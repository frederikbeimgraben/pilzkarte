import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, SheetComponent, type RasteMass } from '../../ui';

/**
 * Das Anmelde-Blatt kennt nur eine Raste: Titel, Satz und Fußleiste bestimmen
 * die Höhe. Ein fester Anteil ließe zwischen Text und Knöpfen Leerraum stehen.
 */
const RASTEN: readonly [RasteMass, RasteMass, RasteMass] = ['inhalt', 'inhalt', 'inhalt'];

/**
 * Fragt nach der Anmeldung, wenn etwas gespeichert werden soll. Es erscheint
 * nur auf {@link AuthService.anmeldungAnfordern}, nie von selbst: Karte, Arten
 * und Ebenen bleiben ohne Konto nutzbar.
 */
@Component({
  selector: 'app-anmelde-blatt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, SheetComponent, TranslatePipe],
  templateUrl: './anmelde-blatt.component.html',
  styleUrl: './anmelde-blatt.component.scss',
})
export class AnmeldeBlattComponent {
  private readonly auth = inject(AuthService);
  // `read` ist nötig: eine Referenz auf ein Komponenten-Element liefert sonst
  // die Komponente, nicht ihr Element.
  private readonly fuss = viewChild('fuss', { read: ElementRef });

  protected readonly offen = this.auth.blattOffen;
  protected readonly rasten = RASTEN;

  constructor() {
    effect(() => {
      // Ein modales Blatt nimmt den Fokus, sonst wanderte der Tabulator weiter
      // durch die Karte darunter.
      const fuss = this.fuss() as ElementRef<HTMLElement> | undefined;
      fuss?.nativeElement.querySelector('button')?.focus();
    });
  }

  protected anmelden(): void {
    void this.auth.anmelden();
  }

  protected spaeter(): void {
    this.auth.spaeter();
  }
}
