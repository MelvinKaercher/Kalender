import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptSnapshot } from '../js/sync-core.js';
import { renderTermine, renderGeburtstage, renderHaare } from '../tools/obsidian-sync/markdown.js';
import { runOnce, fetchSnapshot } from '../tools/obsidian-sync/kalender-zu-obsidian.mjs';

const NOW = new Date(2026, 10, 26, 10, 0);
const snap = {
  events: [
    { id: '1', title: 'Zahnarzt', date: '2026-11-27', start: '13:00', end: '14:00', allDay: false, note: 'Kontrolle' },
    { id: '2', title: 'Urlaub', date: '2026-12-10', endDate: '2026-12-12', allDay: true, vacation: true },
    { id: '3', title: 'Haareschneiden · Salim', date: '2026-10-05', allDay: true, haircut: { customer: 'Salim', price: 15, tip: 2 } },
    { id: '4', title: 'Haareschneiden · Salim', date: '2026-11-02', allDay: true, haircut: { customer: 'Salim', price: 15, tip: 0 } },
  ],
  birthdays: [{ id: 'b', name: 'Anna', day: 3, month: 4, year: 1990, type: 'birthday' }],
  tombs: { events: {}, birthdays: {} },
};

test('Markdown: Termine, Urlaub an jedem Tag, Geburtstage, Haare', () => {
  const t = renderTermine(snap, NOW);
  assert.match(t, /### Fr 27\.11\.2026\n- 13:00–14:00: Zahnarzt – Kontrolle/);
  assert.match(t, /### Do 10\.12\.2026/);
  assert.match(t, /### Sa 12\.12\.2026/);
  assert.match(t, /Zuletzt/);
  assert.match(renderGeburtstage(snap), /## April\n- 3\.4\.: Anna 🎂 \(geboren 1990\)/);
  const h = renderHaare(snap, NOW);
  assert.match(h, /\| Salim \| 2 \| 32,00\s€ \| 16,00\s€ \|/);
  assert.match(h, /\| Oktober \| 1 \|/);
  assert.doesNotMatch(renderTermine(snap, NOW, { includeHaircuts: false }), /Salim/);
});

test('Rundlauf: verschlüsselter Block → Dateien; zweiter Lauf ändert nichts; falsches Passwort', async () => {
  const blob = await encryptSnapshot(snap, 'geheim');
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ version: 1, blob }) });
  const dir = await mkdtemp(join(tmpdir(), 'kal-'));
  const cfg = { workerUrl: 'https://x.test', token: 't', password: 'geheim', vaultFolder: join(dir, 'Kalender'), includeHaircuts: true };
  const r1 = await runOnce(cfg, { fetchFn, now: NOW });
  assert.deepEqual(r1.changed.sort(), ['Geburtstage.md', 'Haare.md', 'Termine.md', '_Stand.md']);
  assert.deepEqual((await readdir(cfg.vaultFolder)).sort(), ['Geburtstage.md', 'Haare.md', 'Termine.md', '_Stand.md']);
  assert.match(await readFile(join(cfg.vaultFolder, 'Termine.md'), 'utf8'), /Zahnarzt/);
  assert.deepEqual((await runOnce(cfg, { fetchFn, now: NOW })).changed, []);
  await assert.rejects(fetchSnapshot({ ...cfg, password: 'falsch' }, fetchFn), /Passwort/);
  await assert.rejects(fetchSnapshot(cfg, async () => ({ ok: false, status: 401 })), /Zugangscode/);
  const noHair = await runOnce({ ...cfg, vaultFolder: join(dir, 'K2'), includeHaircuts: false }, { fetchFn, now: NOW });
  assert.ok(!noHair.changed.includes('Haare.md'));
});
