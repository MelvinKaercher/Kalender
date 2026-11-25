// Liste der jährlichen Ereignisse (Geburtstage, Jahrestage, Sonstiges), sortiert nach dem nächsten Auftreten.
import { el, MONTHS } from './dom.js';
import { sortByNext, typeInfo, countText } from '../birthdays.js';
import { statusLabel } from './settings.js';

function inLabel(days) {
  if (days === 0) return 'Heute 🎉';
  if (days === 1) return 'Morgen';
  if (days < 31) return `in ${days} Tagen`;
  const months = Math.round(days / 30.4);
  return `in ${months} Mon.`;
}

/** Einstieg zu den Benachrichtigungs-Einstellungen. */
function notificationsRow(pushStatus, onNotifications) {
  return el('button', { class: 'notif-row', type: 'button', onclick: onNotifications },
    el('span', { class: 'notif-ico', 'aria-hidden': 'true', text: '🔔' }),
    el('span', { class: 'notif-title', text: 'Benachrichtigungen' }),
    el('span', { class: `notif-state${pushStatus.state === 'on' ? ' on' : ''}`, text: statusLabel(pushStatus.state) }),
    el('span', { class: 'notif-chev', 'aria-hidden': 'true', text: '›' }));
}

export function renderBirthdays(root, { birthdays, now, onBirthday, onAdd, pushStatus, onNotifications }) {
  if (!birthdays.length) {
    root.append(
      el('div', { class: 'bdays' },
        notificationsRow(pushStatus, onNotifications),
        el('div', { class: 'empty' },
          el('div', { class: 'big', text: '🎉' }),
          el('div', { text: 'Noch keine Ereignisse.' }),
          el('div', { text: 'Geburtstage, Jahrestage und mehr: einmal eintragen, jedes Jahr dabei.' }),
          el('button', { type: 'button', onclick: onAdd, text: 'Ereignis hinzufügen' })
        )
      )
    );
    return;
  }
  const list = sortByNext(birthdays, now);
  root.append(
    el('div', { class: 'bdays' },
      notificationsRow(pushStatus, onNotifications),
      list.map(({ birthday: b, age, days }) =>
        el('button', { class: 'b-row', type: 'button', 'aria-label': `${typeInfo(b).label}: ${b.name}`, onclick: () => onBirthday(b) },
          el('span', { class: 'b-av', 'aria-hidden': 'true', text: typeInfo(b).emoji }),
          el('span', {},
            el('div', { class: 'b-name', text: b.name }),
            el('div', { class: 'b-date', text: `${b.day}. ${MONTHS[b.month - 1]}${countText(b, age) ? ` · ${countText(b, age)}` : ''}` })),
          el('span', { class: `b-in${days <= 7 ? ' soon' : ''}`, text: inLabel(days) })
        ))
    )
  );
}
