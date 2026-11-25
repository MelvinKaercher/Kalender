// Prüft den echten Versand: Nachricht wird verschlüsselt (RFC 8291) und ist mit dem
// Schlüssel des Empfängers wieder lesbar. Benötigt `npm install` im Ordner worker/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto as wc, createECDH, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

let sendPush = null;
try { ({ sendPush } = await import('../src/push.js')); } catch { /* Abhängigkeit nicht installiert */ }
const skip = !sendPush && 'worker/node_modules fehlt (npm install im Ordner worker/)';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** Empfänger-Seite von RFC 8291 (aes128gcm). */
function decrypt(body, ua, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);
  const secret = ua.ecdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ua.publicKey, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', secret, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const padded = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end--;
  assert.equal(padded[end - 1], 2, 'Trennbyte 0x02 des letzten Blocks');
  return padded.subarray(0, end - 1).toString('utf8');
}

test('sendPush: verschlüsselt für den Empfänger, VAPID-signiert, Apple-kompatibel', { skip }, async () => {
  // Empfänger (wie ein iPhone): Schlüsselpaar + Auth-Secret
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const ua = { ecdh, publicKey: ecdh.getPublicKey() };
  const authSecret = randomBytes(16);
  const subscription = {
    endpoint: 'https://web.push.apple.com/test-endpoint', expirationTime: null,
    keys: { p256dh: b64u(ua.publicKey), auth: b64u(authSecret) },
  };

  // VAPID-Schlüssel des Servers
  const vk = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const env = {
    VAPID_SUBJECT: 'https://melvin.github.io/Kalender/',
    VAPID_PUBLIC_KEY: b64u(new Uint8Array(await wc.subtle.exportKey('raw', vk.publicKey))),
    VAPID_PRIVATE_KEY: (await wc.subtle.exportKey('jwk', vk.privateKey)).d,
  };

  // Versand abfangen
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => { captured = { url, init }; return new Response(null, { status: 201 }); };
  let result;
  try {
    result = await sendPush(subscription, { title: 'Anna hat heute Geburtstag', body: 'wird 36', tag: 'bd-1', url: './?open=birthday:1' }, env);
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.equal(result.status, 201);
  assert.equal(captured.url, subscription.endpoint);
  const h = captured.init.headers;
  assert.equal(h['content-encoding'], 'aes128gcm'); // das akzeptiert Apple
  assert.match(h.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  assert.equal(h.urgency, 'high');
  assert.equal(h.ttl, String(12 * 60 * 60));

  // JWT: Zielserver und Absender stimmen
  const [, payloadB64] = h.authorization.split('t=')[1].split(',')[0].split('.');
  const jwt = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  assert.equal(jwt.aud, 'https://web.push.apple.com');
  assert.equal(jwt.sub, env.VAPID_SUBJECT);
  assert.ok(jwt.exp > Date.now() / 1000 && jwt.exp <= Date.now() / 1000 + 24 * 3600);

  // Inhalt: nur mit dem Schlüssel des Empfängers lesbar und unverändert
  const plain = decrypt(Buffer.from(captured.init.body), ua, authSecret);
  assert.deepEqual(JSON.parse(plain), { title: 'Anna hat heute Geburtstag', body: 'wird 36', tag: 'bd-1', url: './?open=birthday:1' });
  assert.ok(!Buffer.from(captured.init.body).includes('Anna'), 'Klartext taucht im Body nicht auf');
});

test('sendPush: Umlaute und Sonderzeichen bleiben erhalten', { skip }, async () => {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const ua = { ecdh, publicKey: ecdh.getPublicKey() };
  const authSecret = randomBytes(16);
  const subscription = { endpoint: 'https://web.push.apple.com/x', expirationTime: null, keys: { p256dh: b64u(ua.publicKey), auth: b64u(authSecret) } };
  const vk = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const env = { VAPID_SUBJECT: 'https://x.example/', VAPID_PUBLIC_KEY: b64u(new Uint8Array(await wc.subtle.exportKey('raw', vk.publicKey))), VAPID_PRIVATE_KEY: (await wc.subtle.exportKey('jwk', vk.privateKey)).d };
  const realFetch = globalThis.fetch; let body;
  globalThis.fetch = async (u, init) => { body = Buffer.from(init.body); return new Response(null, { status: 201 }); };
  try { await sendPush(subscription, { title: 'Jürgen hat in 1 Monat Geburtstag', body: 'am 5. März · wird 40 🎂' }, env); } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(JSON.parse(decrypt(body, ua, authSecret)), { title: 'Jürgen hat in 1 Monat Geburtstag', body: 'am 5. März · wird 40 🎂' });
});
