// Abgleich zwischen Geräten – reine Logik (ohne DOM, in Node testbar):
// Zusammenführen von Datenständen und Ende-zu-Ende-Verschlüsselung.
// Der Server speichert nur einen verschlüsselten Block, den er nicht lesen kann.

const DAY = 86400000;
const KINDS = ['events', 'birthdays', 'goals'];
export const TOMB_KEEP_DAYS = 180;

export class SyncError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // 'password' | 'token' | 'network' | 'server' | 'unconfigured'
  }
}

/** Leerer Datenstand: tombs = gelöschte Einträge { id: Zeitpunkt der Löschung }. */
export const emptySnapshot = () => ({ events: [], birthdays: [], goals: [], tombs: { events: {}, birthdays: {}, goals: {} } });

/** Stabile Textform (Schlüssel sortiert, Listen nach id) – zum Vergleichen zweier Datenstände. */
export function canon(snapshot) {
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
    return v;
  };
  const s = snapshot || emptySnapshot();
  return JSON.stringify(sortKeys({
    events: [...(s.events || [])].sort((a, b) => (a.id < b.id ? -1 : 1)),
    birthdays: [...(s.birthdays || [])].sort((a, b) => (a.id < b.id ? -1 : 1)),
    goals: [...(s.goals || [])].sort((a, b) => (a.id < b.id ? -1 : 1)),
    tombs: { events: s.tombs?.events || {}, birthdays: s.tombs?.birthdays || {}, goals: s.tombs?.goals || {} },
  }));
}

/**
 * Führt zwei Datenstände zusammen: je Eintrag gewinnt der zuletzt geänderte (updatedAt);
 * ein gelöschter Eintrag bleibt gelöscht, wenn die Löschung neuer ist als die letzte Änderung.
 * Bei Gleichstand gewinnt `a` (der lokale Stand).
 */
export function mergeSnapshots(a, b, now = Date.now()) {
  const out = emptySnapshot();
  for (const kind of KINDS) {
    const items = new Map();
    for (const list of [a?.[kind] || [], b?.[kind] || []]) {
      for (const item of list) {
        const cur = items.get(item.id);
        if (!cur || (item.updatedAt || 0) > (cur.updatedAt || 0)) items.set(item.id, item);
      }
    }
    const tombs = {};
    for (const map of [a?.tombs?.[kind] || {}, b?.tombs?.[kind] || {}]) {
      for (const [id, t] of Object.entries(map)) tombs[id] = Math.max(tombs[id] || 0, t);
    }
    for (const [id, t] of Object.entries(tombs)) {
      const item = items.get(id);
      if (item && (item.updatedAt || 0) > t) delete tombs[id]; // danach neu angelegt/geändert
      else items.delete(id);
      if (now - t > TOMB_KEEP_DAYS * DAY) delete tombs[id]; // alte Löschvermerke aufräumen
    }
    out[kind] = [...items.values()];
    out.tombs[kind] = tombs;
  }
  return out;
}

/* ───────── Verschlüsselung: PBKDF2 → AES-GCM ───────── */

const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITERATIONS = 200000;
const keyCache = new Map();

async function deriveKey(password, saltB64) {
  const id = `${saltB64}|${password}`;
  if (keyCache.has(id)) return keyCache.get(id);
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  keyCache.set(id, key);
  return key;
}

export const newSalt = () => toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));

/** Datenstand → verschlüsselter Text (JSON mit Salz, IV und Chiffretext). */
export async function encryptSnapshot(snapshot, password, salt = newSalt()) {
  const key = await deriveKey(password, salt);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(snapshot)));
  return JSON.stringify({ v: 1, salt, iv: toB64(iv), ct: toB64(ct) });
}

/** Verschlüsselter Text → { snapshot, salt }. Falsches Passwort → SyncError('password'). */
export async function decryptSnapshot(blob, password) {
  let box;
  try { box = JSON.parse(blob); } catch { throw new SyncError('server', 'blob'); }
  if (!box || box.v !== 1 || !box.salt || !box.iv || !box.ct) throw new SyncError('server', 'blob');
  try {
    const key = await deriveKey(password, box.salt);
    const plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return { snapshot: { ...emptySnapshot(), ...JSON.parse(dec.decode(plain)) }, salt: box.salt };
  } catch {
    throw new SyncError('password');
  }
}
