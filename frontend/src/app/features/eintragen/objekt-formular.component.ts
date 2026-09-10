import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import type { Farbe, Sichtbarkeit } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ColorSwatchesComponent, FormFieldComponent, SegmentedComponent } from '../../ui';
import { farbFelder, farbeAusHex, farbeHex } from '../eintraege/farben';
import { sichtbarkeitSegmente } from './sichtbarkeit';

/** Was ein Marker und eine Zone gemeinsam haben. */
export interface ObjektWerte {
  name: string;
  farbe: Farbe;
  notiz: string | null;
  sichtbarkeit: Sichtbarkeit;
}

/**
 * Name, Farbe, Notiz und Sichtbarkeit: die Felder, die Marker und Zone teilen
 * (Artboards `Zone` und Konzept „Marker und Zonen“).
 *
 * Die Fußleiste steht außen, denn ein neues Objekt speichert und bricht ab,
 * ein vorhandenes speichert, bearbeitet und löscht.
 */
@Component({
  selector: 'app-objekt-formular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColorSwatchesComponent, FormFieldComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './objekt-formular.component.html',
  styleUrl: './objekt-formular.component.scss',
})
export class ObjektFormularComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  /** Ohne Namensfeld: das Objekt-Blatt trägt den Namen schon als Überschrift. */
  readonly ohneName = input(false);
  readonly nameLabel = input.required<string>();
  readonly namePlatzhalter = input.required<string>();
  /** Der Text, wenn niemand einen Namen eingetragen hat. */
  readonly nameFehltText = input.required<string>();
  readonly start = input<ObjektWerte | null>(null);

  readonly werteChange = output<ObjektWerte>();

  protected readonly name = signal<string | null>(null);
  protected readonly farbe = signal<Farbe | null>(null);
  protected readonly notiz = signal<string | null>(null);
  protected readonly sichtbarkeit = signal<Sichtbarkeit | null>(null);

  protected readonly farben = computed(() => farbFelder(this.i18n));
  protected readonly segmente = computed(() => sichtbarkeitSegmente(this.i18n));

  // Solange niemand ein Feld angefasst hat, führt der Startwert. So bleibt das
  // Formular für ein vorhandenes Objekt gefüllt, ohne es beim Öffnen zu kopieren.
  protected readonly nameWert = computed(() => this.name() ?? this.start()?.name ?? '');
  protected readonly farbeWert = computed(() => this.farbe() ?? this.start()?.farbe ?? 'gruen');
  protected readonly notizWert = computed(() => this.notiz() ?? this.start()?.notiz ?? '');
  protected readonly sichtbarkeitWert = computed(
    () => this.sichtbarkeit() ?? this.start()?.sichtbarkeit ?? 'privat',
  );
  protected readonly farbeHexWert = computed(() => farbeHex(this.farbeWert()));

  /** Liefert die Werte oder `null`, wenn der Name fehlt. */
  werte(): ObjektWerte | null {
    const name = this.nameWert().trim();
    if (name === '') {
      this.toasts.error(this.nameFehltText());
      return null;
    }
    const notiz = this.notizWert().trim();
    return {
      name,
      farbe: this.farbeWert(),
      notiz: notiz === '' ? null : notiz,
      sichtbarkeit: this.sichtbarkeitWert(),
    };
  }

  protected setzeFarbe(hex: string): void {
    this.farbe.set(farbeAusHex(hex));
    this.melde();
  }

  protected setzeSichtbarkeit(wert: string): void {
    this.sichtbarkeit.set(wert === 'geteilt' ? 'geteilt' : 'privat');
    this.melde();
  }

  protected setzeName(wert: string): void {
    this.name.set(wert);
    this.melde();
  }

  protected setzeNotiz(wert: string): void {
    this.notiz.set(wert);
    this.melde();
  }

  /** Die Vorschau auf der Karte folgt der Farbe, ohne auf Speichern zu warten. */
  private melde(): void {
    this.werteChange.emit({
      name: this.nameWert().trim(),
      farbe: this.farbeWert(),
      notiz: this.notizWert().trim() || null,
      sichtbarkeit: this.sichtbarkeitWert(),
    });
  }
}
