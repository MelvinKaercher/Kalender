// Prüft die Push-Handler des Service Workers, indem sw.js in einer isolierten Umgebung
// mit Attrappen ausgeführt wird (kein Browser nötig).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadSw({ windows = [] } = {}) {
  const handlers = {};
  const shown = [];
  const opened = [];
  const self = {
    location: { origin: 'https://melvin.github.io' },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: {
      scope: 'https://melvin.github.io/Kalender/',
      showNotification: async (title, options) => { shown.push({ title, options }); },
    },
    clients: {
      matchAll: async () => windows,
      openWindow: async (url) => { opened.push(url); },
      claim: async () => {},
    },
    skipWaiting: async () => {},
  };
  vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), { self, URL, console, caches: {}, fetch: async () => {}, Response });
  return { handlers, shown, opened };
}

/** Ruft einen Handler auf und wartet auf das, was er an waitUntil übergibt. */
async function fire(handler, event) {
  let pending;
  await handler({ ...event, waitUntil: (p) => { pending = p; } });
  await pending;
  return pending !== undefined;
}

const pushEvent = (data) => ({ data: data === undefined ? null : { json: () => JSON.parse(data), text: () => data } });

test('Push mit JSON: Titel, Text, Tag und Ziel-Adresse werden angezeigt', async () => {
  const { handlers, shown } = loadSw();
  const waited = await fire(handlers.push, pushEvent(JSON.stringify({ title: 'Anna hat heute Geburtstag', body: 'wird 36', tag: 'bd-1', url: './?open=birthday:1' })));
  assert.ok(waited, 'waitUntil wurde benutzt');
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'Anna hat heute Geburtstag');
  assert.equal(shown[0].options.body, 'wird 36');
  assert.equal(shown[0].options.tag, 'bd-1');
  assert.equal(shown[0].options.data.url, './?open=birthday:1');
  assert.equal(shown[0].options.icon, 'icons/icon-192.png');
});

test('iOS-Regel: jede Push-Nachricht zeigt IMMER eine Benachrichtigung (auch bei leerem oder kaputtem Inhalt)', async () => {
  for (const data of [undefined, 'das ist kein json', '{}', '']) {
    const { handlers, shown } = loadSw();
    await fire(handlers.push, pushEvent(data));
    assert.equal(shown.length, 1, `Inhalt: ${JSON.stringify(data)}`);
    assert.equal(shown[0].title, 'Kalender');
  }
  const { handlers, shown } = loadSw();
  await fire(handlers.push, pushEvent('Klartext statt JSON'));
  assert.equal(shown[0].options.body, 'Klartext statt JSON');
});

test('Klick: bestehendes App-Fenster wird fokussiert und bekommt die Adresse', async () => {
  const events = [];
  const win = { focus: async () => events.push('focus'), postMessage: (m) => events.push(m) };
  const { handlers, opened } = loadSw({ windows: [win] });
  let closed = false;
  await fire(handlers.notificationclick, { notification: { close: () => (closed = true), data: { url: './?open=birthday:1' } } });
  assert.ok(closed, 'Benachrichtigung wird geschlossen');
  // (Objekte aus der isolierten Umgebung haben einen anderen Prototyp: über JSON vergleichen)
  assert.deepEqual(JSON.parse(JSON.stringify(events)), ['focus', { type: 'open', url: 'https://melvin.github.io/Kalender/?open=birthday:1' }]);
  assert.deepEqual(opened, [], 'kein zweites Fenster');
});

test('Klick ohne offenes Fenster: App wird mit der Adresse geöffnet', async () => {
  const { handlers, opened } = loadSw({ windows: [] });
  await fire(handlers.notificationclick, { notification: { close() {}, data: { url: './?open=birthday:42' } } });
  assert.deepEqual(opened, ['https://melvin.github.io/Kalender/?open=birthday:42']);
  // ohne Ziel: Startseite der App
  const b = loadSw({ windows: [] });
  await fire(b.handlers.notificationclick, { notification: { close() {}, data: {} } });
  assert.deepEqual(b.opened, ['https://melvin.github.io/Kalender/']);
});

test('Precache-Liste enthält alle neuen Dateien und verweist nur auf vorhandene', async () => {
  const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const list = [...src.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]).filter((f) => f !== './');
  for (const f of ['js/push.js', 'js/config.js', 'js/colors.js', 'js/ui/settings.js', 'js/birthdays.js']) assert.ok(list.includes(f), f);
  const { existsSync } = await import('node:fs');
  for (const f of list) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `fehlt: ${f}`);
});
