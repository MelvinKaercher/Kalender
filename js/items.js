// Gemeinsame Abfrage für Monat, Woche und Tages-Sheet:
// ein Datenbestand, drei Darstellungen.
import { toKey } from './calendar.js';
import { birthdaysOn } from './birthdays.js';

/**
 * Alles, was an einem Tag passiert.
 * events: Ganztägige zuerst, dann nach Startzeit, dann nach Titel.
 * birthdays: [{ birthday, age }]
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
  return { events: dayEvents, birthdays: birthdaysOn(birthdays, date) };
}
