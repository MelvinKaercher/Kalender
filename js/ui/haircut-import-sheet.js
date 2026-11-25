// Sheet "Haarschnitte importieren": Text einfügen, Vorschau, übernehmen.
import { el } from './dom.js';
import { openSheet } from './sheet.js';
import * as store from '../store.js';
import { parseImport, splitNew, toEvent } from '../haircut-import.js';
import { fmtEuro } from '../haircuts.js';

export function openHaircutImport() {
  const area = el('textarea', {
    rows: '10', placeholder: '11.05.2026;Silas;10\n13.05.2026;Sizzar;0\n15.05.2026;Salim;10;Notiz (optional)',
    'aria-label': 'Haarschnitte als Text', autocapitalize: 'off', spellcheck: 'false',
  });
  const status = el('div', { class: 'imp-status', role: 'status' });
  const errBox = el('div', { class: 'form-error', role: 'alert' });
  const btn = el('button', { class: 'bar-btn strong', type: 'button', text: 'Importieren', disabled: true });
  let fresh = [];

  function check() {
    const { items, errors } = parseImport(area.value);
    const split = splitNew(items, store.events());
    fresh = split.fresh;
    const sum = fresh.reduce((t, i) => t + i.price, 0);
    status.textContent = area.value.trim() === '' ? ''
      : `${fresh.length} neue Haarschnitte · ${fmtEuro(sum)}${split.skipped ? ` · ${split.skipped} schon vorhanden` : ''}`;
    errBox.replaceChildren(...errors.slice(0, 5).map((e) => el('div', { text: `Zeile ${e.line}: ${e.reason}` })),
      ...(errors.length > 5 ? [el('div', { text: `… und ${errors.length - 5} weitere` })] : []));
    btn.disabled = !fresh.length || errors.length > 0;
  }
  area.addEventListener('input', check);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    for (const it of fresh) await store.saveEvent(toEvent(it));
    sheet.close();
  });

  const sheet = openSheet({
    title: 'Importieren',
    left: el('button', { class: 'bar-btn', type: 'button', text: 'Abbrechen', onclick: () => sheet.close() }),
    right: btn,
    content: [
      el('p', { class: 'form-error', style: 'color:var(--text-2)', text: 'Pro Zeile ein Haarschnitt: Datum;Name;Preis;Notiz (Notiz ist optional). Die Haarschnitte werden ganztägig und orange eingetragen. Bereits vorhandene werden übersprungen.' }),
      el('div', { class: 'group' }, el('div', { class: 'row stack' }, area)),
      status,
      errBox,
    ],
  });
  return sheet;
}
