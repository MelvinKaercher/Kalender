// Sheet "Feiertage & Ferien": zwei Schalter.
import { el } from './dom.js';
import { openSheet } from './sheet.js';
import { getDisplay, setDisplay } from '../display.js';
import { SOURCE_NOTE } from '../school-holidays.js';

export function openDisplaySettings({ onChange = () => {} } = {}) {
  const d = getDisplay();
  const toggle = (key, label, hint) => {
    const input = el('input', { type: 'checkbox', class: 'switch', checked: d[key], 'aria-label': label });
    input.addEventListener('change', async () => {
      await setDisplay({ [key]: input.checked });
      onChange();
    });
    return el('label', { class: 'row' },
      el('span', {}, el('div', { text: label }), el('div', { class: 'row-hint', text: hint })),
      input);
  };

  const sheet = openSheet({
    title: 'Feiertage & Ferien',
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Fertig', onclick: () => sheet.close() }),
    content: [
      el('div', { class: 'group' },
        toggle('holidays', 'Feiertage', 'Gesetzliche Feiertage in Baden-Württemberg, grün markiert'),
        toggle('vacations', 'Schulferien', 'Ferien in Baden-Württemberg, gelber Balken am Tag')),
      el('p', { class: 'notes small', text: SOURCE_NOTE }),
    ],
  });
  return sheet;
}
