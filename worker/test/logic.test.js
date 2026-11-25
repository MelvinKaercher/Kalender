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

/* ───────── Termin-Erinnerungen ───────── */
import { dueReminderNotifications, reminderId } from '../src/logic.js';

const ev = (over = {}) => ({ id: 'e1', title: 'Zahnarzt', date: '2026-11-25', allDay: false, start: '14:00', remind: 15, ...over });
const dueEv = (iso, reminders, sent = {}, tz = BERLIN) => dueReminderNotifications({ reminders, now: new Date(iso), tz, sent });

test('Termin 14:00, 15 Min. vorher: ab 13:45 Ortszeit fällig, nicht davor', () => {
  assert.equal(dueEv('2026-11-25T12:44:00Z', [ev()]).length, 0); // 13:44
  const r = dueEv('2026-11-25T12:45:00Z', [ev()]); // 13:45
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].title, r[0].body], ['Zahnarzt', 'in 15 Min.']);
  assert.equal(r[0].eventId, 'e1');
});

test('verspätet (Cron-Lauf später): Text zeigt die echte Restzeit; bis 5 Min. nach Beginn, danach nicht mehr', () => {
  assert.equal(dueEv('2026-11-25T12:50:00Z', [ev()])[0].body, 'in 10 Min.');
  assert.equal(dueEv('2026-11-25T13:00:00Z', [ev({ remind: 0 })])[0].body, 'Jetzt'); // 14:00 genau
  assert.equal(dueEv('2026-11-25T13:04:00Z', [ev({ remind: 0 })]).length, 1);
  assert.equal(dueEv('2026-11-25T13:05:00Z', [ev({ remind: 0 })]).length, 0);
});

test('1 Tag vorher: am Vortag um 14:00; Text mit Datum und Uhrzeit', () => {
  const r = dueEv('2026-11-24T13:00:00Z', [ev({ remind: 1440 })]); // 24.11. 14:00
  assert.equal(r.length, 1);
  assert.equal(r[0].body, '25.11., 14:00 Uhr');
  assert.equal(dueEv('2026-11-24T12:59:00Z', [ev({ remind: 1440 })]).length, 0);
});

test('ganztägig: ab 9:00 am Tag (Vorlauf 0) bis Tagesende; 1 Tag vorher: Vortag 9:00 → "Morgen"', () => {
  const allDay = ev({ allDay: true, start: null, remind: 0 });
  assert.equal(dueEv('2026-11-25T07:59:00Z', [allDay]).length, 0); // 8:59
  assert.equal(dueEv('2026-11-25T08:00:00Z', [allDay])[0].body, 'Heute');
  assert.equal(dueEv('2026-11-25T22:59:00Z', [allDay]).length, 1); // 23:59
  assert.equal(dueEv('2026-11-25T23:00:00Z', [allDay]).length, 0); // schon 26.11.
  const day = ev({ allDay: true, start: null, remind: 1440 });
  assert.equal(dueEv('2026-11-24T08:00:00Z', [day])[0].body, 'Morgen');
});

test('Zeitzone des Handys zählt (New York ist 6 Std. hinter Berlin)', () => {
  assert.equal(dueEv('2026-11-25T18:45:00Z', [ev()], {}, 'America/New_York').length, 1); // 13:45 New York
  assert.equal(dueEv('2026-11-25T12:45:00Z', [ev()], {}, 'America/New_York').length, 0);
});

test('nur einmal senden; Verschieben/Ändern ergibt eine neue Erinnerung', () => {
  const r = ev();
  const sent = { [reminderId(r)]: 'x' };
  assert.equal(dueEv('2026-11-25T12:50:00Z', [r], sent).length, 0);
  assert.equal(dueEv('2026-11-25T12:50:00Z', [{ ...r, start: '14:05' }], sent).length, 1);
  assert.notEqual(reminderId(r), reminderId({ ...r, remind: 5 }));
});

test('Termin in der Vergangenheit oder weit in der Zukunft: nichts', () => {
  assert.equal(dueEv('2026-11-26T09:00:00Z', [ev()]).length, 0);
  assert.equal(dueEv('2026-11-20T09:00:00Z', [ev()]).length, 0);
});

test('pruneSent: Termin-Erinnerungen nach 14 Tagen weg, Geburtstage unverändert', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  const kept = pruneSent({ 'ev|a|2026-11-01|1400|15': '2026-11-10T00:00:00Z', 'ev|b|2026-11-29|1400|15': '2026-11-29T00:00:00Z', 'x:2026:today': 'v', 'x:2020:today': 'v' }, 2026, now);
  assert.deepEqual(Object.keys(kept).sort(), ['ev|b|2026-11-29|1400|15', 'x:2026:today']);
});
