// Verbindung zum Push-Server (Cloudflare Worker). Beides nach dem Einrichten eintragen,
// siehe worker/README.md. Solange workerUrl leer ist, bleiben Push-Nachrichten ausgeschaltet
// und die App zeigt einen Hinweis.
export default {
  // z. B. 'https://kalender-push.deinname.workers.dev'
  workerUrl: 'https://kalender-push.melvin-kalender.workers.dev',
  // Öffentlicher VAPID-Schlüssel aus `node scripts/gen-vapid.mjs` (darf öffentlich sein)
  vapidPublicKey: 'BMiCFsi8JizdLsNCu4sL0InCHRf1l-gvwENeLUZlBLNhAc4LktMK5hEyd6VI0nnJhMdZZfhj5o5FT3PQNNjG6CU',
  // Nur zur Anzeige in der App. Muss zu ADVANCE_TIME / BIRTHDAY_TIME in worker/wrangler.toml passen.
  times: { advance: '09:00', today: '00:00' },
};
