import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NoteComponent, PageHeaderComponent } from '../../ui';

/** Der leere Rahmen eines Reiters, bis das Arbeitspaket dazu kommt. */
@Component({
  selector: 'app-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoteComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './placeholder.component.html',
  styleUrl: './placeholder.component.scss',
})
export class PlaceholderComponent {
  readonly titel = input.required<string>();
}
