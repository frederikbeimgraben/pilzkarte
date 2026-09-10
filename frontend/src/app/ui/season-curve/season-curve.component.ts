import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Die Marken auf der Grundlinie stehen am Anfang der Monate Jan, Mär, … Nov. */
const MONATSMARKEN = [0, 9, 18, 27, 36, 44] as const;

/** Der Anteil des stärksten Wertes, unter dem eine Woche als dünn gilt. */
const DUENN_UNTER = 0.25;

/**
 * Zentriertes gleitendes Mittel. Am Rand zählen die Nachbarn, die es gibt,
 * sonst zöge eine gedachte Null die erste und die letzte Woche nach unten.
 */
export function glaette(reihe: readonly number[], fenster: number): readonly number[] {
  if (fenster <= 1) return reihe;
  const halb = Math.floor(fenster / 2);
  return reihe.map((_, i) => {
    const von = Math.max(0, i - halb);
    const bis = Math.min(reihe.length - 1, i + halb);
    let summe = 0;
    for (let k = von; k <= bis; k++) summe += reihe[k];
    return summe / (bis - von + 1);
  });
}

let naechsteNummer = 0;

/** Ein Streifen über einer Woche, die auf wenigen Begehungen ruht. */
interface Streifen {
  x: number;
  breite: number;
}

/** Eine Monatsmarke unter der Kurve: der Name und die Woche, in der er beginnt. */
export interface Monatsmarke {
  text: string;
  woche: number;
}

/** Eine gesetzte Monatsmarke: Anteil der Breite, auf dem sie sitzt. */
interface GesetzteMarke {
  text: string;
  links: number;
}

interface Zeichnung {
  breite: number;
  hoehe: number;
  alleJahre: string;
  laufendFlaeche: string;
  laufendLinie: string;
  hatLaufend: boolean;
  marken: number[];
  /** Der Endpunkt als Anteil der Fläche, in Prozent. Er steht neben dem SVG,
   * weil die verzerrte Zeichenfläche aus einem Kreis eine Ellipse machte. */
  endeLinks: number;
  endeOben: number;
  duenn: Streifen[];
}

/**
 * Die Saisonkurve einer Art: der Anteil der Begehungen mit Fund je
 * Kalenderwoche. Alle Jahre liegen schwach als Fläche darunter, das laufende
 * Jahr als Linie bis zur letzten vollen Woche. Beide Reihen teilen sich einen
 * Höchstwert, sonst ragte die eine über den Rand.
 *
 * Sind die Begehungen je Woche bekannt, verblassen die Wochen, die auf wenigen
 * Begehungen ruhen. Ohne diese Zahlen sähe eine Woche mit drei Begehungen aus
 * wie eine mit dreihundert.
 *
 * Die Zeichenfläche folgt der Breite des Wirts, damit die Kurve nie schmal in
 * der Mitte steht, während die Marken darunter über die ganze Breite laufen.
 * Was dabei nicht verzerren darf — die Zahl an der Achse und der Endpunkt —
 * steht neben dem SVG und nicht darin.
 *
 * Gezeichnet wird ein gleitendes Mittel über drei Wochen. Eine Woche mehr oder
 * weniger ist Zufall des Meldeverhaltens, nicht der Saison. Die Achse behält
 * den Höchstwert der Rohdaten, damit die Zahl neben der Kurve dieselbe ist wie
 * in der Liste.
 */
@Component({
  selector: 'app-season-curve',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-curve.component.html',
  styleUrl: './season-curve.component.scss',
})
export class SeasonCurveComponent {
  readonly alleJahre = input.required<readonly number[]>();
  readonly laufendesJahr = input.required<readonly number[]>();
  readonly beschriftung = input.required<string>();
  readonly gross = input(false);
  /** Der Höchstwert der Achse, oben links in die Kurve geschrieben. */
  readonly achse = input<string>();
  /** Die Monatsnamen unter der Grundlinie, jeder auf seiner Woche. */
  readonly monate = input<readonly Monatsmarke[]>([]);
  readonly legendeLaufend = input<string>();
  readonly legendeJahre = input<string>();
  /** Der Nenner der Fläche: Begehungen je Kalenderwoche über alle Jahre. */
  readonly begehungenAlleJahre = input<readonly number[]>([]);
  /** Der Nenner der Linie: Begehungen je Kalenderwoche im laufenden Jahr. */
  readonly begehungenLaufendesJahr = input<readonly number[]>([]);
  /** Breite des gleitenden Mittels in Wochen. 1 zeichnet die Rohwerte. */
  readonly glaettung = input(3);

  private readonly i18n = inject(I18nService);

  protected readonly maskeId = `funke-dicht-${naechsteNummer++}`;
  protected readonly zeichnung = computed<Zeichnung>(() => this.rechne());

  private rechne(): Zeichnung {
    const gross = this.gross();
    const breite = gross ? 330 : 88;
    const hoehe = gross ? 72 : 36;
    const fenster = this.glaettung();
    const alle = glaette(this.alleJahre(), fenster);
    const laufend = glaette(this.laufendesJahr(), fenster);
    // Der Höchstwert kommt aus den Rohdaten, nicht aus der geglätteten Reihe.
    // Sonst stiege die Kurve über die Zahl an der Achse hinaus.
    // Ein Höchstwert von 0 teilte durch null; darum die kleinste Zahl als Boden.
    const top = Math.max(...this.alleJahre(), ...this.laufendesJahr(), Number.EPSILON);
    const punkt = (i: number, wert: number): [number, number] => [
      (i / 51) * breite,
      hoehe - 3 - (wert / top) * (hoehe - 8),
    ];
    const alleP = alle.map((wert, i) => punkt(i, wert));
    const laufendP = laufend.map((wert, i) => punkt(i, wert));
    const letzte = laufendP.at(-1) ?? [0, hoehe];
    return {
      breite,
      hoehe,
      alleJahre: `M0,${hoehe} ${alleP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${breite},${hoehe} Z`,
      laufendFlaeche: `M0,${hoehe} ${laufendP.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${letzte[0].toFixed(1)},${hoehe} Z`,
      laufendLinie: `M${laufendP.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`,
      hatLaufend: laufendP.length > 0,
      marken: MONATSMARKEN.map((k) => (k / 51) * breite),
      endeLinks: (letzte[0] / breite) * 100,
      endeOben: (letzte[1] / hoehe) * 100,
      duenn: this.duenneWochen(breite),
    };
  }

  /**
   * Die Monatsmarken auf derselben Skala wie die Kurve: Woche 1 ganz links,
   * Woche 52 ganz rechts. Als Anteil, damit die Marke bei jeder Breite unter
   * ihrer Woche steht.
   */
  protected readonly monatsmarken = computed<GesetzteMarke[]>(() =>
    this.monate().map((marke) => ({
      text: marke.text,
      links: ((marke.woche - 1) / 51) * 100,
    })),
  );

  protected glaettungText(): string {
    return this.i18n.translate('saison.geglaettet', { wochen: this.glaettung() });
  }

  /**
   * Die Wochen, in denen wenigstens eine der beiden Reihen auf wenigen
   * Begehungen ruht. Jede Reihe misst sich an ihrer eigenen stärksten Woche,
   * weil das laufende Jahr naturgemäß weniger Begehungen trägt als zehn Jahre.
   */
  private duenneWochen(breite: number): Streifen[] {
    const reihen = [this.begehungenAlleJahre(), this.begehungenLaufendesJahr()].filter(
      (reihe) => reihe.length > 0,
    );
    if (reihen.length === 0) return [];
    const schwellen = reihen.map((reihe) => Math.max(...reihe) * DUENN_UNTER);
    const schritt = breite / 51;
    const streifen: Streifen[] = [];
    for (let i = 0; i < Math.max(...reihen.map((reihe) => reihe.length)); i++) {
      const duenn = reihen.some((reihe, r) => i < reihe.length && reihe[i] < schwellen[r]);
      if (!duenn) continue;
      const x = Math.max(0, (i - 0.5) * schritt);
      streifen.push({ x, breite: Math.min(breite, (i + 0.5) * schritt) - x });
    }
    return streifen;
  }
}
