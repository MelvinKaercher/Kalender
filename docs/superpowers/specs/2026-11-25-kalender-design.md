# Kalender – Design

Stand: 2026-11-25 · abgestimmt mit Melvin

## Ziel und Warum
Eine minimalistische, **private** Kalender-App fürs iPhone 14. Sie startet mit einem normalen, leeren Monatskalender. Hauptzweck im Alltag: **Termine & Erinnerungen**. Dazu ein Wochenplan, der dieselben Einträge zeigt, und Geburtstage, die sich jedes Jahr automatisch wiederholen.

## Nicht-Ziele / Anti-Ziele
- Kein Sync, keine Konten, keine Analytics, kein Teilen.
- Keine Push-Benachrichtigungen, kein .ics-Export (bewusst verschoben).
- Keine Überladung: lieber wenig und sehr sauber.
- Anti-Ziel: Daten verlassen das Gerät.

## Entscheidungen
| Thema | Entscheidung | Grund |
|---|---|---|
| Auslieferung | PWA (Safari → „Zum Home-Bildschirm") | Kein Mac/Xcode, kein 99-€-Developer-Account nötig |
| Daten | IndexedDB lokal, In-Memory-Cache | Privat, offline, keine Infrastruktur |
| Erinnerungen | nur in der App (Banner), Weg A | Von Melvin gewählt; echte Push-Nachrichten bräuchten einen Server |
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
