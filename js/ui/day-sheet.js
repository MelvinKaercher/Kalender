// Tages-Sheet: alles an einem Tag. Antippen bearbeitet, "+" legt neu an.
import { el, fmtDayLong, fmtRange, fmtDayShort } from './dom.js';
import { openSheet, closeSheet } from './sheet.js';
import { itemsForDay } from '../items.js';
import * as store from '../store.js';
import { openEventForm, openBirthdayForm } from './forms.js';
import { colorStyle } from '../colors.js';
import { getDisplay } from '../display.js';
import { typeInfo, countText } from '../birthdays.js';
import { fromKey } from '../calendar.js';
import { isHaircut, earned, fmtEuro } from '../haircuts.js';

export function openDaySheet(date) {
  const { events, birthdays, holidays, vacations } = itemsForDay(store.events(), store.birthdays(), date);
  const display = getDisplay();
  const info = (cls, when, name, note) =>
    el('div', { class: `day-row ${cls}` },
      el('span', { class: 'when', text: when }),
      el('span', { class: 'what' },
        el('div', { class: 'name', text: name }),
        note ? el('div', { class: 'note', text: note }) : null));
  const rows = [
    ...(display.holidays ? holidays.map((h) => info('holiday', 'Feiertag', h.name)) : []),
    ...(display.vacations ? vacations.map((v) => info('vac', v.kind === 'frei' ? 'Schule' : 'Schulferien', v.name,
      v.start === v.end ? null : `${fmtDayShort(fromKey(v.start))} – ${fmtDayShort(fromKey(v.end))}`)) : []),
    ...birthdays.map(({ birthday, age }) =>
      el('button', { class: 'day-row bday', type: 'button', onclick: () => openBirthdayForm({ birthday }) },
        el('span', { class: 'when', text: typeInfo(birthday).label }),
        el('span', { class: 'what' },
          el('div', { class: 'name', text: `${typeInfo(birthday).emoji} ${birthday.name}` }),
          countText(birthday, age) ? el('div', { class: 'note', text: countText(birthday, age) }) : null))),
    ...events.map((ev) =>
      el('button', { class: 'day-row', type: 'button', style: colorStyle(ev.color), onclick: () => openEventForm({ event: ev }) },
        el('span', { class: 'when', text: fmtRange(ev) }),
        el('span', { class: 'what' },
          el('div', { class: 'name', text: ev.title }),
          isHaircut(ev) ? el('div', { class: 'note', text: `✂︎ ${ev.haircut.customer ? `${ev.haircut.customer} · ` : ''}${fmtEuro(earned(ev))}` }) : null,
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
