import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigService, type AppKonfiguration } from './config.service';

const KONFIGURATION: AppKonfiguration = {
  oidcIssuer: 'https://sso.beimgraben.net/application/o/pilzkarte/',
  oidcClientId: 'pilzkarte',
  origin: 'https://pilze.beimgraben.net',
  version: '2026-09-09',
};

function aufbauen(): { config: ConfigService; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { config: TestBed.inject(ConfigService), http: TestBed.inject(HttpTestingController) };
}

describe('ConfigService', () => {
  it('holt die vier Felder beim Start', async () => {
    const { config, http } = aufbauen();

    const geladen = config.laden();
    http.expectOne('/api/config').flush(KONFIGURATION);
    await geladen;

    expect(config.konfiguration()).toEqual(KONFIGURATION);
  });

  it('bleibt ohne Backend leer, statt den Start zu brechen', async () => {
    const { config, http } = aufbauen();

    const geladen = config.laden();
    http.expectOne('/api/config').error(new ProgressEvent('error'), { status: 0 });
    await geladen;

    expect(config.konfiguration()).toBeNull();
  });
});
