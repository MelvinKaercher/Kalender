// Push-Benachrichtigungen für jährliche Ereignisse – Geburtstage … (Client-Seite).
// Die App meldet das Gerät beim eigenen Push-Server an und hält dort die Ereignisse aktuell.
// Alle Browser-Zugriffe sind austauschbar (`env`), damit sich das Modul in Node testen lässt.

export class PushError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // 'permission' | 'token' | 'network' | 'server' | 'expired' | 'unsupported' | 'unconfigured'
  }
}

/** Base64URL → Uint8Array (für applicationServerKey). */
export function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const browserEnv = () => ({
  fetch: (...a) => fetch(...a),
  Notification: globalThis.Notification,
  hasPushManager: () => 'serviceWorker' in navigator && 'PushManager' in window,
  // Ohne laufenden Service Worker würde `ready` nie fertig: nach 8 s mit klarer Meldung abbrechen.
  getRegistration: () => Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new PushError('unsupported', 'service-worker')), 8000)),
  ]),
  isInstalled: () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches,
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/**
 * @param {object} o
 * @param {{workerUrl:string, vapidPublicKey:string}} o.config
 * @param {{get:Function,set:Function,delete:Function}} o.meta   lokaler Speicher (Zustand + Zugangscode)
 * @param {() => object[]} o.getBirthdays
 */
export function createPush({ config, meta, getBirthdays, env = browserEnv() }) {
  const configured = () => !!(config.workerUrl && config.vapidPublicKey);
  const state = () => meta.get('push'); // { token, endpoint } oder null

  /** @returns {{state:'unconfigured'|'unsupported'|'denied'|'off'|'on', reason?:string}} */
  function status() {
    if (!configured()) return { state: 'unconfigured' };
    if (!env.hasPushManager()) return { state: 'unsupported', reason: 'no-push' };
    if (!env.isInstalled()) return { state: 'unsupported', reason: 'not-installed' };
    if (env.Notification?.permission === 'denied') return { state: 'denied' };
    return { state: state() ? 'on' : 'off' };
  }

  const payload = () => getBirthdays().map(({ id, name, day, month, year, type }) => ({ id, name, day, month, year: year ?? null, type: type || 'birthday' }));

  async function post(path, body, token) {
    let res;
    try {
      res = await env.fetch(config.workerUrl.replace(/\/+$/, '') + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new PushError('network', err?.message);
    }
    if (res.status === 401) throw new PushError('token');
    if (res.status === 410) throw new PushError('expired');
    if (!res.ok) throw new PushError('server', String(res.status));
    return res;
  }

  async function subscribeBrowser(registration) {
    const key = urlBase64ToUint8Array(config.vapidPublicKey);
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      // Abo mit anderem Server-Schlüssel (z. B. nach neuer Einrichtung) würde abgelehnt: erneuern
      const have = sub.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey);
      const same = !have || (have.length === key.length && have.every((b, i) => b === key[i]));
      if (same) return sub;
      await sub.unsubscribe();
    }
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }

  /** Muss direkt aus einem Tipp heraus aufgerufen werden (iOS verlangt eine Nutzeraktion für die Berechtigung). */
  async function enable(token) {
    if (!configured()) throw new PushError('unconfigured');
    const s = status();
    if (s.state === 'unsupported') throw new PushError('unsupported', s.reason);
    token = (token || '').trim();
    if (!token) throw new PushError('token');

    const permission = await env.Notification.requestPermission();
    if (permission !== 'granted') throw new PushError('permission');

    const registration = await env.getRegistration();
    const sub = await subscribeBrowser(registration);
    await post('/subscribe', { subscription: sub.toJSON(), birthdays: payload(), tz: env.timeZone() }, token);
    await meta.set('push', { token, endpoint: sub.endpoint });
  }

  /** Geburtstage (und Zeitzone) beim Server aktuell halten. Still, wenn aus oder offline. */
  async function sync() {
    const st = state();
    if (status().state !== 'on' || !st) return { ok: false, skipped: true };
    try {
      const registration = await env.getRegistration();
      const sub = await registration.pushManager.getSubscription();
      if (!sub) { await meta.delete('push'); return { ok: false, lost: true }; } // iOS hat das Abo entzogen
      try {
        await post('/sync', { endpoint: sub.endpoint, birthdays: payload(), tz: env.timeZone() }, st.token);
      } catch (err) {
        if (err.code === 'server' && err.message === '404') {
          // Server kennt das Abo nicht (mehr): neu anmelden
          await post('/subscribe', { subscription: sub.toJSON(), birthdays: payload(), tz: env.timeZone() }, st.token);
        } else throw err;
      }
      if (sub.endpoint !== st.endpoint) await meta.set('push', { ...st, endpoint: sub.endpoint });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.code || 'error' };
    }
  }

  async function disable() {
    const st = state();
    try {
      const registration = await env.getRegistration();
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        if (st) await post('/unsubscribe', { endpoint: sub.endpoint }, st.token).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      await meta.delete('push');
    }
  }

  async function sendTest() {
    const st = state();
    if (!st) throw new PushError('unconfigured');
    const registration = await env.getRegistration();
    const sub = await registration.pushManager.getSubscription();
    if (!sub) { await meta.delete('push'); throw new PushError('expired'); }
    try {
      await post('/test', { endpoint: sub.endpoint }, st.token);
    } catch (err) {
      if (err.code === 'expired' || (err.code === 'server' && err.message === '404')) {
        await meta.delete('push');
        throw new PushError('expired');
      }
      throw err;
    }
  }

  return { status, enable, sync, disable, sendTest };
}
