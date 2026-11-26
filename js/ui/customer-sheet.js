// Kundenkarte: Besuche, Zahlungen pro Monat und insgesamt, Abstand zwischen den Besuchen.
import { el, MONTHS, fmtDayShort } from './dom.js';
import { openSheet, closeSheet } from './sheet.js';
import { fromKey, startOfDay } from '../calendar.js';
import { earned, fmtEuro, isDone } from '../haircuts.js';
import { openEventForm } from './forms.js';

const stat = (label, value) =>
  el('div', { class: 'hc-stat' }, el('div', { class: 'hc-val', text: value }), el('div', { class: 'hc-lab', text: label }));

const fmtDate = (key) => `${fmtDayShort(fromKey(key))} ${fromKey(key).getFullYear()}`;

function sinceText(key, now) {
  const days = Math.round((startOfDay(now) - fromKey(key)) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 60) return `vor ${days} Tagen`;
  return `vor ${Math.round(days / 30.4)} Mon.`;
}

export function openCustomerSheet(c, now = new Date()) {
  const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  const content = [
    el('div', { class: 'hc-summary cust' },
      stat('Besuche', String(c.visits)),
      stat('Bezahlt gesamt', fmtEuro(c.earned)),
      stat('Ø pro Besuch', fmtEuro(c.avg))),
    el('div', { class: 'cust-facts' },
      c.visits ? el('div', {}, el('span', { text: 'Davon Preis · Trinkgeld' }), el('b', { text: `${fmtEuro(c.price)} · ${fmtEuro(c.tip)}` })) : null,
      c.last ? el('div', {}, el('span', { text: 'Zuletzt da' }), el('b', { text: `${fmtDate(c.last)} (${sinceText(c.last, now)})` })) : null,
      c.first ? el('div', {}, el('span', { text: 'Erster Besuch' }), el('b', { text: fmtDate(c.first) })) : null,
      c.avgGapDays ? el('div', {}, el('span', { text: 'Kommt etwa alle' }), el('b', { text: `${c.avgGapDays} Tage` })) : null,
      c.nextPlanned ? el('div', {}, el('span', { text: 'Nächster Termin' }), el('b', { text: fmtDate(c.nextPlanned) })) : null),
    c.months.length ? el('h3', { class: 'cust-h', text: 'Pro Monat' }) : null,
    el('div', { class: 'cust-months' }, c.months.map((m) =>
      el('div', { class: 'cust-month' },
        el('span', { text: monthLabel(m.ym) }),
        el('span', { class: 'hc-count', text: `${m.count}×` }),
        el('b', { text: fmtEuro(m.earned) })))),
    el('h3', { class: 'cust-h', text: 'Alle Besuche' }),
    el('div', { class: 'hc-list open-list' }, [...c.items].reverse().map((ev) =>
      el('button', { class: 'hc-item', type: 'button', onclick: () => openEventForm({ event: ev }) },
        el('span', { class: 'hc-when', text: `${fmtDate(ev.date)}${ev.allDay ? '' : ` · ${ev.start}`}` }),
        el('span', { class: 'hc-who', text: isDone(ev, now) ? '' : 'geplant' }),
        el('span', { class: 'hc-amt', text: fmtEuro(earned(ev)) })))),
  ];
  return openSheet({
    title: c.name,
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Fertig', onclick: () => closeSheet() }),
    content,
  });
}
