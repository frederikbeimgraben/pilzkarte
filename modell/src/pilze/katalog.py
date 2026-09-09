#!/usr/bin/env python3
"""The species catalogue of the map: one profile per modelled species.

The profiles are written for this project. They name what to look at, where
the species grows, when it fruits in the data of this map, what it can be
confused with and what the law says. They are not an identification key.
Every profile links to the detail page of 123pilzsuche.de where one exists,
and to Wikipedia; the texts there belong to their authors and are not copied.

The season curve comes from the training finds of the map: the positive
visits per calendar week, all years together.

Usage:
    python katalog.py            prints the catalogue as JSON
"""

from __future__ import annotations

import json
from pathlib import Path

P123 = "https://123pilzsuche.de/daten/details/"
WIKI = "https://de.wikipedia.org/wiki/"
DGFM = "https://www.dgfm-ev.de/pilzsachverstaendige"

SCHUTZ_BARTSCHV = ("Besonders geschützt nach Bundesartenschutzverordnung. Sammeln nur in "
                   "geringen Mengen für den eigenen Bedarf, nicht in Schutzgebieten.")
KEIN_SCHUTZ = "Nicht besonders geschützt. Es gelten die Regeln des Landes und des Waldbesitzers."

KATALOG = [
    {
        "slug": "boletus_edulis", "name": "Steinpilz", "latein": "Boletus edulis",
        "gruppe": "Röhrling", "baeume": ["Fichte", "Kiefer", "Buche", "Eiche"],
        "kurz": "Der Klassiker: brauner Hut, dicker Stiel mit weißem Netz, Röhren erst weiß, dann gelbgrün.",
        "erkennen": [
            "Hut 6 bis 25 cm, hell- bis dunkelbraun, oft mit hellerem Rand, jung halbkugelig.",
            "Stiel bauchig, blass, mit feinem weißem Netz vor allem oben.",
            "Röhren jung weiß, später gelb bis olivgrün. Fleisch weiß, verfärbt sich nicht.",
            "Geruch angenehm pilzig, Geschmack mild und nussig.",
        ],
        "wo": "Mykorrhiza mit Fichte, Kiefer, Buche und Eiche, in Wäldern jeden Alters, gern an Wegrändern und lichten Stellen.",
        "verwechslung": [
            ("Gallenröhrling (Tylopilus felleus)", "Röhren rosa, Stielnetz dunkel und grob, Geschmack sehr bitter. Ungiftig, verdirbt aber jedes Gericht."),
            ("Sommersteinpilz (Boletus reticulatus)", "Heller, feiner genetzt, Hut oft felderig rissig, ab Juni. Ebenso essbar."),
        ],
        "schutz": SCHUTZ_BARTSCHV,
        "links": [("123pilzsuche: Steinpilze", P123 + "Steinpilze.htm"), ("Wikipedia", WIKI + "Gemeiner_Steinpilz")],
    },
    {
        "slug": "pfifferling", "name": "Pfifferling", "latein": "Cantharellus cibarius",
        "gruppe": "Leistling", "baeume": ["Fichte", "Buche", "Eiche", "Kiefer"],
        "kurz": "Dottergelb, mit Leisten statt Lamellen, die am Stiel herablaufen, und einem Duft nach Aprikose.",
        "erkennen": [
            "Hut 2 bis 10 cm, dottergelb, jung gewölbt, später trichterig mit welligem Rand.",
            "Unterseite mit gabeligen Leisten, keine echten Lamellen, weit am Stiel herablaufend.",
            "Fleisch weißlich bis blassgelb, fest. Geruch fruchtig nach Aprikose.",
        ],
        "wo": "Mykorrhiza mit Fichte, Buche, Eiche und Kiefer, auf sauren, moosigen Böden, oft an Hängen und unter Heidelbeere.",
        "verwechslung": [
            ("Falscher Pfifferling (Hygrophoropsis aurantiaca)", "Orange statt dottergelb, echte, dünne und gedrängte Lamellen, weiches Fleisch. Nicht giftig, aber wertlos."),
            ("Ölbaumpilz (Omphalotus olearius)", "Wächst büschelig an Holz, echte Lamellen, giftig. In Deutschland selten, im Süden häufiger."),
        ],
        "schutz": SCHUTZ_BARTSCHV,
        "links": [("Wikipedia", WIKI + "Echter_Pfifferling")],
    },
    {
        "slug": "birkenpilz", "name": "Birkenpilz", "latein": "Leccinum scabrum",
        "gruppe": "Raufußröhrling", "baeume": ["Birke"],
        "kurz": "Graubrauner Hut, weißlicher Stiel mit dunklen Schüppchen, immer bei Birken.",
        "erkennen": [
            "Hut 5 bis 15 cm, grau- bis dunkelbraun, glatt, bei Nässe schmierig.",
            "Stiel schlank, weißlich, mit dunklen bis schwarzen Schuppen rau besetzt.",
            "Röhren weiß, im Alter grau. Fleisch weich, verfärbt sich kaum.",
        ],
        "wo": "Streng an Birke gebunden, in Wäldern, Mooren, Parks und an Straßenrändern, wo Birken stehen.",
        "verwechslung": [
            ("Andere Raufußröhrlinge, etwa Rotkappen", "Orange oder rote Hüte, Fleisch verfärbt sich beim Anschnitt. Alle Arten der Gattung sind essbar."),
            ("Gallenröhrling (Tylopilus felleus)", "Stiel mit Netz statt Schuppen, Röhren rosa, bitter."),
        ],
        "schutz": KEIN_SCHUTZ,
        "links": [("123pilzsuche: Birkenpilz", P123 + "Birkenpilz.htm"), ("Wikipedia", WIKI + "Gemeiner_Birkenpilz")],
    },
    {
        "slug": "reizker", "name": "Reizker", "latein": "Lactarius deliciosus, deterrimus, salmonicolor, semisanguifluus",
        "gruppe": "Milchling", "baeume": ["Kiefer", "Fichte", "Tanne"],
        "kurz": "Orange Milchlinge mit orangeroter Milch, die an Kiefer, Fichte oder Tanne wachsen.",
        "erkennen": [
            "Hut 4 bis 15 cm, orange mit dunkleren Zonen, in der Mitte vertieft, verletzt oft grünfleckig.",
            "Milch beim Anschnitt orange bis karottenrot, bei manchen Arten später weinrot.",
            "Lamellen orange, am Stiel angewachsen. Stiel kurz, hohl, oft grubig.",
        ],
        "wo": "Edelreizker bei Kiefer, Fichtenreizker bei Fichte, Lachsreizker bei Tanne. Gern an Wegrändern und in jungen Beständen.",
        "verwechslung": [
            ("Birkenreizker (Lactarius torminosus)", "Milch weiß, Hutrand zottig behaart, bei Birke. Roh giftig, verursacht Magen-Darm-Beschwerden."),
            ("Andere Milchlinge", "Milch weiß oder wässrig. Orange Milch ist das sichere Merkmal der Reizker."),
        ],
        "schutz": KEIN_SCHUTZ,
        "links": [("123pilzsuche: Edelreizker", P123 + "Edelreizker.htm"), ("123pilzsuche: Fichtenreizker", P123 + "Fichtenreizker.htm"), ("Wikipedia", WIKI + "Edel-Reizker")],
    },
    {
        "slug": "hexen_flock", "name": "Flockenstieliger Hexenröhrling", "latein": "Neoboletus erythropus",
        "gruppe": "Röhrling", "baeume": ["Fichte", "Buche", "Tanne"],
        "kurz": "Dunkler Hut, rote Röhrenmündungen, Stiel mit roten Flocken ohne Netz, blaut sofort tief.",
        "erkennen": [
            "Hut 6 bis 20 cm, dunkelbraun, samtig, jung mit eingerolltem Rand.",
            "Röhrenmündungen orange bis blutrot, Röhren gelb. Fleisch gelb, blaut beim Anschnitt sofort dunkelblau.",
            "Stiel gelb mit feinen roten Flocken, kein Netz. Das trennt ihn vom Netzstieligen.",
        ],
        "wo": "Mykorrhiza mit Fichte, Tanne und Buche, auf sauren Böden, in Nadel- und Mischwäldern, oft schon ab Juni.",
        "verwechslung": [
            ("Netzstieliger Hexenröhrling (Suillellus luridus)", "Stiel mit rotem Netz, kalkliebend. Nur gut gegart essbar."),
            ("Satansröhrling (Rubroboletus satanas)", "Hut hell grauweiß, Stiel mit rotem Netz, auf Kalk unter Buche und Eiche. Giftig."),
        ],
        "schutz": KEIN_SCHUTZ + " Nur gut durchgegart essbar, roh giftig.",
        "links": [("Wikipedia", WIKI + "Flockenstieliger_Hexen-Röhrling")],
    },
    {
        "slug": "hexen_netz", "name": "Netzstieliger Hexenröhrling", "latein": "Suillellus luridus",
        "gruppe": "Röhrling", "baeume": ["Eiche", "Buche", "Linde"],
        "kurz": "Rote Röhrenmündungen und ein rotes Netz auf dem Stiel, auf Kalk unter Laubbäumen, blaut stark.",
        "erkennen": [
            "Hut 5 bis 20 cm, olivbraun bis graubraun, matt, oft mit rötlichem Ton.",
            "Röhrenmündungen rot bis orange, Röhren gelb. Fleisch blaut kräftig, über den Röhren eine rote Linie.",
            "Stiel gelb bis rötlich mit grobem, rotem Netz.",
        ],
        "wo": "Kalkliebend, bei Eiche, Buche und Linde, auch in Parks und an Alleen. Beginnt früher im Jahr als die meisten Röhrlinge.",
        "verwechslung": [
            ("Satansröhrling (Rubroboletus satanas)", "Hut auffallend hell, kreidig weißgrau, dicker Stiel. Giftig."),
            ("Flockenstieliger Hexenröhrling (Neoboletus erythropus)", "Stiel geflockt statt genetzt, saure Böden."),
        ],
        "schutz": KEIN_SCHUTZ + " Nur gut durchgegart essbar; zusammen mit Alkohol werden Beschwerden berichtet.",
        "links": [("123pilzsuche: Netzstieliger Hexenröhrling", P123 + "NetzstieligeHexenroehrling.htm"), ("Wikipedia", WIKI + "Netzstieliger_Hexen-Röhrling")],
    },
    {
        "slug": "parasol", "name": "Parasol", "latein": "Macrolepiota procera",
        "gruppe": "Riesenschirmling", "baeume": [],
        "kurz": "Großer Schirm mit braunen Schuppen, genatterter Stiel und ein verschiebbarer Ring, auf Wiesen und an Waldrändern.",
        "erkennen": [
            "Hut 10 bis 30 cm, jung wie ein Paukenschlegel, aufgeschirmt flach mit Buckel, mit groben braunen Schuppen auf hellem Grund.",
            "Stiel lang, braun genattert wie Schlangenhaut, mit knolliger Basis und einem dicken, verschiebbaren Ring.",
            "Lamellen weiß, frei, Fleisch weiß und bleibt weiß.",
        ],
        "wo": "Wiesen, Weiden, Waldränder, lichte Wälder, gern auf nährstoffarmen Böden. Kein Wirtsbaum, ein Zersetzer.",
        "verwechslung": [
            ("Safranschirmling (Chlorophyllum rhacodes)", "Kleiner, Stiel glatt ohne Natterung, Fleisch rötet beim Anschnitt. Verträgt nicht jeder."),
            ("Kleine Schirmlinge (Lepiota)", "Hut unter 10 cm, Stiel nicht genattert. Mehrere Arten sind tödlich giftig. Ein Parasol ist groß und genattert."),
        ],
        "schutz": KEIN_SCHUTZ,
        "links": [("123pilzsuche: Parasol", P123 + "Parasol.htm"), ("Wikipedia", WIKI + "Gemeiner_Riesenschirmling")],
    },
    {
        "slug": "nebelkappe", "name": "Nebelkappe", "latein": "Clitocybe nebularis",
        "gruppe": "Trichterling", "baeume": ["Buche", "Fichte"],
        "kurz": "Grauer Hut, gedrängte, herablaufende helle Lamellen und ein süßlich-dumpfer Geruch, spät im Jahr in Reihen und Ringen.",
        "erkennen": [
            "Hut 6 bis 20 cm, nebelgrau bis graubraun, jung bereift, Rand lange eingerollt.",
            "Lamellen cremeweiß, sehr gedrängt, am Stiel herablaufend, leicht ablösbar.",
            "Stiel keulig, faserig. Geruch auffallend süßlich, für viele unangenehm.",
        ],
        "wo": "In der Laub- und Nadelstreu, oft in Hexenringen und langen Reihen, unter Buche und Fichte, im Spätherbst bis zum Frost.",
        "verwechslung": [
            ("Riesenrötling (Entoloma sinuatum)", "Lamellen erst gelblich, dann rosa, nicht herablaufend, Geruch mehlig. Stark giftig."),
            ("Bleiweißer Trichterling (Clitocybe phyllophila)", "Weißer, dünnfleischiger, mehlig riechend. Giftig."),
        ],
        "schutz": KEIN_SCHUTZ + " Speisewert umstritten; viele reagieren mit Magen-Darm-Beschwerden.",
        "links": [("Wikipedia", WIKI + "Nebelkappe")],
    },
    {
        "slug": "flaschenbovist", "name": "Flaschenbovist", "latein": "Lycoperdon perlatum",
        "gruppe": "Stäubling", "baeume": [],
        "kurz": "Birnenförmiger weißer Stäubling mit stacheligen Warzen, der im Alter oben aufreißt und Sporen stäubt.",
        "erkennen": [
            "Fruchtkörper 3 bis 7 cm, flaschen- bis birnenförmig, weiß bis cremefarben, mit abwischbaren Stacheln und Warzen.",
            "Innen jung rein weiß und fest, später gelb, dann olivbraun und pulverig.",
            "Am Scheitel öffnet sich im Alter ein Loch, aus dem die Sporen stäuben.",
        ],
        "wo": "Zersetzer in Wäldern aller Art, an Wegrändern, auf Lichtungen, oft in Gruppen.",
        "verwechslung": [
            ("Kartoffelbovist (Scleroderma)", "Derbe, gelbbraune Haut, innen früh schwarzviolett marmoriert. Giftig."),
            ("Junge Knollenblätterpilze im Ei", "Längs durchschneiden: im Ei zeichnet sich Hut und Stiel ab, ein Stäubling ist innen gleichmäßig weiß."),
        ],
        "schutz": KEIN_SCHUTZ + " Nur jung essbar, solange das Innere rein weiß ist.",
        "links": [("123pilzsuche: Flaschenstäubling", P123 + "Flaschenstaeubling.htm"), ("Wikipedia", WIKI + "Flaschen-Stäubling")],
    },
    {
        "slug": "schleimruebling", "name": "Buchen-Schleimrübling", "latein": "Mucidula mucida",
        "gruppe": "Schleimrübling", "baeume": ["Buche"],
        "kurz": "Weiße, glasig schleimige Hüte mit Ring, büschelig an Buchenstämmen und Ästen.",
        "erkennen": [
            "Hut 2 bis 8 cm, weiß bis grauweiß, durchscheinend, dick schleimig.",
            "Stiel weiß mit häutigem Ring, zäh, am Holz ansitzend.",
            "Lamellen weiß, breit und entfernt stehend.",
        ],
        "wo": "Auf Buche, an stehenden und liegenden Stämmen, an toten Ästen auch hoch oben in der Krone. Eine Anzeigerart für Buchenwald.",
        "verwechslung": [
            ("Keine gefährliche", "Weiß, schleimig, beringt und an Buchenholz: die Kombination ist eindeutig."),
        ],
        "schutz": KEIN_SCHUTZ + " Essbar, aber ohne Wert.",
        "links": [("123pilzsuche: Beringter Schleimrübling", P123 + "BeringterSchleimruebling.htm"), ("Wikipedia", WIKI + "Buchen-Schleimrübling")],
    },
    {
        "slug": "schopftintling", "name": "Schopftintling", "latein": "Coprinus comatus",
        "gruppe": "Tintling", "baeume": [],
        "kurz": "Weißer, walzenförmiger Hut mit zottigen Schuppen an Wegrändern und auf Rasen, der sich in schwarze Tinte auflöst.",
        "erkennen": [
            "Hut 5 bis 15 cm hoch, jung geschlossen walzenförmig, weiß mit abstehenden Schuppen und ockerfarbenem Scheitel.",
            "Lamellen weiß, dann rosa, dann schwarz, vom Rand her zerfließend.",
            "Stiel weiß, hohl, mit beweglichem Ring.",
        ],
        "wo": "Wegränder, Rasen, Parks, Schutthalden, frisch bewegte Böden. Kein Waldpilz, darum zeigt die Karte ihn ohne Waldmaske.",
        "verwechslung": [
            ("Faltentintling (Coprinopsis atramentaria)", "Grau, glatt, ohne Schuppen, büschelig. Zusammen mit Alkohol giftig."),
        ],
        "schutz": KEIN_SCHUTZ + " Nur jung essbar, solange die Lamellen weiß sind, und am selben Tag.",
        "links": [("123pilzsuche: Schopftintling", P123 + "Schopftintling.htm"), ("Wikipedia", WIKI + "Schopf-Tintling")],
    },
]


def saison(maps: Path, slug: str) -> list[int]:
    """Positive training visits per calendar week, all years together."""
    datei = maps / "funde" / f"{slug}.json"
    wochen = [0] * 53
    if not datei.exists():
        return wochen
    daten = json.loads(datei.read_text())
    spalten = daten["columns"]
    kw, n = spalten.index("week"), spalten.index("n")
    for zeile in daten["rows"]:
        if 1 <= zeile[kw] <= 52:
            wochen[zeile[kw]] += zeile[n]
    return wochen


def katalog(maps: Path) -> list[dict]:
    """The catalogue with the season curve, ready for the page."""
    aus = []
    for art in KATALOG:
        wochen = saison(maps, art["slug"])
        eintrag = dict(art)
        eintrag["verwechslung"] = [{"art": a, "merkmal": m} for a, m in art["verwechslung"]]
        eintrag["links"] = [{"titel": t, "url": u} for t, u in art["links"]]
        eintrag["saison"] = wochen[1:53]
        eintrag["peak"] = max(range(1, 53), key=lambda w: wochen[w]) if any(wochen) else None
        eintrag["funde"] = sum(wochen)
        aus.append(eintrag)
    return aus


if __name__ == "__main__":
    print(json.dumps(katalog(Path("reports/maps")), ensure_ascii=False, indent=1))
