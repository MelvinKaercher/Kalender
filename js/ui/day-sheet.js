// Tages-Sheet: alles an einem Tag. Antippen bearbeitet, "+" legt neu an.
import { el, fmtDayLong, fmtRange } from './dom.js';
import { openSheet, closeSheet } from './sheet.js';
import { itemsForDay } from '../items.js';
import * as store from '../store.js';
import { openEventForm, openBirthdayForm } from './forms.js';
import { colorStyle } from '../colors.js';

export function openDaySheet(date) {
  const { events, birthdays } = itemsForDay(store.events(), store.birthdays(), date);
  const rows = [
    ...birthdays.map(({ birthday, age }) =>
      el('button', { class: 'day-row bday', type: 'button', onclick: () => openBirthdayForm({ birthday }) },
        el('span', { class: 'when', text: 'Geburtstag' }),
        el('span', { class: 'what' },
          el('div', { class: 'name', text: `🎂 ${birthday.name}` }),
          age ? el('div', { class: 'note', text: `wird ${age}` }) : null))),
    ...events.map((ev) =>
      el('button', { class: 'day-row', type: 'button', style: colorStyle(ev.color), onclick: () => openEventForm({ event: ev }) },
        el('span', { class: 'when', text: fmtRange(ev) }),
        el('span', { class: 'what' },
          el('div', { class: 'name', text: ev.title }),
          ev.note ? el('div', { class: 'note', text: ev.note }) : null))),
  ];

  const add = el('button', { class: 'sheet-add', type: 'button', onclick: () => openEventForm({ date }), text: 'Termin hinzufügen' });
  const content = rows.length ? [rows, add] : [el('div', { class: 'sheet-empty', text: 'Nichts geplant.' }), add];

  return openSheet({
    title: fmtDayLong(date),
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Fertig', onclick: () => closeSheet() }),
    content,
    flush: true,
  });
}
