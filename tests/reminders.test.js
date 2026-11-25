import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, eventStart, eventEnd, whenLabel } from '../js/reminders.js';

const ev = (over = {}) => ({
  id: 'e1', title: 'Zahnarzt', date: '2026-11-25', allDay: false,
  start: '14:00', end: '15:00', remind: 15, ...over,
});
const run = (events, now, { seen = new Set(), birthdays = [] } = {}) =>
  dueReminders({ events, birthdays, seen, now });

test('Erinnerung ist erst ab dem Erinnerungszeitpunkt fällig', () => {
  assert.equal(run([ev()], new Date(2026, 10, 25, 13, 44)).length, 0);
  assert.equal(run([ev()], new Date(2026, 10, 25, 13, 45)).length, 1);
  assert.equal(run([ev()], new Date(2026, 10, 25, 14, 30)).length, 1); // läuft noch
});

test('Nach dem Ende des Termins nicht mehr fällig', () => {
  assert.equal(run([ev()], new Date(2026, 10, 25, 15, 0)).length, 0);
});

test('Ohne Erinnerung (remind=null) nie fällig', () => {
  assert.equal(run([ev({ remind: null })], new Date(2026, 10, 25, 14, 0)).length, 0);
});

test('Gesehene Erinnerungen kommen nicht wieder', () => {
  const first = run([ev()], new Date(2026, 10, 25, 14, 0));
  const seen = new Set([first[0].key]);
  assert.equal(run([ev()], new Date(2026, 10, 25, 14, 1), { seen }).length, 0);
});

test('Wird ein Termin verschoben, erinnert die App neu', () => {
  const first = run([ev()], new Date(2026, 10, 25, 14, 0));
  const seen = new Set([first[0].key]);
  const moved = ev({ start: '16:00', end: '17:00' });
  assert.equal(run([moved], new Date(2026, 10, 25, 15, 50), { seen }).length, 1);
});

test('Ganztägig: Erinnerung "1 Tag vorher" ab 9:00 am Vortag, bis Tagesende', () => {
  const allDay = ev({ allDay: true, start: undefined, end: undefined, remind: 1440 });
  assert.equal(run([allDay], new Date(2026, 10, 24, 8, 59)).length, 0);
  assert.equal(run([allDay], new Date(2026, 10, 24, 9, 0)).length, 1);
  assert.equal(run([allDay], new Date(2026, 10, 25, 23, 59)).length, 1);
  assert.equal(run([allDay], new Date(2026, 10, 26, 0, 0)).length, 0);
});

test('Geburtstag: am Tag selbst fällig, einmal pro Jahr', () => {
  const b = { id: 'b1', name: 'Anna', day: 25, month: 11, year: 1990 };
  const today = run([], new Date(2026, 10, 25, 7, 0), { birthdays: [b] });
  assert.equal(today.length, 1);
  assert.equal(today[0].title, 'Anna hat Geburtstag');
  assert.equal(today[0].text, 'wird 36');
  assert.equal(run([], new Date(2026, 10, 26, 7, 0), { birthdays: [b] }).length, 0);
  const seen = new Set([today[0].key]);
  assert.equal(run([], new Date(2026, 10, 25, 9, 0), { birthdays: [b], seen }).length, 0);
  // nächstes Jahr wieder
  assert.equal(run([], new Date(2027, 10, 25, 9, 0), { birthdays: [b], seen }).length, 1);
});

test('Start/Ende und Beschriftung', () => {
  assert.equal(eventStart(ev()).getHours(), 14);
  assert.equal(eventEnd(ev()).getHours(), 15);
  // fehlendes/ungültiges Ende => 1 Stunde
  assert.equal(eventEnd(ev({ end: '13:00' })).getHours(), 15);
  assert.equal(whenLabel(ev(), new Date(2026, 10, 25, 13, 45)), 'in 15 Min.');
  assert.equal(whenLabel(ev(), new Date(2026, 10, 25, 9, 0)), 'um 14:00 Uhr');
  assert.equal(whenLabel(ev(), new Date(2026, 10, 25, 14, 5)), 'Jetzt');
});
