import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAll } from '../js/search.js';
import { findOverlaps } from '../js/overlap.js';

const NOW = new Date(2026, 10, 26);
const events = [
  { id: 'a', title: 'Zahnarzt', date: '2026-12-01', start: '09:00', end: '10:00' },
  { id: 'b', title: 'Zahnarzt Kontrolle', date: '2026-05-01', start: '09:00', end: '10:00' },
  { id: 'c', title: 'Haareschneiden · Salim', date: '2026-11-30', start: '16:00', end: '17:00', haircut: { customer: 'Salim' } },
  { id: 'u', title: 'Urlaub', date: '2026-11-25', endDate: '2026-11-28', allDay: true },
  { id: 'n', title: 'Müller', date: '2026-12-05', allDay: true, note: 'Straße 5' },
];
const bdays = [{ id: 'x', name: 'Anna Müller', day: 3, month: 4 }];

test('Suche: anstehende zuerst, dann vergangene, dann Ereignisse', () => {
  const r = searchAll(events, bdays, 'zahnarzt', NOW).map((h) => h.item.id);
  assert.deepEqual(r, ['a', 'b']);
  assert.deepEqual(searchAll(events, bdays, 'müller', NOW).map((h) => h.item.id), ['n', 'x']);
});
test('Suche: Umlaute, Groß/Klein, Kunde, Notiz, laufender Urlaub', () => {
  assert.equal(searchAll(events, bdays, 'MULLER', NOW).length, 2);
  assert.equal(searchAll(events, bdays, 'salim', NOW)[0].item.id, 'c');
  assert.equal(searchAll(events, bdays, 'strasse', NOW)[0].item.id, 'n');
  assert.equal(searchAll(events, bdays, 'urlaub', NOW)[0].item.id, 'u');
  assert.deepEqual(searchAll(events, bdays, '  ', NOW), []);
  assert.equal(searchAll(events, bdays, 'zahnarzt kontrolle', NOW).length, 1);
});
test('Überschneidung', () => {
  const cand = { id: null, date: '2026-12-01', start: '09:30', end: '10:30' };
  assert.deepEqual(findOverlaps(events, cand).map((e) => e.id), ['a']);
  assert.equal(findOverlaps(events, { ...cand, start: '10:00', end: '11:00' }).length, 0); // nur Berührung
  assert.equal(findOverlaps(events, { ...cand, id: 'a' }).length, 0); // eigener Termin
  assert.equal(findOverlaps(events, { ...cand, allDay: true }).length, 0);
  assert.equal(findOverlaps(events, { ...cand, date: '2026-12-02' }).length, 0);
});
