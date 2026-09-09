import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NoteComponent, PageHeaderComponent } from '../../ui';

/** Der leere Rahmen eines Reiters, bis das Arbeitspaket dazu kommt. */
@Component({
  selector: 'app-platzhalter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoteComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './platzhalter.component.html',
  styleUrl: './platzhalter.component.scss',
})
export class PlatzhalterComponent {
  readonly titel = input.required<string>();
}
