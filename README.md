# Kalender

Ein minimalistischer, privater Kalender fürs iPhone – als Web-App (PWA).

- **Monat** – klassische Monatsansicht (Montag als Wochenstart), Punkte markieren Tage mit Terminen (blau), Geburtstagen (rot) und Feiertagen (grün), gelbe Balken zeigen Schulferien, darunter „Als Nächstes".
- **Jahr** – herauszoomen wie im Apple-Kalender: Tab „Jahr", Tipp auf den Monatsnamen oder zwei Finger zusammenziehen. Dort alle 12 Monate auf einen Blick; Monat antippen (oder Finger auseinanderziehen) öffnet ihn.
- **Feiertage & Schulferien** – gesetzliche Feiertage in Baden-Württemberg (für jedes Jahr berechnet) und die BW-Schulferien bis Sommer 2027. Im Tab „Jahr" lassen sie sich ein- und ausschalten. Ferien-Stand: November 2026, ohne Gewähr; bewegliche Ferientage einzelner Schulen fehlen.
- **Woche** – Wochenplan mit Zeitraster. Zeigt denselben Datenbestand wie der Monat: was du einträgst, erscheint in beiden Ansichten. Freien Zeitslot antippen legt dort einen Termin an. **Termin lange drücken und ziehen** verschiebt ihn auf einen anderen Tag oder eine andere Uhrzeit (rastet auf 15 Minuten ein, die Dauer bleibt).
- **Ereignisse** – früher „Geburtstage": jährlich wiederkehrende Ereignisse mit Art **Geburtstag**, **Jahrestag** (z. B. Hochzeitstag) oder **Sonstiges** (z. B. Namenstag). Einmal eintragen, jedes Jahr dabei; mit Jahr zeigt die App „wird 36", „8. Jahrestag" bzw. „seit 6 Jahren". Sie erscheinen im Monat, in der Woche und in einer eigenen Liste. Bereits eingetragene Geburtstage bleiben unverändert.
- **Farben** – jeder Termin kann eine eigene Farbe haben (8 Vorschläge oder frei wählbar). Sie erscheint in Monat, Woche und Tages-Sheet.
- **Erinnerungen** – Termine können „5 Min. vorher" bis „1 Tag vorher" erinnern. Die Erinnerung erscheint als Banner, **solange die App geöffnet ist bzw. sobald du sie öffnest**.
- **Benachrichtigungen für Ereignisse** – optional als echte Push-Mitteilung auf dem iPhone: 1 Monat, 1 Woche und 1 Tag vorher (09:00) sowie am Tag selbst um 00:00. Dafür gibt es einen kleinen eigenen Server, siehe [`worker/README.md`](worker/README.md).
- **Privat** – Termine liegen ausschließlich auf deinem Gerät (IndexedDB). Kein Konto, kein Tracking. Nur wenn du die Benachrichtigungen einschaltest, werden Name, Datum und Art der **Ereignisse** (nicht die Termine) an deinen eigenen Server (dein Cloudflare-Konto) übertragen.
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
npm test          # Unit-Tests: Datums-, Geburtstags-, Erinnerungs-, Farb-, Push- und Server-Logik (Node ≥ 20)
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
| `js/colors.js` | Termin-Farben (Palette, Hilfsfunktionen) |
| `js/holidays.js`, `js/school-holidays.js` | Feiertage (berechnet) und BW-Schulferien (Datenliste zum Ergänzen) |
| `js/drag-math.js`, `js/ui/week-drag.js` | Verschieben per Finger: Rechenlogik und Touch-Steuerung |
| `js/ui/year.js` | Jahresansicht |
| `js/push.js`, `js/ui/settings.js` | Push-Anmeldung und Einstellungs-Sheet |
| `worker/` | Push-Server (Cloudflare Worker), teilt sich `js/birthdays.js` mit der App |
| `js/store.js` | IndexedDB + Cache |
| `js/ui/*` | Monat, Woche, Geburtstage, Sheets, Formulare, Banner |
| `sw.js` | Service Worker (Offline) |

Wenn du Dateien änderst und der Service Worker alte Versionen ausliefert: in `sw.js` die `CACHE`-Version erhöhen.

## Bewusst nicht enthalten

- Push-Mitteilungen für **Termine** (nur für Geburtstage; Termin-Erinnerungen erscheinen in der App). Termine bleiben deshalb komplett auf dem Handy.
- Sync zwischen Geräten, Teilen, Mehrtages-Termine, Wiederholungen für normale Termine.
