import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Das Ereignis, mit dem ein Browser die Installation anbietet. */
export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const BOOT_WINDOW_MS = 10_000;

/**
 * Service Worker, Installationsaufforderung und stille Aktualisierung.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  /** Ohne `provideServiceWorker` bleibt der Dienst tatenlos statt zu reißen. */
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  private readonly _canInstall = signal(false);
  private readonly _updateReady = signal(false);
  private prompt: InstallPrompt | null = null;
  private withinBootWindow = false;

  /** Ob der Browser die Installation anbietet. Firefox am Rechner tut es nicht. */
  readonly canInstall = this._canInstall.asReadonly();

  /** Ob eine Fassung bereitsteht: zeigt die Leiste und den Wert im Konto. */
  readonly updateReady = this._updateReady.asReadonly();

  init(): void {
    addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.prompt = event as InstallPrompt;
      this._canInstall.set(true);
    });
    addEventListener('appinstalled', () => {
      this.prompt = null;
      this._canInstall.set(false);
    });
    this.watchUpdates();
  }

  /** Fragt den Browser. Danach ist das Angebot verbraucht. */
  async install(): Promise<boolean> {
    const offer = this.prompt;
    if (offer === null) return false;
    this.prompt = null;
    this._canInstall.set(false);
    await offer.prompt();
    return (await offer.userChoice).outcome === 'accepted';
  }

  /** Beim Start aktiviert eine Fassung sich still. Im Betrieb wartet sie auf die Person. */
  private watchUpdates(): void {
    const swUpdate = this.swUpdate;
    if (!swUpdate?.isEnabled) return;

    this.withinBootWindow = true;
    const bootTimer = setTimeout(() => {
      this.withinBootWindow = false;
    }, BOOT_WINDOW_MS);
    this.destroyRef.onDestroy(() => {
      clearTimeout(bootTimer);
    });

    const versionSub = swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this._updateReady.set(true);
        if (this.withinBootWindow) void this.activate();
      });
    this.destroyRef.onDestroy(() => {
      versionSub.unsubscribe();
    });

    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      void swUpdate.checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Aktiviert die wartende Fassung und lädt neu: beim Start still, sonst auf Knopfdruck. */
  async activate(): Promise<void> {
    if (this.swUpdate === null) return;
    await this.swUpdate.activateUpdate();
    location.reload();
  }
}
