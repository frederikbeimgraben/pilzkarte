import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DialogComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent, ChipGroupComponent, FormFieldComponent, NoteComponent } from '../../ui';

/** Die Vorschläge aus dem Artboard. Ein Tipp schreibt den Satz ins Feld. */
const SUGGESTIONS: readonly TranslationKey[] = [
  'bild.grund.unscharf',
  'bild.grund.nichtErkennbar',
  'bild.grund.rechteUnklar',
  'bild.grund.falscheArt',
];

/**
 * Das Blatt, das nach dem Grund einer Absage fragt.
 *
 * Der Grund ist ein eigener Schritt und kein Feld neben dem Knopf: wer
 * ablehnt, soll den Satz schreiben, den die einreichende Person liest. Ohne
 * Grund geht die Absage nicht hinaus.
 */
@Component({
  selector: 'app-reject-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ChipGroupComponent,
    DialogComponent,
    FormFieldComponent,
    NoteComponent,
    TranslatePipe,
  ],
  templateUrl: './reject-dialog.component.html',
  styleUrl: './reject-dialog.component.scss',
})
export class RejectDialogComponent {
  private readonly i18n = inject(I18nService);

  /** Wessen Bild abgelehnt wird. Ohne Namen fragt das Blatt niemanden. */
  readonly person = input.required<string | null>();
  readonly open = input.required<boolean>();

  readonly rejected = output<string>();
  readonly closed = output();

  protected readonly reason = signal('');

  protected readonly chips = computed(() =>
    SUGGESTIONS.map((key) => {
      const label = this.i18n.translate(key);
      return { value: label, label };
    }),
  );

  protected readonly hint = computed(() => {
    const person = this.person();
    return person === null
      ? this.i18n.translate('bild.grundHinweis')
      : this.i18n.translate('bild.grundHinweisPerson', { name: person });
  });

  /** Ein Grund aus Leerzeichen ist kein Grund. */
  protected readonly ready = computed(() => this.reason().trim().length > 0);

  protected pick(label: string): void {
    this.reason.set(label);
  }

  protected write(text: string): void {
    this.reason.set(text);
  }

  protected confirm(): void {
    if (!this.ready()) return;
    this.rejected.emit(this.reason().trim());
    this.reason.set('');
  }

  protected cancel(): void {
    this.reason.set('');
    this.closed.emit();
  }
}
