// Formulare (als Sheet): Termin und Geburtstag anlegen bzw. bearbeiten.
import { el, MONTHS } from './dom.js';
import { openSheet } from './sheet.js';
import * as store from '../store.js';
import { toKey, fromMinutes, toMinutes, daysInMonth } from '../calendar.js';
import { REMIND_OPTIONS } from '../reminders.js';
import { EVENT_TYPES, typeOf } from '../birthdays.js';
import { PALETTE, colorStyle, normalizeHex } from '../colors.js';
import { showToast } from './toast.js';
import { HAIRCUT_COLOR, HAIRCUT_TITLE, parseEuro, lastPrices, customerKey } from '../haircuts.js';

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

export function openEventForm({ event = null, date = new Date(), start = '09:00', haircut = false, prefill = null } = {}) {
  if (event && event.vacation) return openVacationForm({ event });
  const isNew = !event;
  const startMin = toMinutes(start);
  const d = event
    ? { ...event }
    : {
        id: null, title: '', date: toKey(date), allDay: false,
        start, end: fromMinutes(startMin + 60), note: '', remind: null,
        ...(prefill || {}),
      };
  if (!d.start) { d.start = '09:00'; d.end = '10:00'; } // ganztägige Termine behalten Zeiten für den Umschalter

  const title = el('input', { type: 'text', class: 'title', placeholder: 'Titel', value: d.title, maxlength: '120', autocomplete: 'off', enterkeyhint: 'done' });
  const allDay = el('input', { type: 'checkbox', class: 'switch', checked: d.allDay, 'aria-label': 'Ganztägig' });
  const dateIn = el('input', { type: 'date', value: d.date, required: true });
  const untilIn = el('input', { type: 'date', value: d.endDate || '', min: d.date, 'aria-label': 'Bis (optional)' });
  const startIn = el('input', { type: 'time', value: d.start, step: '300' });
  const endIn = el('input', { type: 'time', value: d.end, step: '300' });
  const remindSel = el('select', { 'aria-label': 'Erinnerung' });
  const note = el('textarea', { placeholder: 'Notiz', rows: '3', maxlength: '2000' });

  // Haareschneiden: Schalter + Kunde, Preis, Trinkgeld (Termin wird automatisch orange)
  const hcData = d.haircut || {};
  const hcSwitch = el('input', { type: 'checkbox', class: 'switch', checked: !!d.haircut || (isNew && haircut), 'aria-label': 'Haareschneiden' });
  const euroValue = (v) => (v || v === 0 ? String(v).replace('.', ',') : '');
  const customerIn = el('input', { type: 'text', placeholder: 'Kunde (optional)', value: hcData.customer || '', maxlength: '80', autocomplete: 'off' });
  const priceIn = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: euroValue(hcData.price), 'aria-label': 'Preis in Euro', autocomplete: 'off' });
  const tipIn = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: euroValue(hcData.tip), 'aria-label': 'Trinkgeld in Euro', autocomplete: 'off' });
  // Bekannte Kunden vorschlagen; Preis wird vom letzten Besuch übernommen, solange das Feld leer ist
  const known = new Map();
  for (const e of store.events()) if (e.haircut && e.haircut.customer) known.set(customerKey(e.haircut.customer), e.haircut.customer.trim());
  const priceMemory = lastPrices(store.events());
  const listId = `kunden-${Math.random().toString(36).slice(2, 7)}`;
  customerIn.setAttribute('list', listId);
  const customerList = el('datalist', { id: listId }, [...known.values()].sort((a, b) => a.localeCompare(b, 'de')).map((n) => el('option', { value: n })));
  const fillPrice = () => {
    const p = priceMemory.get(customerKey(customerIn.value));
    if (p !== undefined && priceIn.value.trim() === '') priceIn.value = euroValue(p);
  };
  customerIn.addEventListener('change', fillPrice);
  customerIn.addEventListener('blur', fillPrice);
  const hcGroup = el('div', { class: 'group', 'data-role': 'haircut-fields' }, customerList,
    el('label', { class: 'row' }, el('span', { text: 'Kunde' }), customerIn),
    el('label', { class: 'row' }, el('span', { text: 'Preis (€)' }), priceIn),
    el('label', { class: 'row' }, el('span', { text: 'Trinkgeld (€)' }), tipIn));

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
  const untilRow = el('label', { class: 'row' }, el('span', { text: 'Bis (mehrtägig)' }), untilIn);
  dateIn.addEventListener('change', () => {
    untilIn.min = dateIn.value;
    if (untilIn.value && dateIn.value && untilIn.value < dateIn.value) untilIn.value = dateIn.value;
  });

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
    untilRow.hidden = !allDay.checked;
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

  const colorGroup = el('div', { class: 'group' },
    el('div', { class: 'row col' }, el('span', { text: 'Farbe' }),
      el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Farbe' }, swatchButtons, customSwatch)));
  function syncHaircut() {
    hcGroup.hidden = !hcSwitch.checked;
    colorGroup.hidden = hcSwitch.checked;
    title.placeholder = hcSwitch.checked ? HAIRCUT_TITLE : 'Titel';
    error.textContent = '';
  }
  hcSwitch.addEventListener('change', syncHaircut);
  syncHaircut();

  async function save() {
    let name = title.value.trim();
    let hc;
    if (hcSwitch.checked) {
      const price = parseEuro(priceIn.value);
      const tip = parseEuro(tipIn.value);
      if (Number.isNaN(price)) { error.textContent = 'Bitte den Preis als Zahl eingeben, z. B. 25 oder 25,50.'; shake(priceIn); priceIn.focus(); return; }
      if (Number.isNaN(tip)) { error.textContent = 'Bitte das Trinkgeld als Zahl eingeben, z. B. 3 oder 2,50.'; shake(tipIn); tipIn.focus(); return; }
      const customer = customerIn.value.trim();
      hc = { customer, price, tip };
      if (!name) name = customer ? `${HAIRCUT_TITLE} · ${customer}` : HAIRCUT_TITLE;
    }
    if (!name) { error.textContent = 'Bitte einen Titel eingeben.'; shake(title.parentElement); title.focus(); return; }
    if (!dateIn.value) { error.textContent = 'Bitte ein Datum wählen.'; shake(dateIn); return; }
    if (allDay.checked && untilIn.value && untilIn.value < dateIn.value) {
      error.textContent = 'Das Enddatum darf nicht vor dem Beginn liegen.'; shake(untilIn); return;
    }
    if (!allDay.checked) {
      if (!startIn.value || !endIn.value) { error.textContent = 'Bitte Beginn und Ende angeben.'; return; }
      if (toMinutes(endIn.value) <= toMinutes(startIn.value)) {
        error.textContent = 'Das Ende muss nach dem Beginn liegen (am selben Tag).';
        shake(endRow);
        return;
      }
    }
    const candidate = {
      id: d.id,
      title: name,
      date: dateIn.value,
      allDay: allDay.checked,
      endDate: allDay.checked && untilIn.value && untilIn.value > dateIn.value ? untilIn.value : undefined,
      start: allDay.checked ? null : startIn.value,
      end: allDay.checked ? null : endIn.value,
      note: note.value.trim(),
      remind: remindSel.value === '' ? null : Number(remindSel.value),
      color: hc ? HAIRCUT_COLOR : color,
      haircut: hc || undefined,
    };
    await store.saveEvent(candidate);
    sheet.close();
  }

  const content = [
    el('div', { class: 'group' }, el('div', { class: 'row' }, title)),
    el('div', { class: 'group' },
      el('label', { class: 'row' }, el('span', { text: 'Ganztägig' }), allDay),
      el('label', { class: 'row' }, el('span', { text: 'Datum' }), dateIn),
      untilRow, startRow, endRow,
    ),
    el('div', { class: 'group' }, el('label', { class: 'row' }, el('span', { text: 'Haareschneiden ✂︎' }), hcSwitch)),
    hcGroup,
    el('div', { class: 'group' }, el('label', { class: 'row' }, el('span', { text: 'Erinnerung' }), remindSel)),
    colorGroup,
    el('div', { class: 'group' }, el('div', { class: 'row stack' }, note)),
    error,
    isNew ? null : deleteButton(async () => { await store.deleteEvent(d.id); sheet.close(); showToast('Termin gelöscht', 'Rückgängig', () => store.restoreEvent(event)); }),
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

/* ───────── Urlaub (von … bis …, ganztägig, in allen Ansichten markiert) ───────── */

export const VACATION_COLOR = '#12a594';
export const VACATION_TITLE = 'Urlaub';

export function openVacationForm({ event = null, date = new Date(), prefill = null } = {}) {
  const isNew = !event;
  const from0 = event ? event.date : (prefill && prefill.date) || toKey(date);
  const to0 = event ? event.endDate || event.date : (prefill && prefill.endDate) || from0;
  const name = el('input', { type: 'text', class: 'title', placeholder: VACATION_TITLE, value: event ? event.title : (prefill && prefill.title !== 'Urlaub' && prefill.title) || '', maxlength: '120', autocomplete: 'off', enterkeyhint: 'done' });
  const fromIn = el('input', { type: 'date', value: from0, required: true, 'aria-label': 'Von' });
  const toIn = el('input', { type: 'date', value: to0, min: from0, required: true, 'aria-label': 'Bis' });
  const error = el('div', { class: 'form-error', role: 'alert' });
  fromIn.addEventListener('change', () => {
    toIn.min = fromIn.value;
    if (fromIn.value && (!toIn.value || toIn.value < fromIn.value)) toIn.value = fromIn.value;
    error.textContent = '';
  });

  async function save() {
    if (!fromIn.value || !toIn.value) { error.textContent = 'Bitte „Von“ und „Bis“ wählen.'; return; }
    if (toIn.value < fromIn.value) { error.textContent = '„Bis“ darf nicht vor „Von“ liegen.'; shake(toIn); return; }
    await store.saveEvent({
      ...(event || {}),
      id: event ? event.id : null,
      title: name.value.trim() || VACATION_TITLE,
      date: fromIn.value,
      endDate: toIn.value > fromIn.value ? toIn.value : undefined,
      allDay: true, start: null, end: null,
      note: event ? event.note || '' : '',
      remind: null,
      color: VACATION_COLOR,
      vacation: true,
    });
    sheet.close();
  }

  const sheet = openSheet({
    title: isNew ? 'Neuer Urlaub' : 'Urlaub',
    left: barBtn('Abbrechen', () => sheet.close()),
    right: barBtn(isNew ? 'Hinzufügen' : 'Sichern', save, true),
    content: [
      el('div', { class: 'group' }, el('div', { class: 'row' }, name)),
      el('div', { class: 'group' },
        el('label', { class: 'row' }, el('span', { text: 'Von' }), fromIn),
        el('label', { class: 'row' }, el('span', { text: 'Bis' }), toIn)),
      error,
      isNew ? null : deleteButton(async () => { await store.deleteEvent(event.id); sheet.close(); showToast('Urlaub gelöscht', 'Rückgängig', () => store.restoreEvent(event)); }),
    ],
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), name.blur()));
  return sheet;
}

/* ───────── Ereignis (Geburtstag, Sonstiges – jedes Jahr wiederkehrend) ───────── */

// Beschriftungen je Typ
const TYPE_TEXT = {
  birthday: {
    name: 'Name', year: 'Geburtsjahr (optional)', yearLabel: 'Geburtsjahr', yearWord: 'Geburtsjahr',
    hint: 'Der Geburtstag wiederholt sich automatisch jedes Jahr. Mit Geburtsjahr zeigt die App das Alter an.',
  },
  other: {
    name: 'Titel, z. B. Namenstag', year: 'Startjahr (optional)', yearLabel: 'Startjahr', yearWord: 'Startjahr',
    hint: 'Das Ereignis wiederholt sich automatisch jedes Jahr. Mit Startjahr zeigt die App „seit N Jahren" an.',
  },
};

export function openBirthdayForm({ birthday = null, date = new Date() } = {}) {
  const isNew = !birthday;
  const b = birthday || { id: null, name: '', day: date.getDate(), month: date.getMonth() + 1, year: null };
  const thisYear = new Date().getFullYear();
  let type = typeOf(b);

  const name = el('input', { type: 'text', class: 'title', value: b.name, maxlength: '80', autocomplete: 'off', enterkeyhint: 'done' });
  const daySel = el('select', { 'aria-label': 'Tag' }, Array.from({ length: 31 }, (_, i) => el('option', { value: String(i + 1), text: `${i + 1}.` })));
  const monthSel = el('select', { 'aria-label': 'Monat' }, MONTHS.map((m, i) => el('option', { value: String(i + 1), text: m })));
  daySel.value = String(b.day);
  monthSel.value = String(b.month);
  const year = el('input', { type: 'number', inputmode: 'numeric', min: '1900', max: String(thisYear), value: b.year ? String(b.year) : '' });
  const hint = el('p', { class: 'form-error', style: 'color:var(--text-2)' });
  const error = el('div', { class: 'form-error', role: 'alert' });

  // Typ-Auswahl: Geburtstag | Sonstiges
  const typeButtons = Object.entries(EVENT_TYPES).map(([key, info]) =>
    el('button', { class: 'seg-btn', type: 'button', role: 'radio', 'data-type': key, onclick: () => { type = key; paintType(); } },
      `${info.emoji} ${info.label}`));
  function paintType() {
    const t = TYPE_TEXT[type];
    typeButtons.forEach((btn) => {
      const on = btn.dataset.type === type;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-checked', String(on));
    });
    name.placeholder = t.name;
    year.placeholder = t.year;
    year.setAttribute('aria-label', t.yearLabel);
    hint.textContent = t.hint;
    error.textContent = '';
  }
  paintType();
  if (isNew) {
    typeButtons.push(el('button', {
      class: 'seg-btn', type: 'button', role: 'radio', 'aria-checked': 'false',
      onclick: () => { sheet.close(); setTimeout(() => openVacationForm({ date }), 320); },
    }, '🌴 Urlaub'));
  }

  async function save() {
    const n = name.value.trim();
    if (!n) { error.textContent = type === 'birthday' ? 'Bitte einen Namen eingeben.' : 'Bitte einen Titel eingeben.'; shake(name.parentElement); name.focus(); return; }
    const day = Number(daySel.value);
    const month = Number(monthSel.value);
    if (day > daysInMonth(2000, month - 1)) { error.textContent = `${MONTHS[month - 1]} hat nur ${daysInMonth(2000, month - 1)} Tage.`; shake(daySel); return; }
    let y = null;
    if (year.value.trim() !== '') {
      y = Number(year.value);
      if (!Number.isInteger(y) || y < 1900 || y > thisYear) { error.textContent = `Das ${TYPE_TEXT[type].yearWord} muss zwischen 1900 und ${thisYear} liegen.`; shake(year); return; }
    }
    await store.saveBirthday({ id: b.id, name: n, day, month, year: y, type });
    sheet.close();
  }

  const content = [
    el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Art des Ereignisses' }, typeButtons),
    el('div', { class: 'group' }, el('div', { class: 'row' }, name)),
    el('div', { class: 'group' },
      el('div', { class: 'row' }, el('div', { class: 'split' }, daySel, monthSel)),
      el('div', { class: 'row' }, year),
    ),
    hint,
    error,
    isNew ? null : deleteButton(async () => { await store.deleteBirthday(b.id); sheet.close(); showToast('Ereignis gelöscht', 'Rückgängig', () => store.restoreBirthday(birthday)); }),
  ];

  const sheet = openSheet({
    title: isNew ? 'Neues Ereignis' : 'Ereignis',
    left: barBtn('Abbrechen', () => sheet.close()),
    right: barBtn(isNew ? 'Hinzufügen' : 'Sichern', save, true),
    content,
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), name.blur()));
  if (isNew) setTimeout(() => name.focus(), 350);
  return sheet;
}
