import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EintraegeApi } from '../../core/api/eintraege.api';
import type { Foto } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';

/** Ein Bild, das schon geladen ist. */
interface Bild {
  id: string;
  url: string;
  beschriftung: string;
}

/**
 * Die Fotos eines Fundes im Objekt-Blatt.
 *
 * Ein Foto hängt an den Rechten seines Fundes; der Server verlangt dafür das
 * Token. Ein `src` am Bild trüge keines, darum kommt jede Datei über den
 * ApiClient und wird als Objekt-Adresse eingehängt.
 */
@Component({
  selector: 'app-foto-galerie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foto-galerie.component.html',
  styleUrl: './foto-galerie.component.scss',
})
export class FotoGalerieComponent implements OnDestroy {
  private readonly api = inject(EintraegeApi);
  private readonly i18n = inject(I18nService);

  readonly fundId = input.required<string>();
  readonly fotos = input.required<readonly Foto[]>();

  private readonly geladen = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly bilder = computed<Bild[]>(() => {
    const urls = this.geladen();
    return this.fotos()
      .map((foto, index) => ({
        id: foto.id,
        url: urls.get(foto.id) ?? '',
        beschriftung: this.i18n.translate('melden.fotoVorschau', { nummer: index + 1 }),
      }))
      .filter((bild) => bild.url !== '');
  });

  constructor() {
    effect(() => {
      const fundId = this.fundId();
      for (const foto of this.fotos()) {
        if (!this.geladen().has(foto.id)) void this.hole(fundId, foto.id);
      }
    });
  }

  ngOnDestroy(): void {
    for (const url of this.geladen().values()) URL.revokeObjectURL(url);
  }

  private async hole(fundId: string, fotoId: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.api.fotoLaden(fundId, fotoId));
      this.geladen.update((alt) => new Map(alt).set(fotoId, URL.createObjectURL(blob)));
    } catch {
      // Ein Bild, das nicht kommt, bleibt weg. Der Fund steht auch ohne es.
    }
  }
}
