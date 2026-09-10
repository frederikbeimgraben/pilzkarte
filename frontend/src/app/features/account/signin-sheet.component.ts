import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, SheetComponent, type DetentSize } from '../../ui';

/**
 * Das Anmelde-Blatt kennt nur eine Raste: Titel, Satz und Fußleiste bestimmen
 * die Höhe. Ein fester Anteil ließe zwischen Text und Knöpfen Leerraum stehen.
 */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['inhalt', 'inhalt', 'inhalt'];

/**
 * Fragt nach der Anmeldung, wenn etwas gespeichert werden soll. Es erscheint
 * nur auf {@link AuthService.requestSignIn}, nie von selbst: Karte, Arten
 * und Ebenen bleiben ohne Konto nutzbar.
 */
@Component({
  selector: 'app-signin-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, SheetComponent, TranslatePipe],
  templateUrl: './signin-sheet.component.html',
  styleUrl: './signin-sheet.component.scss',
})
export class SignInSheetComponent {
  private readonly auth = inject(AuthService);
  // `read` ist nötig: eine Referenz auf ein Komponenten-Element liefert sonst
  // die Komponente, nicht ihr Element.
  private readonly footer = viewChild('footer', { read: ElementRef });

  protected readonly pending = this.auth.sheetOpen;
  protected readonly detents = DETENTS;

  constructor() {
    effect(() => {
      // Ein modales Blatt nimmt den Fokus, sonst wanderte der Tabulator weiter
      // durch die Karte darunter.
      const footer = this.footer() as ElementRef<HTMLElement> | undefined;
      footer?.nativeElement.querySelector('button')?.focus();
    });
  }

  protected signIn(): void {
    void this.auth.signIn();
  }

  protected later(): void {
    this.auth.later();
  }
}
