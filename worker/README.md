# Push-Server für Geburtstags-Benachrichtigungen

Ein winziger Server (Cloudflare Worker, kostenlos), der dir für jeden Geburtstag eine Mitteilung auf dein iPhone schickt:

| Wann | Uhrzeit (Ortszeit deines Handys) |
|---|---|
| 1 Monat vorher | 09:00 |
| 1 Woche vorher | 09:00 |
| 1 Tag vorher | 09:00 |
| am Geburtstag | 00:00 |

Warum ein Server? Eine Web-App auf dem iPhone kann sich keine Mitteilungen selbst für später vormerken, solange sie geschlossen ist. Der Server schickt sie zur richtigen Zeit über Apples Push-Dienst.

**Was liegt auf dem Server?** Nur die Geburtstage (Name, Tag, Monat, optional Geburtsjahr), die Zeitzone deines Handys und die Push-Adresse deines Geräts – in deinem eigenen Cloudflare-Konto. **Termine verlassen dein Handy nie.**

Der Server prüft bei jeder Anfrage einen **Zugangscode**, den nur du kennst, und akzeptiert Anfragen nur von deiner App-Adresse. Push-Adressen werden nur für echte Push-Dienste angenommen (Apple, Google, Mozilla, Microsoft).

## Einrichten (einmalig, am Computer, ca. 10 Minuten)

Du brauchst: ein kostenloses [Cloudflare-Konto](https://dash.cloudflare.com/sign-up), [Node.js](https://nodejs.org) (Version 20 oder neuer) und dieses Projekt auf deinem Computer.

Alle Befehle im Ordner `worker/` ausführen (außer Schritt 3).

**1. Abhängigkeiten installieren**

```bash
cd worker
npm install
```

**2. Bei Cloudflare anmelden** (es öffnet sich ein Browserfenster)

```bash
npx wrangler login
```

**3. Schlüsselpaar erzeugen** (im Hauptordner des Projekts)

```bash
node scripts/gen-vapid.mjs
```

Du bekommst zwei Zeilen: den **öffentlichen** Schlüssel (darf überall stehen) und den **privaten** Schlüssel (geheim, nirgends einchecken!). Lass das Fenster offen.

**4. Speicher anlegen**

```bash
npx wrangler kv namespace create SUBS
```

Die ausgegebene `id` trägst du in `worker/wrangler.toml` bei `[[kv_namespaces]]` → `id = "…"` ein.

**5. Einstellungen in `worker/wrangler.toml` prüfen**

- `ALLOWED_ORIGIN` – Adresse deiner App, nur der Ursprung (vorausgefüllt: `https://melvinkaercher.github.io`).
- `VAPID_SUBJECT` – deine App-Adresse (vorausgefüllt).
- `VAPID_PUBLIC_KEY` – der **öffentliche** Schlüssel aus Schritt 3.
- Optional: `ADVANCE_TIME` / `BIRTHDAY_TIME` (Uhrzeiten). Wenn du sie änderst, passe auch `times` in `js/config.js` an, damit die App die richtigen Zeiten anzeigt.

**6. Geheimnisse setzen** (werden nicht in Dateien gespeichert)

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

→ den **privaten** Schlüssel aus Schritt 3 einfügen.

```bash
npx wrangler secret put APP_TOKEN
```

→ deinen **Zugangscode** festlegen. Am besten lang und zufällig, z. B. erzeugt mit:

```bash
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
```

Notiere dir den Code (Passwort-Manager), du gibst ihn einmal in der App ein.

**7. Veröffentlichen**

```bash
npx wrangler deploy
```

Am Ende steht eine Adresse wie `https://kalender-push.<dein-name>.workers.dev`. Der Cron-Job (alle 5 Minuten) wird dabei automatisch eingerichtet.

**8. App mit dem Server verbinden**

In `js/config.js` eintragen:

```js
workerUrl: 'https://kalender-push.<dein-name>.workers.dev',
vapidPublicKey: '<öffentlicher Schlüssel aus Schritt 3>',
```

Dann committen und pushen, damit GitHub Pages die neue Version ausliefert.

**9. Am iPhone einschalten**

1. Die App über das Home-Bildschirm-Icon öffnen (nicht in Safari!) – zweimal, damit die neue Version geladen ist.
2. Tab **Geburtstage** → **Benachrichtigungen** → Zugangscode eingeben → **einschalten** → iOS fragt nach der Erlaubnis → **Erlauben**.
3. **Testnachricht senden** tippen: Nach wenigen Sekunden muss eine Mitteilung erscheinen.

## Hinweise

- Voraussetzung am iPhone: **iOS 16.4 oder neuer** und die App muss **zum Home-Bildschirm hinzugefügt** sein.
- Die Mitteilung kommt 0–5 Minuten nach dem Zielzeitpunkt (der Server prüft alle 5 Minuten).
- Die Uhrzeit richtet sich nach der **Zeitzone deines Handys beim letzten Öffnen der App**. Auf Reisen einmal die App öffnen.
- Ein Fokus-/Nicht-stören-Modus kann Mitteilungen stumm schalten – besonders die um 00:00.
- Neue oder geänderte Geburtstage werden automatisch an den Server übertragen, sobald die App Internet hat.

## Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| „Der Zugangscode stimmt nicht" | Zugangscode (`APP_TOKEN`) prüfen; bei Zweifel Schritt 6 wiederholen und `npx wrangler deploy`. |
| „Der Server ist nicht erreichbar" | `workerUrl` in `js/config.js` prüfen und ob die neue Version der App geladen ist. Browser-Konsole: Fehler „origin" bedeutet, `ALLOWED_ORIGIN` passt nicht zur App-Adresse. |
| Testnachricht kommt nicht an | iPhone: Einstellungen → Mitteilungen → Kalender erlaubt? Fokus aus? App wirklich über das Home-Bildschirm-Icon installiert? Live-Log ansehen: `npx wrangler tail` |
| Erinnerungen kommen nicht zur erwarteten Zeit | Im Cloudflare-Dashboard unter Workers → kalender-push → Triggers prüfen, ob der Cron (`*/5 * * * *`) aktiv ist. |
| Alles löschen | `npx wrangler delete` entfernt den Server; in der App „Ausschalten" tippen. Die gespeicherten Daten liegen in KV und verschwinden mit dem Namespace. |

## Entwickeln und testen

```bash
npm test                 # im Hauptordner: Unit-Tests inkl. Server-Logik und echter Verschlüsselung
npm run dev              # im Ordner worker/: lokaler Server (wrangler dev)
```

Lokaler Test ohne Apple: In `worker/.dev.vars` die Zeile `ALLOW_LOCAL_ENDPOINT=true` setzen, dann akzeptiert der Server zusätzlich `http://localhost`-Push-Adressen (nie in der Produktion setzen). Den Cron löst `wrangler dev --test-scheduled` über `/cdn-cgi/handler/scheduled` aus.
