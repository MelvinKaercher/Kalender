// Vorsätze (z. B. „Mehr Englisch lernen"): Abhaken pro Tag, Serie, Erinnerung zu einer Uhrzeit an bestimmten Wochentagen.
// Reine Logik ohne DOM – gut testbar. Ein Vorsatz:
//   { id, title, note, remind: { time:'HH:MM', days:[0..6] } | null, checks:['YYYY-MM-DD'], done:boolean, doneAt?, updatedAt }
// days: 0 = Sonntag … 6 = Samstag (wie Date#getDay).
import { toKey, fromKey, addDays, startOfDay } from './calendar.js';

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MAX_GOALS_PUSH = 50;

/** Tage, an denen der Vorsatz „dran" ist: die Erinnerungs-Wochentage, sonst jeden Tag. */
export const scheduleDays = (goal) => (goal.remind && goal.remind.days && goal.remind.days.length ? goal.remind.days : ALL_DAYS);
export const isScheduled = (goal, date) => scheduleDays(goal).includes(date.getDay());
export const isChecked = (goal, date) => (goal.checks || []).includes(toKey(date));

/**
 * Serie: aufeinanderfolgende geplante Tage, die abgehakt sind (bis heute).
 * Ein heute noch nicht abgehakter Tag bricht die Serie nicht; Tage, an denen der Vorsatz nicht dran ist, werden übersprungen.
 */
export function streak(goal, today = new Date()) {
  const checks = new Set(goal.checks || []);
  let n = 0;
  const t0 = startOfDay(today);
  for (let i = 0; i < 800; i++) {
    const d = addDays(t0, -i);
    if (!isScheduled(goal, d)) continue;
    if (checks.has(toKey(d))) n += 1;
    else if (i === 0) continue;
    else break;
  }
  return n;
}

/** Wochenpunkte Mo–So: { key, date, scheduled, checked }. */
export function weekMarks(goal, weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { key: toKey(date), date, scheduled: isScheduled(goal, date), checked: isChecked(goal, date) };
  });
}

/** "täglich 19:00", "Mo, Mi, Fr 19:00" (Wochenfolge Mo–So). */
export function describeRemind(remind) {
  if (!remind) return '';
  const days = [...new Set(remind.days || [])];
  if (days.length === 7 || days.length === 0) return `täglich ${remind.time}`;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return `${order.filter((d) => days.includes(d)).map((d) => DAY_LABELS[d]).join(', ')} ${remind.time}`;
}

/** Aktive Vorsätze mit Erinnerung für den Push-Server (nur das Nötige; letzte 7 Abhak-Tage, damit „heute schon erledigt" erkannt wird). */
export function goalsForPush(goals, now = new Date()) {
  const from = toKey(addDays(startOfDay(now), -7));
  return goals
    .filter((g) => !g.done && g.remind && /^([01]\d|2[0-3]):[0-5]\d$/.test(g.remind.time || '') && g.title)
    .slice(0, MAX_GOALS_PUSH)
    .map((g) => ({
      id: g.id,
      title: String(g.title).slice(0, 120),
      note: String(g.note || '').slice(0, 200),
      time: g.remind.time,
      days: [...new Set(g.remind.days && g.remind.days.length ? g.remind.days : ALL_DAYS)].sort(),
      checks: (g.checks || []).filter((k) => k >= from).sort().slice(-8),
    }));
}

export const sortGoals = (goals) => [...goals].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.title.localeCompare(b.title, 'de'));

/** Hilfsfunktion für Tests/Anzeige: Datum aus Schlüssel. */
export const dateOf = fromKey;
