import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ebenenGruppen, type Ebene } from '../../core/kacheln/ebenen';
import { ListRowComponent } from '../../ui';

interface Gruppe {
  titel: 'ebene.jeWoche' | 'ebene.fest';
  ebenen: readonly Ebene[];
}

/**
 * Die Eingabe-Ebenen in zwei Gruppen: was der Woche folgt und was für alle
 * Wochen gilt. Die Einheit steht in der Zeile, damit die Wahl schon sagt,
 * worin die Ebene misst.
 */
@Component({
  selector: 'app-ebenen-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, TranslatePipe],
  templateUrl: './ebenen-liste.component.html',
  styleUrl: './ebenen-liste.component.scss',
})
export class EbenenListeComponent {
  readonly ebenen = input.required<readonly Ebene[]>();
  readonly gewaehlt = input<string | null>(null);
  readonly beschriftung = input.required<string>();

  readonly auswahl = output<Ebene>();

  protected readonly gruppen = computed<Gruppe[]>(() => {
    const { jeWoche, fest } = ebenenGruppen(this.ebenen());
    return [
      { titel: 'ebene.jeWoche', ebenen: jeWoche },
      { titel: 'ebene.fest', ebenen: fest },
    ].filter((gruppe): gruppe is Gruppe => gruppe.ebenen.length > 0);
  });
}
