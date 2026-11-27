// Suche über alle Termine, Urlaube und Ereignisse. Rein (kein DOM), in Node testbar.
import { toKey, startOfDay } from './calendar.js';
import { typeInfo } from './birthdays.js';
import { isRecurring, describeRepeat } from './repeat.js';

const fold = (s) => String(s || '').toLocaleLowerCase('de').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

/**
 * @returns {Array<{kind:'event'|'birthday', item, date:string|null, title:string, sub:string}>}
 * Anstehende Termine zuerst (aufsteigend), danach vergangene (absteigend), danach jährliche Ereignisse.
 */
export function searchAll(events, birthdays, query, now = new Date()) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hit = (text) => { const t = fold(text); return words.every((w) => t.includes(w)); };
  const todayKey = toKey(startOfDay(now));

  const evHits = events
    .filter((e) => hit([e.title, e.note, e.haircut && e.haircut.customer].filter(Boolean).join(' ')))
    .map((e) => ({ kind: 'event', item: e, date: e.date, title: e.title, sub: isRecurring(e) ? describeRepeat(e) : e.note || '' }));
  const stillGoing = (h) => (isRecurring(h.item) ? !h.item.repeat.until || h.item.repeat.until >= todayKey : (h.item.endDate || h.date) >= todayKey);
  const upcoming = evHits.filter(stillGoing).sort((a, b) => a.date.localeCompare(b.date));
  const past = evHits.filter((h) => !stillGoing(h)).sort((a, b) => b.date.localeCompare(a.date));
  const bdays = birthdays
    .filter((b) => hit(b.name))
    .map((b) => ({ kind: 'birthday', item: b, date: null, title: `${typeInfo(b).emoji} ${b.name}`, sub: `${b.day}.${b.month}.` }));
  return [...upcoming, ...past, ...bdays];
}
