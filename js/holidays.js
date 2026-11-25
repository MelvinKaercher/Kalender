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

// Jeder Feiertag hat den vollen Namen und einen Kurznamen für enge Stellen (Monatszelle, Wochenspalte).
// Der Kurzname enthält weiche Trennstellen (\u00ad), an denen lange Wörter umbrechen dürfen.
const SHY = '\u00ad';

// Feste Feiertage: [Monat, Tag, Name, Kurzname]. Nicht in BW: Reformationstag, Mariä Himmelfahrt, Buß- und Bettag.
const FIXED = [
  [1, 1, 'Neujahr', 'Neujahr'],
  [1, 6, 'Heilige Drei Könige', 'Hl. Drei Könige'],
  [5, 1, 'Tag der Arbeit', 'Tag der Arbeit'],
  [10, 3, 'Tag der Deutschen Einheit', 'Tag der Einheit'],
  [11, 1, 'Allerheiligen', `Aller${SHY}heiligen`],
  [12, 25, '1. Weihnachtstag', `1. Weih${SHY}nachtstag`],
  [12, 26, '2. Weihnachtstag', `2. Weih${SHY}nachtstag`],
];

// Bewegliche Feiertage: [Abstand in Tagen zum Ostersonntag, Name, Kurzname].
const MOVABLE = [
  [-2, 'Karfreitag', `Kar${SHY}freitag`],
  [1, 'Ostermontag', `Oster${SHY}montag`],
  [39, 'Christi Himmelfahrt', `Himmel${SHY}fahrt`],
  [50, 'Pfingstmontag', `Pfingst${SHY}montag`],
  [60, 'Fronleichnam', `Fron${SHY}leichnam`],
];

const cache = new Map();

/** Alle Feiertage des Jahres, nach Datum sortiert: [{ date, name, short }] */
export function holidaysOfYear(year) {
  if (cache.has(year)) return cache.get(year);
  const easter = easterSunday(year);
  const list = [
    ...FIXED.map(([m, d, name, short]) => ({ date: new Date(year, m - 1, d), name, short })),
    ...MOVABLE.map(([offset, name, short]) => ({ date: addDays(easter, offset), name, short })),
  ].sort((a, b) => a.date - b.date);
  cache.set(year, list);
  return list;
}

/** Feiertag an diesem Tag oder null. */
export function holidayOn(date) {
  return holidaysOfYear(date.getFullYear()).find((h) => isSameDay(h.date, date)) || null;
}
