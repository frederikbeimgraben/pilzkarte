{
  description = "Pilzkarte: Entwicklungsumgebungen fuer Backend und Frontend";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systeme = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      fuerAlle = f: nixpkgs.lib.genAttrs systeme (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = fuerAlle (
        pkgs:
        let
          # Was ein fertiges Rad zur Laufzeit nachlaedt. Ohne libstdc++ scheitert
          # greenlet, und damit schon die erste Migration.
          laufzeit = with pkgs; [
            stdenv.cc.cc.lib
            zlib
          ];

          backendWerkzeuge = with pkgs; [
            python313
            ruff
            basedpyright
            git
          ];

          frontendWerkzeuge = with pkgs; [
            nodejs_24
            git
          ];

          # uv und npm holen fertige Binaerpakete (ruff, basedpyright, esbuild).
          # Die suchen ihren Lader unter /lib64 und finden auf NixOS nur einen
          # Stummel, der abbricht. Der Aufruf laeuft darum in einem FHS-Baum, in
          # dem es /lib64 und die Bibliotheken oben gibt. Der Rest der Sitzung
          # bleibt eine gewoehnliche Schale.
          imFhs =
            befehl: werkzeuge:
            pkgs.buildFHSEnv {
              name = befehl;
              targetPkgs = _: werkzeuge ++ laufzeit;
              runScript = befehl;
            };

          uvImFhs = imFhs "uv" ([ pkgs.uv ] ++ backendWerkzeuge);

          nodeImFhs = map (befehl: imFhs befehl frontendWerkzeuge) [
            "node"
            "npm"
            "npx"
          ];

          # Der Dienst laeuft auf dem Python 3.13 aus nixpkgs. Die Umgebung hier
          # nimmt dasselbe, statt sich ein eigenes zu laden.
          uvUmgebung = {
            UV_PYTHON = "${pkgs.python313}/bin/python3.13";
            UV_PYTHON_DOWNLOADS = "never";
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath laufzeit;
          };
        in
        {
          backend = pkgs.mkShell (
            uvUmgebung
            // {
              packages = [ uvImFhs ] ++ backendWerkzeuge;
            }
          );

          frontend = pkgs.mkShell {
            packages = nodeImFhs ++ [ pkgs.git ];
          };

          default = pkgs.mkShell (
            uvUmgebung
            // {
              packages = [ uvImFhs ] ++ nodeImFhs ++ backendWerkzeuge;
            }
          );
        }
      );
    };
}
