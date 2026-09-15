import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, type ToastVariant } from '@stupa-makers/ui-kit';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

const GLYPHS: Readonly<Record<ToastVariant, { name: IconName; stroke: number }>> = {
  success: { name: 'check', stroke: 2.4 },
  danger: { name: 'close', stroke: 2.2 },
  warning: { name: 'warning', stroke: 2.2 },
  info: { name: 'info', stroke: 2.2 },
};

/** Die Meldungen des Dienstes, flach über die Breite, eine je Zeile. */
@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  protected readonly toasts = inject(ToastService);

  protected glyph(variant: ToastVariant): { name: IconName; stroke: number } {
    return GLYPHS[variant];
  }
}
