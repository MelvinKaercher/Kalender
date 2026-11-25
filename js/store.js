// Speicher: IndexedDB auf dem Gerät. Alles liegt zusätzlich in einem In-Memory-Cache,
// damit die Oberfläche synchron lesen kann. Schreibzugriffe gehen zuerst in den Cache
// (UI aktualisiert sofort) und dann in die Datenbank.
//
// Stores:  events    { id, title, date:'YYYY-MM-DD', allDay, start:'HH:MM', end:'HH:MM', note, remind:null|Minuten }
//          birthdays { id, name, day, month, year|null }
//          seen      { key }   (bereits weggewischte Erinnerungen)
//          meta      { key, value }   (lokale Einstellungen, z. B. Push-Status und Zugangscode)

const DB_NAME = 'kalender';
const DB_VERSION = 2;

let db = null;
let persistent = true;
const cache = { events: [], birthdays: [], seen: new Set(), meta: new Map() };
const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      const ensure = (name, keyPath) => { if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath }); };
      ensure('events', 'id');
      ensure('birthdays', 'id');
      ensure('seen', 'key');
      ensure('meta', 'key'); // neu in Version 2
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const getAll = (store) =>
  new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function write(store, fn) {
  if (!persistent) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    fn(tx.objectStore(store));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch((err) => console.error('Speichern fehlgeschlagen', err));
}

const notify = () => listeners.forEach((fn) => fn());
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Datenbank öffnen und alles in den Cache laden. */
export async function load() {
  try {
    db = await openDb();
    const [events, birthdays, seen, metaRows] = await Promise.all([getAll('events'), getAll('birthdays'), getAll('seen'), getAll('meta')]);
    cache.events = events;
    cache.birthdays = birthdays;
    cache.seen = new Set(seen.map((s) => s.key));
    cache.meta = new Map(metaRows.map((m) => [m.key, m.value]));
    // Bitte iOS, die Daten nicht automatisch zu verwerfen.
    navigator.storage?.persist?.().catch(() => {});
  } catch (err) {
    // z. B. privates Surfen: App funktioniert weiter, Daten gehen aber beim Schließen verloren.
    console.warn('IndexedDB nicht verfügbar – Daten werden nur im Speicher gehalten.', err);
    persistent = false;
  }
}

export const isPersistent = () => persistent;
export const events = () => cache.events;
export const birthdays = () => cache.birthdays;
export const seen = () => cache.seen;
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item);
  else list[i] = item;
}

// Gelöschte Einträge merken wir uns (id → Zeitpunkt), damit der Abgleich die Löschung auf andere Geräte bringt.
function addTomb(kind, id) {
  const tombs = meta.get('tombs') || { events: {}, birthdays: {} };
  meta.set('tombs', { ...tombs, [kind]: { ...tombs[kind], [id]: Date.now() } });
}

export function saveEvent(ev) {
  const item = { ...ev, id: ev.id || newId(), updatedAt: Date.now() };
  upsert(cache.events, item);
  notify();
  return write('events', (s) => s.put(item)).then(() => item);
}

export function deleteEvent(id) {
  addTomb('events', id);
  cache.events = cache.events.filter((e) => e.id !== id);
  notify();
  return write('events', (s) => s.delete(id));
}

export function saveBirthday(b) {
  const item = { ...b, id: b.id || newId(), updatedAt: Date.now() };
  upsert(cache.birthdays, item);
  notify();
  return write('birthdays', (s) => s.put(item)).then(() => item);
}

export function deleteBirthday(id) {
  addTomb('birthdays', id);
  cache.birthdays = cache.birthdays.filter((b) => b.id !== id);
  notify();
  return write('birthdays', (s) => s.delete(id));
}

export function markSeen(key) {
  if (cache.seen.has(key)) return Promise.resolve();
  cache.seen.add(key);
  notify();
  return write('seen', (s) => s.put({ key }));
}

/** Lokale Einstellungen (nur auf diesem Gerät). */
export const meta = {
  get: (key) => cache.meta.get(key) ?? null,
  set(key, value) {
    cache.meta.set(key, value);
    return write('meta', (s) => s.put({ key, value }));
  },
  delete(key) {
    cache.meta.delete(key);
    return write('meta', (s) => s.delete(key));
  },
};

/* ───────── Abgleich zwischen Geräten ───────── */

/** Gesamter Datenstand (Termine, Ereignisse, Löschvermerke) – ohne lokale Einstellungen. */
export function snapshot() {
  const t = cache.meta.get('tombs') || {};
  return { events: [...cache.events], birthdays: [...cache.birthdays], tombs: { events: t.events || {}, birthdays: t.birthdays || {} } };
}

/** Übernimmt einen zusammengeführten Stand, ohne `updatedAt` zu verändern. */
export async function applySnapshot(snap) {
  for (const [kind, name] of [['events', 'events'], ['birthdays', 'birthdays']]) {
    const next = snap[kind] || [];
    const nextIds = new Set(next.map((x) => x.id));
    const removed = cache[kind].filter((x) => !nextIds.has(x.id)).map((x) => x.id);
    const before = new Map(cache[kind].map((x) => [x.id, JSON.stringify(x)]));
    const changed = next.filter((x) => before.get(x.id) !== JSON.stringify(x));
    cache[kind] = [...next];
    if (removed.length || changed.length) {
      await write(name, (st) => { removed.forEach((id) => st.delete(id)); changed.forEach((x) => st.put(x)); });
    }
  }
  await meta.set('tombs', snap.tombs || { events: {}, birthdays: {} });
  notify();
}
