import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, runScheduled, isAllowedEndpoint } from '../src/app.js';

const ORIGIN = 'https://melvin.github.io';
const TOKEN = 'geheimer-zugangscode';
const ENDPOINT = 'https://web.push.apple.com/QGxyz123';

function fakeKV() {
  const map = new Map();
  return {
    map,
    async get(key, type) { const v = map.get(key); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; },
    async put(key, value) { map.set(key, value); },
    async delete(key) { map.delete(key); },
    async list({ prefix = '' } = {}) {
      return { keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
}
const mkEnv = (over = {}) => ({ SUBS: fakeKV(), APP_TOKEN: TOKEN, ALLOWED_ORIGIN: ORIGIN, ...over });
const sub = (endpoint = ENDPOINT) => ({ endpoint, expirationTime: null, keys: { p256dh: 'BPublicKeyPublicKeyPublicKey', auth: 'AuthSecretAuth' } });
const bdays = [{ id: 'anna', name: 'Anna', day: 25, month: 11, year: 1990 }];

function call(env, path, body, { token = TOKEN, origin = ORIGIN, method = 'POST', sendPush = async () => ({ status: 201 }) } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  return handleRequest(new Request(`https://worker.example${path}`, { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined }), env, { sendPush });
}
const subscribe = (env, over = {}) => call(env, '/subscribe', { subscription: sub(), birthdays: bdays, tz: 'Europe/Berlin', ...over });

test('Endpoint-Allowlist: nur echte Push-Dienste über https', () => {
  for (const ok of ['https://web.push.apple.com/abc', 'https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=1']) {
    assert.ok(isAllowedEndpoint(ok), ok);
  }
  for (const bad of ['http://web.push.apple.com/abc', 'https://evil.example/abc', 'https://web.push.apple.com.evil.example/x', 'https://user:pw@web.push.apple.com/x', 'https://web.push.apple.com:8443/x', 'https://169.254.169.254/', 'https://localhost/', 'ftp://web.push.apple.com/', 'kein url', '']) {
    assert.ok(!isAllowedEndpoint(bad), bad);
  }
  assert.ok(!isAllowedEndpoint('http://localhost:9000/x')); // lokal nur mit Dev-Schalter
  assert.ok(isAllowedEndpoint('http://localhost:9000/x', { ALLOW_LOCAL_ENDPOINT: 'true' }));
});

test('ohne oder mit falschem Token: 401, nichts wird gespeichert', async () => {
  const env = mkEnv();
  assert.equal((await subscribe(env, {}, {})).status, 200); // Kontrolle: mit Token geht es
  const env2 = mkEnv();
  assert.equal((await call(env2, '/subscribe', { subscription: sub(), birthdays: bdays, tz: 'UTC' }, { token: null })).status, 401);
  assert.equal((await call(env2, '/subscribe', { subscription: sub(), birthdays: bdays, tz: 'UTC' }, { token: 'falsch' })).status, 401);
  assert.equal(env2.SUBS.map.size, 0);
});

test('kein APP_TOKEN konfiguriert: alles abgelehnt', async () => {
  const env = mkEnv({ APP_TOKEN: '' });
  assert.equal((await call(env, '/subscribe', {}, { token: '' })).status, 401);
  assert.equal((await call(env, '/subscribe', {}, { token: 'x' })).status, 401);
});

test('fremder Origin: 403; CORS-Header nur für die eigene Seite', async () => {
  const env = mkEnv();
  assert.equal((await subscribe(env, {}, {}) && (await call(env, '/subscribe', {}, { origin: 'https://evil.example' })).status), 403);
  const ok = await subscribe(env);
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const pre = await call(env, '/subscribe', undefined, { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
  const preEvil = await call(env, '/subscribe', undefined, { method: 'OPTIONS', origin: 'https://evil.example' });
  assert.equal(preEvil.status, 403);
});

test('GET wird abgelehnt', async () => {
  const res = await call(mkEnv(), '/subscribe', undefined, { method: 'GET' });
  assert.equal(res.status, 405);
});

test('subscribe: speichert Abo, Zeitzone und Geburtstage; prüft Eingaben', async () => {
  const env = mkEnv();
  assert.equal((await subscribe(env)).status, 200);
  const [rec] = [...env.SUBS.map.values()].map((v) => JSON.parse(v));
  assert.equal(rec.tz, 'Europe/Berlin');
  assert.deepEqual(rec.birthdays, [{ id: 'anna', name: 'Anna', day: 25, month: 11, year: 1990, type: 'birthday' }]); // ohne Typ = Geburtstag
  assert.deepEqual(rec.sent, {});

  const e = mkEnv();
  assert.equal((await subscribe(e, { subscription: sub('https://evil.example/x') })).status, 400);
  assert.equal((await subscribe(e, { subscription: { endpoint: ENDPOINT, keys: {} } })).status, 400);
  assert.equal((await subscribe(e, { tz: 'Mars/Olympus' })).status, 400);
  assert.equal((await subscribe(e, { birthdays: [{ id: 'x', name: 'A', day: 32, month: 1, year: null }] })).status, 400);
  assert.equal((await subscribe(e, { birthdays: [{ id: 'x', name: '', day: 1, month: 1, year: null }] })).status, 400);
  assert.equal((await subscribe(e, { birthdays: [{ id: 'a b', name: 'A', day: 1, month: 1, year: null }] })).status, 400);
  assert.equal((await subscribe(e, { birthdays: Array.from({ length: 501 }, (_, i) => ({ id: `i${i}`, name: 'A', day: 1, month: 1, year: null })) })).status, 400);
  assert.equal(e.SUBS.map.size, 0);
});

test('zu große Anfrage: 413', async () => {
  const env = mkEnv();
  const res = await call(env, '/subscribe', { subscription: sub(), birthdays: bdays, tz: 'UTC', pad: 'x'.repeat(70 * 1024) });
  assert.equal(res.status, 413);
});

test('höchstens 5 Abos; bekanntes Abo darf aktualisieren', async () => {
  const env = mkEnv();
  for (let i = 0; i < 5; i++) assert.equal((await subscribe(env, { subscription: sub(`https://web.push.apple.com/e${i}`) })).status, 200);
  assert.equal((await subscribe(env, { subscription: sub('https://web.push.apple.com/e5') })).status, 429);
  assert.equal((await subscribe(env, { subscription: sub('https://web.push.apple.com/e0') })).status, 200);
});

test('erneutes subscribe behält die "gesendet"-Markierungen', async () => {
  const env = mkEnv();
  await subscribe(env);
  const key = [...env.SUBS.map.keys()][0];
  const rec = JSON.parse(env.SUBS.map.get(key));
  rec.sent = { 'anna:2026:today': 'x' };
  env.SUBS.map.set(key, JSON.stringify(rec));
  await subscribe(env);
  assert.deepEqual(JSON.parse(env.SUBS.map.get(key)).sent, { 'anna:2026:today': 'x' });
});

test('sync: aktualisiert Geburtstage; unbekanntes Abo -> 404', async () => {
  const env = mkEnv();
  assert.equal((await call(env, '/sync', { endpoint: ENDPOINT, birthdays: bdays, tz: 'UTC' })).status, 404);
  await subscribe(env);
  const next = [...bdays, { id: 'ben', name: 'Ben', day: 1, month: 2, year: null }];
  assert.equal((await call(env, '/sync', { endpoint: ENDPOINT, birthdays: next, tz: 'America/New_York' })).status, 200);
  const rec = JSON.parse([...env.SUBS.map.values()][0]);
  assert.equal(rec.birthdays.length, 2);
  assert.equal(rec.tz, 'America/New_York');
});

test('unsubscribe löscht das Abo', async () => {
  const env = mkEnv();
  await subscribe(env);
  assert.equal((await call(env, '/unsubscribe', { endpoint: ENDPOINT })).status, 200);
  assert.equal(env.SUBS.map.size, 0);
});

test('test: sendet sofort; abgelaufenes Abo (410) wird gelöscht', async () => {
  const env = mkEnv();
  await subscribe(env);
  const calls = [];
  const ok = await call(env, '/test', { endpoint: ENDPOINT }, { sendPush: async (s, m) => (calls.push([s.endpoint, m]), { status: 201 }) });
  assert.equal(ok.status, 200);
  assert.equal(calls[0][0], ENDPOINT);
  assert.equal(calls[0][1].title, 'Kalender');
  const gone = await call(env, '/test', { endpoint: ENDPOINT }, { sendPush: async () => ({ status: 410 }) });
  assert.equal(gone.status, 410);
  assert.equal(env.SUBS.map.size, 0);
  assert.equal((await call(env, '/test', { endpoint: ENDPOINT })).status, 404);
});

/* ───────── Cron ───────── */

async function subscribed(env = mkEnv(), over = {}) {
  await subscribe(env, over);
  return env;
}

test('Cron: sendet um 00:00 die Geburtstags-Nachricht, genau einmal', async () => {
  const env = await subscribed();
  const sent = [];
  const sendPush = async (s, m) => (sent.push(m), { status: 201 });
  const at = (iso) => runScheduled(env, { sendPush, now: new Date(iso) });

  assert.deepEqual(await at('2026-11-24T08:00:00Z'), ['anna:2026:day']); // 09:00 Berlin: "1 Tag vorher"
  assert.deepEqual(await at('2026-11-24T22:55:00Z'), []); // 23:55 Berlin: noch nichts
  assert.deepEqual(await at('2026-11-24T23:00:00Z'), ['anna:2026:today']); // 00:00 Berlin
  assert.deepEqual(await at('2026-11-24T23:05:00Z'), []); // nächster Cron-Lauf: nichts mehr
  assert.equal(sent.length, 2);
  assert.equal(sent[1].title, 'Anna hat heute Geburtstag');
  assert.equal(sent[1].body, 'wird 36');
  assert.equal(sent[1].url, './?open=birthday:anna');
  assert.equal(sent[1].tag, 'bd-anna:2026:today');
});

test('Cron: alle vier Stufen kommen nacheinander, je einmal', async () => {
  const env = await subscribed();
  const titles = [];
  const sendPush = async (s, m) => (titles.push(m.title), { status: 201 });
  for (const iso of ['2026-10-25T09:00:00Z', '2026-11-18T08:00:00Z', '2026-11-24T08:00:00Z', '2026-11-24T23:00:00Z']) {
    await runScheduled(env, { sendPush, now: new Date(iso) });
    await runScheduled(env, { sendPush, now: new Date(new Date(iso).getTime() + 5 * 60000) }); // zweiter Lauf: keine Doppelung
  }
  assert.deepEqual(titles, ['Anna hat in 1 Monat Geburtstag', 'Anna hat in 1 Woche Geburtstag', 'Anna hat morgen Geburtstag', 'Anna hat heute Geburtstag']);
});

test('Cron: Fehler beim Senden -> nicht als gesendet markiert, nächster Lauf versucht es erneut', async () => {
  const env = await subscribed();
  let n = 0;
  const flaky = async () => (++n === 1 ? { status: 500 } : { status: 201 });
  const now = new Date('2026-11-24T23:00:00Z');
  assert.deepEqual(await runScheduled(env, { sendPush: flaky, now }), []);
  assert.deepEqual(await runScheduled(env, { sendPush: flaky, now: new Date(now.getTime() + 300000) }), ['anna:2026:today']);
  const thrower = async () => { throw new Error('Netz weg'); };
  const env2 = await subscribed();
  assert.deepEqual(await runScheduled(env2, { sendPush: thrower, now }), []);
});

test('Cron: abgelaufenes Abo (410) wird entfernt', async () => {
  const env = await subscribed();
  await runScheduled(env, { sendPush: async () => ({ status: 410 }), now: new Date('2026-11-24T23:00:00Z') });
  assert.equal(env.SUBS.map.size, 0);
});

test('Cron: Zeiten aus der Konfiguration', async () => {
  const env = await subscribed(mkEnv({ BIRTHDAY_TIME: '07:00', ADVANCE_TIME: 'kaputt' }));
  const sendPush = async () => ({ status: 201 });
  assert.deepEqual(await runScheduled(env, { sendPush, now: new Date('2026-11-24T23:00:00Z') }), []); // 00:00: noch nicht
  assert.deepEqual(await runScheduled(env, { sendPush, now: new Date('2026-11-25T06:00:00Z') }), ['anna:2026:today']); // 07:00
  // ungültige ADVANCE_TIME -> Standard 09:00
  assert.deepEqual(await runScheduled(env, { sendPush, now: new Date('2026-11-24T08:00:00Z') }), ['anna:2026:day']);
});

test('Cron: mehrere Abos werden unabhängig bedient (Zeitzonen)', async () => {
  const env = mkEnv();
  await subscribe(env, { subscription: sub('https://web.push.apple.com/berlin'), tz: 'Europe/Berlin' });
  await subscribe(env, { subscription: sub('https://web.push.apple.com/ny'), tz: 'America/New_York' });
  const to = [];
  const sendPush = async (s) => (to.push(s.endpoint.split('/').pop()), { status: 201 });
  await runScheduled(env, { sendPush, now: new Date('2026-11-24T23:00:00Z') }); // 00:00 Berlin, 18:00 New York (24.)
  assert.ok(to.includes('berlin'));
  await runScheduled(env, { sendPush, now: new Date('2026-11-25T05:00:00Z') }); // 00:00 New York
  assert.equal(to.filter((x) => x === 'ny').length >= 1, true);
  assert.equal(to.filter((x) => x === 'berlin').length, 1, 'Berlin nur einmal');
});

test('Ereignis-Typen: gültige werden gespeichert, unbekannte abgelehnt', async () => {
  const env = mkEnv();
  const list = [
    { id: 'hz', name: 'Hochzeitstag', day: 3, month: 6, year: 2018, type: 'anniversary' }, // altes Gerät
    { id: 'nt', name: 'Namenstag', day: 19, month: 3, year: null, type: 'other' },
    { id: 'an', name: 'Anna', day: 25, month: 11, year: 1990, type: 'birthday' },
  ];
  assert.equal((await subscribe(env, { birthdays: list })).status, 200);
  const rec = JSON.parse([...env.SUBS.map.values()][0]);
  assert.deepEqual(rec.birthdays.map((b) => b.type), ['other', 'other', 'birthday']);
  assert.equal((await subscribe(mkEnv(), { birthdays: [{ id: 'x', name: 'X', day: 1, month: 1, year: null, type: 'hack' }] })).status, 400);
});

test('Cron: Sonstiges bekommt einen eigenen Text ohne "hat Geburtstag"', async () => {
  const env = mkEnv();
  await subscribe(env, { birthdays: [{ id: 'hz', name: 'Hochzeitstag', day: 25, month: 11, year: 2018, type: 'other' }] });
  const titles = [];
  const sendPush = async (s, m) => (titles.push([m.title, m.body]), { status: 201 });
  await runScheduled(env, { sendPush, now: new Date('2026-11-24T23:00:00Z') }); // 00:00 am Tag selbst
  assert.deepEqual(titles, [['Hochzeitstag heute', 'seit 8 Jahren']]);
});
