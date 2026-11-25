import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthdaysOn, nextOccurrence, sortByNext, dateInYear, ageIn } from '../js/birthdays.js';
import { toKey } from '../js/calendar.js';

const anna = { id: '1', name: 'Anna', day: 12, month: 3, year: 1990 };

test('Geburtstag erscheint in jedem Folgejahr – aus einem einzigen Eintrag', () => {
  for (const year of [1990, 2026, 2027, 2040, 2100]) {
    const hits = birthdaysOn([anna], new Date(year, 2, 12));
    assert.equal(hits.length, 1, `Jahr ${year}`);
  }
  assert.equal(birthdaysOn([anna], new Date(2027, 2, 13)).length, 0);
});

test('Alter wird pro Jahr berechnet', () => {
  assert.equal(birthdaysOn([anna], new Date(2026, 2, 12))[0].age, 36);
  assert.equal(birthdaysOn([anna], new Date(2027, 2, 12))[0].age, 37);
});

test('Ohne Geburtsjahr: Geburtstag da, aber kein Alter', () => {
  const b = { id: '2', name: 'Ben', day: 1, month: 1, year: null };
  const hit = birthdaysOn([b], new Date(2031, 0, 1));
  assert.equal(hit.length, 1);
  assert.equal(hit[0].age, null);
});

test('Vor dem Geburtsjahr gibt es keinen Geburtstag', () => {
  assert.equal(birthdaysOn([anna], new Date(1985, 2, 12)).length, 0);
  assert.equal(ageIn(anna, 1990), null); // Geburtsjahr selbst: kein "wird 0"
});

test('29. Februar: im Schaltjahr am 29., sonst am 28.', () => {
  const leap = { id: '3', name: 'Schalt', day: 29, month: 2, year: 2000 };
  assert.equal(toKey(dateInYear(leap, 2028)), '2028-02-29');
  assert.equal(toKey(dateInYear(leap, 2027)), '2027-02-28');
  assert.equal(birthdaysOn([leap], new Date(2027, 1, 28)).length, 1);
  assert.equal(birthdaysOn([leap], new Date(2028, 1, 28)).length, 0);
  assert.equal(birthdaysOn([leap], new Date(2028, 1, 29)).length, 1);
});

test('nextOccurrence: heute zählt mit, danach nächstes Jahr', () => {
  const today = nextOccurrence(anna, new Date(2026, 2, 12, 15, 30));
  assert.equal(today.days, 0);
  assert.equal(today.age, 36);
  const after = nextOccurrence(anna, new Date(2026, 2, 13));
  assert.equal(toKey(after.date), '2027-03-12');
  assert.equal(after.age, 37);
});

test('sortByNext sortiert nach dem nächsten Auftreten, nicht nach Kalenderjahr', () => {
  const list = [
    { id: 'a', name: 'Januar', day: 5, month: 1, year: null },
    { id: 'b', name: 'Dezember', day: 5, month: 12, year: null },
    { id: 'c', name: 'November', day: 30, month: 11, year: null },
  ];
  const sorted = sortByNext(list, new Date(2026, 10, 25)).map((x) => x.birthday.name);
  assert.deepEqual(sorted, ['November', 'Dezember', 'Januar']);
});
