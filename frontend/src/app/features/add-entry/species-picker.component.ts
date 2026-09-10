import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { SpeciesBrief } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SpeciesState } from '../species/species.state';
import { FormFieldComponent, ListRowComponent } from '../../ui';

/**
 * Die Art eines Fundes aus dem Katalog wählen: Suche und Liste.
 *
 * Der Katalog liegt schon im Speicher, weil der Reiter Arten ihn einmal holt.
 * Gesucht wird darum im Gerät, ohne Anfrage je Tastendruck.
 */
@Component({
  selector: 'app-species-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, ListRowComponent, TranslatePipe],
  templateUrl: './species-picker.component.html',
  styleUrl: './species-picker.component.scss',
})
export class SpeciesPickerComponent {
  private readonly arten = inject(SpeciesState);

  readonly selected = input<string | null>(null);

  readonly chosen = output<SpeciesBrief>();

  protected readonly search = signal('');

  protected readonly matches = computed<SpeciesBrief[]>(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const alle = this.arten.catalogue()?.arten ?? [];
    if (query === '') return [...alle];
    return alle.filter(
      (art) =>
        art.name.toLocaleLowerCase().includes(query) || art.lateinisch.toLocaleLowerCase().includes(query),
    );
  });

  constructor() {
    this.arten.loadCatalogue();
  }
}
