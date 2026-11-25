// Gesetzliche Feiertage in Baden-Württemberg. Reine Logik, ohne DOM.
// Bewegliche Feiertage werden aus dem Ostersonntag berechnet, gelten also für jedes Jahr.
import { addDays, isSameDay } from './calendar.js';

/** Ostersonntag (Gregorianischer Kalender, Verfahren nach Meeus/Jones/Butcher). */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feste Feiertage: [Monat, Tag, Name]. Nicht in BW: Reformationstag, Mariä Himmelfahrt, Buß- und Bettag.
const FIXED = [
  [1, 1, 'Neujahr'],
  [1, 6, 'Heilige Drei Könige'],
  [5, 1, 'Tag der Arbeit'],
  [10, 3, 'Tag der Deutschen Einheit'],
  [11, 1, 'Allerheiligen'],
  [12, 25, '1. Weihnachtstag'],
  [12, 26, '2. Weihnachtstag'],
];

// Bewegliche Feiertage: Abstand in Tagen zum Ostersonntag.
const MOVABLE = [
  [-2, 'Karfreitag'],
  [1, 'Ostermontag'],
  [39, 'Christi Himmelfahrt'],
  [50, 'Pfingstmontag'],
  [60, 'Fronleichnam'],
];

const cache = new Map();

/** Alle Feiertage des Jahres, nach Datum sortiert: [{ date, name }] */
export function holidaysOfYear(year) {
  if (cache.has(year)) return cache.get(year);
  const easter = easterSunday(year);
  const list = [
    ...FIXED.map(([m, d, name]) => ({ date: new Date(year, m - 1, d), name })),
    ...MOVABLE.map(([offset, name]) => ({ date: addDays(easter, offset), name })),
  ].sort((a, b) => a.date - b.date);
  cache.set(year, list);
  return list;
}

/** Feiertag an diesem Tag oder null. */
export function holidayOn(date) {
  return holidaysOfYear(date.getFullYear()).find((h) => isSameDay(h.date, date)) || null;
}
