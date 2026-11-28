# Kalender → Obsidian

Dieses kleine Programm läuft auf deinem **PC**. Es holt deine Kalenderdaten vom eigenen Server, entschlüsselt sie
**auf dem PC** (Passwort und Zugangscode verlassen den PC nicht) und schreibt sie als Markdown-Dateien in deinen Obsidian-Vault:

- `Termine.md` – anstehende Termine (120 Tage) und die letzten 30 Tage, Urlaub an jedem Tag
- `Geburtstage.md` – Geburtstage und jährliche Ereignisse
- `Haare.md` – Verdienst pro Monat und Kunden-Tabelle (abschaltbar)
- `_Stand.md` – wann zuletzt aktualisiert

Es ist **nur lesend**: Es ändert nichts in der App. Wenn du in Claude Code / Claude Desktop den Vault-Ordner freigibst,
kann Claude diese Dateien immer lesen („Wann habe ich nächste Woche Zeit?“).

## Einrichtung (Windows, einmal – dauert 3 Minuten)

1. **Node.js installieren** (Version 18 oder neuer): <https://nodejs.org> → „LTS“ herunterladen und installieren (alles mit „Weiter“ bestätigen).
2. **Dieses Projekt auf den PC holen:** GitHub-Seite des Projekts → grüner Knopf „Code“ → „Download ZIP“ → entpacken.
   Wichtig: Der Ordner `tools\obsidian-sync` muss im entpackten Projekt bleiben (er braucht die Dateien in `js\`).
3. In `tools\obsidian-sync` die Datei **`Einrichten.bat` doppelklicken** und die Fragen beantworten:
   - Pfad zu deinem Obsidian-Vault (Explorer: Rechtsklick auf den Ordner → „Als Pfad kopieren“, im Fenster mit Rechtsklick einfügen)
   - Zugangscode und Abgleich-Passwort (dieselben wie in der App beim Abgleich)
   - ob Kundennamen und Beträge (Haare) auch in den Vault sollen
   - ob es automatisch beim Anmelden im Hintergrund laufen soll (Ja)
4. Fertig: In Obsidian gibt es im Vault den Ordner **Kalender** mit `Termine.md`, `Geburtstage.md`, `Haare.md`.
   Das Programm holt jetzt alle 15 Minuten den neuesten Stand (auch nach einem Neustart des PCs).

**Abschalten:** Die Datei `KalenderZuObsidian.vbs` im Autostart-Ordner löschen (Windows-Taste + R → `shell:startup`) und im Task-Manager
den Prozess „Node.js“ beenden.

**Hinweis:** Die App gleicht nur ab, wenn sie Internet hat; neue Einträge vom iPhone sind also nach dem Speichern wenige Sekunden später
auf dem Server und beim nächsten Lauf im Vault.

### Manuell (ohne Einrichtungs-Assistent)
`config.example.json` zu `config.json` kopieren, ausfüllen, dann `node kalender-zu-obsidian.mjs` (einmal) bzw. `--watch` (dauerhaft).

## Claude liest den Vault

In Claude Code oder Claude Desktop den Vault-Ordner (bzw. den Unterordner `Kalender`) öffnen bzw. freigeben. Dann kann Claude `Kalender/*.md` lesen
und z. B. beantworten: „Wann habe ich nächste Woche Zeit?“ oder „Wie viel habe ich im Oktober mit Haareschneiden verdient?“.

## Wenn etwas nicht klappt

- „Das Abgleich-Passwort stimmt nicht“ → Passwort in `config.json` prüfen.
- „Der Zugangscode (token) stimmt nicht“ → Zugangscode prüfen.
- „Noch kein Stand auf dem Server“ → in der App Ereignisse → Abgleich öffnen.
