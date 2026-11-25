// Reine Datumslogik. Kein DOM, keine Datenbank – dadurch gut testbar.
// Alle Daten sind lokale Daten (keine UTC-Umrechnung), Wochenstart ist Montag.

export const pad = (n) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' (lokal) */
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' -> Date (lokal, 00:00) */
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const isSameDay = (a, b) => toKey(a) === toKey(b);
export const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

/** Erster Tag des Monats, n Monate von d entfernt. */
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** Montag der Woche, in der d liegt. */
export function startOfWeek(d) {
  const sinceMonday = (d.getDay() + 6) % 7; // Mo=0 … So=6
  return addDays(startOfDay(d), -sinceMonday);
}

/** Die 7 Tage (Mo–So) der Woche von d. */
export function weekDays(d) {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Monatsraster: Array von Wochen (4–6), jede Woche 7 Zellen.
 * Zellen außerhalb des Monats sind mit inMonth=false markiert.
 */
export function monthGrid(year, month0) {
  const first = new Date(year, month0, 1);
  const offset = (first.getDay() + 6) % 7;
  const weekCount = Math.ceil((offset + daysInMonth(year, month0)) / 7);
  const start = addDays(first, -offset);
  return Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, w * 7 + i);
      return { date, key: toKey(date), inMonth: date.getMonth() === month0 };
    })
  );
}

/** ISO-8601-Kalenderwoche (Woche mit dem ersten Donnerstag = KW 1). */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

/** 'HH:MM' -> Minuten seit Mitternacht */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minuten seit Mitternacht -> 'HH:MM' (auf 00:00–23:59 begrenzt) */
export function fromMinutes(min) {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`;
}
