import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toKey, fromKey, addDays, addMonths, startOfWeek, weekDays, monthGrid,
  isoWeek, isLeapYear, daysInMonth, toMinutes, fromMinutes,
} from '../js/calendar.js';
import { itemsForDay } from '../js/items.js';

test('toKey/fromKey sind zueinander invers', () => {
  assert.equal(toKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toKey(fromKey('2028-02-29')), '2028-02-29');
});

test('Schaltjahre und Monatslängen', () => {
  assert.ok(isLeapYear(2028));
  assert.ok(!isLeapYear(2100));
  assert.ok(isLeapYear(2000));
  assert.equal(daysInMonth(2028, 1), 29);
  assert.equal(daysInMonth(2027, 1), 28);
});

test('Woche beginnt am Montag', () => {
  // 25.11.2026 ist ein Mittwoch
  assert.equal(toKey(startOfWeek(new Date(2026, 10, 25))), '2026-11-23');
  // Sonntag gehört zur Woche davor
  assert.equal(toKey(startOfWeek(new Date(2026, 10, 29))), '2026-11-23');
  // Montag bleibt Montag
  assert.equal(toKey(startOfWeek(new Date(2026, 10, 23))), '2026-11-23');
  const days = weekDays(new Date(2026, 10, 25)).map(toKey);
  assert.deepEqual(days, [
    '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26',
    '2026-11-27', '2026-11-28', '2026-11-29',
  ]);
});

test('Wochenbereich über den Jahreswechsel', () => {
  const days = weekDays(new Date(2026, 11, 31)).map(toKey);
  assert.equal(days[0], '2026-12-28');
  assert.equal(days[6], '2027-01-03');
});

test('Monatsraster November 2026: 6 Wochen, 1.11. ist ein Sonntag', () => {
  const grid = monthGrid(2026, 10);
  assert.equal(grid.length, 6); // 6 Tage Vormonat + 30 Tage = 36 Zellen
  assert.ok(grid.every((w) => w.length === 7));
  assert.equal(grid[0][0].key, '2026-10-26');
  assert.equal(grid[0][6].key, '2026-11-01');
  assert.ok(!grid[0][0].inMonth);
  assert.ok(grid[0][6].inMonth);
  assert.equal(grid[5][0].key, '2026-11-30');
  assert.ok(grid[5][0].inMonth);
  assert.ok(!grid[5][1].inMonth);
});

test('Monatsraster Oktober 2026: 5 Wochen', () => {
  const grid = monthGrid(2026, 9); // 1.10. = Donnerstag, 31 Tage
  assert.equal(grid.length, 5);
  assert.equal(grid[0][0].key, '2026-09-28');
  assert.equal(grid[4][6].key, '2026-11-01');
});

test('Monatsraster: Februar 2027 passt in 4 Wochen, Mai 2027 braucht 6', () => {
  assert.equal(monthGrid(2027, 1).length, 4); // 1.2.2027 = Montag, 28 Tage
  assert.equal(monthGrid(2027, 4).length, 6); // 1.5.2027 = Samstag
});

test('Monatsraster im Schaltjahr enthält den 29.2.', () => {
  const keys = monthGrid(2028, 1).flat().filter((c) => c.inMonth).map((c) => c.key);
  assert.equal(keys.length, 29);
  assert.ok(keys.includes('2028-02-29'));
});

test('addMonths über Jahresgrenzen', () => {
  assert.equal(toKey(addMonths(new Date(2026, 11, 15), 1)), '2027-01-01');
  assert.equal(toKey(addMonths(new Date(2026, 0, 31), -1)), '2025-12-01');
});

test('addDays über Monats-/Jahresgrenzen', () => {
  assert.equal(toKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.equal(toKey(addDays(new Date(2028, 1, 28), 1)), '2028-02-29');
});

test('ISO-Kalenderwoche', () => {
  assert.equal(isoWeek(new Date(2026, 10, 25)), 48);
  assert.equal(isoWeek(new Date(2026, 0, 1)), 1);
  assert.equal(isoWeek(new Date(2027, 0, 1)), 53); // Freitag, gehört zu KW 53/2026
  assert.equal(isoWeek(new Date(2024, 11, 30)), 1); // Montag, gehört zu KW 1/2025
});

test('Minuten <-> HH:MM', () => {
  assert.equal(toMinutes('09:30'), 570);
  assert.equal(fromMinutes(570), '09:30');
  assert.equal(fromMinutes(24 * 60 + 30), '23:59'); // gedeckelt
  assert.equal(fromMinutes(-5), '00:00');
});

test('itemsForDay: ein Datenbestand für Monat und Woche, sortiert', () => {
  const events = [
    { id: 'a', title: 'Zahnarzt', date: '2026-11-25', allDay: false, start: '14:00', end: '15:00' },
    { id: 'b', title: 'Urlaub', date: '2026-11-25', allDay: true },
    { id: 'c', title: 'Frühstück', date: '2026-11-25', allDay: false, start: '08:00', end: '09:00' },
    { id: 'd', title: 'Anderer Tag', date: '2026-11-26', allDay: false, start: '08:00', end: '09:00' },
  ];
  const birthdays = [{ id: 'x', name: 'Oma', day: 25, month: 11, year: 1950 }];
  const r = itemsForDay(events, birthdays, new Date(2026, 10, 25));
  assert.deepEqual(r.events.map((e) => e.id), ['b', 'c', 'a']);
  assert.equal(r.birthdays.length, 1);
  assert.equal(r.birthdays[0].age, 76);
  assert.equal(itemsForDay(events, birthdays, new Date(2026, 10, 27)).events.length, 0);
});

test('itemsForDay: mehrtägiger Termin erscheint an jedem Tag von Beginn bis Ende', () => {
  const urlaub = { id: 'u', title: 'Urlaub', date: '2026-08-10', endDate: '2026-08-14', allDay: true };
  const at = (d) => itemsForDay([urlaub], [], new Date(2026, 7, d)).events.length;
  assert.equal(at(9), 0);
  assert.equal(at(10), 1);
  assert.equal(at(12), 1);
  assert.equal(at(14), 1);
  assert.equal(at(15), 0);
});
