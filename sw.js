// Service Worker: macht die App offline-fähig.
// Strategie "Netz zuerst": neue Versionen erscheinen sofort; ohne Netz (oder bei langsamem Netz) kommt der Cache.
// Bei größeren Änderungen CACHE-Version erhöhen, damit alte Dateien verschwinden.
const CACHE = 'kalender-v17';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/calendar.js',
  'js/birthdays.js',
  'js/items.js',
  'js/colors.js',
  'js/holidays.js',
  'js/school-holidays.js',
  'js/display.js',
  'js/push.js',
  'js/sync.js',
  'js/sync-core.js',
  'js/ui/sync-settings.js',
  'js/config.js',
  'js/reminders.js',
  'js/ui/dom.js',
  'js/ui/sheet.js',
  'js/ui/forms.js',
  'js/ui/month.js',
  'js/ui/year.js',
  'js/ui/week.js',
  'js/ui/week-drag.js',
  'js/drag-math.js',
  'js/ui/birthdays-view.js',
  'js/ui/haircuts-view.js',
  'js/haircuts.js',
  'js/haircut-import.js',
  'js/ui/haircut-import-sheet.js',
  'js/ui/day-sheet.js',
  'js/ui/banner.js',
  'js/ui/settings.js',
  'js/ui/display-settings.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const network = fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
      if (!hit) return network;
      // Netz zuerst, aber höchstens 3 s warten, dann den Cache nehmen (Netz lädt im Hintergrund weiter).
      return Promise.race([network, new Promise((r) => setTimeout(() => r(hit), 3000))]);
    })
  );
});

// ───────── Push-Benachrichtigungen ─────────
// Wichtig für iOS: Auf jede Push-Nachricht MUSS eine sichtbare Benachrichtigung folgen,
// sonst entzieht iOS der App die Berechtigung.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kalender', {
      body: data.body || '',
      tag: data.tag,
      icon: 'icons/icon-192.png',
      data: { url: data.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if ('focus' in w) {
          await w.focus();
          w.postMessage({ type: 'open', url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
