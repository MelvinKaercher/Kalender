import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yToMinutes, durationOf, movedStart, columnFromX, moveChanges, isMove, SNAP } from '../js/drag-math.js';

const ev = { id: 'e', title: 'T', date: '2026-11-25', allDay: false, start: '14:00', end: '15:30' };

test('yToMinutes: 52 px pro Stunde', () => {
  assert.equal(yToMinutes(0, 52), 0);
  assert.equal(yToMinutes(52, 52), 60);
  assert.equal(yToMinutes(26, 52), 30);
});

test('durationOf: Differenz, sonst 60 Minuten', () => {
  assert.equal(durationOf(ev), 90);
  assert.equal(durationOf({ ...ev, end: '14:00' }), 60); // ungültig
  assert.equal(durationOf({ ...ev, end: '13:00' }), 60);
  assert.equal(durationOf({ ...ev, end: null }), 60);
});

test('movedStart rastet auf 15 Minuten ein', () => {
  const base = { grabOffsetMin: 0, duration: 60 };
  assert.equal(SNAP, 15);
  assert.equal(movedStart({ ...base, pointerMin: 600 }), 600);
  assert.equal(movedStart({ ...base, pointerMin: 607 }), 600); // 10:07 -> 10:00
  assert.equal(movedStart({ ...base, pointerMin: 608 }), 615); // 10:08 -> 10:15
  assert.equal(movedStart({ ...base, pointerMin: 622 }), 615);
  assert.equal(movedStart({ ...base, pointerMin: 623 }), 630);
});

test('movedStart berücksichtigt, wo der Termin gegriffen wurde', () => {
  // Termin 10:00, Finger greift 30 Minuten unterhalb der Oberkante, Finger jetzt bei 12:30 -> Beginn 12:00
  assert.equal(movedStart({ pointerMin: 12 * 60 + 30, grabOffsetMin: 30, duration: 60 }), 12 * 60);
});

test('movedStart: nicht vor 00:00 und nicht über 23:59 hinaus (Dauer bleibt)', () => {
  assert.equal(movedStart({ pointerMin: -50, grabOffsetMin: 0, duration: 60 }), 0);
  assert.equal(movedStart({ pointerMin: 5, grabOffsetMin: 20, duration: 60 }), 0);
  // 60 Minuten Dauer: spätester Beginn 22:45 (Ende 23:45), denn 23:00 würde 00:00 treffen
  assert.equal(movedStart({ pointerMin: 24 * 60, grabOffsetMin: 0, duration: 60 }), 22 * 60 + 45);
  assert.equal(movedStart({ pointerMin: 1200, grabOffsetMin: 0, duration: 30 }), 1200); // 20:00 geht
  assert.equal(movedStart({ pointerMin: 99999, grabOffsetMin: 0, duration: 15 }), 23 * 60 + 30); // Ende 23:45
  // sehr langer Termin
  assert.equal(movedStart({ pointerMin: 500, grabOffsetMin: 0, duration: 23 * 60 + 59 }), 0);
});

test('columnFromX wählt die Spalte unter dem Finger, außerhalb die Randspalte', () => {
  const rects = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ left: 40 + i * 50, right: 90 + i * 50 }));
  assert.equal(columnFromX(41, rects), 0);
  assert.equal(columnFromX(89.9, rects), 0);
  assert.equal(columnFromX(90, rects), 1);
  assert.equal(columnFromX(200, rects), 3);
  assert.equal(columnFromX(389, rects), 6);
  assert.equal(columnFromX(5, rects), 0); // links neben dem Raster
  assert.equal(columnFromX(900, rects), 6); // rechts davon
});

test('moveChanges: neuer Tag und Beginn, Dauer bleibt erhalten', () => {
  assert.deepEqual(moveChanges(ev, { date: '2026-11-27', startMin: 9 * 60 + 15 }), { date: '2026-11-27', start: '09:15', end: '10:45' });
  assert.deepEqual(moveChanges(ev, { date: '2026-11-25', startMin: 22 * 60 + 15 }), { date: '2026-11-25', start: '22:15', end: '23:45' });
});

test('isMove erkennt, ob sich etwas geändert hat', () => {
  assert.equal(isMove(ev, { date: '2026-11-25', start: '14:00', end: '15:30' }), false);
  assert.equal(isMove(ev, { date: '2026-11-26', start: '14:00', end: '15:30' }), true);
  assert.equal(isMove(ev, { date: '2026-11-25', start: '14:15', end: '15:45' }), true);
});
