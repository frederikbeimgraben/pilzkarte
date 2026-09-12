#!/usr/bin/env node
/**
 * Sucht deutsche Stämme in den Bezeichnern von `src/app`.
 *
 * Bezeichner sind englisch (`CLAUDE.md`). Deutsch steht nur in dem, was eine
 * Person liest: Oberflächentexte über i18n, Kommentare und Docstrings. Das
 * Skript trennt beides und meldet nur, was im Code steht.
 *
 * Ausgenommen bleiben die Feldnamen des Vertrags zum Backend, die Werte der
 * Aufzählungen und die i18n-Schlüssel: die nimmt sich R3 vor.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const WURZEL = new URL('../src/app', import.meta.url).pathname;

/** Stämme, die in einem Bezeichner nichts zu suchen haben. */
const STAEMME = [
  'aender',
  'anmeld',
  'anzeig',
  'arbeiter',
  'attrappe',
  'auftrag',
  'auswahl',
  'baue',
  'begehung',
  'beschriftung',
  'bild',
  'blatt',
  'dateien',
  'deckkraft',
  'dienst',
  'dunkel',
  'ebene',
  'eingabe',
  'eintrag',
  'faerbe',
  'farbe',
  'feld',
  'fehler',
  'flaeche',
  'foto',
  'fund',
  'fuss',
  'griff',
  'gruppe',
  'hell',
  'hintergrund',
  'hinweis',
  'hoehe',
  'jahr',
  'kachel',
  'karte',
  'knopf',
  'kombi',
  'konto',
  'kopf',
  'kurve',
  'lade',
  'leiste',
  'liste',
  'loesch',
  'melde',
  'merkmal',
  'nutzer',
  'objekt',
  'oeffne',
  'ordner',
  'pfad',
  'punkt',
  'quelle',
  'rampe',
  'rand',
  'raste',
  'reihe',
  'saison',
  'schicht',
  'schliess',
  'schritt',
  'schwelle',
  'sende',
  'sicht',
  'speicher',
  'sprache',
  'stufe',
  'suche',
  'tausch',
  'ueber',
  'vorlage',
  'waehl',
  'wahl',
  'warte',
  'wert',
  'woche',
  'zeichn',
  'zeige',
  'zeile',
  'zeit',
  'zurueck',
  'zustand',
  'abfrage',
  'anfrage',
  'anleitung',
  'anteile',
  'ausschnitt',
  'beding',
  'bedingung',
  'beobachter',
  'dienst',
  'durchlauf',
  'einheit',
  'entfern',
  'ereignis',
  'erfuell',
  'ergebnis',
  'fabrik',
  'formular',
  'gefahr',
  'geist',
  'glaett',
  'grenze',
  'groesse',
  'histogramm',
  'horcher',
  'huelle',
  'kandidat',
  'klasse',
  'klassen',
  'kodier',
  'kontroll',
  'kursiv',
  'laenge',
  'leinwand',
  'mehrzeilig',
  'muster',
  'nutzlast',
  'profil',
  'prognose',
  'richtung',
  'sammlung',
  'skala',
  'spitze',
  'stelle',
  'stift',
  'streifen',
  'tabelle',
  'taste',
  'teiler',
  'tippe',
  'umleitung',
  'umleitungen',
  'unbekannt',
  'verstoss',
  'verteilung',
  'verwechslung',
  'vorhanden',
  'vorlage',
  'vorrat',
  'vorschau',
  'wechsel',
  'zelle',
];

/** Englische Woerter, die zufaellig mit einem deutschen Stamm beginnen. */
const ENGLISCH = new Set(['list', 'listener', 'listeners', 'profile', 'random', 'randomuuid']);

/**
 * Was der Vertrag zum Backend, der Speicher im Gerät, die Aufzählungen, die
 * Schlüssel in der Adresse und die Platzhalter der Übersetzungen tragen. Diese
 * Namen wechseln erst mit R3, auf beiden Seiten zugleich.
 */
const VERTRAG = new Set([
  'deckkraft',
  'bedingung',
  'faktoren',
  'aktiv',
  'wertigkeit',
  'quelle',
  'stand',
  'eigen',
  'baeume',
  'stielLaengeCm',
  'sporenLaengeUm',
  'jahreszeiten',
  'unbekanntesAusmass',
  'verwechslung',
  'darstellung',
  'regel',
  'klassen',
  'anteile',
  'histogramm',
  'histogramme',
  'profil',
  'bedingtEssbar',
  'ohneSpeisewert',
  'einheit',
  'objekt',
  'flaeche',
  'wert',
  'art',
  'arten',
  'artSlug',
  'kartenSlug',
  'woche',
  'wochen',
  'jahr',
  'jahre',
  'farbe',
  'notiz',
  'datum',
  'anzahl',
  'fotos',
  'melder',
  'polygon',
  'punkte',
  'breite',
  'hoehe',
  'stufe',
  'gruppe',
  'saison',
  'merkmal',
  'merkmale',
  'schluessel',
  'essbar',
  'sichtbarkeit',
  'flaecheHa',
  'fuerTraining',
  'erstelltAm',
  'geaendertAm',
  'gerundet',
  'hoechstwert',
  'alleJahre',
  'laufendesJahr',
  'begehungen',
  'begehungenMitFund',
  'begehungenJeWocheAlleJahre',
  'begehungenJeWocheLaufendesJahr',
  'spitzeWoche',
  'flaechenmittel',
  'eigeneFunde',
  'verwechslungen',
  'lateinisch',
  'geschuetzt',
  'speisewert',
  'eintraege',
  'gesamt',
  'hell',
  'dunkel',
  'unter',
  'ueber',
  'zwischen',
  'vorhersage',
  'ebene',
  'kombination',
  'fund',
  'marker',
  'zone',
  'geteilt',
  'privat',
  'schnitt',
  'abgestuft',
  'automatisch',
  'titel',
  'zurueck',
  'leisten',
  'zeit',
  'fruchtkoerper',
  'hut',
  'roehren',
  'lamellen',
  'stacheln',
  'poren',
  'milch',
  'stiel',
  'fleisch',
  'geruch',
  'geschmack',
  'sporenpulver',
  'vorkommen',
  'schutz',
  'farben',
  'verfaerbung',
  'zeitraum',
  'beobachteterZeitraum',
  'vonMonat',
  'bisMonat',
  'spitzeMonat',
  'wechseldauer',
  'wechseldauern',
  'einheiten',
  'hutform',
  'hutformen',
  'hutmerkmal',
  'hutmerkmale',
  'hutrand',
  'hutraender',
  'stielmerkmal',
  'stielmerkmale',
  'ueberstehend',
  'entwicklung',
]);

const STELLEN = [];

/** Zerlegt `zeigeGeteilteFunde` und `karte__flaeche` in einzelne Wörter. */
function woerter(bezeichner) {
  return bezeichner
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

function pruefeCode(code, datei, zeile) {
  for (const bezeichner of code.match(/[A-Za-z_$][\w$-]*/g) ?? []) {
    if (VERTRAG.has(bezeichner)) continue;
    for (const wort of woerter(bezeichner)) {
      if (VERTRAG.has(wort) || ENGLISCH.has(wort)) continue;
      const stamm = STAEMME.find((s) => wort.startsWith(s));
      if (stamm) {
        STELLEN.push(`${datei}:${zeile}  ${bezeichner}  (${stamm})`);
        break;
      }
    }
  }
}

/** Ein `/` beginnt einen regulären Ausdruck nur dort, wo kein Wert steht. */
const VOR_REGEX = /(?:^|[(,=:[!&|?{};+\-*%~^<>]|\b(?:return|typeof|case|in|of|do|else|yield|await))$/;

/** Sucht das Ende eines regulären Ausdrucks samt Schaltern. */
function regexEnde(quelle, i) {
  let j = i + 1;
  let klasse = false;
  for (; j < quelle.length; j += 1) {
    const c = quelle[j];
    if (c === '\\') {
      j += 1;
      continue;
    }
    if (c === '\n') return null;
    if (c === '[') klasse = true;
    else if (c === ']') klasse = false;
    else if (c === '/' && !klasse) break;
  }
  if (j >= quelle.length) return null;
  j += 1;
  while (j < quelle.length && /[a-z]/i.test(quelle[j])) j += 1;
  return j;
}

/** Zeichenketten und Kommentare tragen Text für Menschen und bleiben deutsch. */
function ohneTextTs(quelle) {
  let raus = '';
  for (let i = 0; i < quelle.length;) {
    const z = quelle[i];
    if (z === "'" || z === '"' || z === '`') {
      let j = i + 1;
      while (j < quelle.length && quelle[j] !== z) j += quelle[j] === '\\' ? 2 : 1;
      raus += ' '.repeat(j - i + 1).replace(/ /g, ' ');
      i = j + 1;
      continue;
    }
    if (z === '/' && quelle[i + 1] === '/') {
      const j = quelle.indexOf('\n', i);
      const bis = j === -1 ? quelle.length : j;
      raus += ' '.repeat(bis - i);
      i = bis;
      continue;
    }
    if (z === '/' && quelle[i + 1] === '*') {
      const j = quelle.indexOf('*/', i);
      const bis = j === -1 ? quelle.length : j + 2;
      raus += quelle.slice(i, bis).replace(/[^\n]/g, ' ');
      i = bis;
      continue;
    }
    // Ein regulärer Ausdruck sucht nach Text auf dem Schirm.
    if (z === '/' && VOR_REGEX.test(raus.replace(/\s+$/, ''))) {
      const bis = regexEnde(quelle, i);
      if (bis !== null) {
        raus += ' '.repeat(bis - i);
        i = bis;
        continue;
      }
    }
    raus += z;
    i += 1;
  }
  return raus;
}

/** In einer Vorlage bleiben einfache Anführungszeichen und Kommentare außen vor. */
function ohneTextHtml(quelle) {
  return (
    quelle
      .replace(/<!--[\s\S]*?-->/g, (t) => t.replace(/[^\n]/g, ' '))
      .replace(/'(?:[^'\\\n]|\\.)*'/g, (t) => ' '.repeat(t.length))
      // Ein einfacher Attributwert traegt einen Wert, keinen Bezeichner:
      // `icon="suche"` nennt ein Piktogramm.
      .replace(/([\w.\-]+)="([^"]*)"/g, (ganz, name, wert) =>
        name === 'class' ? ganz : name + '="' + ' '.repeat(wert.length) + '"',
      )
  );
}

function gehe(ordner) {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      gehe(pfad);
      continue;
    }
    const endung = extname(pfad);
    if (!['.ts', '.html', '.scss'].includes(endung)) continue;
    const roh = readFileSync(pfad, 'utf8');
    const code = endung === '.html' ? ohneTextHtml(roh) : ohneTextTs(roh);
    const kurz = pfad.slice(WURZEL.length + 1);
    code.split('\n').forEach((zeile, i) => pruefeCode(zeile, kurz, i + 1));
    // Der Dateiname selbst ist auch ein Bezeichner.
    pruefeCode(name.replace(/[.-]/g, ' '), kurz, 0);
  }
}

gehe(WURZEL);

if (STELLEN.length > 0) {
  console.error(`${STELLEN.length} deutsche Bezeichner:`);
  for (const stelle of STELLEN) console.error('  ' + stelle);
  process.exit(1);
}
console.log('Alle Bezeichner in src/app sind englisch.');
