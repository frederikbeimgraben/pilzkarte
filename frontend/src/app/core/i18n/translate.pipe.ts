import { Pipe, inject, type PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';
import type { TranslationKey } from './translations';

/**
 * `{{ 'nav.karte' | t }}`. Unrein, damit ein Sprachwechsel sofort durchschlägt;
 * die aktive Sprache ist ein Signal im Dienst.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
