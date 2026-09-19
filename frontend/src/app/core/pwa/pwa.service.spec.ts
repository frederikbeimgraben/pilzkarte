import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent, type VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { PwaService } from './pwa.service';

const VERSION_READY: VersionReadyEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'a' },
  latestVersion: { hash: 'b' },
};

/** Ein Angebot des Browsers, die App zu installieren. */
function offer(outcome: 'accepted' | 'dismissed'): Event {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome }),
  });
}

/** `SwUpdate` mit steuerbarem Strom für `versionUpdates`. */
class SwUpdateDouble {
  isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly checkForUpdate = vi.fn().mockResolvedValue(false);
  readonly activateUpdate = vi.fn().mockResolvedValue(true);
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function service(swUpdate: SwUpdateDouble): PwaService {
  TestBed.configureTestingModule({
    providers: [{ provide: SwUpdate, useValue: swUpdate }],
  });
  const pwa = TestBed.inject(PwaService);
  pwa.init();
  return pwa;
}

describe('PwaService', () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockClear();
    vi.stubGlobal('location', { reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setVisibility('visible');
  });

  it('bietet die Installation an, sobald der Browser fragt', async () => {
    const pwa = service(new SwUpdateDouble());
    expect(pwa.canInstall()).toBe(false);

    dispatchEvent(offer('accepted'));

    expect(pwa.canInstall()).toBe(true);
    expect(await pwa.install()).toBe(true);
    expect(pwa.canInstall()).toBe(false);
  });

  it('meldet eine abgelehnte Installation', async () => {
    const pwa = service(new SwUpdateDouble());
    dispatchEvent(offer('dismissed'));

    expect(await pwa.install()).toBe(false);
  });

  it('installiert nicht ohne Angebot', async () => {
    expect(await service(new SwUpdateDouble()).install()).toBe(false);
  });

  it('vergisst das Angebot nach der Installation', () => {
    const pwa = service(new SwUpdateDouble());
    dispatchEvent(offer('accepted'));

    dispatchEvent(new Event('appinstalled'));

    expect(pwa.canInstall()).toBe(false);
  });

  describe('Aktualisierung', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('aktiviert eine Fassung sofort, wenn sie innerhalb von 10 s bereitsteht', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = service(swUpdate);

      swUpdate.versionUpdates.next(VERSION_READY);
      await vi.waitFor(() => {
        expect(swUpdate.activateUpdate).toHaveBeenCalledOnce();
      });

      expect(pwa.updateReady()).toBe(true);
      expect(reload).toHaveBeenCalledOnce();
    });

    it('aktiviert nicht sofort, wenn die Fassung nach 10 s bereitsteht', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = service(swUpdate);

      await vi.advanceTimersByTimeAsync(10_001);
      swUpdate.versionUpdates.next(VERSION_READY);

      expect(pwa.updateReady()).toBe(true);
      expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('aktiviert eine späte Fassung nicht beim Wechsel auf sichtbar', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = service(swUpdate);
      await vi.advanceTimersByTimeAsync(10_001);
      swUpdate.versionUpdates.next(VERSION_READY);

      setVisibility('visible');

      expect(swUpdate.activateUpdate).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(pwa.updateReady()).toBe(true);
    });

    it('aktiviert eine bereitstehende Fassung auf Wunsch', async () => {
      const swUpdate = new SwUpdateDouble();
      const pwa = service(swUpdate);
      await vi.advanceTimersByTimeAsync(10_001);
      swUpdate.versionUpdates.next(VERSION_READY);

      await pwa.activate();

      expect(swUpdate.activateUpdate).toHaveBeenCalledOnce();
      expect(reload).toHaveBeenCalledOnce();
    });

    it('fragt bei jedem Wechsel auf sichtbar nach einer neuen Fassung', () => {
      const swUpdate = new SwUpdateDouble();
      service(swUpdate);

      setVisibility('hidden');
      setVisibility('visible');

      expect(swUpdate.checkForUpdate).toHaveBeenCalledOnce();
    });

    it('fragt nicht nach einer Fassung beim Wechsel in den Hintergrund', () => {
      const swUpdate = new SwUpdateDouble();
      service(swUpdate);

      setVisibility('hidden');

      expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
    });

    it('rührt nichts an, wenn der Service Worker nicht aktiv ist', () => {
      const swUpdate = new SwUpdateDouble();
      swUpdate.isEnabled = false;
      const pwa = service(swUpdate);

      setVisibility('hidden');
      setVisibility('visible');

      expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
      expect(pwa.updateReady()).toBe(false);
    });

    it('läuft ohne `provideServiceWorker` ohne Fehler', async () => {
      TestBed.configureTestingModule({});
      const pwa = TestBed.inject(PwaService);

      expect(() => {
        pwa.init();
      }).not.toThrow();
      await expect(pwa.activate()).resolves.toBeUndefined();
      expect(pwa.updateReady()).toBe(false);
    });
  });
});
