#!/usr/bin/env node
// Holt den verschlüsselten Kalender-Stand vom eigenen Server, entschlüsselt ihn auf DIESEM Rechner
// und schreibt Markdown-Dateien in einen Obsidian-Ordner. Nur lesend – nichts geht zurück in die App.
//   node kalender-zu-obsidian.mjs            einmal ausführen
//   node kalender-zu-obsidian.mjs --watch    dauerhaft, alle N Minuten
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decryptSnapshot, SyncError } from '../../js/sync-core.js';
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

async function main() {
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
