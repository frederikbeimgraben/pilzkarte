import pandas as pd
ARTEN = """Boletus edulis;Steinpilz
Boletus reticulatus;Sommersteinpilz
Boletus pinophilus;Kiefernsteinpilz
Boletus aereus;Schwarzhütiger Steinpilz
Imleria badia;Maronenröhrling
Leccinum scabrum;Birkenpilz
Leccinum versipelle;Birken-Rotkappe
Leccinum aurantiacum;Espen-Rotkappe
Suillus luteus;Butterpilz
Suillus grevillei;Goldröhrling
Suillus bovinus;Kuhröhrling
Suillus granulatus;Körnchenröhrling
Xerocomellus chrysenteron;Rotfußröhrling
Xerocomus subtomentosus;Ziegenlippe
Neoboletus erythropus;Flockenstieliger Hexenröhrling
Suillellus luridus;Netzstieliger Hexenröhrling
Butyriboletus appendiculatus;Anhängselröhrling
Cantharellus cibarius;Pfifferling
Craterellus tubaeformis;Trompetenpfifferling
Craterellus cornucopioides;Totentrompete
Craterellus lutescens;Gelbstieliger Trompetenpfifferling
Hydnum repandum;Semmelstoppelpilz
Hydnum rufescens;Rotgelber Stoppelpilz
Lactarius deliciosus;Edelreizker
Lactarius deterrimus;Fichtenreizker
Lactarius salmonicolor;Lachsreizker
Lactarius volemus;Brätling
Russula cyanoxantha;Frauentäubling
Russula vesca;Speisetäubling
Russula virescens;Grüngefelderter Täubling
Russula claroflava;Gelber Graustieltäubling
Macrolepiota procera;Parasol
Macrolepiota mastoidea;Zitzen-Riesenschirmling
Chlorophyllum rhacodes;Safranschirmling
Agaricus campestris;Wiesenchampignon
Agaricus arvensis;Schafchampignon
Agaricus augustus;Riesenchampignon
Agaricus sylvaticus;Waldchampignon
Coprinus comatus;Schopftintling
Lycoperdon perlatum;Flaschenbovist
Calvatia gigantea;Riesenbovist
Lycoperdon utriforme;Hasenbovist
Clitocybe nebularis;Nebelkappe
Lepista nuda;Violetter Rötelritterling
Lepista personata;Lilastieliger Rötelritterling
Infundibulicybe geotropa;Mönchskopf
Armillaria mellea;Honiggelber Hallimasch
Armillaria ostoyae;Dunkler Hallimasch
Armillaria gallica;Gelbschuppiger Hallimasch
Kuehneromyces mutabilis;Stockschwämmchen
Flammulina velutipes;Samtfußrübling
Pleurotus ostreatus;Austernseitling
Pleurotus pulmonarius;Lungenseitling
Hericium erinaceus;Igelstachelbart
Hericium coralloides;Ästiger Stachelbart
Fistulina hepatica;Ochsenzunge
Laetiporus sulphureus;Schwefelporling
Sparassis crispa;Krause Glucke
Grifola frondosa;Klapperschwamm
Meripilus giganteus;Riesenporling
Cerioporus squamosus;Schuppiger Porling
Marasmius oreades;Nelkenschwindling
Calocybe gambosa;Maipilz
Amanita rubescens;Perlpilz
Amanita fulva;Fuchsiger Scheidenstreifling
Morchella esculenta;Speisemorchel
Morchella elata;Spitzmorchel
Mitrophora semilibera;Käppchenmorchel
Verpa bohemica;Böhmische Verpel
Auricularia auricula-judae;Judasohr
Tricholoma terreum;Erdritterling
Tricholoma portentosum;Schwarzfaseriger Ritterling
Hygrophorus marzuolus;Märzschneckling
Mucidula mucida;Buchen-Schleimrübling
Gomphidius glutinosus;Kuhmaul
Chroogomphus rutilus;Kupferroter Gelbfuß
Cortinarius caperatus;Reifpilz
Lyophyllum decastes;Büscheliger Rasling
Clitopilus prunulus;Mehlräsling
Albatrellus ovinus;Schafporling
Sarcodon imbricatus;Habichtspilz
Aleuria aurantia;Orangebecherling
Leucoagaricus leucothites;Rosablättriger Egerlingsschirmling
Entoloma clypeatum;Schildrötling
Lepista flaccida;Fuchsiger Rötelritterling"""
namen = dict(l.split(";") for l in ARTEN.splitlines())
occ = pd.read_parquet("data/interim/occurrences.parquet", columns=["species", "recordedByHash", "date", "x", "y", "iso_year", "coordinateUncertaintyInMeters"])
gesamt = occ["species"].value_counts()
o = occ[(occ["iso_year"] >= 2015) & occ["recordedByHash"].notna()]
err = o["coordinateUncertaintyInMeters"]; o = o[err.isna() | (err <= 500)]
o = o.assign(visit=o["recordedByHash"].astype(str) + "|" + o["date"].astype(str) + "|" + (o["x"] // 1000).astype(int).astype(str) + "_" + (o["y"] // 1000).astype(int).astype(str))
n_species = o.groupby("visit")["species"].nunique()
gut = set(n_species[n_species >= 2].index)
o2 = o[o["visit"].isin(gut)]
besuche = o2.groupby("species")["visit"].nunique()
rows = []
for lat, de in namen.items():
    rows.append((de, lat, int(gesamt.get(lat, 0)), int(besuche.get(lat, 0))))
df = pd.DataFrame(rows, columns=["deutsch", "latein", "records", "besuche"]).sort_values("besuche", ascending=False)
def stufe(b):
    return "Vorhersage" if b >= 600 else ("Saison" if b >= 60 else "Profil")
df["stufe"] = df["besuche"].map(stufe)
pd.set_option("display.width", 200); pd.set_option("display.max_rows", 200)
print(df.to_string(index=False))
print("\nStufen:", df["stufe"].value_counts().to_dict())
df.to_csv("/home/frederik/.claude/jobs/a0eac465/tmp/arten_stufen.csv", index=False)
