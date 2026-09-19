import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';

/** Der Zustand, den die Leiste meldet. */
export type BannerKind = 'noConnection' | 'pending' | 'update';

const TEXT: Record<BannerKind, TranslationKey> = {
  noConnection: 'state.noConnection',
  pending: 'state.offlinePending',
  update: 'app.update.ready',
};

/** Die Zustandsleiste am Kopf einer Seite: kein Netz, Abgleich oder eine bereitstehende Fassung. */
@Component({
  selector: 'app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
})
export class BannerComponent {
  readonly kind = input<BannerKind>('noConnection');
  readonly icon = input<IconName>('wifi-off');
  readonly actionIcon = input<IconName>();
  readonly actionLabel = input<TranslationKey>();

  readonly actionClick = output();

  protected readonly textKey = computed(() => TEXT[this.kind()]);
  protected readonly showsIcon = computed(() => this.kind() !== 'update');

  /** Icon und Beschriftung gehören zusammen: eine Aktion ohne Namen wäre stumm. */
  protected readonly action = computed(() => {
    const icon = this.actionIcon();
    const label = this.actionLabel();
    return icon && label ? { icon, label } : null;
  });
}
