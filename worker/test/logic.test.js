import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueNotifications, zonedNow, pruneSent, isValidTimeZone, isTime, DEFAULT_TIMES } from '../src/logic.js';

const anna = { id: 'anna', name: 'Anna', day: 25, month: 11, year: 1990 };
const BERLIN = 'Europe/Berlin';
const due = (iso, over = {}) => dueNotifications({ birthdays: [anna], now: new Date(iso), tz: BERLIN, ...over });

test('zonedNow rechnet UTC in die Ortszeit um (Winter: +1, Sommer: +2)', () => {
  assert.deepEqual(zonedNow(new Date('2026-11-24T23:00:00Z'), BERLIN), { year: 2026, key: '2026-11-25', minutes: 0 });
  assert.deepEqual(zonedNow(new Date('2026-07-01T22:30:00Z'), BERLIN), { year: 2026, key: '2026-07-02', minutes: 30 });
  assert.equal(zonedNow(new Date('2026-12-31T23:30:00Z'), BERLIN).key, '2027-01-01'); // Jahreswechsel
  assert.equal(zonedNow(new Date('2026-11-25T03:00:00Z'), 'America/New_York').key, '2026-11-24');
});

test('Geburtstag selbst: ab 00:00 Ortszeit fällig, nicht eine Minute vorher', () => {
  assert.equal(due('2026-11-24T22:59:00Z').filter((n) => n.stage === 'today').length, 0); // 23:59 am 24.
  const n = due('2026-11-24T23:00:00Z');
  assert.equal(n.length, 1);
  assert.equal(n[0].stage, 'today');
  assert.equal(n[0].id, 'anna:2026:today');
  assert.equal(n[0].title, 'Anna hat heute Geburtstag');
  assert.equal(n[0].body, 'wird 36');
});

test('Vorab-Stufen kommen um 09:00 Ortszeit', () => {
  // 1 Tag vorher = 24.11.
  assert.equal(due('2026-11-24T07:59:00Z').length, 0); // 08:59 Berlin
  const n = due('2026-11-24T08:00:00Z'); // 09:00 Berlin
  assert.equal(n.length, 1);
  assert.equal(n[0].stage, 'day');
  assert.equal(n[0].title, 'Anna hat morgen Geburtstag');
  assert.equal(n[0].body, 'am 25. November · wird 36');
  // 1 Woche vorher = 18.11., 1 Monat vorher = 25.10.
  assert.equal(due('2026-11-18T08:00:00Z')[0].stage, 'week');
  assert.equal(due('2026-10-25T09:00:00Z')[0].stage, 'month'); // 25.10. ist Sommerzeit-Ende: 10:00 Berlin
});

test('Zeiten sind einstellbar', () => {
  const times = { advance: '18:30', today: '07:00' };
  assert.equal(due('2026-11-24T17:29:00Z', { times }).length, 0);
  assert.equal(due('2026-11-24T17:30:00Z', { times })[0].stage, 'day');
  assert.equal(due('2026-11-24T23:00:00Z', { times }).filter((n) => n.stage === 'today').length, 0);
  assert.equal(due('2026-11-25T06:00:00Z', { times })[0].stage, 'today');
});

test('keine Doppelsendung: gesendete Stufen sind raus', () => {
  const sent = { 'anna:2026:today': '2026-11-24T23:00:00Z' };
  assert.equal(due('2026-11-25T10:00:00Z', { sent }).length, 0);
  assert.equal(due('2026-11-25T10:00:00Z').length, 1); // ohne Markierung: noch fällig (am selben Tag nachholbar)
});

test('Nachholen nur am selben Tag', () => {
  assert.equal(due('2026-11-25T22:00:00Z').length, 1); // 25.11. 23:00 Berlin: noch derselbe Tag
  assert.equal(due('2026-11-25T23:00:00Z').length, 0); // 26.11. 00:00 Berlin: vorbei
});

test('Zeitzone des Handys entscheidet', () => {
  // 25.11. 00:00 in New York = 05:00 UTC
  const ny = dueNotifications({ birthdays: [anna], now: new Date('2026-11-25T05:00:00Z'), tz: 'America/New_York' });
  assert.equal(ny.length, 1);
  assert.equal(ny[0].stage, 'today');
  const utc = dueNotifications({ birthdays: [anna], now: new Date('2026-11-25T05:00:00Z'), tz: 'UTC' });
  assert.equal(utc.length, 1); // in UTC ist 05:00 am 25.11. – ebenfalls fällig (aber nur einmal pro Abo)
});

test('Januar-Geburtstag: Vorab-Stufen liegen im Dezember (nächstes Jahr zählt mit)', () => {
  const jan = { id: 'jan', name: 'Jan', day: 5, month: 1, year: 2000 };
  const n = dueNotifications({ birthdays: [jan], now: new Date('2026-12-05T08:00:00Z'), tz: BERLIN });
  assert.equal(n.length, 1);
  assert.equal(n[0].id, 'jan:2027:month');
  assert.equal(n[0].body, 'am 5. Januar · wird 27');
  // am Jahreswechsel: 1 Tag vorher = 4.1.
  const d = dueNotifications({ birthdays: [jan], now: new Date('2027-01-04T08:00:00Z'), tz: BERLIN });
  assert.equal(d[0].id, 'jan:2027:day');
});

test('29. Februar: Schaltjahr am 29., sonst am 28.', () => {
  const leap = { id: 'leap', name: 'Schalt', day: 29, month: 2, year: 2000 };
  const at = (iso) => dueNotifications({ birthdays: [leap], now: new Date(iso), tz: BERLIN });
  assert.equal(at('2028-02-28T23:00:00Z')[0].stage, 'today'); // 29.2.2028 00:00 Berlin
  assert.equal(at('2027-02-27T23:00:00Z')[0].stage, 'today'); // 28.2.2027 00:00 Berlin
  assert.equal(at('2028-02-27T23:00:00Z').filter((n) => n.stage === 'today').length, 0);
});

test('Monatsende: 1 Monat vor dem 31.3. ist der 28.2.', () => {
  const b = { id: 'b', name: 'B', day: 31, month: 3, year: null };
  const n = dueNotifications({ birthdays: [b], now: new Date('2026-02-28T08:00:00Z'), tz: BERLIN });
  assert.equal(n.length, 1);
  assert.equal(n[0].stage, 'month');
  assert.equal(n[0].body, 'am 31. März'); // ohne Geburtsjahr kein Alter
});

test('Sommerzeit-Umstellung: Wochenstufe am Umstellungstag kommt trotzdem um 09:00', () => {
  // Geburtstag 29.3.2026: 1 Woche vorher = 22.3.; Umstellung auf Sommerzeit ist am 29.3.
  const b = { id: 'dst', name: 'Dst', day: 29, month: 3, year: 1980 };
  const at = (iso) => dueNotifications({ birthdays: [b], now: new Date(iso), tz: BERLIN });
  assert.equal(at('2026-03-22T07:59:00Z').length, 0); // 08:59 (Winter)
  assert.equal(at('2026-03-22T08:00:00Z')[0].stage, 'week');
  // am 29.3. selbst: 00:00 Winterzeit = 28.3. 23:00 UTC
  assert.equal(at('2026-03-28T23:00:00Z').find((n) => n.stage === 'today').id, 'dst:2026:today');
});

test('Geburtsjahr in der Zukunft: nichts', () => {
  const baby = { id: 'k', name: 'K', day: 25, month: 11, year: 2030 };
  assert.deepEqual(dueNotifications({ birthdays: [baby], now: new Date('2026-11-25T10:00:00Z'), tz: BERLIN }), []);
});

test('pruneSent behält aktuelle und letzte Jahre', () => {
  const sent = { 'a:2024:today': 1, 'a:2025:today': 2, 'a:2026:month': 3, 'komisch': 4 };
  assert.deepEqual(Object.keys(pruneSent(sent, 2026)).sort(), ['a:2025:today', 'a:2026:month', 'komisch']);
});

test('Hilfsprüfungen', () => {
  assert.ok(isValidTimeZone('Europe/Berlin'));
  assert.ok(!isValidTimeZone('Mars/Olympus'));
  assert.ok(!isValidTimeZone(''));
  assert.ok(isTime('09:00') && isTime('23:59') && !isTime('24:00') && !isTime('9:00') && !isTime(null));
  assert.deepEqual(DEFAULT_TIMES, { advance: '09:00', today: '00:00' });
});
