import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PlatzhalterComponent } from '../platzhalter/platzhalter.component';

/** Platzhalter, bis der Reiter gebaut wird. */
@Component({
  selector: 'app-arten',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlatzhalterComponent, TranslatePipe],
  templateUrl: './arten.component.html',
})
export class ArtenComponent {}
