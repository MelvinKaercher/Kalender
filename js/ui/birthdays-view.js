// Geburtstagsliste, sortiert nach dem nächsten Auftreten.
import { el, MONTHS } from './dom.js';
import { sortByNext } from '../birthdays.js';
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
          el('div', { class: 'big', text: '🎂' }),
          el('div', { text: 'Noch keine Geburtstage.' }),
          el('div', { text: 'Einmal eintragen – sie kehren jedes Jahr wieder.' }),
          el('button', { type: 'button', onclick: onAdd, text: 'Geburtstag hinzufügen' })
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
        el('button', { class: 'b-row', type: 'button', onclick: () => onBirthday(b) },
          el('span', { class: 'b-av', 'aria-hidden': 'true', text: (b.name.trim()[0] || '?').toUpperCase() }),
          el('span', {},
            el('div', { class: 'b-name', text: b.name }),
            el('div', { class: 'b-date', text: `${b.day}. ${MONTHS[b.month - 1]}${age ? ` · wird ${age}` : ''}` })),
          el('span', { class: `b-in${days <= 7 ? ' soon' : ''}`, text: inLabel(days) })
        ))
    )
  );
}
