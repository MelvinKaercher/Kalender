// Reine Logik des Push-Servers: Was ist für ein Abo jetzt fällig?
// Teilt sich die Geburtstags-Stufen mit der App (../../js/birthdays.js).
import { reminderDates, stageText, ageIn } from '../../js/birthdays.js';
import { toKey, toMinutes } from '../../js/calendar.js';

/** Uhrzeit (Ortszeit des Handys), zu der die Nachrichten kommen. */
export const DEFAULT_TIMES = { advance: '09:00', today: '00:00' };

export const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Datum und Uhrzeit von `now` in der Zeitzone `tz`. */
export function zonedNow(now, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const n = (type) => Number(parts.find((p) => p.type === type).value);
  const year = n('year'), month = n('month'), day = n('day');
  return {
    year,
    key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    minutes: n('hour') * 60 + n('minute'),
  };
}

/**
 * Fällige Benachrichtigungen für ein Abo.
 * Fällig = das Datum der Stufe ist heute (in der Ortszeit), die Zielzeit ist erreicht
 * und die Stufe wurde noch nicht gesendet. Nachholen geht nur am selben Tag.
 *
 * @returns {{id:string, stage:string, birthdayId:string, title:string, body:string}[]}
 */
export function dueNotifications({ birthdays, now, tz, sent = {}, times = DEFAULT_TIMES }) {
  const local = zonedNow(now, tz);
  const out = [];
  for (const b of birthdays) {
    // Das nächste Jahr gehört dazu: "1 Monat vorher" für einen Januar-Geburtstag liegt im Dezember.
    for (const year of [local.year, local.year + 1]) {
      if (b.year && year < b.year) continue;
      const dates = reminderDates(b, year);
      const birthdayDate = dates.find((r) => r.stage === 'today').date;
      for (const { stage, date } of dates) {
        if (toKey(date) !== local.key) continue;
        if (local.minutes < toMinutes(stage === 'today' ? times.today : times.advance)) continue;
        const id = `${b.id}:${year}:${stage}`;
        if (sent[id]) continue;
        const { title, body } = stageText(stage, b, ageIn(b, year), birthdayDate);
        out.push({ id, stage, birthdayId: b.id, title, body });
      }
    }
  }
  return out;
}

/** Alte "gesendet"-Markierungen entfernen (Geburtstagsjahr vor dem Vorjahr). */
export function pruneSent(sent, currentYear) {
  const kept = {};
  for (const [id, value] of Object.entries(sent)) {
    const year = Number(id.split(':').at(-2));
    if (!Number.isFinite(year) || year >= currentYear - 1) kept[id] = value;
  }
  return kept;
}
