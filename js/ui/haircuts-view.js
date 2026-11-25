// Übersicht "Haare": Verdienst und Anzahl der Haarschnitte pro Monat, Jahressumme, Einzelliste je Monat.
import { el, MONTHS, fmtDayShort } from './dom.js';
import { statsForYear, earned, fmtEuro } from '../haircuts.js';
import { fromKey } from '../calendar.js';

// aufgeklappter Monat bleibt beim Neuzeichnen (z. B. nach Bearbeiten) offen
let openMonth = null;

const stat = (label, value) =>
  el('div', { class: 'hc-stat' }, el('div', { class: 'hc-val', text: value }), el('div', { class: 'hc-lab', text: label }));

export function renderHaircuts(root, { cursor, now, events, onEvent, onAddHaircut }) {
  const year = cursor.getFullYear();
  const { months, total } = statsForYear(events, year, now);
  const any = total.count + total.planned > 0;

  if (!any) {
    root.append(el('div', { class: 'hc' },
      el('div', { class: 'empty' },
        el('div', { class: 'big', text: '✂︎' }),
        el('div', { text: `Noch keine Haarschnitte in ${year}.` }),
        el('div', { text: 'Trage einen Termin mit dem Schalter „Haareschneiden“ ein – er wird orange und hier ausgewertet.' }),
        el('button', { type: 'button', onclick: onAddHaircut, text: 'Haarschnitt eintragen' }))));
    return;
  }

  const best = Math.max(1, ...months.map((m) => m.earned));
  const rows = months.map((m, i) => {
    const has = m.count + m.planned > 0;
    const open = has && openMonth === `${year}-${i}`;
    const head = el('button', {
      class: `hc-month${has ? '' : ' empty'}${open ? ' open' : ''}`, type: 'button', 'data-month': String(i),
      'aria-expanded': String(open), disabled: !has,
      onclick: () => { openMonth = open ? null : `${year}-${i}`; rerender(); },
    },
      el('span', { class: 'hc-name', text: MONTHS[i] }),
      el('span', { class: 'hc-count', text: has ? `${m.count}×${m.planned ? ` · ${m.planned} geplant` : ''}` : '–' }),
      el('span', { class: 'hc-money', text: m.count ? fmtEuro(m.earned) : '–' }),
      el('span', { class: 'hc-bar', style: `--w:${Math.round((m.earned / best) * 100)}%`, 'aria-hidden': 'true' }));
    const list = open
      ? el('div', { class: 'hc-list' }, m.items.map((ev) => {
          return el('button', { class: 'hc-item', type: 'button', onclick: () => onEvent(ev) },
            el('span', { class: 'hc-when', text: `${fmtDayShort(fromKey(ev.date))} · ${ev.allDay ? 'ganztägig' : ev.start}` }),
            el('span', { class: 'hc-who', text: ev.haircut.customer || 'Haarschnitt' }),
            el('span', { class: 'hc-amt', text: fmtEuro(earned(ev)) }));
        }))
      : null;
    return el('div', { class: 'hc-block' }, head, list);
  });

  function rerender() {
    const parent = root;
    parent.replaceChildren();
    renderHaircuts(parent, { cursor, now, events, onEvent, onAddHaircut });
  }

  root.append(el('div', { class: 'hc' },
    el('div', { class: 'hc-summary' },
      stat('Verdient', fmtEuro(total.earned)),
      stat('Haarschnitte', String(total.count)),
      stat('Ø pro Schnitt', fmtEuro(total.avg))),
    total.planned ? el('div', { class: 'hc-planned', text: `Noch geplant: ${total.planned} · ${fmtEuro(total.plannedEarned)}` }) : null,
    el('div', { class: 'hc-months' }, rows)));
}
