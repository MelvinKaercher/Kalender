// Sheet "Benachrichtigungen": Push-Nachrichten für Ereignisse (Geburtstage …) ein- und ausschalten.
import { el } from './dom.js';
import { openSheet } from './sheet.js';
import config from '../config.js';

const ERROR_TEXT = {
  token: 'Der Zugangscode stimmt nicht. Du hast ihn bei der Einrichtung des Servers selbst festgelegt.',
  permission: 'Mitteilungen wurden nicht erlaubt. Du kannst sie in den iPhone-Einstellungen unter „Mitteilungen" → „Kalender" einschalten.',
  network: 'Der Server ist nicht erreichbar. Prüfe deine Internetverbindung und versuche es noch einmal.',
  server: 'Der Server hat einen Fehler gemeldet. Versuche es später noch einmal.',
  expired: 'Die Anmeldung ist abgelaufen. Bitte schalte die Benachrichtigungen noch einmal ein.',
  unsupported: 'Auf diesem Gerät sind Benachrichtigungen nicht möglich.',
  unconfigured: 'Der Server ist noch nicht eingerichtet.',
};

const uhr = (t) => `${t} Uhr`;

/** Kurztext für die Zeile in der Ereignisliste. */
export const statusLabel = (state) =>
  ({ on: 'An', off: 'Aus', unconfigured: 'Einrichten', unsupported: 'Nicht verfügbar', denied: 'Blockiert' }[state] || '');

export function openNotificationSettings({ push, onChange = () => {} }) {
  const sheet = openSheet({
    title: 'Benachrichtigungen',
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Fertig', onclick: () => sheet.close() }),
    content: [],
  });

  function paint(message = '') {
    const { state, reason } = push.status();
    const error = el('div', { class: 'form-error', role: 'alert', text: message });
    const note = (text) => el('p', { class: 'notes', text });
    const parts = [];

    parts.push(
      el('div', { class: 'info' },
        el('p', { class: 'notes', text: 'Für jedes Ereignis (Geburtstag …) bekommst du eine Mitteilung auf dein iPhone, auch wenn die App geschlossen ist:' }),
        el('ul', { class: 'info-list' },
          el('li', { text: `1 Monat vorher (${uhr(config.times.advance)})` }),
          el('li', { text: `1 Woche vorher (${uhr(config.times.advance)})` }),
          el('li', { text: `1 Tag vorher (${uhr(config.times.advance)})` }),
          el('li', { text: `am Tag selbst um ${uhr(config.times.today)}` })),
        el('p', { class: 'notes', text: 'Auch Termine mit Erinnerung (im Termin unter „Erinnerung“) kommen als Mitteilung, zur eingestellten Zeit vorher.' })));

    if (state === 'unconfigured') {
      parts.push(note('Der Server für die Mitteilungen ist noch nicht eingerichtet. Die Schritte stehen in der Datei worker/README.md im Projekt. Danach trägst du die Adresse des Servers in js/config.js ein.'));
    } else if (state === 'unsupported') {
      parts.push(note(reason === 'not-installed'
        ? 'Mitteilungen funktionieren nur, wenn du die App auf dem Home-Bildschirm installiert hast: in Safari auf „Teilen" tippen → „Zum Home-Bildschirm". Öffne die App danach über das Icon. Erforderlich ist iOS 16.4 oder neuer.'
        : 'Dieser Browser unterstützt keine Push-Mitteilungen.'));
    } else if (state === 'denied') {
      parts.push(note('Mitteilungen sind für diese App blockiert. Erlaube sie in den iPhone-Einstellungen unter „Mitteilungen" → „Kalender" und öffne diese Seite danach noch einmal.'));
    } else if (state === 'off') {
      const code = el('input', { type: 'password', placeholder: 'Zugangscode', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Zugangscode' });
      const button = el('button', { class: 'sheet-add', type: 'button', text: 'Benachrichtigungen einschalten' });
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Einen Moment …';
        try {
          await push.enable(code.value); // direkt aus dem Tipp, iOS verlangt das für die Berechtigung
          onChange();
          paint('');
        } catch (err) {
          button.disabled = false;
          button.textContent = 'Benachrichtigungen einschalten';
          error.textContent = ERROR_TEXT[err.code] || 'Das hat nicht geklappt.';
        }
      });
      parts.push(
        el('div', { class: 'group' }, el('div', { class: 'row' }, code)),
        note('Den Zugangscode hast du bei der Einrichtung des Servers selbst festgelegt. Er wird nur auf diesem Gerät gespeichert.'),
        button, error);
    } else if (state === 'on') {
      const test = el('button', { class: 'sheet-add', type: 'button', text: 'Testnachricht senden' });
      test.addEventListener('click', async () => {
        test.disabled = true;
        error.style.color = 'var(--text-2)';
        error.textContent = 'Wird gesendet …';
        try {
          await push.sendTest();
          error.textContent = 'Gesendet. In wenigen Sekunden sollte eine Mitteilung erscheinen.';
        } catch (err) {
          error.style.color = '';
          error.textContent = ERROR_TEXT[err.code] || 'Das hat nicht geklappt.';
          if (err.code === 'expired') { onChange(); paint(ERROR_TEXT.expired); }
        } finally {
          test.disabled = false;
        }
      });
      const off = el('button', { class: 'danger-btn', type: 'button', text: 'Ausschalten' });
      off.addEventListener('click', async () => {
        off.disabled = true;
        await push.disable();
        onChange();
        paint('');
      });
      parts.push(
        el('p', { class: 'status-on', text: '✓ Eingeschaltet' }),
        test, error, off);
    }

    parts.push(
      el('p', { class: 'notes small', text: 'Datenschutz: Dafür werden die Namen und Daten der Ereignisse an deinen eigenen Server (dein Cloudflare-Konto) gesendet. Von Terminen mit Erinnerung gehen Titel und Zeit an den Server (bei Haarschnitten nur „Haareschneiden“, ohne Kunde und Preis). Alle anderen Termine bleiben auf dem Gerät; beim „Abgleich" liegen sie nur verschlüsselt auf deinem Server.' }));
    sheet.body.replaceChildren(...parts);
  }

  paint();
  return sheet;
}
