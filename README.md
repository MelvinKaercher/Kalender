# Kalender

Ein minimalistischer, privater Kalender fürs iPhone – als Web-App (PWA).

- **Monat** – klassische Monatsansicht (Montag als Wochenstart), Punkte markieren Tage mit Terminen (blau) und Geburtstagen (rot), darunter „Als Nächstes".
- **Woche** – Wochenplan mit Zeitraster. Zeigt denselben Datenbestand wie der Monat: was du einträgst, erscheint in beiden Ansichten. Freien Zeitslot antippen legt dort einen Termin an.
- **Geburtstage** – einmal eintragen, kehren jedes Jahr automatisch wieder (mit Alter, wenn das Geburtsjahr bekannt ist). Sie erscheinen im Monat, in der Woche und in einer eigenen Liste.
- **Erinnerungen** – Termine können „5 Min. vorher" bis „1 Tag vorher" erinnern. Die Erinnerung erscheint als Banner, **solange die App geöffnet ist bzw. sobald du sie öffnest** (keine Push-Nachrichten – siehe unten).
- **Privat** – alle Daten liegen ausschließlich auf deinem Gerät (IndexedDB). Kein Konto, kein Server, kein Tracking.
- Dark Mode folgt automatisch dem iPhone, Zwischen Monaten und Wochen wechselst du mit den Pfeilen ‹ › (oder per Wisch), „Heute" springt zurück. Funktioniert offline.

## Aufs iPhone bringen

Die App ist reines HTML/CSS/JavaScript ohne Build-Schritt. Sie muss nur irgendwo per **https** erreichbar sein.

### GitHub Pages (empfohlen)

1. Repo auf GitHub öffnen → **Settings → Pages**.
2. **Source:** „Deploy from a branch", Branch wählen (z. B. `main`), Ordner `/ (root)`, speichern.
3. Nach ca. einer Minute steht oben die Adresse, z. B. `https://<name>.github.io/Kalender/`.

> GitHub Pages ist im kostenlosen Tarif nur für **öffentliche** Repos verfügbar. Im Repo steht kein persönlicher Inhalt – deine Termine bleiben auf dem Handy und sind nie im Repo.

### Installieren

1. Die Adresse in **Safari** auf dem iPhone öffnen.
2. **Teilen-Symbol** (Quadrat mit Pfeil) → **„Zum Home-Bildschirm"** → Hinzufügen.
3. Ab jetzt über das Icon starten: Vollbild, ohne Browserleiste, auch offline.

Tipp: In Safari-Einstellungen nicht „Alle Cookies blockieren"/„Websitedaten löschen" nutzen – das würde auch die Termine löschen. Die App bittet iOS zusätzlich, die Daten dauerhaft zu behalten.

## Entwickeln

```bash
npm test          # Unit-Tests der Datums-, Geburtstags- und Erinnerungslogik (Node ≥ 20)
npm start         # lokaler Server auf http://localhost:8080
node scripts/make-icons.cjs   # App-Icons neu erzeugen (braucht Playwright)
```

Aufbau:

| Datei | Aufgabe |
|---|---|
| `js/calendar.js` | reine Datumslogik (Monatsraster, Wochen, KW) |
| `js/birthdays.js` | Wiederholung jedes Jahr, Alter, 29.-Februar-Regel |
| `js/items.js` | „was passiert an diesem Tag" – gemeinsame Quelle für Monat, Woche, Tages-Sheet |
| `js/reminders.js` | welche Erinnerungen sind gerade fällig |
| `js/store.js` | IndexedDB + Cache |
| `js/ui/*` | Monat, Woche, Geburtstage, Sheets, Formulare, Banner |
| `sw.js` | Service Worker (Offline) |

Wenn du Dateien änderst und der Service Worker alte Versionen ausliefert: in `sw.js` die `CACHE`-Version erhöhen.

## Bewusst nicht enthalten

- **Push-Benachrichtigungen bei gesperrtem Handy.** Safari-Web-Apps können sich keine Benachrichtigungen selbst vormerken; dafür bräuchte es einen kleinen Server. Mögliche spätere Erweiterungen: „In Apple Kalender übernehmen" (.ics-Export) oder Web-Push über einen Cloudflare Worker.
- Sync zwischen Geräten, Teilen, Mehrtages-Termine, Wiederholungen für normale Termine.
