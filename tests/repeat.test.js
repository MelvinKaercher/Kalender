import test from 'node:test';
import assert from 'node:assert/strict';
import { occursOn, occurrences, expandEvents, describeRepeat, withOccurrence } from '../js/repeat.js';
import { itemsForDay } from '../js/items.js';
import { remindersForPush } from '../js/reminders.js';
import { parseVoice } from '../js/voice-parse.js';

const work = (over = {}) => ({ id: 'w', title: 'Arbeit', date: '2026-11-23', start: '08:00', end: '16:00', allDay: false, remind: 30, repeat: { freq: 'weekly', every: 1, days: [1, 2, 3, 4, 5], until: null, skip: [] }, ...over });

test('wöchentlich Mo–Fr, nie vor dem Start, skip und until', () => {
  const ev = work({ repeat: { freq: 'weekly', every: 1, days: [1, 2, 3, 4, 5], until: '2026-12-04', skip: ['2026-11-25'] } });
  assert.equal(occursOn(ev, '2026-11-22'), false); // vor Start
  assert.equal(occursOn(ev, '2026-11-24'), true);
  assert.equal(occursOn(ev, '2026-11-25'), false); // übersprungen
  assert.equal(occursOn(ev, '2026-11-28'), false); // Samstag
  assert.equal(occursOn(ev, '2026-12-04'), true);
  assert.equal(occursOn(ev, '2026-12-07'), false); // nach until
  assert.equal(occurrences(ev, '2026-11-23', '2026-11-30').length, 5);
});
test('alle 2 Wochen, täglich, monatlich (31.), jährlich (29.2.)', () => {
  const biweekly = work({ date: '2026-11-23', repeat: { freq: 'weekly', every: 2, days: [1] } });
  assert.deepEqual(occurrences(biweekly, '2026-11-23', '2026-12-31'), ['2026-11-23', '2026-12-07', '2026-12-21']);
  assert.equal(occurrences(work({ repeat: { freq: 'daily', every: 3 } }), '2026-11-23', '2026-11-30').length, 3);
  const monthly = work({ date: '2026-01-31', repeat: { freq: 'monthly', every: 1 } });
  assert.deepEqual(occurrences(monthly, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
  const yearly = work({ date: '2024-02-29', repeat: { freq: 'yearly', every: 1 } });
  assert.equal(occursOn(yearly, '2025-02-28'), true);
  assert.equal(occursOn(yearly, '2028-02-29'), true);
});
test('Zeitumstellung: Ende Oktober bleibt jede Woche stabil', () => {
  const ev = work({ date: '2026-10-19', repeat: { freq: 'weekly', every: 1, days: [1] } });
  assert.deepEqual(occurrences(ev, '2026-10-19', '2026-11-09'), ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
});
test('itemsForDay zeigt Vorkommen als Kopie mit occKey', () => {
  const r = itemsForDay([work()], [], new Date(2026, 10, 25)).events;
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].date, r[0].occKey, r[0].seriesDate], ['2026-11-25', '2026-11-25', '2026-11-23']);
  assert.equal(itemsForDay([work()], [], new Date(2026, 10, 28)).events.length, 0);
  assert.equal(withOccurrence(work(), '2026-12-01').occKey, '2026-12-01');
});
test('Erinnerungen: Serie wird zu Vorkommen (eigene Datumsangabe je Vorkommen)', () => {
  const now = new Date(2026, 10, 26, 10, 0);
  const list = remindersForPush([work()], now);
  assert.ok(list.length > 10 && list.length <= 200);
  assert.deepEqual(list.slice(0, 2).map((r) => r.date), ['2026-11-26', '2026-11-27']);
  assert.equal(expandEvents([work()], '2026-11-23', '2026-11-27').length, 5);
});
test('describeRepeat und Sprach-Erkennung', () => {
  assert.equal(describeRepeat(work()), 'jede Woche (Mo, Di, Mi, Do, Fr)');
  assert.equal(describeRepeat(work({ repeat: { freq: 'weekly', every: 2, until: '2027-01-31' } })), 'alle 2 Wochen bis 31.1.2027');
  const now = new Date(2026, 10, 26, 10, 0);
  const a = parseVoice('Arbeit jeden Montag um 8 Uhr', now);
  assert.deepEqual([a.title, a.date, a.start, a.repeat.freq, a.repeat.days], ['Arbeit', '2026-11-30', '08:00', 'weekly', [1]]);
  assert.equal(parseVoice('Training jede Woche heute um 18 Uhr', now).repeat.freq, 'weekly');
  assert.equal(parseVoice('Medikament täglich um 9 Uhr', now).repeat.freq, 'daily');
  assert.equal(parseVoice('Zahnarzt morgen um 9 Uhr', now).repeat, undefined);
});
