// Die Vorgaengerseite hatte einen eigenen Service Worker. Ein Browser, der
// ihn einmal eingetragen hat, fragt ihn weiter, auch wenn die Datei laengst
// weg ist: er faengt dann Anfragen ab und liefert Reste aus einem alten
// Speicher. Diese Fassung traegt sich aus und raeumt die Speicher, sobald
// sie laeuft. Sie faellt weg, wenn die App ihren eigenen Service Worker
// mitbringt.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    (async () => {
      for (const name of await caches.keys()) await caches.delete(name);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
