// Monatsansicht: Raster mit Punkten für Termine/Geburtstage + "Als Nächstes"-Liste.
import { el, WEEKDAYS, fmtWeekdayDay } from './dom.js';
import { monthGrid, isSameDay, addDays, startOfDay } from '../calendar.js';
import { itemsForDay } from '../items.js';
import { eventEnd } from '../reminders.js';

const UPCOMING_LIMIT = 3;
const UPCOMING_DAYS = 60;

function cell(c, today, events, birthdays, onDay) {
  const items = itemsForDay(events, birthdays, c.date);
  const nEvents = items.events.length;
  const nBdays = items.birthdays.length;
  const dots = [
    ...Array.from({ length: Math.min(nEvents, 2) }, () => el('i', { class: 'dot' })),
    ...(nBdays ? [el('i', { class: 'dot bday' })] : []),
  ];
  const label = [
    c.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
    nEvents ? `${nEvents} ${nEvents === 1 ? 'Termin' : 'Termine'}` : null,
    nBdays ? `${nBdays} ${nBdays === 1 ? 'Geburtstag' : 'Geburtstage'}` : null,
  ].filter(Boolean).join(', ');
  return el('button', {
    class: `cell${c.inMonth ? '' : ' out'}${isSameDay(c.date, today) ? ' today' : ''}`,
    type: 'button',
    'aria-label': label,
    'data-key': c.key,
    onclick: () => onDay(c.date),
  }, el('span', { class: 'num', text: String(c.date.getDate()) }), el('span', { class: 'dots' }, dots));
}

/** Die nächsten Termine/Geburtstage ab jetzt. */
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
        ? el('button', { class: 'up-row', type: 'button', onclick: () => onEvent(it.event) },
            el('span', { class: 'up-when', text: whenLabel(it) }),
            el('span', { class: 'up-title' }, el('span', { class: 'bar' }), it.event.title),
            el('span', { class: 'up-meta', text: it.event.allDay ? 'Ganztägig' : it.event.start }))
        : el('button', { class: 'up-row', type: 'button', onclick: () => onBirthday(it.birthday) },
            el('span', { class: 'up-when', text: whenLabel(it) }),
            el('span', { class: 'up-title' }, el('span', { class: 'bar bday' }), `🎂 ${it.birthday.name}`),
            el('span', { class: 'up-meta', text: it.age ? `wird ${it.age}` : '' }))
    ));
}

export function renderMonth(root, { cursor, today, now, events, birthdays, onDay, onEvent, onBirthday }) {
  const weeks = monthGrid(cursor.getFullYear(), cursor.getMonth());
  root.append(
    el('div', { class: 'month' },
      el('div', { class: 'weekdays', 'aria-hidden': 'true' }, WEEKDAYS.map((d) => el('span', { text: d }))),
      el('div', { class: 'grid', role: 'grid', style: `--rows:${weeks.length}` }, weeks.flat().map((c) => cell(c, today, events, birthdays, onDay))),
      upcomingList(upcoming(events, birthdays, now), onEvent, onBirthday)
    )
  );
}
