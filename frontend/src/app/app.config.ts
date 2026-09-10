import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { UI_KIT_INTL, uiKitIntlFromLang } from '@stupa-makers/ui-kit';
import { authInterceptor, AuthService } from './core/auth';
import { ConfigService } from './core/config/config.service';
import { I18nService } from './core/i18n/i18n.service';
import { ThemeService } from './core/theme/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Die Texte des Kits folgen der Sprache der App, statt eine eigene zu führen.
    { provide: UI_KIT_INTL, useFactory: () => uiKitIntlFromLang(inject(I18nService).locale) },
    provideAppInitializer(async () => {
      inject(ThemeService).init();
      const auth = inject(AuthService);
      // Erst die Konfiguration: ohne Issuer und Client ID gibt es keine
      // Anmeldung. Die Sitzung kommt danach im Hintergrund, damit der Chunk
      // von oidc-client-ts und der iframe den ersten Frame nicht aufhalten.
      await inject(ConfigService).laden();
      void auth.sitzungWiederherstellen();
    }),
  ],
};
