import { provideHttpClient } from '@angular/common/http';
import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { UI_KIT_INTL, uiKitIntlFromLang } from '@stupa-makers/ui-kit';
import { ConfigService } from './core/config/config.service';
import { I18nService } from './core/i18n/i18n.service';
import { ThemeService } from './core/theme/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    // Die Texte des Kits folgen der Sprache der App, statt eine eigene zu führen.
    { provide: UI_KIT_INTL, useFactory: () => uiKitIntlFromLang(inject(I18nService).locale) },
    provideAppInitializer(() => {
      inject(ThemeService).init();
      return inject(ConfigService).laden();
    }),
  ],
};
