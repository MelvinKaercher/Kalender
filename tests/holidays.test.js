import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterSunday, holidaysOfYear, holidayOn } from '../js/holidays.js';
import { SCHOOL_HOLIDAYS, vacationsOn } from '../js/school-holidays.js';
import { itemsForDay } from '../js/items.js';
import { toKey } from '../js/calendar.js';

const key = (d) => toKey(d);

test('Ostersonntag stimmt für bekannte Jahre', () => {
  const known = {
    1961: '1961-04-02', 2000: '2000-04-23', 2019: '2019-04-21', 2024: '2024-03-31', 2025: '2025-04-20',
    2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2030: '2030-04-21', 2038: '2038-04-25',
  };
  for (const [year, expected] of Object.entries(known)) assert.equal(key(easterSunday(Number(year))), expected, year);
});

test('Feiertage BW 2026', () => {
  const got = holidaysOfYear(2026).map((h) => `${key(h.date)} ${h.name}`);
  assert.deepEqual(got, [
    '2026-01-01 Neujahr',
    '2026-01-06 Heilige Drei Könige',
    '2026-04-03 Karfreitag',
    '2026-04-06 Ostermontag',
    '2026-05-01 Tag der Arbeit',
    '2026-05-14 Christi Himmelfahrt',
    '2026-05-25 Pfingstmontag',
    '2026-06-04 Fronleichnam',
    '2026-10-03 Tag der Deutschen Einheit',
    '2026-11-01 Allerheiligen',
    '2026-12-25 1. Weihnachtstag',
    '2026-12-26 2. Weihnachtstag',
  ]);
});

test('Feiertage BW 2027 (bewegliche folgen Ostern am 28.3.)', () => {
  const got = Object.fromEntries(holidaysOfYear(2027).map((h) => [h.name, key(h.date)]));
  assert.equal(got['Karfreitag'], '2027-03-26');
  assert.equal(got['Ostermontag'], '2027-03-29');
  assert.equal(got['Christi Himmelfahrt'], '2027-05-06');
  assert.equal(got['Pfingstmontag'], '2027-05-17');
  assert.equal(got['Fronleichnam'], '2027-05-27');
  assert.equal(holidaysOfYear(2027).length, 12);
});

test('Keine Feiertage in BW: Reformationstag, Mariä Himmelfahrt, Buß- und Bettag, Heiligabend, Silvester', () => {
  for (const [m, d] of [[10, 31], [8, 15], [12, 24], [12, 31], [11, 18]]) {
    assert.equal(holidayOn(new Date(2026, m - 1, d)), null, `${d}.${m}.`);
  }
});

test('holidayOn findet Feiertag, sonst null; Schaltjahr stört nicht', () => {
  assert.equal(holidayOn(new Date(2026, 11, 25)).name, '1. Weihnachtstag');
  assert.equal(holidayOn(new Date(2026, 10, 25)), null);
  assert.equal(holidayOn(new Date(2028, 3, 14)).name, 'Karfreitag'); // Ostern 16.4.2028
});

test('Ferien: Grenzen sind einschließlich, auch über den Jahreswechsel', () => {
  const names = (y, m, d) => vacationsOn(new Date(y, m - 1, d)).map((v) => v.name);
  assert.deepEqual(names(2026, 12, 22), []);
  assert.deepEqual(names(2026, 12, 23), ['Weihnachtsferien']);
  assert.deepEqual(names(2026, 12, 31), ['Weihnachtsferien']);
  assert.deepEqual(names(2027, 1, 1), ['Weihnachtsferien']);
  assert.deepEqual(names(2027, 1, 9), ['Weihnachtsferien']);
  assert.deepEqual(names(2027, 1, 10), []);
});

test('Ferien 2026/27 und Sommerferien 2027 beginnen im Juli 2027', () => {
  const on = (y, m, d) => vacationsOn(new Date(y, m - 1, d)).map((v) => v.name);
  assert.deepEqual(on(2026, 10, 26), ['Herbstferien']);
  assert.deepEqual(on(2026, 10, 30), ['Herbstferien']);
  assert.deepEqual(on(2026, 11, 2), []);
  assert.deepEqual(on(2027, 3, 25), ['Unterrichtsfreier Tag (Gründonnerstag)']);
  assert.deepEqual(on(2027, 3, 29), []);
  assert.deepEqual(on(2027, 3, 30), ['Osterferien']);
  assert.deepEqual(on(2027, 4, 3), ['Osterferien']);
  assert.deepEqual(on(2027, 5, 18), ['Pfingstferien']);
  assert.deepEqual(on(2027, 5, 29), ['Pfingstferien']);
  assert.deepEqual(on(2027, 7, 28), []);
  assert.deepEqual(on(2027, 7, 29), ['Sommerferien']);
  assert.deepEqual(on(2027, 9, 11), ['Sommerferien']);
});

test('Ferien-Daten sind gültig, geordnet und überlappen nicht', () => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  let prevEnd = '';
  for (const v of SCHOOL_HOLIDAYS) {
    assert.ok(iso.test(v.start) && iso.test(v.end), v.name);
    assert.ok(v.start <= v.end, `${v.name}: Ende vor Anfang`);
    assert.ok(v.start > prevEnd, `${v.name} überlappt/ist nicht geordnet`);
    assert.ok(['ferien', 'frei'].includes(v.kind));
    prevEnd = v.end;
  }
});

test('itemsForDay liefert Feiertag und Ferien neben den eigenen Einträgen', () => {
  const r = itemsForDay([], [], new Date(2026, 11, 25));
  assert.deepEqual(r.holidays, [{ name: '1. Weihnachtstag' }]);
  assert.equal(r.vacations[0].name, 'Weihnachtsferien');
  const plain = itemsForDay([], [], new Date(2026, 10, 25));
  assert.deepEqual(plain.holidays, []);
  assert.deepEqual(plain.vacations, []);
});
