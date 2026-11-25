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
  assert.equal(today[0].title, 'Anna hat heute Geburtstag');
  assert.equal(today[0].text, 'wird 36');
  assert.equal(today[0].stage, 'today');
  assert.equal(run([], new Date(2026, 10, 26, 7, 0), { birthdays: [b] }).length, 0);
  const seen = new Set([today[0].key]);
  assert.equal(run([], new Date(2026, 10, 25, 9, 0), { birthdays: [b], seen }).length, 0);
  // nächstes Jahr wieder
  assert.equal(run([], new Date(2027, 10, 25, 9, 0), { birthdays: [b], seen }).length, 1);
});

test('Geburtstag: vier Stufen, je Stufe genau eine Erinnerung', () => {
  const b = { id: 'b1', name: 'Anna', day: 25, month: 11, year: 1990 };
  const seen = new Set();
  const expected = [
    [new Date(2026, 9, 25, 8), 'month', 'Anna hat in 1 Monat Geburtstag', 'am 25. November · wird 36'],
    [new Date(2026, 10, 18, 8), 'week', 'Anna hat in 1 Woche Geburtstag', 'am 25. November · wird 36'],
    [new Date(2026, 10, 24, 8), 'day', 'Anna hat morgen Geburtstag', 'am 25. November · wird 36'],
    [new Date(2026, 10, 25, 0, 1), 'today', 'Anna hat heute Geburtstag', 'wird 36'],
  ];
  const keys = new Set();
  for (const [now, stage, title, text] of expected) {
    const due = run([], now, { birthdays: [b], seen });
    assert.equal(due.length, 1, stage);
    assert.equal(due[0].stage, stage);
    assert.equal(due[0].title, title);
    assert.equal(due[0].text, text);
    keys.add(due[0].key);
    seen.add(due[0].key); // wegwischen
    assert.equal(run([], now, { birthdays: [b], seen }).length, 0, `${stage}: nach dem Wegwischen ruhig`);
  }
  assert.equal(keys.size, 4, 'jede Stufe hat einen eigenen Schlüssel');
});

test('Geburtstag: wer die App erst am Tag öffnet, bekommt nur die jüngste Stufe', () => {
  const b = { id: 'b1', name: 'Anna', day: 25, month: 11, year: 1990 };
  const due = run([], new Date(2026, 10, 25, 12), { birthdays: [b] });
  assert.equal(due.length, 1);
  assert.equal(due[0].stage, 'today');
});

test('Geburtstag im Januar erinnert schon im Dezember (1 Monat vorher)', () => {
  const b = { id: 'b2', name: 'Jan', day: 5, month: 1, year: 2000 };
  const due = run([], new Date(2026, 11, 5, 9), { birthdays: [b] });
  assert.equal(due.length, 1);
  assert.equal(due[0].title, 'Jan hat in 1 Monat Geburtstag');
  assert.equal(due[0].text, 'am 5. Januar · wird 27');
});

test('Geburtstag: verspätet gezeigte Meldung nennt die echte Restzeit, nach 2 Tagen Schluss', () => {
  const b = { id: 'b1', name: 'Anna', day: 25, month: 11, year: 1990 };
  // Wochen-Stufe war am 18.11.; am 20.11. (2 Tage später) noch da, aber mit echter Restzeit
  const late = run([], new Date(2026, 10, 20, 9), { birthdays: [b] });
  assert.equal(late.length, 1);
  assert.equal(late[0].stage, 'week');
  assert.equal(late[0].title, 'Anna hat in 5 Tagen Geburtstag');
  // am 21.11. (3 Tage später) nicht mehr
  assert.equal(run([], new Date(2026, 10, 21, 9), { birthdays: [b] }).length, 0);
  // am Tag der Stufe: normaler Text
  assert.equal(run([], new Date(2026, 10, 18, 9), { birthdays: [b] })[0].title, 'Anna hat in 1 Woche Geburtstag');
});

test('Geburtstag erst kurz vorher eingetragen: keine falsche Meldung "in 1 Woche"', () => {
  // heute 25.11., neu eingetragen: Geburtstag am 27.11. -> Wochen-Stufe war am 20.11. (5 Tage her)
  const b = { id: 'n', name: 'Neu', day: 27, month: 11, year: 2000 };
  assert.equal(run([], new Date(2026, 10, 25, 10), { birthdays: [b] }).length, 0);
  // Geburtstag in 3 Wochen: Monats-Stufe liegt 1 Woche zurück -> auch nichts
  const far = { id: 'f', name: 'Fern', day: 16, month: 12, year: 2000 };
  assert.equal(run([], new Date(2026, 10, 25, 10), { birthdays: [far] }).length, 0);
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

/* ───────── Push: Termine mit Erinnerung ───────── */
import { remindersForPush } from '../js/reminders.js';

test('remindersForPush: nur Anstehendes mit Erinnerung, ohne Kundennamen, gekürzt, begrenzt', () => {
  const now = new Date(2026, 10, 25, 12, 0);
  const mk = (id, over = {}) => ({ id, title: 'T' + id, date: '2026-11-26', allDay: false, start: '10:00', end: '11:00', remind: 15, ...over });
  const list = remindersForPush([
    mk('a'), mk('b', { remind: null }), mk('c', { date: '2026-11-20' }), mk('d', { date: '2027-06-01' }),
    mk('e', { title: 'Haareschneiden · Silas', haircut: { customer: 'Silas', price: 10 } }),
    mk('f', { title: 'x'.repeat(300) }), mk('g', { allDay: true, start: null, end: null, remind: 0 }),
  ], now);
  assert.deepEqual(list.map((r) => r.id).sort(), ['a', 'e', 'f', 'g']);
  assert.equal(list.find((r) => r.id === 'e').title, 'Haareschneiden');
  assert.equal(list.find((r) => r.id === 'f').title.length, 120);
  assert.deepEqual(list.find((r) => r.id === 'g'), { id: 'g', title: 'Tg', date: '2026-11-26', allDay: true, start: null, remind: 0 });
  assert.ok(!JSON.stringify(list).includes('Silas'));
  const many = Array.from({ length: 300 }, (_, i) => mk(`m${i}`));
  assert.equal(remindersForPush(many, now).length, 200);
});
