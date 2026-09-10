import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/**
 * Ein Hinweis: eingekreistes i links, der Text daneben.
 *
 * Hinweise standen bisher als gewöhnlicher Absatz zwischen dem übrigen Text.
 * Wer die Seite überfliegt, übersieht sie dort. Ein Zeichen davor sagt in einem
 * Blick, dass hier eine Auskunft steht und keine Angabe zur Art.
 */
@Component({
  selector: 'app-info-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './info-text.component.html',
  styleUrl: './info-text.component.scss',
})
export class InfoTextComponent {}
