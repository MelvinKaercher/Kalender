// Jährliche Ereignisse (Geburtstage, Jahrestage, Sonstiges): werden EINMAL gespeichert
// ({ id, name, day, month, year|null, type }) und für jedes Jahr neu berechnet – es werden keine Kopien angelegt.
// Der Name "birthdays" ist historisch: Die Datei kennt alle Typen, Einträge ohne `type` gelten als Geburtstag.
import { isLeapYear, isSameDay, startOfDay, addDays, daysInMonth } from './calendar.js';

/** Typen jährlicher Ereignisse. */
export const EVENT_TYPES = {
  birthday: { label: 'Geburtstag', emoji: '🎂' },
  anniversary: { label: 'Jahrestag', emoji: '💍' },
  other: { label: 'Sonstiges', emoji: '📌' },
};
export const typeOf = (b) => (EVENT_TYPES[b.type] ? b.type : 'birthday');
export const typeInfo = (b) => EVENT_TYPES[typeOf(b)];

/** Zähltext zum Jahr: "wird 36", "8. Jahrestag", "seit 6 Jahren" (null ohne Jahr). */
export function countText(b, n) {
  if (!n) return null;
  const type = typeOf(b);
  if (type === 'birthday') return `wird ${n}`;
  if (type === 'anniversary') return `${n}. Jahrestag`;
  return `seit ${n} ${n === 1 ? 'Jahr' : 'Jahren'}`;
}

/** Datum des Ereignisses im Jahr `year`. 29.2. wird in Nicht-Schaltjahren zum 28.2. */
export function dateInYear(b, year) {
  const day = b.month === 2 && b.day === 29 && !isLeapYear(year) ? 28 : b.day;
  return new Date(year, b.month - 1, day);
}

/** Alter bzw. Anzahl Jahre im Jahr `year` (null, wenn kein Jahr bekannt oder es noch nicht losging). */
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

/* ───────── Benachrichtigungsstufen ─────────
 * Für jeden Geburtstag gibt es vier Stufen: 1 Monat, 1 Woche, 1 Tag vorher und am Tag selbst.
 * Dieselbe Logik nutzen die App (Banner) und der Push-Server (Cloudflare Worker). */

export const STAGES = ['month', 'week', 'day', 'today'];

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Gleicher Tag im Vormonat; gibt es ihn nicht (31.3. → Februar), der letzte Tag des Vormonats. */
export function minusMonthClamped(date) {
  const first = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const day = Math.min(date.getDate(), daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day);
}

/** Die vier Stufen-Daten für den Geburtstag im Jahr `year`. */
export function reminderDates(b, year) {
  const day = dateInYear(b, year);
  return [
    { stage: 'month', date: minusMonthClamped(day) },
    { stage: 'week', date: addDays(day, -7) },
    { stage: 'day', date: addDays(day, -1) },
    { stage: 'today', date: day },
  ];
}

/**
 * Titel und Text der Benachrichtigung (ohne Emoji – die setzt die Oberfläche).
 * `daysLeft` nur angeben, wenn die Meldung verspätet kommt: dann steht die echte Restzeit im Titel.
 */
export function stageText(stage, b, age, eventDate, daysLeft) {
  const exact = { month: 'in 1 Monat', week: 'in 1 Woche', day: 'morgen', today: 'heute' }[stage];
  const when = daysLeft === undefined ? exact : daysLeft <= 0 ? 'heute' : daysLeft === 1 ? 'morgen' : `in ${daysLeft} Tagen`;
  const type = typeOf(b);
  const title = type === 'birthday' ? `${b.name} hat ${when} Geburtstag` : `${b.name} ${when}`;
  const count = countText(b, age);
  const dateText = `am ${eventDate.getDate()}. ${MONTH_NAMES[eventDate.getMonth()]}`;
  if (stage === 'today') return { title, body: count || (type === 'other' ? dateText : 'Alles Gute!') };
  return { title, body: count ? `${dateText} · ${count}` : dateText };
}

/**
 * Welche Stufe gilt für diesen Geburtstag gerade? Die jüngste, deren Datum erreicht ist,
 * solange der Geburtstag noch nicht vorbei ist. Sonst null.
 * `year` ist das Jahr des Geburtstags (bei einem Januar-Geburtstag im Dezember also das nächste Jahr).
 */
export function currentStage(b, now) {
  const today = startOfDay(now);
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    if (b.year && year < b.year) continue;
    const day = dateInYear(b, year);
    if (day < today) continue;
    const reached = reminderDates(b, year).filter((r) => r.date <= today);
    if (!reached.length) continue;
    const last = reached[reached.length - 1];
    return { stage: last.stage, year, date: day, age: ageIn(b, year) };
  }
  return null;
}
