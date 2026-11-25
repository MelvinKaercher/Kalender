import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshots, canon, emptySnapshot, encryptSnapshot, decryptSnapshot, SyncError } from '../js/sync-core.js';
import { createSync } from '../js/sync.js';

const ev = (id, title, updatedAt) => ({ id, title, date: '2026-05-11', updatedAt });
const snap = (events = [], birthdays = [], tombs = {}) => ({ events, birthdays, tombs: { events: tombs.events || {}, birthdays: tombs.birthdays || {} } });

test('merge: Vereinigung, neuere Änderung gewinnt, Gleichstand lokal', () => {
  const a = snap([ev('1', 'A neu', 200), ev('2', 'nur a', 1)]);
  const b = snap([ev('1', 'B alt', 100), ev('3', 'nur b', 1)]);
  const m = mergeSnapshots(a, b, 1000);
  assert.deepEqual(m.events.map((e) => [e.id, e.title]).sort(), [['1', 'A neu'], ['2', 'nur a'], ['3', 'nur b']]);
  assert.equal(mergeSnapshots(snap([ev('1', 'lokal', 5)]), snap([ev('1', 'fern', 5)])).events[0].title, 'lokal');
});

test('merge: Löschung gewinnt gegen ältere Änderung, neuere Änderung gewinnt gegen Löschung', () => {
  const del = snap([], [], { events: { 1: 500 } });
  assert.equal(mergeSnapshots(snap([ev('1', 'x', 400)]), del, 1000).events.length, 0);
  const m = mergeSnapshots(snap([ev('1', 'neu angelegt', 600)]), del, 1000);
  assert.equal(m.events.length, 1);
  assert.deepEqual(m.tombs.events, {});
});

test('merge: alte Löschvermerke werden aufgeräumt; Ergebnis ist symmetrisch', () => {
  const old = snap([], [], { events: { 9: 1 } });
  assert.deepEqual(mergeSnapshots(old, emptySnapshot(), 1 + 181 * 86400000).tombs.events, {});
  const a = snap([ev('1', 'a', 2)], [{ id: 'b', name: 'N', updatedAt: 3 }], { events: { 7: 9 } });
  const b = snap([ev('1', 'b', 1), ev('2', 'x', 5)], [], { events: { 7: 4, 8: 1 } });
  assert.equal(canon(mergeSnapshots(a, b, 100)), canon(mergeSnapshots(b, a, 100)));
});

test('canon ignoriert Reihenfolge von Schlüsseln und Listen', () => {
  assert.equal(canon(snap([{ id: '1', a: 1, b: 2 }, { id: '2' }])), canon(snap([{ id: '2' }, { b: 2, id: '1', a: 1 }])));
});

test('Verschlüsselung: Rundreise, falsches Passwort, Server sieht keinen Klartext', async () => {
  const s = snap([ev('1', 'Geheimer Kunde Silas', 1)]);
  const blob = await encryptSnapshot(s, 'pw-richtig');
  assert.ok(!blob.includes('Silas'));
  const got = await decryptSnapshot(blob, 'pw-richtig');
  assert.equal(canon(got.snapshot), canon(s));
  await assert.rejects(decryptSnapshot(blob, 'falsch'), (e) => e instanceof SyncError && e.code === 'password');
  const again = await encryptSnapshot(s, 'pw-richtig', got.salt);
  assert.equal(JSON.parse(again).salt, got.salt);
  assert.notEqual(JSON.parse(again).iv, JSON.parse(blob).iv, 'neuer IV je Verschlüsselung');
});

/* Gerät mit Speicher + gemeinsamem Fake-Server */
function fakeServer() {
  const vault = { version: 0, blob: null };
  const calls = [];
  const fetch = async (url, init) => {
    const path = new URL(url).pathname; const body = JSON.parse(init.body);
    calls.push(path);
    if (init.headers.authorization !== 'Bearer code') return { ok: false, status: 401, json: async () => ({}) };
    if (path === '/sync/get') return { ok: true, status: 200, json: async () => ({ ...vault }) };
    if (body.baseVersion !== vault.version) return { ok: false, status: 409, json: async () => ({}) };
    vault.version += 1; vault.blob = body.blob;
    return { ok: true, status: 200, json: async () => ({ version: vault.version }) };
  };
  return { vault, fetch, calls };
}
function device(server, now = () => 1000) {
  const m = new Map();
  let data = emptySnapshot();
  const meta = { get: (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } };
  const store = { snapshot: () => data, applySnapshot: async (s) => { data = s; } };
  const syncer = createSync({ config: { workerUrl: 'https://x.example' }, meta, store, env: { fetch: (...a) => server.fetch(...a), now } });
  return { syncer, set: (s) => { data = s; }, get: () => data };
}

test('Abgleich: Gerät A lädt hoch, Gerät B bekommt die Daten, Änderungen und Löschungen wandern zurück', async () => {
  const server = fakeServer();
  const a = device(server), b = device(server);
  a.set(snap([ev('1', 'Haarschnitt', 10)]));
  await a.syncer.enable({ token: 'code', password: 'pw' });
  assert.ok(!server.vault.blob.includes('Haarschnitt'));
  await b.syncer.enable({ token: 'code', password: 'pw' });
  assert.equal(b.get().events[0].title, 'Haarschnitt');
  // B ändert, A holt es
  b.set(snap([ev('1', 'Haarschnitt geändert', 20), ev('2', 'neu', 20)]));
  await b.syncer.sync(); await a.syncer.sync();
  assert.deepEqual(a.get().events.map((e) => e.title).sort(), ['Haarschnitt geändert', 'neu']);
  // A löscht 2
  a.set(snap([ev('1', 'Haarschnitt geändert', 20)], [], { events: { 2: 30 } }));
  await a.syncer.sync(); await b.syncer.sync();
  assert.deepEqual(b.get().events.map((e) => e.id), ['1']);
  assert.equal(a.syncer.status().state, 'on');
  assert.equal(a.syncer.status().last, 1000);
});

test('Abgleich: falscher Zugangscode / falsches Passwort lassen das Gerät ausgeschaltet', async () => {
  const server = fakeServer();
  const a = device(server); a.set(snap([ev('1', 'x', 1)]));
  await a.syncer.enable({ token: 'code', password: 'pw' });
  const b = device(server);
  await assert.rejects(b.syncer.enable({ token: 'falsch', password: 'pw' }), (e) => e.code === 'token');
  await assert.rejects(b.syncer.enable({ token: 'code', password: 'anders' }), (e) => e.code === 'password');
  assert.equal(b.syncer.status().state, 'off');
  assert.equal(b.get().events.length, 0, 'lokale Daten bleiben unangetastet');
});

test('Abgleich: bei Versionskonflikt wird neu geholt und zusammengeführt', async () => {
  const server = fakeServer();
  const a = device(server), b = device(server);
  a.set(snap([ev('1', 'a', 1)])); await a.syncer.enable({ token: 'code', password: 'pw' });
  await b.syncer.enable({ token: 'code', password: 'pw' });
  // A lädt zwischen B.get und B.put etwas hoch
  const orig = server.fetch; let hijacked = false;
  server.fetch = async (url, init) => {
    const r = await orig(url, init);
    if (!hijacked && new URL(url).pathname === '/sync/get') { hijacked = true; a.set(snap([ev('1', 'a', 1), ev('3', 'von a', 5)])); await a.syncer.sync(); }
    return r;
  };
  b.set(snap([ev('1', 'a', 1), ev('2', 'von b', 6)]));
  await b.syncer.sync();
  assert.deepEqual(b.get().events.map((e) => e.id).sort(), ['1', '2', '3']);
});

test('Abgleich: unkonfiguriert und ausgeschaltet', async () => {
  const meta = { get: () => null, set: async () => {}, delete: async () => {} };
  const s = createSync({ config: { workerUrl: '' }, meta, store: {}, env: {} });
  assert.equal(s.status().state, 'unconfigured');
  await assert.rejects(s.enable({ token: 'a', password: 'b' }), (e) => e.code === 'unconfigured');
});
