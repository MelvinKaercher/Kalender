// Jahresansicht (wie im Apple-Kalender "herausgezoomt"): 12 Mini-Monate. Tipp auf einen Monat öffnet ihn.
import { el, MONTHS } from './dom.js';
import { monthGrid, isSameDay } from '../calendar.js';
import { holidayOn } from '../holidays.js';

function miniMonth(year, month0, today, display, onMonth) {
  const weeks = monthGrid(year, month0);
  const cells = weeks.flat().map((c) => {
    if (!c.inMonth) return el('i', { 'aria-hidden': 'true' });
    const classes = [
      isSameDay(c.date, today) ? 'today' : '',
      display.holidays && holidayOn(c.date) ? 'holiday' : '',
    ].filter(Boolean).join(' ');
    return el('span', { class: classes, text: String(c.date.getDate()) });
  });
  const isCurrent = year === today.getFullYear() && month0 === today.getMonth();
  return el('button', {
    class: `mini${isCurrent ? ' current' : ''}`, type: 'button', 'data-month': String(month0), 'data-year': String(year),
    'aria-label': `${MONTHS[month0]} ${year}`,
    onclick: () => onMonth(year, month0),
  },
    el('span', { class: 'mini-title', text: MONTHS[month0] }),
    el('span', { class: 'mini-grid', style: `--weeks:${weeks.length}` }, cells));
}

export function renderYear(root, { cursor, today, display, onMonth, onSettings }) {
  const year = cursor.getFullYear();
  const on = [display.holidays, display.vacations].filter(Boolean).length;
  root.append(
    el('div', { class: 'year' },
      el('div', { class: 'year-grid' }, Array.from({ length: 12 }, (_, m) => miniMonth(year, m, today, display, onMonth))),
      el('button', { class: 'notif-row', type: 'button', onclick: onSettings },
        el('span', { class: 'notif-ico', 'aria-hidden': 'true', text: '📅' }),
        el('span', { class: 'notif-title', text: 'Feiertage & Ferien' }),
        el('span', { class: `notif-state${on ? ' on' : ''}`, text: on === 2 ? 'An' : on === 0 ? 'Aus' : 'Teilweise' }),
        el('span', { class: 'notif-chev', 'aria-hidden': 'true', text: '›' }))
    )
  );
}
