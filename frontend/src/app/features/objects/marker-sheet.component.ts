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
import { EntriesState } from '../entries/entries.state';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { visibilityText } from '../add-entry/visibility';

/**
 * Das Objekt-Blatt eines Markers: Name, Farbe, Sichtbarkeit, Notiz. Es folgt
 * dem Artboard `Zone`, nur ohne Fläche und ohne Kennzahlen.
 */
@Component({
  selector: 'app-marker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, DialogComponent, NoteComponent, ObjectFormComponent, TranslatePipe],
  templateUrl: './marker-sheet.component.html',
  styleUrl: './marker-sheet.component.scss',
})
export class MarkerSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EntriesState);

  private readonly form = viewChild(ObjectFormComponent);

  readonly marker = input.required<Marker>();

  readonly showOnMap = output<readonly [number, number]>();
  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);

  protected readonly location = computed<readonly [number, number]>(() => [
    this.marker().lon,
    this.marker().lat,
  ]);

  protected readonly subline = computed(() =>
    this.i18n.translate('marker.unter', {
      sichtbarkeit: visibilityText(this.i18n, this.marker().sichtbarkeit),
    }),
  );

  protected readonly start = computed<ObjectValues>(() => {
    const marker = this.marker();
    return {
      name: marker.name,
      farbe: marker.farbe,
      notiz: marker.notiz,
      sichtbarkeit: marker.sichtbarkeit,
    };
  });

  protected async save(): Promise<void> {
    const values = this.form()?.values();
    if (!values) return;
    this.busy.set(true);
    try {
      if (await this.eintraege.updateMarker(this.marker().id, values)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteMarker(this.marker().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.closed.emit();
    }
  }
}
