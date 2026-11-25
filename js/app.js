// Einstieg: Zustand (Ansicht + Cursor), Navigation, Gesten, Erinnerungen.
import * as store from './store.js';
import { el, clear, MONTHS, fmtDayShort } from './ui/dom.js';
import { startOfDay, addDays, addMonths, isSameMonth, isSameDay, isoWeek, startOfWeek, weekDays, toKey } from './calendar.js';
import { renderMonth } from './ui/month.js';
import { renderWeek } from './ui/week.js';
import { renderBirthdays } from './ui/birthdays-view.js';
import { openDaySheet } from './ui/day-sheet.js';
import { openEventForm, openBirthdayForm } from './ui/forms.js';
import { syncBanners } from './ui/banner.js';
import { dueReminders } from './reminders.js';

const $ = (sel) => document.querySelector(sel);
const VIEWS = ['month', 'week', 'birthdays'];

function savedView() {
  try {
    const v = localStorage.getItem('kalender.view');
    return VIEWS.includes(v) ? v : 'month';
  } catch { return 'month'; }
}

const state = { view: savedView(), cursor: startOfDay(new Date()) };
let renderedDay = toKey(new Date());

/* ───────── Rendering ───────── */

function renderHeader(today) {
  const title = $('#title');
  clear(title);
  const { view, cursor } = state;
  let showToday = false;

  if (view === 'month') {
    title.append(MONTHS[cursor.getMonth()], el('span', { class: 'sub', text: String(cursor.getFullYear()) }));
    showToday = !isSameMonth(cursor, today);
  } else if (view === 'week') {
    const days = weekDays(cursor);
    const [first, last] = [days[0], days[6]];
    const range = first.getMonth() === last.getMonth()
      ? `${first.getDate()}.–${fmtDayShort(last)}`
      : `${fmtDayShort(first)} – ${fmtDayShort(last)}`;
    title.append(`KW ${isoWeek(cursor)}`, el('span', { class: 'sub', text: range }));
    showToday = toKey(startOfWeek(cursor)) !== toKey(startOfWeek(today));
  } else {
    title.append('Geburtstage');
  }

  $('#btn-today').hidden = !showToday;
  $('#btn-add').setAttribute('aria-label', view === 'birthdays' ? 'Geburtstag hinzufügen' : 'Termin hinzufügen');
  document.querySelectorAll('#tabbar button').forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle('active', active);
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function render(anim = null) {
  const now = new Date();
  const today = startOfDay(now);
  renderedDay = toKey(now);
  renderHeader(today);

  const view = $('#view');
  view.className = anim ? `anim-${anim}` : '';
  clear(view);

  const ctx = {
    cursor: state.cursor,
    today,
    now,
    events: store.events(),
    birthdays: store.birthdays(),
    onDay: (date) => openDaySheet(date),
    onEvent: (event) => openEventForm({ event }),
    onBirthday: (birthday) => openBirthdayForm({ birthday }),
    onNewEvent: (date, start) => openEventForm({ date, start }),
    onAdd: () => openBirthdayForm({}),
  };
  if (state.view === 'month') renderMonth(view, ctx);
  else if (state.view === 'week') renderWeek(view, ctx);
  else renderBirthdays(view, ctx);
}

/* ───────── Navigation ───────── */

function setView(view) {
  if (view === state.view) return;
  state.view = view;
  try { localStorage.setItem('kalender.view', view); } catch { /* optional */ }
  render('fade');
}

/** delta: +1 = vor, -1 = zurück (Monat bzw. Woche) */
function go(delta) {
  if (state.view === 'birthdays') return;
  const today = startOfDay(new Date());
  if (state.view === 'month') {
    const target = addMonths(state.cursor, delta);
    state.cursor = isSameMonth(target, today) ? today : target;
  } else {
    state.cursor = addDays(state.cursor, 7 * delta);
  }
  render(delta > 0 ? 'next' : 'prev');
}

function goToday() {
  const today = startOfDay(new Date());
  const dir = state.cursor < today ? 'next' : 'prev';
  state.cursor = today;
  render(dir);
}

/** Neuer Termin: im Monat am Cursor-Tag, in der Woche heute (falls sichtbar) sonst Wochenstart. */
function addForCurrentView() {
  if (state.view === 'birthdays') return openBirthdayForm({});
  const today = startOfDay(new Date());
  if (state.view === 'week') {
    const inWeek = weekDays(state.cursor).some((d) => isSameDay(d, today));
    return openEventForm({ date: inWeek ? today : startOfWeek(state.cursor) });
  }
  openEventForm({ date: state.cursor });
}

$('#btn-today').addEventListener('click', goToday);
$('#btn-add').addEventListener('click', addForCurrentView);
document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

// Wischen: links = vor, rechts = zurück
(() => {
  const view = $('#view');
  let x0 = 0, y0 = 0, t0 = 0, tracking = false;
  view.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    ({ clientX: x0, clientY: y0 } = e.touches[0]);
    t0 = Date.now();
    tracking = true;
  }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0 < 700) go(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

/* ───────── Erinnerungen ───────── */

function checkReminders() {
  const due = dueReminders({ events: store.events(), birthdays: store.birthdays(), seen: store.seen(), now: new Date() });
  syncBanners(due, {
    onDismiss: (item) => store.markSeen(item.key),
    onOpen: (item) => (item.kind === 'birthday' ? openBirthdayForm({ birthday: item.birthday }) : openEventForm({ event: item.event })),
  });
}

/* ───────── Start ───────── */

async function start() {
  await store.load();
  store.onChange(() => { render(); checkReminders(); });
  render();
  checkReminders();

  setInterval(() => {
    // Tageswechsel (App blieb über Mitternacht offen): "heute" neu markieren
    if (toKey(new Date()) !== renderedDay) render();
    checkReminders();
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    render();
    checkReminders();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
  }
}

start();
