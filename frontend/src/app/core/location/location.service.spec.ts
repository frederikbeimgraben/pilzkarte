import { TestBed } from '@angular/core/testing';
import { LocationService } from './location.service';

interface Watcher {
  ok: PositionCallback;
  fail: PositionErrorCallback;
}

function stubGeolocation(): { watchers: Watcher[]; cleared: number[] } {
  const watchers: Watcher[] = [];
  const cleared: number[] = [];
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
        watchers.push({ ok, fail });
        return watchers.length;
      },
      clearWatch: (id: number) => cleared.push(id),
      getCurrentPosition: () => undefined,
    },
  });
  return { watchers, cleared };
}

function stubPermission(state: PermissionState): { change: () => void } {
  const listeners: (() => void)[] = [];
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: () =>
        Promise.resolve({
          state,
          addEventListener: (_kind: string, handler: () => void) => {
            listeners.push(handler);
          },
        }),
    },
  });
  return {
    change: () => {
      for (const handler of listeners) handler();
    },
  };
}

function position(lon: number, lat: number, accuracy: number): GeolocationPosition {
  return {
    coords: { longitude: lon, latitude: lat, accuracy },
    timestamp: 0,
  } as GeolocationPosition;
}

describe('LocationService', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'permissions');
  });

  it('meldet Ort und Genauigkeit, sobald das Gerät sie liefert', async () => {
    const { watchers } = stubGeolocation();
    stubPermission('granted');
    const service = TestBed.inject(LocationService);
    await Promise.resolve();

    expect(service.location()).toBeNull();
    service.start();
    watchers[0].ok(position(9.1, 48.8, 25));

    expect(service.location()).toEqual({ lon: 9.1, lat: 48.8, accuracy: 25 });
    expect(service.allowed()).toBe(true);
  });

  it('folgt nur einmal, auch wenn die Karte mehrfach anstößt', () => {
    const { watchers, cleared } = stubGeolocation();
    const service = TestBed.inject(LocationService);

    service.start();
    service.start();
    expect(watchers).toHaveLength(1);

    service.stop();
    expect(cleared).toEqual([1]);
  });

  it('sperrt sich, sobald die Freigabe abgelehnt ist', async () => {
    stubGeolocation();
    stubPermission('denied');
    const service = TestBed.inject(LocationService);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.allowed()).toBe(false);
  });

  it('bleibt offen, solange niemand gefragt hat', async () => {
    stubGeolocation();
    stubPermission('prompt');
    const service = TestBed.inject(LocationService);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.allowed()).toBe(true);
  });

  it('folgt nicht, wo das Gerät keine Ortung kennt', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    const service = TestBed.inject(LocationService);

    service.start();

    expect(service.location()).toBeNull();
  });

  it('sperrt sich nach einer abgelehnten Ortung, nicht nach einem Aussetzer', () => {
    const { watchers } = stubGeolocation();
    const service = TestBed.inject(LocationService);
    service.start();

    watchers[0].fail({ code: 2, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    expect(service.allowed()).toBe(true);

    watchers[0].fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    expect(service.allowed()).toBe(false);
    expect(service.location()).toBeNull();
  });
});
