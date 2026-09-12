import { computed, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Page } from './models';

/** So viele Zeilen holt eine Seite: mehr als ein Bildschirm, weniger als alles. */
export const PAGE_SIZE = 25;

/**
 * Eine Liste, die in Seiten hereinkommt.
 *
 * Der Dienst blättert schon; ohne diesen Halter nähme jede Seite die erste
 * Seite und ließe den Rest liegen. Zwei Screens brauchen dasselbe Verhalten,
 * darum steht es einmal hier und nicht zweimal in einer Komponente.
 */
export class PagedList<E> {
  private readonly held = signal<readonly E[] | null>(null);
  private readonly count = signal(0);
  private readonly running = signal(false);

  readonly entries = computed<readonly E[]>(() => this.held() ?? []);
  /** Wie viele es im Dienst gibt, nicht wie viele schon da sind. */
  readonly total = this.count.asReadonly();
  readonly busy = this.running.asReadonly();
  /** `false`, solange die erste Antwort aussteht. Dann zeigt die Seite nichts. */
  readonly loaded = computed(() => this.held() !== null);
  readonly more = computed(() => this.entries().length < this.count());

  constructor(private readonly page: (offset: number, limit: number) => Observable<Page<E>>) {}

  /** Von vorn. Ein Wechsel der Sicht wirft weg, was zur alten gehörte. */
  restart(): void {
    this.held.set(null);
    this.count.set(0);
    this.next();
  }

  /** Die nächste Seite ans Ende der schon geladenen. */
  next(): void {
    if (this.running()) return;
    this.running.set(true);
    this.page(this.entries().length, PAGE_SIZE).subscribe({
      next: (answer) => {
        this.held.set([...this.entries(), ...answer.eintraege]);
        this.count.set(answer.gesamt);
        this.running.set(false);
      },
      // Ein Ausfall lässt stehen, was schon da ist. Der Toast des ApiClient
      // sagt Bescheid, und der Knopf lädt es beim nächsten Druck nach.
      error: () => {
        this.held.set(this.entries());
        this.running.set(false);
      },
    });
  }

  /**
   * Nimmt eine Zeile heraus, die in diese Sicht nicht mehr gehört.
   *
   * Nach einer Freigabe die ganze Liste neu zu holen würde die Person zurück
   * an den Anfang werfen, obwohl sie auf Seite drei arbeitet.
   */
  withoutEntry(matches: (entry: E) => boolean): void {
    const held = this.held();
    if (held === null) return;
    const left = held.filter((entry) => !matches(entry));
    this.count.update((count) => count - (held.length - left.length));
    this.held.set(left);
  }
}
