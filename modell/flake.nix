{
  description = "Fruiting-body occurrence prediction for German macrofungi";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        # The download scripts under src/pilze use the standard library only,
        # so they run with a plain python. These environments are for the steps
        # that read the grids and fit the models.
        #
        # The packages come from nixpkgs, not from pip. Wheels built for glibc
        # fail on NixOS because they cannot find libstdc++.
        #
        # Three shells exist. The default shell holds what the model needs and
        # builds from the binary cache. The geo shell adds GDAL, rasterio and
        # geopandas, which nixpkgs may have to build from source. The test
        # shell is the small one, see below.
        corePackages =
          ps: with ps; [
            numpy
            pandas
            pyarrow
            duckdb
            xarray
            netcdf4
            scipy
            scikit-learn
            matplotlib
            pyproj
            tqdm
            httpx
            lightgbm
            ipython
            pytest
          ];

        python = pkgs.python312.withPackages corePackages;

        pythonGeo = pkgs.python312.withPackages (
          ps:
          corePackages ps
          ++ (with ps; [
            geopandas
            rasterio
            shapely
          ])
        );

        # The tests touch manifest.py and arten_zaehlen.py only. The full
        # shell made the CI job wait three minutes for lightgbm, scipy and
        # matplotlib, which no test loads.
        pythonTest = pkgs.python312.withPackages (
          ps: with ps; [
            numpy
            pandas
            pyarrow
            pillow
            pytest
          ]
        );

      in
      {
        devShells = {
          default = pkgs.mkShell {
            packages = [
              python
              pkgs.jq
            ];
            shellHook = ''
              echo "pilze dev shell — python $(python --version 2>&1 | cut -d' ' -f2)"
              echo "  fetchers:  python src/pilze/gbif_fetch.py --help"
              echo "  raster work needs: nix develop .#geo"
            '';
          };

          # The shell that CI runs: nix develop ./modell#test. No compiler in
          # it: the tests import wheels that nixpkgs already built, and stdenv
          # is 390 MB of the download.
          test = pkgs.mkShellNoCC { packages = [ pythonTest ]; };

          # Raster work: cutting the DEM and the soil grids to the model cells.
          geo = pkgs.mkShell {
            packages = [
              pythonGeo
              pkgs.gdal
              pkgs.osmium-tool
              pkgs.jq
            ];
            shellHook = ''
              echo "pilze geo shell — gdal, rasterio, geopandas, osmium"
            '';
          };
        };
      }
    );
}
