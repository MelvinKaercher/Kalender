// Erzeugt ein VAPID-Schlüsselpaar für die Push-Nachrichten. Aufruf: node scripts/gen-vapid.mjs
// Der öffentliche Schlüssel kommt in worker/wrangler.toml und js/config.js,
// der private Schlüssel NUR als Secret (npx wrangler secret put VAPID_PRIVATE_KEY).
import { webcrypto as crypto } from 'node:crypto';

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)); // 65 Byte, unkomprimierter Punkt
const jwk = await crypto.subtle.exportKey('jwk', privateKey);

console.log('Öffentlicher Schlüssel (VAPID_PUBLIC_KEY, darf öffentlich sein):');
console.log(b64url(raw));
console.log('\nPrivater Schlüssel (VAPID_PRIVATE_KEY – GEHEIM, nirgends einchecken!):');
console.log(jwk.d);
