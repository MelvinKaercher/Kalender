// HTTP-Handler und Cron-Lauf. Alle Abhängigkeiten (KV, Push-Versand, Uhr) werden
// übergeben, damit sich alles ohne Cloudflare testen lässt.
import { dueNotifications, pruneSent, isValidTimeZone, isTime, DEFAULT_TIMES } from './logic.js';
import { EVENT_TYPES } from '../../js/birthdays.js';

const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES);

const MAX_BODY_BYTES = 64 * 1024;
const MAX_BIRTHDAYS = 500;
const MAX_SUBSCRIPTIONS = 5;

/** Nur echte Push-Dienste: Der Worker ruft diese Adresse auf – ohne Liste wäre er ein offener Proxy. */
const PUSH_HOSTS = [
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isAllowedEndpoint(value, env = {}) {
  let url;
  try { url = new URL(value); } catch { return false; }
  // Nur für lokale Tests mit wrangler dev (nie in der Produktion setzen)
  if (env.ALLOW_LOCAL_ENDPOINT === 'true' && url.protocol === 'http:' && url.hostname === 'localhost') return true;
  return url.protocol === 'https:' && !url.username && !url.password && url.port === ''
    && PUSH_HOSTS.some((re) => re.test(url.hostname));
}

const b64url = /^[A-Za-z0-9_-]{8,200}$/;

function cleanSubscription(sub, env) {
  if (!sub || typeof sub !== 'object') return null;
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000 || !isAllowedEndpoint(sub.endpoint, env)) return null;
  const { p256dh, auth } = sub.keys || {};
  if (!b64url.test(p256dh || '') || !b64url.test(auth || '')) return null;
  return { endpoint: sub.endpoint, expirationTime: typeof sub.expirationTime === 'number' ? sub.expirationTime : null, keys: { p256dh, auth } };
}

function cleanBirthdays(list) {
  if (!Array.isArray(list) || list.length > MAX_BIRTHDAYS) return null;
  const out = [];
  for (const b of list) {
    if (!b || typeof b !== 'object') return null;
    const { id, name, day, month, year } = b;
    const type = b.type ?? 'birthday';
    if (!EVENT_TYPE_KEYS.includes(type)) return null;
    if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) return null;
    if (typeof name !== 'string' || name.length < 1 || name.length > 80) return null;
    if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) return null;
    if (year !== null && year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2200)) return null;
    out.push({ id, name, day, month, year: year ?? null, type });
  }
  return out;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Vergleich in konstanter Zeit (über Hashes gleicher Länge). */
async function tokenMatches(given, expected) {
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const subKey = async (endpoint) => `sub:${await sha256Hex(endpoint)}`;

const timesFrom = (env) => ({
  advance: isTime(env.ADVANCE_TIME) ? env.ADVANCE_TIME : DEFAULT_TIMES.advance,
  today: isTime(env.BIRTHDAY_TIME) ? env.BIRTHDAY_TIME : DEFAULT_TIMES.today,
});

function corsHeaders(env, origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/**
 * @param {Request} request
 * @param {object} env     KV-Bindung SUBS, Variablen und Secrets
 * @param {{sendPush: Function}} deps
 */
export async function handleRequest(request, env, { sendPush }) {
  const origin = request.headers.get('origin');
  const allowed = env.ALLOWED_ORIGIN;
  // Browser-Anfragen müssen von der eigenen Seite kommen; Anfragen ohne Origin (z. B. curl) brauchen den Token.
  if (origin && origin !== allowed) return json(403, { error: 'origin' });
  const cors = origin ? corsHeaders(env, origin) : {};
  const reply = (status, body) => json(status, body, cors);

  if (request.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'method' });

  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !(await tokenMatches(auth.slice(7), env.APP_TOKEN))) return reply(401, { error: 'token' });

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return reply(413, { error: 'too large' });
  let body;
  try { body = JSON.parse(text || '{}'); } catch { return reply(400, { error: 'json' }); }

  const path = new URL(request.url).pathname.replace(/\/+$/, '');

  if (path === '/subscribe') {
    const subscription = cleanSubscription(body.subscription, env);
    const birthdays = cleanBirthdays(body.birthdays);
    if (!subscription) return reply(400, { error: 'subscription' });
    if (!birthdays) return reply(400, { error: 'birthdays' });
    if (!isValidTimeZone(body.tz)) return reply(400, { error: 'tz' });
    const key = await subKey(subscription.endpoint);
    const existing = await env.SUBS.get(key, 'json');
    if (!existing) {
      const { keys } = await env.SUBS.list({ prefix: 'sub:' });
      if (keys.length >= MAX_SUBSCRIPTIONS) return reply(429, { error: 'limit' });
    }
    await env.SUBS.put(key, JSON.stringify({ subscription, tz: body.tz, birthdays, sent: existing?.sent || {}, updatedAt: new Date().toISOString() }));
    return reply(200, { ok: true });
  }

  // alle weiteren Aufrufe beziehen sich auf ein vorhandenes Abo
  if (typeof body.endpoint !== 'string') return reply(400, { error: 'endpoint' });
  const key = await subKey(body.endpoint);
  const record = await env.SUBS.get(key, 'json');

  if (path === '/sync') {
    if (!record) return reply(404, { error: 'unknown subscription' }); // App meldet sich dann neu an
    const birthdays = cleanBirthdays(body.birthdays);
    if (!birthdays) return reply(400, { error: 'birthdays' });
    if (!isValidTimeZone(body.tz)) return reply(400, { error: 'tz' });
    await env.SUBS.put(key, JSON.stringify({ ...record, birthdays, tz: body.tz, updatedAt: new Date().toISOString() }));
    return reply(200, { ok: true });
  }

  if (path === '/unsubscribe') {
    await env.SUBS.delete(key);
    return reply(200, { ok: true });
  }

  if (path === '/test') {
    if (!record) return reply(404, { error: 'unknown subscription' });
    const result = await sendPush(record.subscription, {
      title: 'Kalender', body: 'Testnachricht: Benachrichtigungen funktionieren.', tag: 'test', url: './',
    }, env);
    if (result.status === 404 || result.status === 410) {
      await env.SUBS.delete(key);
      return reply(410, { error: 'subscription expired' });
    }
    return reply(result.status >= 200 && result.status < 300 ? 200 : 502, { ok: result.status < 300, status: result.status });
  }

  return reply(404, { error: 'not found' });
}

/** Cron: für jedes Abo fällige Geburtstags-Nachrichten senden. */
export async function runScheduled(env, { sendPush, now = new Date() }) {
  const times = timesFrom(env);
  let cursor;
  const sentLog = [];
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const record = await env.SUBS.get(name, 'json');
      if (!record) continue;
      const due = dueNotifications({ birthdays: record.birthdays, now, tz: record.tz, sent: record.sent, times });
      let changed = false;
      let expired = false;
      for (const n of due) {
        let result;
        try {
          result = await sendPush(record.subscription, {
            title: n.title, body: n.body, tag: `bd-${n.id}`, url: `./?open=birthday:${encodeURIComponent(n.birthdayId)}`,
          }, env);
        } catch (err) {
          console.error('Push fehlgeschlagen', err?.message || err);
          continue; // beim nächsten Lauf nochmal versuchen
        }
        if (result.status === 404 || result.status === 410) { expired = true; break; }
        if (result.status >= 200 && result.status < 300) {
          record.sent[n.id] = now.toISOString();
          sentLog.push(n.id);
          changed = true;
        } else {
          console.error('Push-Dienst antwortete', result.status);
        }
      }
      if (expired) await env.SUBS.delete(name);
      else if (changed) {
        record.sent = pruneSent(record.sent, now.getUTCFullYear());
        await env.SUBS.put(name, JSON.stringify(record));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return sentLog;
}
