// Suche: tippen, Treffer antippen = Formular öffnen.
import { el, fmtDayShort } from './dom.js';
import { openSheet, closeSheet } from './sheet.js';
import * as store from '../store.js';
import { searchAll } from '../search.js';
import { fromKey } from '../calendar.js';
import { colorStyle } from '../colors.js';
import { openEventForm, openBirthdayForm } from './forms.js';
import { isRecurring, describeRepeat } from '../repeat.js';

export function openSearchSheet() {
  const input = el('input', { type: 'search', class: 'title', placeholder: 'Termine, Kunden, Ereignisse …', autocomplete: 'off', autocapitalize: 'none', enterkeyhint: 'search', 'aria-label': 'Suche' });
  const list = el('div', { class: 'search-list' });

  function paint() {
    const q = input.value.trim();
    list.replaceChildren();
    if (!q) return;
    const hits = searchAll(store.events(), store.birthdays(), q).slice(0, 60);
    if (!hits.length) { list.append(el('div', { class: 'sheet-empty', text: 'Nichts gefunden.' })); return; }
    for (const h of hits) {
      const open = () => (h.kind === 'birthday' ? openBirthdayForm({ birthday: h.item }) : openEventForm({ event: h.item }));
      const e = h.item;
      const when = h.kind === 'birthday'
        ? 'Jährlich'
        : `${isRecurring(e) ? `⟳ ${describeRepeat(e)} · ab ` : ''}${fmtDayShort(fromKey(h.date))}${e.endDate ? ` – ${fmtDayShort(fromKey(e.endDate))}` : ''} ${fromKey(h.date).getFullYear()}${!e.allDay && e.start ? ` · ${e.start}` : ''}`;
      list.append(el('button', { class: 'day-row', type: 'button', style: h.kind === 'event' ? colorStyle(e.color) : '', onclick: open },
        el('span', { class: 'when', text: h.kind === 'birthday' ? '🎂' : e.vacation ? '🌴' : e.haircut ? '✂︎' : '•' }),
        el('span', { class: 'what' },
          el('div', { class: 'name', text: h.title }),
          el('div', { class: 'note', text: when }))));
    }
  }
  input.addEventListener('input', paint);

  const sheet = openSheet({
    title: 'Suche',
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Fertig', onclick: () => closeSheet() }),
    content: [el('div', { class: 'group' }, el('div', { class: 'row' }, input)), list],
  });
  setTimeout(() => input.focus(), 350);
  return sheet;
}
