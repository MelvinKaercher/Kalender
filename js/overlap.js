// Überschneidungen: Termine mit Uhrzeit, die sich am selben Tag zeitlich überlappen.
import { toMinutes } from './calendar.js';

const span = (e) => {
  const s = toMinutes(e.start);
  return [s, e.end && toMinutes(e.end) > s ? toMinutes(e.end) : s + 60];
};

/** Termine aus `events`, die sich mit `cand` überschneiden (eigener Termin und Ganztägige zählen nicht). */
export function findOverlaps(events, cand) {
  if (cand.allDay || !cand.start) return [];
  const [cs, ce] = span(cand);
  return events
    .filter((e) => e.id !== cand.id && !e.allDay && e.start && e.date === cand.date)
    .filter((e) => { const [s, en] = span(e); return s < ce && cs < en; })
    .sort((a, b) => a.start.localeCompare(b.start));
}
