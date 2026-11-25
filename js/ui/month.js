// Monatsansicht: Raster mit Namen der Termine/Ereignisse + "Als Nächstes"-Liste.
import { el, WEEKDAYS, fmtWeekdayDay } from './dom.js';
import { monthGrid, isSameDay, addDays, startOfDay } from '../calendar.js';
import { itemsForDay } from '../items.js';
import { eventEnd } from '../reminders.js';
import { colorStyle } from '../colors.js';
import { typeInfo, countText } from '../birthdays.js';
import { isHaircut } from '../haircuts.js';

const UPCOMING_LIMIT = 3;
const UPCOMING_DAYS = 60;

function cell(c, today, events, birthdays, display, onDay) {
  const items = itemsForDay(events, birthdays, c.date);
  const nEvents = items.events.length;
  const nBdays = items.birthdays.length;
  const holiday = display.holidays ? items.holidays[0] : null;
  const vacation = display.vacations ? items.vacations[0] : null;
  // Namen direkt im Feld (wie bei Feiertagen): Ereignisse zuerst, dann Termine; maximal 3 Zeilen inkl. Feiertag
  const room = Math.max(0, 3 - (holiday ? 1 : 0));
  const hairs = items.events.filter(isHaircut);
  const plain = items.events.filter((e) => !isHaircut(e));
  const bdayLabels = items.birthdays.map(({ birthday }) => el('i', { class: 'lbl bday', text: `${typeInfo(birthday).emoji}${birthday.name}` }));
  const plainLabels = plain.map((ev) => el('i', { class: 'lbl', style: colorStyle(ev.color), text: ev.title }));
  const hairLabels = hairs.map((ev) => el('i', { class: 'lbl', style: colorStyle(ev.color), text: `✂︎${ev.haircut.customer || 'Haare'}` }));
  // Zu voll? Zuerst die Haarschnitte ohne Namen zusammenfassen ("✂︎ 4"), danach auch die übrigen Termine.
  const sumLabel = (list, text) => (list.length ? [el('i', { class: 'lbl', style: colorStyle(list[0].color), text })] : []);
  let names = [...bdayLabels, ...plainLabels, ...hairLabels];
  if (names.length > room) names = [...bdayLabels, ...plainLabels, ...sumLabel(hairs, `✂︎ ${hairs.length}`)];
  if (names.length > room) names = [...bdayLabels, ...sumLabel(plain, `${plain.length} Termin${plain.length === 1 ? '' : 'e'}`), ...sumLabel(hairs, `✂︎ ${hairs.length}`)];
  const shown = names.length > room ? names.slice(0, Math.max(0, room - 1)) : names;
  const more = names.length - shown.length;
  const label = [
    c.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
    nEvents ? `${nEvents} ${nEvents === 1 ? 'Termin' : 'Termine'}` : null,
    nBdays ? `${nBdays} ${nBdays === 1 ? 'Ereignis' : 'Ereignisse'}: ${items.birthdays.map((x) => x.birthday.name).join(', ')}` : null,
    holiday ? `Feiertag: ${holiday.name}` : null,
    vacation ? vacation.name : null,
  ].filter(Boolean).join(', ');
  return el('button', {
    class: `cell${c.inMonth ? '' : ' out'}${isSameDay(c.date, today) ? ' today' : ''}${holiday ? ' holiday' : ''}${vacation ? ' vac' : ''}`,
    type: 'button',
    'aria-label': label,
    'data-key': c.key,
    onclick: () => onDay(c.date),
  }, el('span', { class: 'num', text: String(c.date.getDate()) }),
    holiday ? el('span', { class: 'hname', text: holiday.short }) : null,
    el('span', { class: 'lbls' }, shown, more ? el('i', { class: 'lbl more', text: `+${more}` }) : null));
}

/** Die nächsten Termine und Ereignisse ab jetzt. */
export function upcoming(events, birthdays, now, limit = UPCOMING_LIMIT) {
  const today = startOfDay(now);
  const out = [];
  for (let i = 0; i < UPCOMING_DAYS && out.length < limit; i++) {
    const date = addDays(today, i);
    const items = itemsForDay(events, birthdays, date);
    for (const { birthday, age } of items.birthdays) out.push({ type: 'birthday', date, i, birthday, age });
    for (const ev of items.events) {
      if (i === 0 && !ev.allDay && eventEnd(ev) <= now) continue; // heute schon vorbei
      out.push({ type: 'event', date, i, event: ev });
    }
  }
  return out.slice(0, limit);
}

function upcomingList(list, onEvent, onBirthday) {
  if (!list.length) return null;
  const whenLabel = (it) => (it.i === 0 ? 'Heute' : it.i === 1 ? 'Morgen' : fmtWeekdayDay(it.date));
  return el('section', { class: 'upcoming' },
    el('h2', { text: 'Als Nächstes' }),
    list.map((it) =>
      it.type === 'event'
        ? el('button', { class: 'up-row', type: 'button', style: colorStyle(it.event.color), onclick: () => onEvent(it.event) },
            el('span', { class: 'up-when', text: whenLabel(it) }),
            el('span', { class: 'up-title' }, el('span', { class: 'bar' }), it.event.title),
            el('span', { class: 'up-meta', text: it.event.allDay ? 'Ganztägig' : it.event.start }))
        : el('button', { class: 'up-row', type: 'button', onclick: () => onBirthday(it.birthday) },
            el('span', { class: 'up-when', text: whenLabel(it) }),
            el('span', { class: 'up-title' }, el('span', { class: 'bar bday' }), `${typeInfo(it.birthday).emoji} ${it.birthday.name}`),
            el('span', { class: 'up-meta', text: countText(it.birthday, it.age) || '' }))
    ));
}

export function renderMonth(root, { cursor, today, now, events, birthdays, display, onPickDay, onEvent, onBirthday }) {
  const weeks = monthGrid(cursor.getFullYear(), cursor.getMonth());
  root.append(
    el('div', { class: 'month' },
      el('div', { class: 'weekdays', 'aria-hidden': 'true' }, WEEKDAYS.map((d) => el('span', { text: d }))),
      el('div', { class: 'grid', role: 'grid', style: `--rows:${weeks.length}` }, weeks.flat().map((c) => cell(c, today, events, birthdays, display, onPickDay))),
      upcomingList(upcoming(events, birthdays, now), onEvent, onBirthday)
    )
  );
}
