// Rechenlogik für das Verschieben von Terminen in der Wochenansicht. Rein, ohne DOM.
import { toMinutes, fromMinutes } from './calendar.js';

export const SNAP = 15; // Minuten
export const DAY_END = 23 * 60 + 59; // ein Termin endet spätestens um 23:59 (Termine gehen nicht über Mitternacht)

/** Pixel von der Oberkante des Zeitrasters → Minuten seit Mitternacht. */
export const yToMinutes = (y, hourPx) => (y / hourPx) * 60;

/** Dauer in Minuten (ungültige oder fehlende Endzeit: 60). */
export function durationOf(ev) {
  const d = ev.end ? toMinutes(ev.end) - toMinutes(ev.start) : 0;
  return d > 0 ? d : 60;
}

/**
 * Neuer Beginn nach dem Ziehen: Fingerposition minus der Stelle, an der der Termin gegriffen wurde,
 * auf `step` Minuten eingerastet und so begrenzt, dass der Termin am selben Tag bleibt.
 */
export function movedStart({ pointerMin, grabOffsetMin, duration, step = SNAP }) {
  const max = Math.max(0, DAY_END - duration);
  const snapped = Math.round((pointerMin - grabOffsetMin) / step) * step;
  if (snapped <= 0) return 0;
  if (snapped > max) return Math.floor(max / step) * step;
  return snapped;
}

/** Index der Spalte unter x; außerhalb liegende Werte gehen an die nächste Randspalte. */
export function columnFromX(x, rects) {
  const i = rects.findIndex((r) => x >= r.left && x < r.right);
  if (i !== -1) return i;
  return x < rects[0].left ? 0 : rects.length - 1;
}

/** Änderungen am Termin für den neuen Tag und Beginn (Dauer bleibt erhalten). */
export function moveChanges(ev, { date, startMin }) {
  const end = startMin + durationOf(ev);
  return { date, start: fromMinutes(startMin), end: fromMinutes(end) };
}

/** Hat sich etwas geändert? */
export const isMove = (ev, changes) => changes.date !== ev.date || changes.start !== ev.start;
