# Kalender → Obsidian

Dieses kleine Programm läuft auf deinem **PC**. Es holt deine Kalenderdaten vom eigenen Server, entschlüsselt sie
**auf dem PC** (Passwort und Zugangscode verlassen den PC nicht) und schreibt sie als Markdown-Dateien in deinen Obsidian-Vault:

- `Termine.md` – anstehende Termine (120 Tage) und die letzten 30 Tage, Urlaub an jedem Tag
- `Geburtstage.md` – Geburtstage und jährliche Ereignisse
- `Haare.md` – Verdienst pro Monat und Kunden-Tabelle (abschaltbar)
- `_Stand.md` – wann zuletzt aktualisiert

Es ist **nur lesend**: Es ändert nichts in der App. Wenn du in Claude Code / Claude Desktop den Vault-Ordner freigibst,
kann Claude diese Dateien immer lesen („Wann habe ich nächste Woche Zeit?“).

## Einrichtung (einmal)

1. **Node.js installieren** (Version 18 oder neuer): <https://nodejs.org> → „LTS“ herunterladen und installieren.
2. **Dieses Projekt auf den PC holen:** GitHub-Seite des Projekts → grüner Knopf „Code“ → „Download ZIP“ → entpacken.
   Wichtig: Der Ordner `tools/obsidian-sync` muss im entpackten Projekt bleiben (er braucht die Dateien in `js/`).
3. In `tools/obsidian-sync` die Datei `config.example.json` kopieren und die Kopie **`config.json`** nennen. Dort eintragen:
   - `workerUrl`: `https://kalender-push.melvin-kalender.workers.dev`
   - `token`: dein **Zugangscode** (derselbe wie in der App beim Abgleich)
   - `password`: dein **Abgleich-Passwort** (dasselbe wie in der App)
   - `vaultFolder`: Ordner im Vault, z. B. `C:\\Users\\DEINNAME\\Documents\\MeinVault\\Kalender` (Backslashes doppelt schreiben)
   - `includeHaircuts`: `false`, wenn Kundennamen und Beträge **nicht** im Vault stehen sollen
4. **Testlauf:** Eingabeaufforderung im Ordner `tools/obsidian-sync` öffnen und eingeben:
   ```
   node kalender-zu-obsidian.mjs
   ```
   Es sollte „Aktualisiert: Termine.md, …“ erscheinen, und die Dateien liegen im Vault.
   (Zuerst muss in der App einmal der Abgleich laufen: Ereignisse → Abgleich.)

## Automatisch starten (Windows)

- Variante A (empfohlen): **Aufgabenplanung** → „Aufgabe erstellen“ → Trigger **„Bei Anmeldung“** →
  Aktion: Programm `node`, Argumente `kalender-zu-obsidian.mjs --watch`, „Starten in“: der Ordner `tools\obsidian-sync`.
  Es holt dann beim Anmelden sofort den neuesten Stand und danach alle 15 Minuten.
- Variante B: `node kalender-zu-obsidian.mjs --watch` im Autostart-Ordner (Windows-Taste + R → `shell:startup`) als Verknüpfung ablegen.

Hinweis: Die App gleicht nur ab, wenn sie Internet hat; neue Einträge vom iPhone sind also nach dem Speichern wenige Sekunden später
auf dem Server und beim nächsten Lauf im Vault.

## Wenn etwas nicht klappt

- „Das Abgleich-Passwort stimmt nicht“ → Passwort in `config.json` prüfen.
- „Der Zugangscode (token) stimmt nicht“ → Zugangscode prüfen.
- „Noch kein Stand auf dem Server“ → in der App Ereignisse → Abgleich öffnen.
