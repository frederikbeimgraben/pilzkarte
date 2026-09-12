import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/**
 * Eine Zeile der Verwechslungstabelle: Name, lateinischer Name, die Marke für
 * die Essbarkeit und zwei Wege.
 *
 * Der erklärende Satz steht nicht mehr hier. Er war in jeder Zeile anders lang,
 * und wer den Unterschied wirklich sucht, will beide Arten nebeneinander sehen
 * statt einen Satz darüber zu lesen. Dafür stehen rechts zwei Zeichen: zwei
 * gegenläufige Pfeile führen zum Vergleich, der einfache zur Artseite.
 *
 * Die Marke steht immer in einer eigenen Zeile und nie im Textfluss. Hing sie
 * hinter dem letzten Wort, sprang sie je nach Textlänge mal in dieselbe und mal
 * in die nächste Zeile, und der Abstand darüber wechselte von Zeile zu Zeile.
 */
@Component({
  selector: 'app-lookalike-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SvgIconComponent],
  templateUrl: './lookalike-row.component.html',
  styleUrl: './lookalike-row.component.scss',
})
export class LookalikeRowComponent {
  private readonly i18n = inject(I18nService);

  readonly name = input.required<string>();
  /** Der lateinische Name, wenn die Antwort ihn trägt. */
  readonly latin = input<string | null>(null);
  /** Das eigene Profil des Partners. Ohne Ziel fehlt das Zeichen. */
  readonly route = input<string | null>(null);
  /** Die Gegenüberstellung beider Arten. Ohne Ziel fehlt das Zeichen. */
  readonly compareRoute = input<string | null>(null);

  protected readonly compareLabel = computed(() =>
    this.i18n.translate('art.verwechslung.vergleichen', { name: this.name() }),
  );

  protected readonly openLabel = computed(() =>
    this.i18n.translate('art.verwechslung.ansehen', { name: this.name() }),
  );
}
