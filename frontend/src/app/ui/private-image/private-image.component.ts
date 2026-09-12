import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  type OnDestroy,
} from '@angular/core';
import { ApiClient } from '../../core/api/api-client';

/**
 * Ein Bild, das noch nicht öffentlich ist.
 *
 * Bis zur Freigabe hängt eine Bilddatei an den Rechten der Person. Ein nacktes
 * `src` trägt kein Token und bekäme darum ein 404. Das Bild geht deshalb
 * denselben Weg wie jede andere Anfrage und wird als Objekt-URL gezeigt.
 */
@Component({
  selector: 'app-private-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './private-image.component.html',
  styleUrl: './private-image.component.scss',
})
export class PrivateImageComponent implements OnDestroy {
  private readonly api = inject(ApiClient);

  /** Der Pfad aus der Antwort, ohne `/api`. */
  readonly path = input.required<string>();
  readonly alt = input.required<string>();

  protected readonly source = signal<string | null>(null);

  /**
   * Dieselbe Adresse noch einmal, aber als gewöhnliches Feld. Der Effekt darf
   * das Signal nicht lesen: er hinge sonst an seinem eigenen Ergebnis und
   * liefe endlos.
   */
  private held: string | null = null;

  constructor() {
    effect(() => {
      const path = this.path();
      this.release();
      this.api.getBlob(path.replace(/^\/api/, '')).subscribe({
        next: (data) => {
          this.held = URL.createObjectURL(data);
          this.source.set(this.held);
        },
        // Der Toast des ApiClient sagt schon Bescheid. Hier bleibt die Fläche
        // leer, statt ein kaputtes Bild zu zeigen.
        error: () => {
          this.source.set(null);
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.release();
  }

  /** Eine Objekt-URL bleibt sonst im Speicher, bis die Seite neu lädt. */
  private release(): void {
    if (this.held !== null) URL.revokeObjectURL(this.held);
    this.held = null;
    this.source.set(null);
  }
}
