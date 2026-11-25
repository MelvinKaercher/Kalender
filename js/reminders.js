// Erinnerungen (nur in der App sichtbar): reine Berechnung, was gerade fällig ist.
import { fromKey, toKey, toMinutes, addDays, startOfDay } from './calendar.js';
import { currentStage, reminderDates, stageText } from './birthdays.js';

export const REMIND_OPTIONS = [
  { value: null, label: 'Keine' },
  { value: 0, label: 'Zum Zeitpunkt' },
  { value: 5, label: '5 Min. vorher' },
  { value: 15, label: '15 Min. vorher' },
  { value: 30, label: '30 Min. vorher' },
  { value: 60, label: '1 Std. vorher' },
  { value: 1440, label: '1 Tag vorher' },
];

/** So viele Tage nach dem Stufen-Datum zeigt die App eine verpasste Geburtstags-Erinnerung noch an. */
export const CATCH_UP_DAYS = 2;

/** Ganztägige Termine erinnern ab 9:00 Uhr. */
export const ALL_DAY_HOUR = 9;

export function eventStart(ev) {
  const d = fromKey(ev.date);
  if (ev.allDay) d.setHours(ALL_DAY_HOUR, 0, 0, 0);
  else d.setMinutes(toMinutes(ev.start));
  return d;
}

/** Ende des Termins; danach ist eine Erinnerung nicht mehr nützlich. */
export function eventEnd(ev) {
  if (ev.allDay) return addDays(fromKey(ev.endDate || ev.date), 1);
  const d = fromKey(ev.date);
  const end = ev.end && toMinutes(ev.end) > toMinutes(ev.start) ? toMinutes(ev.end) : toMinutes(ev.start) + 60;
  d.setMinutes(end);
  return d;
}

export const eventReminderKey = (ev) => `ev:${ev.id}:${ev.date}:${ev.allDay ? 'allday' : ev.start}:${ev.remind}`;
export const birthdayReminderKey = (b, year, stage) => `bd:${b.id}:${year}:${stage}`;

/**
 * Termine mit Erinnerung für den Push-Server: nur Anstehendes (Ende noch nicht vorbei, bis 90 Tage voraus), höchstens 200.
 * Datenschutz: Haarschnitt-Termine senden nur "Haareschneiden" (ohne Kundenname), Titel werden gekürzt.
 */
export function remindersForPush(events, now = new Date()) {
  const horizon = now.getTime() + 90 * 86400000;
  return events
    .filter((ev) => ev.remind !== null && ev.remind !== undefined && eventEnd(ev) > now && eventStart(ev).getTime() <= horizon)
    .sort((a, b) => eventStart(a) - eventStart(b))
    .slice(0, 200)
    .map((ev) => ({
      id: ev.id,
      title: (ev.haircut ? 'Haareschneiden' : ev.title || 'Termin').slice(0, 120),
      date: ev.date,
      allDay: !!ev.allDay,
      start: ev.allDay ? null : ev.start,
      remind: ev.remind,
    }));
}

/** Kurzer Text, wann es losgeht ("in 15 Min.", "um 14:00", "Heute", …). */
export function whenLabel(ev, now = new Date()) {
  if (ev.allDay) {
    const diffDays = Math.round((fromKey(ev.date) - startOfDay(now)) / 86400000);
    return diffDays <= 0 ? 'Heute' : diffDays === 1 ? 'Morgen' : `in ${diffDays} Tagen`;
  }
  const mins = Math.round((eventStart(ev) - now) / 60000);
  if (mins <= 0) return 'Jetzt';
  if (mins < 60) return `in ${mins} Min.`;
  if (toKey(eventStart(ev)) === toKey(now)) return `um ${ev.start} Uhr`;
  return `${fromKey(ev.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${ev.start} Uhr`;
}

/**
 * Fällige Erinnerungen. Eine Erinnerung ist fällig, sobald ihr Zeitpunkt erreicht
 * ist, und bleibt es, bis der Termin vorbei ist oder sie weggewischt wurde (`seen`).
 */
export function dueReminders({ events, birthdays, seen, now = new Date() }) {
  const due = [];
  for (const ev of events) {
    if (ev.remind === null || ev.remind === undefined) continue;
    const key = eventReminderKey(ev);
    if (seen.has(key)) continue;
    const at = new Date(eventStart(ev).getTime() - ev.remind * 60000);
    if (at <= now && now < eventEnd(ev)) {
      due.push({ key, kind: 'event', title: ev.title, text: whenLabel(ev, now), event: ev, at });
    }
  }
  // Geburtstage: pro Person nur die jüngste fällige Stufe (1 Monat / 1 Woche / 1 Tag vorher / heute)
  for (const birthday of birthdays) {
    const cur = currentStage(birthday, now);
    if (!cur) continue;
    const key = birthdayReminderKey(birthday, cur.year, cur.stage);
    if (seen.has(key)) continue;
    const at = reminderDates(birthday, cur.year).find((r) => r.stage === cur.stage).date;
    // Nur am Tag der Stufe und die zwei Tage danach (Nachholen). Wer einen Geburtstag erst später einträgt
    // oder die App lange nicht öffnet, bekommt keine veraltete Meldung. (Push schickt nur am exakten Tag.)
    const daysLate = Math.round((startOfDay(now) - at) / 86400000);
    if (daysLate > CATCH_UP_DAYS) continue;
    const daysLeft = Math.round((cur.date - startOfDay(now)) / 86400000);
    const { title, body } = stageText(cur.stage, birthday, cur.age, cur.date, daysLate > 0 ? daysLeft : undefined);
    due.push({ key, kind: 'birthday', stage: cur.stage, title, text: body, birthday, at });
  }
  return due.sort((a, b) => a.at - b.at);
}
