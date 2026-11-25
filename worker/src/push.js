// Echter Versand per Web Push (RFC 8291 verschlüsselt, VAPID-signiert).
import { buildPushPayload } from '@block65/webcrypto-web-push';

/** @returns {Promise<{status:number}>} HTTP-Status des Push-Dienstes (201 = angenommen) */
export async function sendPush(subscription, message, env) {
  // Nur für lokale Tests (wrangler dev mit ALLOW_LOCAL_ENDPOINT=true): Die Bibliothek verlangt https,
  // also bauen wir die Nachricht für eine https-Adresse und schicken sie an den lokalen http-Fake.
  const local = env.ALLOW_LOCAL_ENDPOINT === 'true' && subscription.endpoint.startsWith('http://localhost');
  const payload = await buildPushPayload(
    { data: message, options: { ttl: 12 * 60 * 60, urgency: 'high' } },
    local ? { ...subscription, endpoint: subscription.endpoint.replace(/^http:/, 'https:') } : subscription,
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  );
  const res = await fetch(subscription.endpoint, payload);
  return { status: res.status };
}
