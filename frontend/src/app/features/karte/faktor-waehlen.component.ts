import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ebenenGruppen, type Ebene } from '../../core/kacheln/ebenen';
import { ActionBarComponent, ListRowComponent, SheetComponent } from '../../ui';

type GruppenTitel = 'ebene.jeWoche' | 'ebene.fest' | 'faktor.arten';

interface Gruppe {
  titel: GruppenTitel;
  ebenen: readonly Ebene[];
}

/**
 * Die Wahl einer Quelle für einen neuen Faktor: die Eingabe-Ebenen und die
 * Arten mit Vorhersage. Was schon in der Liste steht, ist gesperrt; zweimal
 * dieselbe Quelle zu prüfen hilft niemandem.
 */
@Component({
  selector: 'app-faktor-waehlen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ListRowComponent, SheetComponent, TranslatePipe],
  templateUrl: './faktor-waehlen.component.html',
  styleUrl: './faktor-waehlen.component.scss',
})
export class FaktorWaehlenComponent {
  private readonly i18n = inject(I18nService);

  readonly ebenen = input.required<readonly Ebene[]>();
  readonly arten = input<readonly Ebene[]>([]);
  /** Die Quellen, die schon einen Faktor haben. */
  readonly vergeben = input<ReadonlySet<string>>(new Set());

  readonly auswahl = output<Ebene>();
  readonly schliessen = output();

  protected readonly gruppen = computed<Gruppe[]>(() => {
    const { jeWoche, fest } = ebenenGruppen(this.ebenen());
    return (
      [
        { titel: 'ebene.jeWoche', ebenen: jeWoche },
        { titel: 'ebene.fest', ebenen: fest },
        { titel: 'faktor.arten', ebenen: this.arten() },
      ] as const
    )
      .filter((gruppe) => gruppe.ebenen.length > 0)
      .map((gruppe) => ({ titel: gruppe.titel, ebenen: gruppe.ebenen }));
  });

  protected unter(ebene: Ebene): string | undefined {
    return this.vergeben().has(ebene.id) ? this.i18n.translate('faktor.schonDabei') : undefined;
  }
}
