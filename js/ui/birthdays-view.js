// Liste der jährlichen Ereignisse (Geburtstage, Sonstiges), sortiert nach dem nächsten Auftreten.
import { el, MONTHS, fmtDayShort } from './dom.js';
import { toKey, fromKey } from '../calendar.js';
import { sortByNext, typeInfo, countText } from '../birthdays.js';
import { statusLabel } from './settings.js';
import { syncLabel } from './sync-settings.js';

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

/** Zeile "Abgleich" (Geräte-Sync). */
function syncRow(syncStatus, onSync) {
  return el('button', { class: 'notif-row', type: 'button', onclick: onSync },
    el('span', { class: 'notif-ico', 'aria-hidden': 'true', text: '🔄' }),
    el('span', { class: 'notif-title', text: 'Abgleich' }),
    el('span', { class: `notif-state${syncStatus.state === 'on' && !syncStatus.error ? ' on' : ''}`, text: syncLabel(syncStatus) }),
    el('span', { class: 'notif-chev', 'aria-hidden': 'true', text: '›' }));
}

/** Anstehender oder laufender Urlaub (Zeilen für die Ereignis-Liste). */
function vacationRows(events, now, onVacation) {
  const todayKey = toKey(now);
  return events
    .filter((e) => e.vacation && (e.endDate || e.date) >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const range = e.endDate ? `${fmtDayShort(fromKey(e.date))} – ${fmtDayShort(fromKey(e.endDate))}` : fmtDayShort(fromKey(e.date));
      const running = e.date <= todayKey;
      const days = Math.round((fromKey(e.date) - fromKey(todayKey)) / 86400000);
      return el('button', { class: 'b-row', type: 'button', 'aria-label': `Urlaub: ${e.title}`, onclick: () => onVacation(e) },
        el('span', { class: 'b-av', 'aria-hidden': 'true', text: '🌴' }),
        el('span', {}, el('div', { class: 'b-name', text: e.title }), el('div', { class: 'b-date', text: range })),
        el('span', { class: `b-in${running || days <= 7 ? ' soon' : ''}`, text: running ? 'läuft' : inLabel(days) }));
    });
}

export function renderBirthdays(root, { birthdays, events = [], onVacation = () => {}, now, onBirthday, onAdd, pushStatus, onNotifications, syncStatus, onSync }) {
  const vac = vacationRows(events, now, onVacation);
  if (!birthdays.length && !vac.length) {
    root.append(
      el('div', { class: 'bdays' },
        notificationsRow(pushStatus, onNotifications),
        syncRow(syncStatus, onSync),
        el('div', { class: 'empty' },
          el('div', { class: 'big', text: '🎉' }),
          el('div', { text: 'Noch keine Ereignisse.' }),
          el('div', { text: 'Geburtstage und andere Ereignisse: einmal eintragen, jedes Jahr dabei.' }),
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
        syncRow(syncStatus, onSync),
      vac,
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
