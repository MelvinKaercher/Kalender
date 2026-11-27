// Wiederholende Termine: ein Termin mit `repeat` wird einmal gespeichert, die einzelnen Vorkommen werden errechnet.
//   repeat: { freq:'daily'|'weekly'|'monthly'|'yearly', every:number, days?:number[] (weekly, 0=So), until:'YYYY-MM-DD'|null, skip:['YYYY-MM-DD'] }
// Reine Logik, ohne DOM – in Node testbar.
import { daysInMonth } from './calendar.js';

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const parts = (key) => key.split('-').map(Number);
/** Fortlaufende Tageszahl (UTC, ohne Zeitumstellungs-Probleme). */
export const dayNum = (key) => { const [y, m, d] = parts(key); return Date.UTC(y, m - 1, d) / 86400000; };
const weekdayOf = (key) => new Date(dayNum(key) * 86400000).getUTCDay();
const mondayNum = (key) => dayNum(key) - ((weekdayOf(key) + 6) % 7);
export const keyOfDayNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

export const isRecurring = (ev) => !!ev && !!ev.repeat && typeof ev.repeat === 'object' && !!ev.repeat.freq;

/** Findet das Vorkommen eines Termins am Tag `key` statt? (Einzeltermine: nur am eigenen Datum.) */
export function occursOn(ev, key) {
  if (!isRecurring(ev)) return ev.date === key;
  const r = ev.repeat;
  if (key < ev.date) return false;
  if (r.until && key > r.until) return false;
  if (r.skip && r.skip.includes(key)) return false;
  const every = Math.max(1, Number(r.every) || 1);
  const [y1, m1, d1] = parts(ev.date);
  const [y2, m2, d2] = parts(key);
  switch (r.freq) {
    case 'daily':
      return (dayNum(key) - dayNum(ev.date)) % every === 0;
    case 'weekly': {
      const days = r.days && r.days.length ? r.days : [weekdayOf(ev.date)];
      if (!days.includes(weekdayOf(key))) return false;
      return Math.round((mondayNum(key) - mondayNum(ev.date)) / 7) % every === 0;
    }
    case 'monthly':
      return ((y2 - y1) * 12 + (m2 - m1)) % every === 0 && d2 === Math.min(d1, daysInMonth(y2, m2 - 1));
    case 'yearly':
      return (y2 - y1) % every === 0 && m2 === m1 && d2 === Math.min(d1, daysInMonth(y2, m2 - 1));
    default:
      return false;
  }
}

/** Kopie des Termins für ein Vorkommen: `date` = Tag des Vorkommens, `seriesDate` = Startdatum der Serie, `occKey` = Tag. */
export const withOccurrence = (ev, key) => ({ ...ev, date: key, seriesDate: ev.date, occKey: key });

/** Alle Vorkommen eines Termins zwischen zwei Tagen (einschließlich). */
export function occurrences(ev, fromKey, toKey) {
  if (!isRecurring(ev)) return ev.date >= fromKey && ev.date <= toKey ? [ev.date] : [];
  const out = [];
  const start = Math.max(dayNum(fromKey), dayNum(ev.date));
  const end = Math.min(dayNum(toKey), ev.repeat.until ? dayNum(ev.repeat.until) : Infinity);
  for (let n = start; n <= end && n - start < 800; n++) {
    const key = keyOfDayNum(n);
    if (occursOn(ev, key)) out.push(key);
  }
  return out;
}

/** Terminliste, in der Serien durch ihre Vorkommen im Zeitraum ersetzt sind (für Erinnerungen, Export). */
export function expandEvents(events, fromKey, toKey) {
  const out = [];
  for (const ev of events) {
    if (!isRecurring(ev)) { out.push(ev); continue; }
    for (const key of occurrences(ev, fromKey, toKey)) out.push(withOccurrence(ev, key));
  }
  return out;
}

const fmtShort = (key) => { const [y, m, d] = parts(key); return `${d}.${m}.${y}`; };

/** "jede Woche", "jede Woche (Mo, Mi, Fr)", "alle 2 Wochen", "jeden Monat", … */
export function describeRepeat(ev) {
  if (!isRecurring(ev)) return '';
  const r = ev.repeat;
  const every = Math.max(1, Number(r.every) || 1);
  let text;
  if (r.freq === 'daily') text = every === 1 ? 'täglich' : `alle ${every} Tage`;
  else if (r.freq === 'weekly') {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = r.days && r.days.length ? order.filter((d) => r.days.includes(d)) : [];
    const list = days.length > 1 ? ` (${days.map((d) => DAY_NAMES[d]).join(', ')})` : '';
    text = (every === 1 ? 'jede Woche' : `alle ${every} Wochen`) + list;
  } else if (r.freq === 'monthly') text = every === 1 ? 'jeden Monat' : `alle ${every} Monate`;
  else text = every === 1 ? 'jedes Jahr' : `alle ${every} Jahre`;
  return r.until ? `${text} bis ${fmtShort(r.until)}` : text;
}
