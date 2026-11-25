import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPush, PushError, urlBase64ToUint8Array } from '../js/push.js';

const CONFIG = { workerUrl: 'https://kalender-push.example.workers.dev/', vapidPublicKey: 'BKPbZTktxzUY1wVdrLwQSM4O8UIUAYzS1jD2EqOs-0kU4GBuP0EuHi24Mt7PKl_ECCfsgMbxgZHNWO2u_aOj6ek' };
const BIRTHDAYS = [{ id: 'a', name: 'Anna', day: 25, month: 11, year: 1990, extra: 'wird nicht gesendet' }, { id: 'b', name: 'Ben', day: 1, month: 2 }];

function setup({ responses = {}, permission = 'granted', installed = true, hasPush = true, subscribed = false, tokenState = null, config = CONFIG } = {}) {
  const store = new Map(tokenState ? [['push', tokenState]] : []);
  const meta = { get: (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async (k) => void store.delete(k) };
  const calls = [];
  let current = subscribed ? mkSub('https://web.push.apple.com/old') : null;
  function mkSub(endpoint, key) {
    return { endpoint, options: { applicationServerKey: (key ?? urlBase64ToUint8Array(CONFIG.vapidPublicKey)).buffer ?? key },
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }),
      unsubscribe: async () => { calls.push(['unsubscribe']); current = null; return true; } };
  }
  const registration = { pushManager: {
    getSubscription: async () => current,
    subscribe: async (opts) => { calls.push(['subscribe', opts]); current = mkSub('https://web.push.apple.com/new'); return current; },
  } };
  const Notification = { permission, requestPermission: async () => (calls.push(['requestPermission']), permission) };
  const env = {
    Notification, hasPushManager: () => hasPush, isInstalled: () => installed, timeZone: () => 'Europe/Berlin',
    getRegistration: async () => registration,
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      calls.push(['fetch', path, JSON.parse(init.body), init.headers.authorization]);
      const r = responses[path] ?? { status: 200 };
      if (r.throw) throw new Error('offline');
      return { ok: r.status >= 200 && r.status < 300, status: r.status };
    },
  };
  const push = createPush({ config, meta, getBirthdays: () => BIRTHDAYS, env });
  return { push, calls, store, setSub: (s) => (current = s), mkSub };
}
const fetchCalls = (calls) => calls.filter((c) => c[0] === 'fetch');

test('urlBase64ToUint8Array: VAPID-Schlüssel hat 65 Byte, beginnt mit 0x04', () => {
  const bytes = urlBase64ToUint8Array(CONFIG.vapidPublicKey);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4);
});

test('status: unconfigured / unsupported / denied / off / on', () => {
  assert.equal(setup({ config: { workerUrl: '', vapidPublicKey: '' } }).push.status().state, 'unconfigured');
  assert.deepEqual(setup({ hasPush: false }).push.status(), { state: 'unsupported', reason: 'no-push' });
  assert.deepEqual(setup({ installed: false }).push.status(), { state: 'unsupported', reason: 'not-installed' });
  assert.equal(setup({ permission: 'denied' }).push.status().state, 'denied');
  assert.equal(setup().push.status().state, 'off');
  assert.equal(setup({ tokenState: { token: 't', endpoint: 'e' } }).push.status().state, 'on');
});

test('enable: Berechtigung -> Abo -> /subscribe mit Token, Geburtstagen und Zeitzone -> lokal gemerkt', async () => {
  const { push, calls, store } = setup();
  await push.enable('  mein-code  ');
  assert.equal(calls[0][0], 'requestPermission', 'Berechtigung zuerst (direkt aus dem Tipp)');
  const sub = calls.find((c) => c[0] === 'subscribe');
  assert.equal(sub[1].userVisibleOnly, true);
  assert.equal(sub[1].applicationServerKey.length, 65);
  const [, path, body, auth] = fetchCalls(calls)[0];
  assert.equal(path, '/subscribe');
  assert.equal(auth, 'Bearer mein-code');
  assert.equal(body.tz, 'Europe/Berlin');
  assert.equal(body.subscription.endpoint, 'https://web.push.apple.com/new');
  assert.deepEqual(body.birthdays, [
    { id: 'a', name: 'Anna', day: 25, month: 11, year: 1990 }, // nur die nötigen Felder
    { id: 'b', name: 'Ben', day: 1, month: 2, year: null },
  ]);
  assert.deepEqual(store.get('push'), { token: 'mein-code', endpoint: 'https://web.push.apple.com/new' });
});

test('enable: Fehlerfälle (kein Code, falscher Code, Server weg, nicht installiert, nicht eingerichtet)', async () => {
  await assert.rejects(setup().push.enable(''), (e) => e.code === 'token');
  await assert.rejects(setup({ responses: { '/subscribe': { status: 401 } } }).push.enable('falsch'), (e) => e.code === 'token');
  await assert.rejects(setup({ responses: { '/subscribe': { throw: true } } }).push.enable('x'), (e) => e.code === 'network');
  await assert.rejects(setup({ responses: { '/subscribe': { status: 500 } } }).push.enable('x'), (e) => e.code === 'server');
  await assert.rejects(setup({ installed: false }).push.enable('x'), (e) => e.code === 'unsupported');
  await assert.rejects(setup({ config: { workerUrl: '', vapidPublicKey: '' } }).push.enable('x'), (e) => e.code === 'unconfigured');
  // bei Fehler wird nichts als "an" gespeichert
  const failed = setup({ responses: { '/subscribe': { status: 401 } } });
  await failed.push.enable('x').catch(() => {});
  assert.equal(failed.store.has('push'), false);
});

test('enable: Berechtigung nicht erteilt (abgelehnt oder Dialog weggewischt) -> permission, kein Serverkontakt', async () => {
  for (const permission of ['denied', 'default']) {
    const t = setup({ permission });
    await assert.rejects(t.push.enable('x'), (e) => e instanceof PushError && e.code === 'permission', permission);
    assert.equal(t.store.has('push'), false);
    assert.equal(fetchCalls(t.calls).length, 0);
  }
});

test('enable: bestehendes Abo wird wiederverwendet; Abo mit fremdem Schlüssel wird erneuert', async () => {
  const same = setup({ subscribed: true });
  await same.push.enable('x');
  assert.ok(!same.calls.some((c) => c[0] === 'subscribe'));
  assert.equal(fetchCalls(same.calls)[0][2].subscription.endpoint, 'https://web.push.apple.com/old');

  const other = setup();
  other.setSub(other.mkSub('https://web.push.apple.com/alt', new Uint8Array(65).fill(7)));
  await other.push.enable('x');
  assert.ok(other.calls.some((c) => c[0] === 'unsubscribe'));
  assert.ok(other.calls.some((c) => c[0] === 'subscribe'));
});

test('sync: nur wenn an; schickt aktuelle Geburtstage', async () => {
  const off = setup();
  assert.deepEqual(await off.push.sync(), { ok: false, skipped: true });
  assert.equal(fetchCalls(off.calls).length, 0);

  const on = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'https://web.push.apple.com/old' } });
  assert.deepEqual(await on.push.sync(), { ok: true });
  const [, path, body, auth] = fetchCalls(on.calls)[0];
  assert.equal(path, '/sync');
  assert.equal(auth, 'Bearer tok');
  assert.equal(body.birthdays.length, 2);
  assert.equal(body.endpoint, 'https://web.push.apple.com/old');
});

test('sync: Server kennt Abo nicht (404) -> neu anmelden; offline -> still scheitern', async () => {
  const lost = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'https://web.push.apple.com/old' }, responses: { '/sync': { status: 404 } } });
  assert.deepEqual(await lost.push.sync(), { ok: true });
  assert.deepEqual(fetchCalls(lost.calls).map((c) => c[1]), ['/sync', '/subscribe']);

  const offline = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'e' }, responses: { '/sync': { throw: true } } });
  assert.deepEqual(await offline.push.sync(), { ok: false, error: 'network' });
  assert.equal(offline.push.status().state, 'on', 'bleibt an, nächster Versuch beim nächsten Start');
});

test('sync: iOS hat das Abo entzogen -> lokal auf "aus" gesetzt', async () => {
  const gone = setup({ subscribed: false, tokenState: { token: 'tok', endpoint: 'e' } });
  assert.deepEqual(await gone.push.sync(), { ok: false, lost: true });
  assert.equal(gone.push.status().state, 'off');
});

test('disable: meldet beim Server ab, löscht Abo und lokalen Zustand', async () => {
  const t = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'e' } });
  await t.push.disable();
  assert.equal(fetchCalls(t.calls)[0][1], '/unsubscribe');
  assert.ok(t.calls.some((c) => c[0] === 'unsubscribe'));
  assert.equal(t.push.status().state, 'off');
  // auch wenn der Server nicht erreichbar ist
  const o = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'e' }, responses: { '/unsubscribe': { throw: true } } });
  await o.push.disable();
  assert.equal(o.push.status().state, 'off');
});

test('sendTest: ok, abgelaufen (410) setzt Zustand zurück', async () => {
  const ok = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'e' } });
  await ok.push.sendTest();
  assert.equal(fetchCalls(ok.calls)[0][1], '/test');
  const gone = setup({ subscribed: true, tokenState: { token: 'tok', endpoint: 'e' }, responses: { '/test': { status: 410 } } });
  await assert.rejects(gone.push.sendTest(), (e) => e.code === 'expired');
  assert.equal(gone.push.status().state, 'off');
  await assert.rejects(setup().push.sendTest(), (e) => e.code === 'unconfigured');
});
