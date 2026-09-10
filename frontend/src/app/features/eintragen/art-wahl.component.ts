import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { ArtKurz } from '../../core/api/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ArtenZustand } from '../arten/arten.zustand';
import { FormFieldComponent, ListRowComponent } from '../../ui';

/**
 * Die Art eines Fundes aus dem Katalog wählen: Suche und Liste.
 *
 * Der Katalog liegt schon im Speicher, weil der Reiter Arten ihn einmal holt.
 * Gesucht wird darum im Gerät, ohne Anfrage je Tastendruck.
 */
@Component({
  selector: 'app-art-wahl',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, ListRowComponent, TranslatePipe],
  templateUrl: './art-wahl.component.html',
  styleUrl: './art-wahl.component.scss',
})
export class ArtWahlComponent {
  private readonly arten = inject(ArtenZustand);

  readonly gewaehlt = input<string | null>(null);

  readonly auswahl = output<ArtKurz>();

  protected readonly suche = signal('');

  protected readonly treffer = computed<ArtKurz[]>(() => {
    const gesucht = this.suche().trim().toLocaleLowerCase();
    const alle = this.arten.liste()?.arten ?? [];
    if (gesucht === '') return [...alle];
    return alle.filter(
      (art) =>
        art.name.toLocaleLowerCase().includes(gesucht) ||
        art.lateinisch.toLocaleLowerCase().includes(gesucht),
    );
  });

  constructor() {
    this.arten.ladeListe();
  }
}
