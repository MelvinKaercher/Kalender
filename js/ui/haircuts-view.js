// Übersicht "Haare": Verdienst und Anzahl der Haarschnitte pro Monat, Jahressumme, Einzelliste je Monat.
import { el, MONTHS, fmtDayShort } from './dom.js';
import { statsForYear, earned, fmtEuro, customerStats } from '../haircuts.js';
import { openCustomerSheet } from './customer-sheet.js';
import { fromKey } from '../calendar.js';
import { openHaircutImport } from './haircut-import-sheet.js';

const importRow = () => el('button', { class: 'hc-import', type: 'button', onclick: openHaircutImport, text: 'Frühere Haarschnitte importieren' });

// aufgeklappter Monat bleibt beim Neuzeichnen (z. B. nach Bearbeiten) offen
let openMonth = null;
let mode = 'months'; // 'months' | 'customers'

const stat = (label, value) =>
  el('div', { class: 'hc-stat' }, el('div', { class: 'hc-val', text: value }), el('div', { class: 'hc-lab', text: label }));

function modeSwitch(root, ctx) {
  const btn = (key, label) => el('button', {
    class: `seg-btn${mode === key ? ' on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(mode === key),
    onclick: () => { mode = key; root.replaceChildren(); renderHaircuts(root, ctx); },
  }, label);
  return el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Ansicht' }, btn('months', 'Monate'), btn('customers', 'Kunden'));
}

function renderCustomers(root, ctx) {
  const { now, events } = ctx;
  const list = customerStats(events, now);
  const totalEarned = list.reduce((t, c) => t + c.earned, 0);
  const named = list.filter((c) => c.visits || c.planned);
  root.append(el('div', { class: 'hc' },
    modeSwitch(root, ctx),
    el('div', { class: 'hc-summary' },
      stat('Kunden', String(named.length)),
      stat('Bezahlt gesamt', fmtEuro(totalEarned)),
      stat('Besuche', String(list.reduce((t, c) => t + c.visits, 0)))),
    named.length ? el('div', { class: 'cust-list' }, named.map((c, i) =>
      el('button', { class: 'cust-row', type: 'button', onclick: () => openCustomerSheet(c, now) },
        el('span', { class: 'cust-rank', text: String(i + 1) }),
        el('span', { class: 'cust-name' },
          el('div', { text: c.name }),
          el('div', { class: 'cust-sub', text: `${c.visits}× da${c.planned ? ` · ${c.planned} geplant` : ''}${c.avg ? ` · Ø ${fmtEuro(c.avg)}` : ''}` })),
        el('span', { class: 'hc-money', text: c.visits ? fmtEuro(c.earned) : '–' }))))
      : el('div', { class: 'empty' }, el('div', { text: 'Noch keine Kunden.' }), el('div', { text: 'Trage Haarschnitte mit einem Kundennamen ein.' }))));
}

export function renderHaircuts(root, ctx) {
  if (mode === 'customers') return renderCustomers(root, ctx);
  const { cursor, now, events, onEvent, onAddHaircut } = ctx;
  const year = cursor.getFullYear();
  const { months, total } = statsForYear(events, year, now);
  const any = total.count + total.planned > 0;

  if (!any) {
    root.append(el('div', { class: 'hc' },
      modeSwitch(root, ctx),
      el('div', { class: 'empty' },
        el('div', { class: 'big', text: '✂︎' }),
        el('div', { text: `Noch keine Haarschnitte in ${year}.` }),
        el('div', { text: 'Trage einen Termin mit dem Schalter „Haareschneiden“ ein – er wird orange und hier ausgewertet.' }),
        el('button', { type: 'button', onclick: onAddHaircut, text: 'Haarschnitt eintragen' })),
      importRow()));
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
    renderHaircuts(parent, ctx);
  }

  root.append(el('div', { class: 'hc' },
    modeSwitch(root, ctx),
    el('div', { class: 'hc-summary' },
      stat('Verdient', fmtEuro(total.earned)),
      stat('Haarschnitte', String(total.count)),
      stat('Ø pro Schnitt', fmtEuro(total.avg))),
    total.planned ? el('div', { class: 'hc-planned', text: `Noch geplant: ${total.planned} · ${fmtEuro(total.plannedEarned)}` }) : null,
    el('div', { class: 'hc-months' }, rows),
    importRow()));
}
