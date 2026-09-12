import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, DialogComponent, InputComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Layer } from '../../core/tiles/layers';
import type { Combination } from '../../core/api/models';
import {
  ActionBarComponent,
  FactorRowComponent,
  ListRowComponent,
  NoteComponent,
  SvgIconComponent,
} from '../../ui';
import { conditionText, type Faktor } from './factors';

/** Ein Faktor, wie ihn die Zeile braucht: mit aufgelöster Quelle. */
interface Row {
  factor: Faktor;
  name: string;
  subline: string;
  condition: string;
}

/**
 * Die Darstellung „Kombination“: die Liste der Faktoren und die Aktionen
 * darunter. Sie hängt an keiner Art. Wer angemeldet ist, findet darüber seine
 * gespeicherten Kombinationen. Die Regel steht bei den Schaltern des Blatts,
 * denn sie gehört zur Darstellung, nicht zu den Faktoren.
 */
@Component({
  selector: 'app-combination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    DialogComponent,
    FactorRowComponent,
    FormsModule,
    InputComponent,
    ListRowComponent,
    NoteComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './combination.component.html',
  styleUrl: './combination.component.scss',
})
export class KombinationComponent {
  private readonly i18n = inject(I18nService);

  readonly factors = input.required<readonly Faktor[]>();
  /** Die Quellen der Faktoren, nach Kennung. Was fehlt, wird nicht gezeigt. */
  readonly sources = input.required<ReadonlyMap<string, Layer>>();
  /** Die Woche, auf die sich die Wochenfaktoren beziehen. */
  readonly weekText = input<string>();
  readonly saved = input<readonly Combination[]>([]);
  readonly signedIn = input(false);
  /** Die Seite hat die Anmeldung geklärt; jetzt fehlt nur noch der Name. */
  readonly asksName = input(false);

  readonly activeChange = output<{ factor: Faktor; active: boolean }>();
  readonly openFactor = output<Faktor>();
  readonly add = output();
  readonly saveRequested = output();
  readonly save = output<string>();
  readonly nameCancelled = output();
  readonly picked = output<Combination>();
  readonly remove = output<Combination>();

  protected readonly name = signal('');
  /** Die Kombination, deren Löschen noch bestätigt werden muss. */
  protected readonly toDelete = signal<Combination | null>(null);

  protected readonly rows = computed<Row[]>(() => {
    const sources = this.sources();
    const locale = this.i18n.locale();
    const bis = this.i18n.translate('faktor.bis');
    return this.factors().flatMap((factor) => {
      const layer = sources.get(factor.source);
      if (!layer) return [];
      return [
        {
          factor,
          name: layer.label,
          subline: layer.fixed
            ? this.i18n.translate('faktor.konstant')
            : (this.weekText() ?? this.i18n.translate('faktor.konstant')),
          condition: conditionText(factor, layer, locale, bis),
        },
      ];
    });
  });

  /** Ohne Konto führt der Knopf zuerst zur Anmeldung, und das steht auf ihm. */
  protected readonly saveText = computed(() =>
    this.i18n.translate(this.signedIn() ? 'kombination.speichern' : 'kombination.anmeldenZumSpeichern'),
  );

  protected readonly canSave = computed(() => this.factors().length > 0);

  protected bestaetigeNamen(): void {
    const name = this.name().trim();
    if (name === '') return;
    this.name.set('');
    this.save.emit(name);
  }

  protected brichNamenAb(): void {
    this.name.set('');
    this.nameCancelled.emit();
  }

  protected confirmDelete(): void {
    const combination = this.toDelete();
    this.toDelete.set(null);
    if (combination) this.remove.emit(combination);
  }

  protected deleteAsk(combination: Combination): string {
    return this.i18n.translate('kombination.loeschenFrage', { name: combination.name });
  }

  protected deleteHint(combination: Combination): string {
    return this.i18n.translate('kombination.loeschen', { name: combination.name });
  }
}
