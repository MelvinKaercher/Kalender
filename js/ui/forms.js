// Formulare (als Sheet): Termin und Geburtstag anlegen bzw. bearbeiten.
import { el, MONTHS } from './dom.js';
import { openSheet } from './sheet.js';
import * as store from '../store.js';
import { toKey, fromMinutes, toMinutes, daysInMonth } from '../calendar.js';
import { REMIND_OPTIONS } from '../reminders.js';
import { PALETTE, colorStyle, normalizeHex } from '../colors.js';

const barBtn = (label, onclick, strong = false) =>
  el('button', { class: `bar-btn${strong ? ' strong' : ''}`, type: 'button', onclick, text: label });

/** Zweistufiger Löschen-Button: erster Tipp fragt nach, zweiter löscht. */
function deleteButton(onConfirm) {
  let armed = false;
  let timer;
  const btn = el('button', {
    class: 'danger-btn', type: 'button', text: 'Löschen',
    onclick: () => {
      if (!armed) {
        armed = true;
        btn.textContent = 'Wirklich löschen?';
        btn.classList.add('confirm');
        timer = setTimeout(() => { armed = false; btn.textContent = 'Löschen'; btn.classList.remove('confirm'); }, 3500);
      } else {
        clearTimeout(timer);
        onConfirm();
      }
    },
  });
  return btn;
}

function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

/* ───────── Termin ───────── */

export function openEventForm({ event = null, date = new Date(), start = '09:00' } = {}) {
  const isNew = !event;
  const startMin = toMinutes(start);
  const d = event
    ? { ...event }
    : {
        id: null, title: '', date: toKey(date), allDay: false,
        start, end: fromMinutes(startMin + 60), note: '', remind: null,
      };
  if (!d.start) { d.start = '09:00'; d.end = '10:00'; } // ganztägige Termine behalten Zeiten für den Umschalter

  const title = el('input', { type: 'text', class: 'title', placeholder: 'Titel', value: d.title, maxlength: '120', autocomplete: 'off', enterkeyhint: 'done' });
  const allDay = el('input', { type: 'checkbox', class: 'switch', checked: d.allDay, 'aria-label': 'Ganztägig' });
  const dateIn = el('input', { type: 'date', value: d.date, required: true });
  const startIn = el('input', { type: 'time', value: d.start, step: '300' });
  const endIn = el('input', { type: 'time', value: d.end, step: '300' });
  const remindSel = el('select', { 'aria-label': 'Erinnerung' });
  const note = el('textarea', { placeholder: 'Notiz', rows: '3', maxlength: '2000' });

  // Farbe: Standard, 8 Vorschläge, freie Wahl (Farbwähler des Geräts)
  let color = normalizeHex(d.color);
  const swatchOptions = [{ value: null, name: 'Standard' }, ...PALETTE];
  const swatchButtons = swatchOptions.map((o) =>
    el('button', {
      class: `sw${o.value ? '' : ' default'}`, type: 'button', role: 'radio', 'aria-label': o.name,
      style: colorStyle(o.value), onclick: () => { color = o.value; refreshSwatches(); },
    }));
  const customInput = el('input', { type: 'color', value: color || '#3e63dd', 'aria-label': 'Eigene Farbe wählen' });
  const customSwatch = el('label', { class: 'sw custom', 'aria-label': 'Eigene Farbe' }, customInput);
  customInput.addEventListener('input', () => { color = normalizeHex(customInput.value); refreshSwatches(); });
  function refreshSwatches() {
    swatchOptions.forEach((o, i) => {
      const on = color === o.value;
      swatchButtons[i].classList.toggle('on', on);
      swatchButtons[i].setAttribute('aria-checked', String(on));
    });
    const isCustom = !!color && !PALETTE.some((p) => p.value === color);
    customSwatch.classList.toggle('on', isCustom);
    customSwatch.style.cssText = isCustom ? colorStyle(color) : '';
  }
  refreshSwatches();
  note.value = d.note || '';
  const error = el('div', { class: 'form-error', role: 'alert' });

  let remind = d.remind ?? null;
  remindSel.addEventListener('change', () => { remind = remindSel.value === '' ? null : Number(remindSel.value); });

  const startRow = el('label', { class: 'row' }, el('span', { text: 'Beginn' }), startIn);
  const endRow = el('label', { class: 'row' }, el('span', { text: 'Ende' }), endIn);

  function fillRemind() {
    const options = allDay.checked
      ? [
          { value: null, label: 'Keine' },
          { value: 0, label: 'Am Tag selbst (9:00)' },
          { value: 1440, label: '1 Tag vorher (9:00)' },
        ]
      : REMIND_OPTIONS;
    remindSel.replaceChildren(...options.map((o) => el('option', { value: o.value === null ? '' : String(o.value), text: o.label })));
    // Auswahl merken, auch wenn sie für Ganztägig nicht angeboten wird (beim Zurückschalten ist sie wieder da)
    const available = remind !== null && options.some((o) => o.value === remind);
    remindSel.value = available ? String(remind) : '';
  }

  function syncAllDay() {
    startRow.hidden = endRow.hidden = allDay.checked;
    fillRemind();
  }
  allDay.addEventListener('change', syncAllDay);
  fillRemind();
  syncAllDay();

  // Beginn verschiebt das Ende mit, wenn es sonst davor läge
  let duration = Math.max(15, toMinutes(d.end) - toMinutes(d.start));
  startIn.addEventListener('change', () => {
    if (!startIn.value) return;
    endIn.value = fromMinutes(toMinutes(startIn.value) + duration);
    error.textContent = '';
  });
  endIn.addEventListener('change', () => {
    if (startIn.value && endIn.value && toMinutes(endIn.value) > toMinutes(startIn.value)) {
      duration = toMinutes(endIn.value) - toMinutes(startIn.value);
    }
    error.textContent = '';
  });

  async function save() {
    const name = title.value.trim();
    if (!name) { error.textContent = 'Bitte einen Titel eingeben.'; shake(title.parentElement); title.focus(); return; }
    if (!dateIn.value) { error.textContent = 'Bitte ein Datum wählen.'; shake(dateIn); return; }
    if (!allDay.checked) {
      if (!startIn.value || !endIn.value) { error.textContent = 'Bitte Beginn und Ende angeben.'; return; }
      if (toMinutes(endIn.value) <= toMinutes(startIn.value)) {
        error.textContent = 'Das Ende muss nach dem Beginn liegen (am selben Tag).';
        shake(endRow);
        return;
      }
    }
    await store.saveEvent({
      id: d.id,
      title: name,
      date: dateIn.value,
      allDay: allDay.checked,
      start: allDay.checked ? null : startIn.value,
      end: allDay.checked ? null : endIn.value,
      note: note.value.trim(),
      remind: remindSel.value === '' ? null : Number(remindSel.value),
      color,
    });
    sheet.close();
  }

  const content = [
    el('div', { class: 'group' }, el('div', { class: 'row' }, title)),
    el('div', { class: 'group' },
      el('label', { class: 'row' }, el('span', { text: 'Ganztägig' }), allDay),
      el('label', { class: 'row' }, el('span', { text: 'Datum' }), dateIn),
      startRow, endRow,
    ),
    el('div', { class: 'group' }, el('label', { class: 'row' }, el('span', { text: 'Erinnerung' }), remindSel)),
    el('div', { class: 'group' },
      el('div', { class: 'row col' }, el('span', { text: 'Farbe' }),
        el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Farbe' }, swatchButtons, customSwatch))),
    el('div', { class: 'group' }, el('div', { class: 'row stack' }, note)),
    error,
    isNew ? null : deleteButton(async () => { await store.deleteEvent(d.id); sheet.close(); }),
  ];

  const sheet = openSheet({
    title: isNew ? 'Neuer Termin' : 'Termin',
    left: barBtn('Abbrechen', () => sheet.close()),
    right: barBtn(isNew ? 'Hinzufügen' : 'Sichern', save, true),
    content,
  });
  title.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), title.blur()));
  if (isNew) setTimeout(() => title.focus(), 350);
  return sheet;
}

/* ───────── Geburtstag ───────── */

export function openBirthdayForm({ birthday = null, date = new Date() } = {}) {
  const isNew = !birthday;
  const b = birthday || { id: null, name: '', day: date.getDate(), month: date.getMonth() + 1, year: null };
  const thisYear = new Date().getFullYear();

  const name = el('input', { type: 'text', class: 'title', placeholder: 'Name', value: b.name, maxlength: '80', autocomplete: 'off', enterkeyhint: 'done' });
  const daySel = el('select', { 'aria-label': 'Tag' }, Array.from({ length: 31 }, (_, i) => el('option', { value: String(i + 1), text: `${i + 1}.` })));
  const monthSel = el('select', { 'aria-label': 'Monat' }, MONTHS.map((m, i) => el('option', { value: String(i + 1), text: m })));
  daySel.value = String(b.day);
  monthSel.value = String(b.month);
  const year = el('input', { type: 'number', inputmode: 'numeric', placeholder: 'Jahr (optional)', min: '1900', max: String(thisYear), value: b.year ? String(b.year) : '', 'aria-label': 'Geburtsjahr' });
  const error = el('div', { class: 'form-error', role: 'alert' });

  async function save() {
    const n = name.value.trim();
    if (!n) { error.textContent = 'Bitte einen Namen eingeben.'; shake(name.parentElement); name.focus(); return; }
    const day = Number(daySel.value);
    const month = Number(monthSel.value);
    if (day > daysInMonth(2000, month - 1)) { error.textContent = `${MONTHS[month - 1]} hat nur ${daysInMonth(2000, month - 1)} Tage.`; shake(daySel); return; }
    let y = null;
    if (year.value.trim() !== '') {
      y = Number(year.value);
      if (!Number.isInteger(y) || y < 1900 || y > thisYear) { error.textContent = `Das Geburtsjahr muss zwischen 1900 und ${thisYear} liegen.`; shake(year); return; }
    }
    await store.saveBirthday({ id: b.id, name: n, day, month, year: y });
    sheet.close();
  }

  const content = [
    el('div', { class: 'group' }, el('div', { class: 'row' }, name)),
    el('div', { class: 'group' },
      el('div', { class: 'row' }, el('div', { class: 'split' }, daySel, monthSel)),
      el('div', { class: 'row' }, year),
    ),
    el('p', { class: 'form-error', style: 'color:var(--text-2)', text: 'Der Geburtstag wiederholt sich automatisch jedes Jahr. Mit Geburtsjahr zeigt die App das Alter an.' }),
    error,
    isNew ? null : deleteButton(async () => { await store.deleteBirthday(b.id); sheet.close(); }),
  ];

  const sheet = openSheet({
    title: isNew ? 'Neuer Geburtstag' : 'Geburtstag',
    left: barBtn('Abbrechen', () => sheet.close()),
    right: barBtn(isNew ? 'Hinzufügen' : 'Sichern', save, true),
    content,
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), name.blur()));
  if (isNew) setTimeout(() => name.focus(), 350);
  return sheet;
}
