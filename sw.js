// Service Worker: macht die App offline-fähig.
// Strategie "stale-while-revalidate": sofort aus dem Cache, im Hintergrund aktualisieren.
// Bei größeren Änderungen CACHE-Version erhöhen, damit alte Dateien verschwinden.
const CACHE = 'kalender-v4';
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
  'js/config.js',
  'js/reminders.js',
  'js/ui/dom.js',
  'js/ui/sheet.js',
  'js/ui/forms.js',
  'js/ui/month.js',
  'js/ui/week.js',
  'js/ui/birthdays-view.js',
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
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
      return hit || network;
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
