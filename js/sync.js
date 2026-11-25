// Abgleich zwischen Geräten (Client): holt den verschlüsselten Block vom eigenen Server,
// führt ihn mit den lokalen Daten zusammen und lädt den neuen Stand hoch.
// Zugangscode und Passwort bleiben nur auf diesem Gerät.
import { mergeSnapshots, canon, encryptSnapshot, decryptSnapshot, SyncError, emptySnapshot } from './sync-core.js';

const browserEnv = () => ({ fetch: (...a) => fetch(...a), now: () => Date.now() });

/**
 * @param {object} o
 * @param {{workerUrl:string}} o.config
 * @param {{get:Function,set:Function,delete:Function}} o.meta
 * @param {{snapshot:()=>object, applySnapshot:(s:object)=>Promise<void>|void}} o.store
 */
export function createSync({ config, meta, store, env = browserEnv() }) {
  const configured = () => !!config.workerUrl;
  const settings = () => meta.get('sync'); // { token, password, last }
  let running = null;

  /** @returns {{state:'unconfigured'|'off'|'on', last:number|null, error:string|null}} */
  function status() {
    if (!configured()) return { state: 'unconfigured', last: null, error: null };
    const s = settings();
    return s ? { state: 'on', last: s.last || null, error: s.error || null } : { state: 'off', last: null, error: null };
  }

  async function call(path, body, token) {
    let res;
    try {
      res = await env.fetch(config.workerUrl.replace(/\/+$/, '') + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch { throw new SyncError('network'); }
    if (res.status === 401) throw new SyncError('token');
    if (res.status === 409) throw new SyncError('conflict');
    if (!res.ok) throw new SyncError('server', String(res.status));
    return res.json();
  }

  async function run() {
    const s = settings();
    if (!s) throw new SyncError('unconfigured');
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await call('/sync/get', {}, s.token);
      let merged = store.snapshot();
      let salt;
      if (remote.blob) {
        const got = await decryptSnapshot(remote.blob, s.password);
        salt = got.salt;
        merged = mergeSnapshots(store.snapshot(), got.snapshot, env.now());
        if (canon(merged) !== canon(store.snapshot())) await store.applySnapshot(merged);
        if (canon(merged) === canon(got.snapshot)) return { pushed: false, pulled: canon(merged) !== canon(emptySnapshot()) };
      }
      const blob = await encryptSnapshot(merged, s.password, salt);
      try {
        await call('/sync/put', { baseVersion: remote.version, blob }, s.token);
        return { pushed: true };
      } catch (e) {
        if (e.code !== 'conflict') throw e; // jemand war schneller: neu holen und erneut zusammenführen
      }
    }
    throw new SyncError('server', 'conflict');
  }

  /** Einen Abgleich ausführen (Mehrfachaufrufe laufen zusammen). */
  function sync() {
    if (running) return running;
    running = run()
      .then(async (r) => { await meta.set('sync', { ...settings(), last: env.now(), error: null }); return r; })
      .catch(async (e) => { if (settings()) await meta.set('sync', { ...settings(), error: e.code }); throw e; })
      .finally(() => { running = null; });
    return running;
  }

  async function enable({ token, password }) {
    if (!configured()) throw new SyncError('unconfigured');
    if (!token?.trim() || !password) throw new SyncError('token');
    await meta.set('sync', { token: token.trim(), password, last: null, error: null });
    try { return await sync(); } catch (e) { await meta.delete('sync'); throw e; }
  }

  const disable = () => meta.delete('sync');

  return { status, sync, enable, disable, settings };
}
