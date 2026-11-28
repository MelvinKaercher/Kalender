#!/usr/bin/env node
// Holt den verschlüsselten Kalender-Stand vom eigenen Server, entschlüsselt ihn auf DIESEM Rechner
// und schreibt Markdown-Dateien in einen Obsidian-Ordner. Nur lesend – nichts geht zurück in die App.
//   node kalender-zu-obsidian.mjs            einmal ausführen
//   node kalender-zu-obsidian.mjs --watch    dauerhaft, alle N Minuten
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decryptSnapshot, SyncError } from '../../js/sync-core.js';
import config from '../../js/config.js';
import { renderTermine, renderGeburtstage, renderHaare, renderStand } from './markdown.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function loadConfig(path = join(here, 'config.json')) {
  let raw;
  try { raw = JSON.parse(await readFile(path, 'utf8')); } catch (e) {
    throw new Error(`Die Datei config.json fehlt oder ist kaputt (${path}). Kopiere config.example.json zu config.json und fülle sie aus.`);
  }
  for (const k of ['workerUrl', 'token', 'password', 'vaultFolder']) {
    if (!raw[k] || String(raw[k]).startsWith('HIER')) throw new Error(`In config.json fehlt der Wert „${k}“.`);
  }
  return { includeHaircuts: true, intervalMinutes: 15, ...raw };
}

/** Holt und entschlüsselt den Stand. Gibt { snapshot } oder { snapshot: null } (noch nichts abgeglichen) zurück. */
export async function fetchSnapshot(cfg, fetchFn = fetch) {
  let res;
  try {
    res = await fetchFn(`${cfg.workerUrl.replace(/\/+$/, '')}/sync/get`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` }, body: '{}',
    });
  } catch { throw new Error('Keine Verbindung zum Server. Ist der PC online?'); }
  if (res.status === 401) throw new Error('Der Zugangscode (token) stimmt nicht.');
  if (!res.ok) throw new Error(`Der Server antwortete mit Fehler ${res.status}.`);
  const { blob } = await res.json();
  if (!blob) return { snapshot: null };
  try { return { snapshot: (await decryptSnapshot(blob, cfg.password)).snapshot }; } catch (e) {
    if (e instanceof SyncError && e.code === 'password') throw new Error('Das Abgleich-Passwort stimmt nicht.');
    throw e;
  }
}

async function writeIfChanged(file, text) {
  try { if ((await readFile(file, 'utf8')) === text) return false; } catch { /* neu */ }
  await writeFile(file, text, 'utf8');
  return true;
}

/** Ein Durchlauf: holen, entschlüsseln, Dateien schreiben. Gibt die Liste der geänderten Dateien zurück. */
export async function runOnce(cfg, { fetchFn = fetch, now = new Date() } = {}) {
  const { snapshot } = await fetchSnapshot(cfg, fetchFn);
  if (!snapshot) return { changed: [], note: 'Auf dem Server liegt noch kein Stand. Öffne die Kalender-App und starte dort den Abgleich.' };
  await mkdir(cfg.vaultFolder, { recursive: true });
  const files = {
    'Termine.md': renderTermine(snapshot, now, { includeHaircuts: cfg.includeHaircuts }),
    'Geburtstage.md': renderGeburtstage(snapshot),
  };
  if (cfg.includeHaircuts) files['Haare.md'] = renderHaare(snapshot, now);
  const changed = [];
  for (const [name, text] of Object.entries(files)) if (await writeIfChanged(join(cfg.vaultFolder, name), text)) changed.push(name);
  // _Stand.md nur neu schreiben, wenn sich sonst etwas geändert hat (sonst ändert sich die Datei ständig)
  if (changed.length) {
    await writeFile(join(cfg.vaultFolder, '_Stand.md'), renderStand(now, { events: snapshot.events.length, birthdays: snapshot.birthdays.length }), 'utf8');
    changed.push('_Stand.md');
  }
  return { changed };
}

/* ───────── Geführte Einrichtung: node kalender-zu-obsidian.mjs --setup ───────── */

/** Pfad aus dem Explorer ("Als Pfad kopieren") bereinigen: Anführungszeichen, Leerzeichen am Rand. */
export const cleanPathInput = (s) => String(s || '').trim().replace(/^["']+|["']+$/g, '').trim();

/** Windows-Autostart-Skript: startet das Programm unsichtbar beim Anmelden. */
export function startupScript(nodePath, scriptPath) {
  const q = (p) => `""${String(p).replace(/"/g, '')}""`;
  return `CreateObject("WScript.Shell").Run "${q(nodePath)} ${q(scriptPath)} --watch", 0, False\r\n`;
}

const isDir = async (p) => { try { return (await stat(p)).isDirectory(); } catch { return false; } };

export async function setup({ input = process.stdin, output = process.stdout, fetchFn = fetch, configPath = join(here, 'config.json'), platform = process.platform, startupDir = null, launch = true } = {}) {
  const rl = createInterface({ input, output });
  const say = (m = '') => output.write(`${m}\n`);
  const ask = async (q, dflt = '') => { const a = (await rl.question(`${q}${dflt ? ` [${dflt}]` : ''}: `)).trim(); return a || dflt; };
  try {
    say('\nEinrichtung: Kalender → Obsidian\n');
    say('Tipp: Im Explorer den Vault-Ordner mit Rechtsklick → „Als Pfad kopieren“ und hier einfügen (Rechtsklick ins Fenster).');
    let vault;
    for (;;) {
      vault = cleanPathInput(await ask('Pfad zu deinem Obsidian-Vault'));
      if (vault && await isDir(vault)) break;
      say('Diesen Ordner gibt es nicht. Bitte noch einmal.');
    }
    const cfg = { workerUrl: config.workerUrl, token: '', password: '', vaultFolder: join(vault, 'Kalender'), includeHaircuts: true, intervalMinutes: 15 };
    const hair = (await ask('Kundennamen und Beträge (Haare) auch in den Vault schreiben? (j/n)', 'j')).toLowerCase();
    cfg.includeHaircuts = !hair.startsWith('n');

    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      cfg.token = await ask('Zugangscode (wie in der App beim Abgleich)', cfg.token);
      cfg.password = await ask('Abgleich-Passwort (wie in der App)', cfg.password);
      try {
        const r = await runOnce(cfg, { fetchFn });
        say(r.note || (r.changed.length ? `Geschafft! Geschrieben: ${r.changed.join(', ')}` : 'Verbindung klappt, alles schon aktuell.'));
        ok = true;
      } catch (e) { say(`Das hat nicht geklappt: ${e.message}`); }
    }
    if (!ok) { say('\nAbgebrochen. Prüfe Zugangscode und Passwort in der App (Ereignisse → Abgleich) und starte die Einrichtung noch einmal.'); return false; }
    await writeFile(configPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    say(`Einstellungen gespeichert (${configPath}).`);

    if (platform === 'win32') {
      const auto = (await ask('Automatisch beim Anmelden im Hintergrund starten und alle 15 Minuten aktualisieren? (j/n)', 'j')).toLowerCase();
      if (!auto.startsWith('n')) {
        const dir = startupDir || join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        await mkdir(dir, { recursive: true });
        const vbs = join(dir, 'KalenderZuObsidian.vbs');
        const script = fileURLToPath(import.meta.url);
        await writeFile(vbs, startupScript(process.execPath, script), 'utf8');
        if (launch) spawn(process.execPath, [script, '--watch'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        say('Fertig: Es läuft jetzt unsichtbar im Hintergrund und startet auch nach jedem Neustart.');
        say(`Abschalten: Datei löschen: ${vbs}`);
      }
    } else {
      say('Hinweis: Autostart wird nur unter Windows automatisch eingerichtet. Starte mit: node kalender-zu-obsidian.mjs --watch');
    }
    say('\nÖffne jetzt Obsidian: Im Vault gibt es den Ordner „Kalender“.');
    return true;
  } finally { rl.close(); }
}

async function main() {
  if (process.argv.includes('--setup')) { process.exitCode = (await setup()) ? 0 : 1; return; }
  const watch = process.argv.includes('--watch');
  const cfg = await loadConfig();
  const log = (m) => console.log(`[${new Date().toLocaleString('de-DE')}] ${m}`);
  const step = async () => {
    try {
      const r = await runOnce(cfg);
      log(r.note || (r.changed.length ? `Aktualisiert: ${r.changed.join(', ')}` : 'Keine Änderungen.'));
    } catch (e) { log(`Fehler: ${e.message}`); if (!watch) process.exitCode = 1; }
  };
  await step();
  if (watch) setInterval(step, Math.max(1, Number(cfg.intervalMinutes) || 15) * 60000);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`Fehler: ${e.message}`); process.exit(1); });
}
