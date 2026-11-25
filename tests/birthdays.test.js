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

/* ───────── Benachrichtigungsstufen (1 Monat, 1 Woche, 1 Tag vorher, am Tag) ───────── */
import { STAGES, minusMonthClamped, reminderDates, stageText, currentStage } from '../js/birthdays.js';

const keyOf = (r) => `${r.stage}:${toKey(r.date)}`;

test('minusMonthClamped: gleicher Tag im Vormonat, bei Monatsende gekürzt', () => {
  assert.equal(toKey(minusMonthClamped(new Date(2026, 10, 27))), '2026-10-27');
  assert.equal(toKey(minusMonthClamped(new Date(2026, 2, 31))), '2026-02-28'); // 31.3. -> 28.2.
  assert.equal(toKey(minusMonthClamped(new Date(2028, 2, 31))), '2028-02-29'); // Schaltjahr
  assert.equal(toKey(minusMonthClamped(new Date(2026, 4, 31))), '2026-04-30'); // 31.5. -> 30.4.
  assert.equal(toKey(minusMonthClamped(new Date(2027, 0, 5))), '2026-12-05'); // Jahreswechsel
});

test('reminderDates: vier Stufen in fester Reihenfolge', () => {
  assert.deepEqual(STAGES, ['month', 'week', 'day', 'today']);
  const r = reminderDates(anna, 2026); // 12.3.
  assert.deepEqual(r.map(keyOf), ['month:2026-02-12', 'week:2026-03-05', 'day:2026-03-11', 'today:2026-03-12']);
});

test('reminderDates: Geburtstag im Januar -> Vorab-Stufen im Dezember des Vorjahres', () => {
  const jan = { id: 'j', name: 'Jan', day: 5, month: 1, year: null };
  assert.deepEqual(reminderDates(jan, 2027).map(keyOf), ['month:2026-12-05', 'week:2026-12-29', 'day:2027-01-04', 'today:2027-01-05']);
});

test('reminderDates: 29.2. folgt der Schaltjahr-Regel, Vorab-Stufen auch', () => {
  const leap = { id: 'l', name: 'Schalt', day: 29, month: 2, year: 2000 };
  assert.deepEqual(reminderDates(leap, 2028).map(keyOf), ['month:2028-01-29', 'week:2028-02-22', 'day:2028-02-28', 'today:2028-02-29']);
  assert.deepEqual(reminderDates(leap, 2027).map(keyOf), ['month:2027-01-28', 'week:2027-02-21', 'day:2027-02-27', 'today:2027-02-28']);
});

test('stageText: deutsche Texte je Stufe, Alter nur wenn bekannt', () => {
  const d = new Date(2026, 10, 27);
  assert.deepEqual(stageText('month', anna, 36, d), { title: 'Anna hat in 1 Monat Geburtstag', body: 'am 27. November · wird 36' });
  assert.equal(stageText('week', anna, 36, d).title, 'Anna hat in 1 Woche Geburtstag');
  assert.equal(stageText('day', anna, 36, d).title, 'Anna hat morgen Geburtstag');
  assert.deepEqual(stageText('today', anna, 36, d), { title: 'Anna hat heute Geburtstag', body: 'wird 36' });
  assert.equal(stageText('month', anna, null, d).body, 'am 27. November');
  assert.equal(stageText('today', anna, null, d).body, 'Alles Gute!');
});

test('stageText mit daysLeft: echte Restzeit statt Stufen-Text', () => {
  const d = new Date(2026, 10, 27);
  assert.equal(stageText('week', anna, 36, d, 5).title, 'Anna hat in 5 Tagen Geburtstag');
  assert.equal(stageText('week', anna, 36, d, 1).title, 'Anna hat morgen Geburtstag');
  assert.equal(stageText('day', anna, 36, d, 0).title, 'Anna hat heute Geburtstag');
  assert.equal(stageText('week', anna, 36, d, 5).body, 'am 27. November · wird 36');
});

test('currentStage: jüngste Stufe, deren Datum erreicht ist', () => {
  const b = { id: 'a', name: 'Anna', day: 25, month: 11, year: 1990 }; // 25.11.
  const at = (y, m, d) => currentStage(b, new Date(y, m - 1, d, 12));
  assert.equal(at(2026, 10, 24), null);
  assert.deepEqual(pick(at(2026, 10, 25)), { stage: 'month', year: 2026, age: 36 });
  assert.equal(at(2026, 11, 10).stage, 'month'); // dazwischen bleibt die letzte Stufe
  assert.equal(at(2026, 11, 18).stage, 'week');
  assert.equal(at(2026, 11, 24).stage, 'day');
  assert.equal(at(2026, 11, 25).stage, 'today');
  assert.equal(at(2026, 11, 26), null); // vorbei
});

test('currentStage: Geburtstag im Januar wird schon im Dezember erkannt (Jahr = Geburtstagsjahr)', () => {
  const jan = { id: 'j', name: 'Jan', day: 5, month: 1, year: 2000 };
  assert.deepEqual(pick(currentStage(jan, new Date(2026, 11, 6, 8))), { stage: 'month', year: 2027, age: 27 });
});

test('currentStage: Person noch nicht geboren -> keine Stufe', () => {
  const baby = { id: 'k', name: 'Kind', day: 25, month: 11, year: 2030 };
  assert.equal(currentStage(baby, new Date(2026, 10, 25, 12)), null);
});

function pick(r) { return r && { stage: r.stage, year: r.year, age: r.age }; }

/* ───────── Ereignis-Typen: Geburtstag, Jahrestag, Sonstiges ───────── */
import { EVENT_TYPES, typeOf, typeInfo, countText } from '../js/birthdays.js';

test('Typen: Einträge ohne type (alte Daten) gelten als Geburtstag', () => {
  assert.equal(typeOf({ name: 'A', day: 1, month: 1 }), 'birthday');
  assert.equal(typeOf({ type: 'kaputt' }), 'birthday');
  assert.equal(typeOf({ type: 'anniversary' }), 'anniversary');
  assert.deepEqual(Object.keys(EVENT_TYPES), ['birthday', 'anniversary', 'other']);
  assert.equal(typeInfo({ type: 'anniversary' }).label, 'Jahrestag');
  assert.equal(typeInfo({}).emoji, '🎂');
});

test('countText je Typ', () => {
  assert.equal(countText({ type: 'birthday' }, 36), 'wird 36');
  assert.equal(countText({}, 36), 'wird 36');
  assert.equal(countText({ type: 'anniversary' }, 8), '8. Jahrestag');
  assert.equal(countText({ type: 'other' }, 1), 'seit 1 Jahr');
  assert.equal(countText({ type: 'other' }, 6), 'seit 6 Jahren');
  assert.equal(countText({ type: 'anniversary' }, null), null);
  assert.equal(countText({ type: 'anniversary' }, 0), null);
});

test('Jahrestag und Sonstiges wiederholen sich jedes Jahr wie Geburtstage', () => {
  const hz = { id: 'h', name: 'Hochzeitstag', day: 27, month: 11, year: 2018, type: 'anniversary' };
  for (const y of [2026, 2027, 2040]) assert.equal(birthdaysOn([hz], new Date(y, 10, 27)).length, 1, String(y));
  assert.equal(birthdaysOn([hz], new Date(2026, 10, 27))[0].age, 8);
  assert.equal(birthdaysOn([hz], new Date(2017, 10, 27)).length, 0, 'vor dem Startjahr nichts');
  const sonst = { id: 's', name: 'Namenstag', day: 19, month: 3, type: 'other' };
  assert.equal(birthdaysOn([sonst], new Date(2031, 2, 19)).length, 1);
  assert.equal(birthdaysOn([sonst], new Date(2031, 2, 19))[0].age, null);
});

test('stageText Jahrestag: Titel ohne "hat Geburtstag", Zähltext im Body', () => {
  const hz = { id: 'h', name: 'Hochzeitstag', day: 27, month: 11, year: 2018, type: 'anniversary' };
  const d = new Date(2026, 10, 27);
  assert.deepEqual(stageText('month', hz, 8, d), { title: 'Hochzeitstag in 1 Monat', body: 'am 27. November · 8. Jahrestag' });
  assert.equal(stageText('week', hz, 8, d).title, 'Hochzeitstag in 1 Woche');
  assert.equal(stageText('day', hz, 8, d).title, 'Hochzeitstag morgen');
  assert.deepEqual(stageText('today', hz, 8, d), { title: 'Hochzeitstag heute', body: '8. Jahrestag' });
  assert.equal(stageText('today', hz, null, d).body, 'Alles Gute!');
  assert.equal(stageText('month', hz, null, d).body, 'am 27. November');
  assert.equal(stageText('week', hz, 8, d, 5).title, 'Hochzeitstag in 5 Tagen'); // verspätet: echte Restzeit
});

test('stageText Sonstiges', () => {
  const e = { id: 'e', name: 'Einschulung', day: 1, month: 9, year: 2020, type: 'other' };
  const d = new Date(2026, 8, 1);
  assert.equal(stageText('today', e, 6, d).body, 'seit 6 Jahren');
  assert.equal(stageText('today', { ...e, year: null }, null, d).body, 'am 1. September'); // ohne Jahr: Datum statt "Alles Gute"
  assert.equal(stageText('day', e, 6, d).title, 'Einschulung morgen');
});

test('stageText Geburtstag bleibt unverändert', () => {
  assert.equal(stageText('today', { name: 'Anna' }, 36, new Date(2026, 10, 25)).title, 'Anna hat heute Geburtstag');
});
