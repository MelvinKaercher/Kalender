// Sheet "Abgleich": Daten verschlüsselt mit anderen Geräten (z. B. Laptop) abgleichen.
import { el } from './dom.js';
import { openSheet } from './sheet.js';

const ERROR_TEXT = {
  token: 'Der Zugangscode stimmt nicht.',
  password: 'Das Passwort passt nicht zu den bereits gespeicherten Daten. Nimm dasselbe Passwort wie auf dem ersten Gerät.',
  network: 'Der Server ist nicht erreichbar. Prüfe die Internetverbindung.',
  server: 'Der Server hat einen Fehler gemeldet. Versuche es später noch einmal.',
  unconfigured: 'Der Server ist noch nicht eingerichtet.',
};

const when = (t) => (t ? new Date(t).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'noch nie');

/** Kurztext für die Zeile in der Ereignisliste. */
export const syncLabel = (s) => (s.state === 'on' ? (s.error ? 'Fehler' : 'An') : s.state === 'unconfigured' ? 'Einrichten' : 'Aus');

export function openSyncSettings({ syncer, pushToken = '', onChange = () => {} }) {
  const sheet = openSheet({
    title: 'Abgleich',
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Fertig', onclick: () => sheet.close() }),
    content: [],
  });

  function paint(message = '', ok = false) {
    const st = syncer.status();
    const error = el('div', { class: 'form-error', role: 'alert', text: message });
    if (ok) error.style.color = 'var(--text-2)';
    const note = (text, cls = 'notes') => el('p', { class: cls, text });
    const parts = [note('Gleicht Termine, Ereignisse und Haarschnitte zwischen deinen Geräten ab, z. B. iPhone und Laptop. Die Daten werden auf dem Gerät mit deinem Passwort verschlüsselt, bevor sie zu deinem Server gehen. Der Server kann sie nicht lesen.')];

    if (st.state === 'unconfigured') {
      parts.push(note('Der Server ist noch nicht eingerichtet.'));
    } else if (st.state === 'off') {
      const code = el('input', { type: 'password', placeholder: 'Zugangscode', value: pushToken, autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Zugangscode' });
      const pw = el('input', { type: 'password', placeholder: 'Passwort für die Verschlüsselung', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Passwort' });
      const button = el('button', { class: 'sheet-add', type: 'button', text: 'Abgleich einschalten' });
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Einen Moment …';
        try {
          await syncer.enable({ token: code.value, password: pw.value });
          onChange();
          paint('');
        } catch (err) {
          button.disabled = false;
          button.textContent = 'Abgleich einschalten';
          error.textContent = ERROR_TEXT[err.code] || 'Das hat nicht geklappt.';
        }
      });
      parts.push(
        el('div', { class: 'group' }, el('div', { class: 'row' }, code), el('div', { class: 'row' }, pw)),
        note('Den Zugangscode hast du bei der Einrichtung des Servers erhalten. Das Passwort legst du jetzt selbst fest (auf dem ersten Gerät) bzw. gibst es auf jedem weiteren Gerät wieder ein. Es wird nur auf dem Gerät gespeichert und ist nirgends sonst abrufbar: Wenn du es vergisst, sind die abgeglichenen Daten auf dem Server nicht wiederherzustellen. Auf deinen Geräten bleiben sie erhalten.', 'notes small'),
        button, error);
    } else {
      const now = el('button', { class: 'sheet-add', type: 'button', text: 'Jetzt abgleichen' });
      now.addEventListener('click', async () => {
        now.disabled = true;
        try { await syncer.sync(); onChange(); paint('Abgleich abgeschlossen.', true); } catch (err) { paint(ERROR_TEXT[err.code] || 'Das hat nicht geklappt.'); }
      });
      const off = el('button', { class: 'danger-btn', type: 'button', text: 'Ausschalten (auf diesem Gerät)' });
      off.addEventListener('click', async () => { await syncer.disable(); onChange(); paint(''); });
      parts.push(
        el('p', { class: 'status-on', text: '✓ Eingeschaltet' }),
        note(`Letzter Abgleich: ${when(st.last)}`, 'notes small'),
        st.error ? el('div', { class: 'form-error', role: 'alert', text: ERROR_TEXT[st.error] || 'Der letzte Abgleich hat nicht geklappt.' }) : null,
        now, error, off);
    }
    sheet.body.replaceChildren(...parts.filter(Boolean));
  }

  paint();
  return sheet;
}
