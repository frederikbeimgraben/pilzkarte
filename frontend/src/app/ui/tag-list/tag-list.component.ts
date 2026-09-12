import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Die Kategorien eines Merkmals als Reihe.
 *
 * Sie tragen den Filter; der Satz daneben trägt, was in keine Kategorie passt.
 * Anders als eine Chip-Reihe wählt hier nichts aus: die Reihe zeigt nur, was
 * für die Art gilt.
 */
@Component({
  selector: 'app-tag-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss',
})
export class TagListComponent {
  readonly tags = input.required<readonly string[]>();
  readonly label = input.required<string>();
}
