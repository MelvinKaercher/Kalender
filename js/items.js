// Gemeinsame Abfrage für Monat, Woche und Tages-Sheet:
// ein Datenbestand, drei Darstellungen.
import { toKey } from './calendar.js';
import { birthdaysOn } from './birthdays.js';
import { holidayOn } from './holidays.js';
import { vacationsOn } from './school-holidays.js';

/**
 * Alles, was an einem Tag passiert.
 * events: Ganztägige zuerst, dann nach Startzeit, dann nach Titel.
 * birthdays: [{ birthday, age }]
 * holidays: [{ name }] (Feiertag in BW, höchstens einer)
 * vacations: [{ name, start, end, kind }] (Schulferien BW)
 */
export function itemsForDay(events, birthdays, date) {
  const key = toKey(date);
  const dayEvents = events
    .filter((e) => e.date === key)
    .sort(
      (a, b) =>
        Number(!!b.allDay) - Number(!!a.allDay) ||
        (a.start || '').localeCompare(b.start || '') ||
        a.title.localeCompare(b.title, 'de')
    );
  const holiday = holidayOn(date);
  return {
    events: dayEvents,
    birthdays: birthdaysOn(birthdays, date),
    holidays: holiday ? [{ name: holiday.name }] : [],
    vacations: vacationsOn(date),
  };
}
