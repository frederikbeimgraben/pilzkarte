import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

// Ein Fehler beim Start hat keine Oberfläche, die ihn zeigen könnte.
bootstrapApplication(App, appConfig).catch((failure: unknown) => {
  document.body.textContent = String(failure);
});
