import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DialogComponent, ToastService } from '@stupa-makers/ui-kit';
import type { Marker } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, NoteComponent } from '../../ui';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { ObjektFormularComponent, type ObjektWerte } from '../eintragen/objekt-formular.component';
import { sichtbarkeitText } from '../eintragen/sichtbarkeit';

/**
 * Das Objekt-Blatt eines Markers: Name, Farbe, Sichtbarkeit, Notiz. Es folgt
 * dem Artboard `Zone`, nur ohne Fläche und ohne Kennzahlen.
 */
@Component({
  selector: 'app-marker-blatt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, DialogComponent, NoteComponent, ObjektFormularComponent, TranslatePipe],
  templateUrl: './marker-blatt.component.html',
  styleUrl: './marker-blatt.component.scss',
})
export class MarkerBlattComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EintraegeZustand);

  private readonly formular = viewChild(ObjektFormularComponent);

  readonly marker = input.required<Marker>();

  readonly zeigeAufKarte = output<readonly [number, number]>();
  readonly geschlossen = output();

  protected readonly loeschFrage = signal(false);
  protected readonly beschaeftigt = signal(false);

  protected readonly ort = computed<readonly [number, number]>(() => [this.marker().lon, this.marker().lat]);

  protected readonly unterzeile = computed(() =>
    this.i18n.translate('marker.unter', {
      sichtbarkeit: sichtbarkeitText(this.i18n, this.marker().sichtbarkeit),
    }),
  );

  protected readonly start = computed<ObjektWerte>(() => {
    const marker = this.marker();
    return {
      name: marker.name,
      farbe: marker.farbe,
      notiz: marker.notiz,
      sichtbarkeit: marker.sichtbarkeit,
    };
  });

  protected async speichere(): Promise<void> {
    const werte = this.formular()?.werte();
    if (!werte) return;
    this.beschaeftigt.set(true);
    try {
      if (await this.eintraege.aendereMarker(this.marker().id, werte)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
      }
    } finally {
      this.beschaeftigt.set(false);
    }
  }

  protected async loesche(): Promise<void> {
    this.loeschFrage.set(false);
    if (await this.eintraege.loescheMarker(this.marker().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.geschlossen.emit();
    }
  }
}
