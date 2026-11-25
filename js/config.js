// Verbindung zum Push-Server (Cloudflare Worker). Beides nach dem Einrichten eintragen,
// siehe worker/README.md. Solange workerUrl leer ist, bleiben Push-Nachrichten ausgeschaltet
// und die App zeigt einen Hinweis.
export default {
  // z. B. 'https://kalender-push.deinname.workers.dev'
  workerUrl: '',
  // Öffentlicher VAPID-Schlüssel aus `node scripts/gen-vapid.mjs` (darf öffentlich sein)
  vapidPublicKey: '',
  // Nur zur Anzeige in der App. Muss zu ADVANCE_TIME / BIRTHDAY_TIME in worker/wrangler.toml passen.
  times: { advance: '09:00', today: '00:00' },
};
