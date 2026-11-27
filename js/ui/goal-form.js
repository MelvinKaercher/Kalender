// Vorsatz anlegen/bearbeiten (Sheet): Titel, Ziel/Notiz, Erinnerung (Uhrzeit + Wochentage), erreicht, löschen.
import { el } from './dom.js';
import { openSheet } from './sheet.js';
import * as store from '../store.js';
import { showToast } from './toast.js';
import { ALL_DAYS, DAY_LABELS } from '../goals.js';

const barBtn = (label, onclick, strong = false) =>
  el('button', { class: `bar-btn${strong ? ' strong' : ''}`, type: 'button', onclick, text: label });

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo … So

function shake(node) { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }

export function openGoalForm({ goal = null } = {}) {
  const isNew = !goal;
  const g = goal || { id: null, title: '', note: '', remind: null, checks: [], done: false };
  const title = el('input', { type: 'text', class: 'title', placeholder: 'Vorsatz, z. B. Mehr Englisch lernen', value: g.title, maxlength: '120', autocomplete: 'off', enterkeyhint: 'done' });
  const note = el('textarea', { class: 'plain', placeholder: 'Ziel / Notiz, z. B. 20 Minuten Vokabeln', rows: '3', maxlength: '200' });
  note.value = g.note || '';
  const remindOn = el('input', { type: 'checkbox', class: 'switch', checked: !!g.remind, 'aria-label': 'Erinnerung' });
  const timeIn = el('input', { type: 'time', value: g.remind ? g.remind.time : '19:00', step: '300', 'aria-label': 'Uhrzeit' });
  let days = new Set(g.remind && g.remind.days && g.remind.days.length ? g.remind.days : ALL_DAYS);
  const error = el('div', { class: 'form-error', role: 'alert' });

  const dayButtons = WEEK_ORDER.map((d) =>
    el('button', { class: 'day-chip', type: 'button', role: 'checkbox', 'data-day': String(d), onclick: () => { days.has(d) ? days.delete(d) : days.add(d); paintDays(); } }, DAY_LABELS[d]));
  const everyDay = el('button', { class: 'text-btn small', type: 'button', onclick: () => { days = new Set(ALL_DAYS); paintDays(); }, text: 'Täglich' });
  function paintDays() {
    dayButtons.forEach((b) => {
      const on = days.has(Number(b.dataset.day));
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    error.textContent = '';
  }
  paintDays();

  const remindRows = el('div', { class: 'group' },
    el('label', { class: 'row' }, el('span', { text: 'Uhrzeit' }), timeIn),
    el('div', { class: 'row col' }, el('div', { class: 'days-head' }, el('span', { text: 'An diesen Tagen' }), everyDay), el('div', { class: 'day-chips' }, dayButtons)));
  const syncRemind = () => { remindRows.hidden = !remindOn.checked; error.textContent = ''; };
  remindOn.addEventListener('change', syncRemind);
  syncRemind();

  async function save(extra = {}) {
    const name = title.value.trim();
    if (!name) { error.textContent = 'Bitte einen Vorsatz eingeben.'; shake(title.parentElement); title.focus(); return; }
    if (remindOn.checked && days.size === 0) { error.textContent = 'Wähle mindestens einen Tag für die Erinnerung.'; return; }
    if (remindOn.checked && !timeIn.value) { error.textContent = 'Bitte eine Uhrzeit wählen.'; return; }
    await store.saveGoal({
      ...g,
      title: name,
      note: note.value.trim(),
      remind: remindOn.checked ? { time: timeIn.value, days: [...days].sort() } : null,
      ...extra,
    });
    sheet.close();
  }

  function deleteButton() {
    let armed = false;
    let timer;
    const btn = el('button', {
      class: 'danger-btn', type: 'button', text: 'Löschen',
      onclick: async () => {
        if (!armed) {
          armed = true; btn.textContent = 'Wirklich löschen?'; btn.classList.add('confirm');
          timer = setTimeout(() => { armed = false; btn.textContent = 'Löschen'; btn.classList.remove('confirm'); }, 3500);
          return;
        }
        clearTimeout(timer);
        await store.deleteGoal(g.id);
        sheet.close();
        showToast('Vorsatz gelöscht', 'Rückgängig', () => store.restoreGoal(goal));
      },
    });
    return btn;
  }

  const content = [
    el('div', { class: 'group' }, el('div', { class: 'row' }, title)),
    el('div', { class: 'group' }, el('div', { class: 'row stack' }, note)),
    el('div', { class: 'group' }, el('label', { class: 'row' }, el('span', { text: 'Erinnerung' }), remindOn)),
    remindRows,
    error,
    isNew ? null : el('button', { class: 'sheet-add', type: 'button', text: g.done ? 'Wieder aktivieren' : 'Als erreicht markieren ✓',
      onclick: () => save(g.done ? { done: false, doneAt: undefined } : { done: true, doneAt: Date.now() }) }),
    isNew ? null : deleteButton(),
  ];

  const sheet = openSheet({
    title: isNew ? 'Neuer Vorsatz' : 'Vorsatz',
    left: barBtn('Abbrechen', () => sheet.close()),
    right: barBtn(isNew ? 'Hinzufügen' : 'Sichern', () => save(), true),
    content,
  });
  title.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), title.blur()));
  if (isNew) setTimeout(() => title.focus(), 350);
  return sheet;
}
