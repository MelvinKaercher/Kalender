// Service Worker: macht die App offline-fähig.
// Strategie "stale-while-revalidate": sofort aus dem Cache, im Hintergrund aktualisieren.
// Bei größeren Änderungen CACHE-Version erhöhen, damit alte Dateien verschwinden.
const CACHE = 'kalender-v2';
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
  'js/reminders.js',
  'js/ui/dom.js',
  'js/ui/sheet.js',
  'js/ui/forms.js',
  'js/ui/month.js',
  'js/ui/week.js',
  'js/ui/birthdays-view.js',
  'js/ui/day-sheet.js',
  'js/ui/banner.js',
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
