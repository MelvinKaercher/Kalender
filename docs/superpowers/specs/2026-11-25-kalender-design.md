# Kalender – Design

Stand: 2026-11-25 · abgestimmt mit Melvin

## Ziel und Warum
Eine minimalistische, **private** Kalender-App fürs iPhone 14. Sie startet mit einem normalen, leeren Monatskalender. Hauptzweck im Alltag: **Termine & Erinnerungen**. Dazu ein Wochenplan, der dieselben Einträge zeigt, und Geburtstage, die sich jedes Jahr automatisch wiederholen.

## Nicht-Ziele / Anti-Ziele
- Kein Sync zwischen Geräten, keine Konten, keine Analytics, kein Teilen.
- Keine Push-Benachrichtigungen für Termine, kein .ics-Export.
- Keine Überladung: lieber wenig und sehr sauber.
- Anti-Ziel: Termine verlassen das Gerät. (Ausnahme auf ausdrücklichen Wunsch: die Geburtstage, siehe Runde 2.)

## Entscheidungen
| Thema | Entscheidung | Grund |
|---|---|---|
| Auslieferung | PWA (Safari → „Zum Home-Bildschirm") | Kein Mac/Xcode, kein 99-€-Developer-Account nötig |
| Daten | IndexedDB lokal, In-Memory-Cache | Privat, offline, keine Infrastruktur |
| Erinnerungen | Termine: nur in der App (Banner). Geburtstage: zusätzlich echte Push-Nachrichten (Runde 2) | Von Melvin gewählt; Push braucht einen Server, deshalb nur für Geburtstage |
| Technik | Vanilla ES-Module, kein Build | Wenig Abhängigkeiten, leicht zu verstehen und zu hosten *(Entscheidung des Entwicklers)* |
| Hosting | GitHub Pages | kostenlos *(Entscheidung des Entwicklers)* |

### Betrachtete Ansätze für Erinnerungen
- **A – nur in der App** (gewählt): einfach, privat; Erinnerung sichtbar beim Öffnen/solange offen.
- B – A + Export in Apple Kalender: zuverlässige Erinnerung, aber Termin doppelt vorhanden.
- C – echte Push-Nachrichten: braucht Cloudflare-Account und Server, der Terminzeiten kennt.

## Funktionen
- **Monat** (Startansicht): Montag-Wochenstart, deutsche Namen, heutiger Tag hervorgehoben, Punkte für Termine/Geburtstage, Wischen wechselt den Monat, „Heute"-Button, darunter „Als Nächstes" (nur wenn es etwas gibt – der leere Kalender bleibt leer).
- **Woche:** Mo–So mit Zeitraster, Ganztags-Zeile (Ganztägiges + Geburtstage), Jetzt-Linie, überlappende Termine nebeneinander. **Ein Datenbestand** für alle Ansichten (`js/items.js`).
- **Geburtstage:** einmal gespeichert (`name, day, month, year|null`), pro Jahr berechnet, nicht kopiert. 29.2. wird in Nicht-Schaltjahren am 28.2. gezeigt *(Vorschlag des Entwicklers)*. Alter nur mit Geburtsjahr.
- **Termin:** Titel, Datum, ganztägig, Beginn/Ende, Notiz, Erinnerung (Keine, zum Zeitpunkt, 5/15/30 Min., 1 Std., 1 Tag vorher). Ganztägige Erinnerungen gelten ab 9:00 Uhr.
- **Erinnerungen:** fällig ab Erinnerungszeitpunkt, bis der Termin vorbei ist; einmal pro Termin/Zeit/Erinnerungswert (verschobene Termine erinnern neu); Geburtstage am Tag selbst.
- **Design:** viel Weißraum, Systemschrift (SF), eine Akzentfarbe (Indigo), Rot für Geburtstage, Dark Mode automatisch, Safe-Area-Insets, Touch-Ziele ≥ 44 px, Eingabefelder 16 px (kein Zoom).

## Bekannte Grenzen
- Termine gehen nicht über Mitternacht (Ende am selben Tag).
- Löscht der Nutzer die Safari-Websitedaten, sind die Termine weg (kein Backup/Export in v1).
- Echtes iOS-Safari-Verhalten (Installation, Safe Areas) wurde nur im Chromium-Emulator geprüft.

## Runde 2 – Farben und Geburtstags-Push
Wunsch von Melvin: (1) Termine in frei wählbarer Farbe, (2) für jeden Geburtstag Benachrichtigungen 1 Monat, 1 Woche, 1 Tag vorher und um 00:00 am Geburtstag.

- **Farben:** Feld `color` (`#rrggbb` oder `null` = Akzentfarbe); 8 Vorschläge plus freie Wahl; wirkt in Monat, Woche, Tages-Sheet, „Als Nächstes".
- **Push – bewusste Abkehr von „kein Server":** Eine geschlossene iOS-Web-App kann sich keine Mitteilungen selbst vormerken. Melvin hat echte Push-Nachrichten gewählt (Alternative war ein .ics-Import in den Apple-Kalender). Dafür gibt es einen Cloudflare Worker (`worker/`) mit KV-Speicher, Cron alle 5 Minuten und Web Push (RFC 8291, VAPID).
- **Was den Server erreicht:** nur Geburtstage (Name, Tag, Monat, Jahr?), Zeitzone, Push-Adresse. Termine nie.
- **Zeiten (Entscheidung des Entwicklers):** Vorab-Stufen 09:00, Geburtstag selbst 00:00 (Ortszeit des Handys), einstellbar in `wrangler.toml`.
- **„1 Monat vorher"** = gleicher Tag im Vormonat, am Monatsende gekürzt (31.3. → 28./29.2.).
- **Schutz:** Zugangscode (Bearer-Token, Vergleich in konstanter Zeit), CORS nur für die App-Adresse, Push-Adressen nur von echten Push-Diensten (sonst wäre der Worker ein offener Proxy), Grenzen für Abos/Geburtstage/Größe.
- **In-App-Banner** kennen dieselben vier Stufen (gemeinsame Logik in `js/birthdays.js`), erscheinen aber nur am Tag der Stufe und bis zu zwei Tage danach, mit echter Restzeit.
- **iOS-Regel:** Jede Push-Nachricht zeigt eine sichtbare Benachrichtigung, sonst entzieht iOS die Berechtigung.
- **Nicht testbar hier:** die Zustellung über Apples Push-Dienst. Erster echter Test: „Testnachricht senden" auf dem iPhone.

## Runde 3 – Jahresansicht, Feiertage, Schulferien, Verschieben
Wunsch von Melvin: wie im Apple-Kalender herauszoomen und Monate schnell wählen, Feiertage, Schulferien Baden-Württemberg bis Juli 2027, Termine in der Woche per Finger verschieben.

- **Jahresansicht:** 4. Tab „Jahr" (12 Mini-Monate). Zugang auch per Tipp auf den Monatstitel und Zwei-Finger-Zusammenziehen; zurück per Monat antippen oder Auseinanderziehen. Die Geste läuft über Touch-Ereignisse; `gesturestart/-change` werden nur unterdrückt, damit iOS nicht die ganze Seite zoomt.
- **Feiertage:** Baden-Württemberg, aus dem Ostersonntag berechnet (gilt für jedes Jahr). Nicht dabei: Reformationstag, Mariä Himmelfahrt, Buß- und Bettag.
- **Schulferien BW (Entscheidung des Entwicklers zur Quellenlage):** Die offizielle Seite des Kultusministeriums war nicht abrufbar. Grundlage sind übereinstimmende Ferienportale; bei den Osterferien 2027 nennen einige Portale 25.03.–03.04., hier gilt „Ferien ab 30.03., 25.03. einzeln unterrichtsfrei". Anzeige als gelber Balken am Tag. Daten in `js/school-holidays.js`.
- **Anzeige:** Feiertage grün, Ferien gelb, ein-/ausschaltbar (lokal, `meta`-Eintrag `display`).
- **Verschieben:** Langdruck ca. 0,4 s, ziehen, Einrasten auf 15 Minuten, Dauer bleibt, Auto-Scroll am Rand, Zeitanzeige am Finger. Touch-Ereignisse mit `passive:false` nur am Termin-Block, damit normales Scrollen und Antippen unverändert bleiben. Ganztägige Termine und Geburtstage sind nicht verschiebbar; Größe ändern gibt es (noch) nicht.
- **Nicht testbar hier:** das echte Gefühl auf iOS (Dauer des Langdrucks, Schwelle der Zwei-Finger-Geste). Die Schwellen stehen als Konstanten (`HOLD_MS` in `js/ui/week-drag.js`, Verhältniswerte in `js/app.js`) und lassen sich nach dem Test auf dem iPhone nachjustieren.
