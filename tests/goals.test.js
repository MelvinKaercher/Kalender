import test from 'node:test';
import assert from 'node:assert/strict';
import { streak, weekMarks, describeRemind, goalsForPush, isScheduled } from '../js/goals.js';
import { mergeSnapshots, emptySnapshot, canon } from '../js/sync-core.js';

const TODAY = new Date(2026, 10, 27); // Fr 27.11.2026
const g = (over = {}) => ({ id: 'e', title: 'Englisch', note: '', remind: null, checks: [], done: false, ...over });

test('Serie: täglich, heute offen bricht nicht, Lücke bricht', () => {
  assert.equal(streak(g({ checks: ['2026-11-26', '2026-11-25', '2026-11-24'] }), TODAY), 3);
  assert.equal(streak(g({ checks: ['2026-11-27', '2026-11-26'] }), TODAY), 2);
  assert.equal(streak(g({ checks: ['2026-11-27', '2026-11-25'] }), TODAY), 1);
  assert.equal(streak(g(), TODAY), 0);
});
test('Serie: nicht geplante Tage werden übersprungen (Mo/Mi/Fr)', () => {
  const goal = g({ remind: { time: '19:00', days: [1, 3, 5] }, checks: ['2026-11-27', '2026-11-25', '2026-11-23', '2026-11-20'] });
  assert.equal(streak(goal, TODAY), 4); // Fr, Mi, Mo, Fr davor
  assert.equal(isScheduled(goal, new Date(2026, 10, 28)), false);
});
test('Wochenpunkte und Beschreibung', () => {
  const marks = weekMarks(g({ remind: { time: '19:00', days: [1, 3, 5] }, checks: ['2026-11-25'] }), new Date(2026, 10, 23));
  assert.deepEqual(marks.map((m) => [m.scheduled, m.checked]), [[true, false], [false, false], [true, true], [false, false], [true, false], [false, false], [false, false]]);
  assert.equal(describeRemind({ time: '19:00', days: [0, 1, 2, 3, 4, 5, 6] }), 'täglich 19:00');
  assert.equal(describeRemind({ time: '07:30', days: [5, 1, 3] }), 'Mo, Mi, Fr 07:30');
});
test('Push-Aufbereitung: nur aktive mit Erinnerung, gekürzt', () => {
  const list = goalsForPush([
    g({ id: 'a', remind: { time: '19:00', days: [1] }, note: 'x'.repeat(300), checks: ['2026-11-27', '2026-01-01'] }),
    g({ id: 'b' }), g({ id: 'c', remind: { time: '19:00', days: [1] }, done: true }),
  ], TODAY);
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].id, list[0].note.length, list[0].checks], ['a', 200, ['2026-11-27']]);
});
test('Abgleich: Vorsätze werden zusammengeführt und Löschungen respektiert', () => {
  const a = { ...emptySnapshot(), goals: [{ id: '1', title: 'A', updatedAt: 5 }, { id: '2', title: 'B', updatedAt: 5 }] };
  const b = { ...emptySnapshot(), goals: [{ id: '1', title: 'A neu', updatedAt: 9 }], tombs: { events: {}, birthdays: {}, goals: { 2: 8 } } };
  const m = mergeSnapshots(a, b, 10);
  assert.deepEqual(m.goals.map((x) => [x.id, x.title]), [['1', 'A neu']]);
  assert.equal(canon({ events: [], birthdays: [] }), canon(emptySnapshot())); // alter Datenstand ohne goals bleibt gültig
});
