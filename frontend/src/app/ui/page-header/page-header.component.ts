import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Die Kopfleiste einer Listenseite, 64 px, mit Zurück und Titel. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  private readonly i18n = inject(I18nService);

  readonly titel = input.required<string>();
  readonly zurueck = input(false);

  readonly zurueckKlick = output();

  protected zurueckText(): string {
    return this.i18n.translate('kopfleiste.zurueck');
  }
}
