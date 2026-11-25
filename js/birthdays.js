// Geburtstage: werden EINMAL gespeichert ({ id, name, day, month, year|null })
// und für jedes Jahr neu berechnet – es werden keine Kopien angelegt.
import { isLeapYear, isSameDay, startOfDay } from './calendar.js';

/** Datum des Geburtstags im Jahr `year`. 29.2. wird in Nicht-Schaltjahren zum 28.2. */
export function dateInYear(b, year) {
  const day = b.month === 2 && b.day === 29 && !isLeapYear(year) ? 28 : b.day;
  return new Date(year, b.month - 1, day);
}

/** Alter, das die Person im Jahr `year` erreicht (null, wenn kein Geburtsjahr bekannt oder noch nicht geboren). */
export function ageIn(b, year) {
  return b.year && year > b.year ? year - b.year : null;
}

/** Alle Geburtstage, die auf `date` fallen. */
export function birthdaysOn(list, date) {
  const year = date.getFullYear();
  return list
    .filter((b) => (!b.year || year >= b.year) && isSameDay(dateInYear(b, year), date))
    .map((b) => ({ birthday: b, age: ageIn(b, year) }))
    .sort((a, b) => a.birthday.name.localeCompare(b.birthday.name, 'de'));
}

/** Nächster Geburtstag ab `from` (heute zählt mit). */
export function nextOccurrence(b, from) {
  const today = startOfDay(from);
  for (let y = Math.max(today.getFullYear(), b.year || 0); y <= today.getFullYear() + 2; y++) {
    const date = dateInYear(b, y);
    if (date >= today) {
      return { date, age: ageIn(b, y), days: Math.round((date - today) / 86400000) };
    }
  }
  return null;
}

/** Liste sortiert nach dem nächsten Geburtstag. */
export function sortByNext(list, from = new Date()) {
  return list
    .map((b) => ({ birthday: b, ...nextOccurrence(b, from) }))
    .filter((x) => x.date)
    .sort((a, b) => a.days - b.days || a.birthday.name.localeCompare(b.birthday.name, 'de'));
}
