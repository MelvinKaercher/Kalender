import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseImport, splitNew, toEvent } from '../js/haircut-import.js';
import { statsForYear } from '../js/haircuts.js';

test('parseDate: deutsch und ISO, nur echte Tage', () => {
  assert.equal(parseDate('11.05.2026'), '2026-05-11');
  assert.equal(parseDate('1.6.2026'), '2026-06-01');
  assert.equal(parseDate('2026-05-11'), '2026-05-11');
  for (const bad of ['31.02.2026', '11.05', 'gestern', '2026-13-01', '']) assert.equal(parseDate(bad), null, bad);
});

test('parseImport: Zeilen, Komma-Preis, Notiz, Kommentare und Fehler', () => {
  const { items, errors } = parseImport('# Mai\n11.05.2026;Silas;10\n\n12.07.2026;Silas;7,5;mit Notiz; und mehr\n13.05.2026;;5\nxx;Ben;5\n14.05.2026;Ben;abc\n15.05.2026;Ben;');
  assert.deepEqual(items.map((i) => [i.date, i.customer, i.price, i.note]), [['2026-05-11', 'Silas', 10, ''], ['2026-07-12', 'Silas', 7.5, 'mit Notiz; und mehr']]);
  assert.deepEqual(errors.map((e) => e.line), [5, 6, 7, 8]);
  assert.match(errors[0].reason, /Name/); assert.match(errors[1].reason, /Datum/); assert.match(errors[2].reason, /Preis/);
});

test('splitNew: Doppelte (auch innerhalb des Imports und gegen Vorhandenes) werden übersprungen', () => {
  const existing = [toEvent({ date: '2026-05-11', customer: 'Silas', price: 10, note: '' })];
  const items = [
    { date: '2026-05-11', customer: 'silas', price: 10, note: '' },
    { date: '2026-05-11', customer: 'Ben', price: 10, note: '' },
    { date: '2026-05-11', customer: 'Ben', price: 10, note: '' },
    { date: '2026-05-11', customer: 'Silas', price: 12, note: '' },
  ];
  const { fresh, skipped } = splitNew(items, existing);
  assert.equal(skipped, 2);
  assert.deepEqual(fresh.map((i) => [i.customer, i.price]), [['Ben', 10], ['Silas', 12]]);
});

test('toEvent: ganztägig, orange, Verdienst zählt in der Jahresauswertung', () => {
  const { items } = parseImport('11.05.2026;Silas;10\n13.05.2026;Sizzar;0\n15.05.2026;Salim;10');
  const events = items.map((i, n) => ({ ...toEvent(i), id: String(n) }));
  assert.equal(events[0].allDay, true);
  assert.equal(events[0].color, '#f76b15');
  const { months, total } = statsForYear(events, 2026, new Date(2026, 10, 25));
  assert.deepEqual([months[4].count, months[4].earned], [3, 20]);
  assert.equal(total.planned, 0);
});
