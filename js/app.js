// Einstieg: Zustand (Ansicht + Cursor), Navigation, Gesten, Erinnerungen.
import * as store from './store.js';
import { el, clear, MONTHS, fmtDayShort } from './ui/dom.js';
import { startOfDay, addDays, addMonths, isSameMonth, isSameDay, isoWeek, startOfWeek, weekDays, toKey } from './calendar.js';
import { renderMonth } from './ui/month.js';
import { renderWeek } from './ui/week.js';
import { renderYear } from './ui/year.js';
import { openDisplaySettings } from './ui/display-settings.js';
import { renderBirthdays } from './ui/birthdays-view.js';
import { renderHaircuts } from './ui/haircuts-view.js';
import { openDaySheet } from './ui/day-sheet.js';
import { openEventForm, openBirthdayForm } from './ui/forms.js';
import { syncBanners } from './ui/banner.js';
import { dueReminders } from './reminders.js';
import config from './config.js';
import { createPush } from './push.js';
import { createSync } from './sync.js';
import { openSyncSettings } from './ui/sync-settings.js';
import { openNotificationSettings } from './ui/settings.js';
import { getDisplay } from './display.js';

const $ = (sel) => document.querySelector(sel);
const VIEWS = ['month', 'week', 'year', 'haircuts', 'birthdays'];

function savedView() {
  try {
    const v = localStorage.getItem('kalender.view');
    return VIEWS.includes(v) ? v : 'month';
  } catch { return 'month'; }
}

const state = { view: savedView(), cursor: startOfDay(new Date()) };
const push = createPush({ config, meta: store.meta, getBirthdays: () => store.birthdays() });
const syncer = createSync({ config, meta: store.meta, store });
let renderedDay = toKey(new Date());

/* ───────── Rendering ───────── */

function renderHeader(today) {
  const title = $('#title');
  clear(title);
  const { view, cursor } = state;
  let showToday = false;

  if (view === 'month') {
    title.append(MONTHS[cursor.getMonth()], ' ', el('span', { class: 'sub', text: String(cursor.getFullYear()) }));
    showToday = !isSameMonth(cursor, today);
  } else if (view === 'week') {
    const days = weekDays(cursor);
    const [first, last] = [days[0], days[6]];
    const range = first.getMonth() === last.getMonth()
      ? `${first.getDate()}.–${fmtDayShort(last)}`
      : `${fmtDayShort(first)} – ${fmtDayShort(last)}`;
    title.append(`KW ${isoWeek(cursor)}`, ' ', el('span', { class: 'sub small', text: range }));
    showToday = toKey(startOfWeek(cursor)) !== toKey(startOfWeek(today));
  } else if (view === 'year') {
    title.append(String(cursor.getFullYear()));
    showToday = cursor.getFullYear() !== today.getFullYear();
  } else if (view === 'haircuts') {
    title.append('Haare ', el('span', { class: 'sub', text: String(cursor.getFullYear()) }));
    showToday = cursor.getFullYear() !== today.getFullYear();
  } else {
    title.append('Ereignisse');
  }

  // Im Monat ist der Titel ein Knopf: Tipp = herauszoomen zur Jahresansicht
  const zoomable = view === 'month';
  title.classList.toggle('tappable', zoomable);
  if (zoomable) { title.setAttribute('role', 'button'); title.setAttribute('aria-label', `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}, Jahresansicht öffnen`); }
  else { title.removeAttribute('role'); title.removeAttribute('aria-label'); }

  $('#nav').hidden = view === 'birthdays';
  $('#btn-today').hidden = !showToday;
  const unit = { week: 'Woche', year: 'Jahr', haircuts: 'Jahr' }[view] || 'Monat';
  $('#btn-prev').setAttribute('aria-label', { Monat: 'Vorheriger Monat', Woche: 'Vorherige Woche', Jahr: 'Vorheriges Jahr' }[unit]);
  $('#btn-next').setAttribute('aria-label', { Monat: 'Nächster Monat', Woche: 'Nächste Woche', Jahr: 'Nächstes Jahr' }[unit]);
  $('#btn-today').setAttribute('aria-label', unit === 'Jahr' ? 'Zum aktuellen Jahr' : `Zur aktuellen ${unit}`);
  $('#btn-add').setAttribute('aria-label', view === 'birthdays' ? 'Ereignis hinzufügen' : view === 'haircuts' ? 'Haarschnitt hinzufügen' : 'Termin hinzufügen');
  document.querySelectorAll('#tabbar button').forEach((b) => {
    const active = b.dataset.view === (view === 'year' ? 'month' : view);
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
    display: getDisplay(),
    onDay: (date) => openDaySheet(date),
    // Monat: Tipp auf einen Tag öffnet die Woche dieses Tages (dort per Halten auf die Uhrzeit eintragen)
    onPickDay: (date) => { state.cursor = date; setView('week', 'zoom-in'); },
    onEvent: (event) => openEventForm({ event }),
    onBirthday: (birthday) => openBirthdayForm({ birthday }),
    onNewEvent: (date, start) => openEventForm({ date, start }),
    onMoveEvent: (event, changes) => store.saveEvent({ ...event, ...changes }),
    onAdd: () => openBirthdayForm({}),
    onAddHaircut: () => openEventForm({ date: today, haircut: true }),
    pushStatus: push.status(),
    syncStatus: syncer.status(),
    onSync: () => openSyncSettings({ syncer, pushToken: store.meta.get('push')?.token || '', onChange: () => render() }),
    onNotifications: () => openNotificationSettings({ push, onChange: () => render() }),
    onSettings: () => openDisplaySettings({ onChange: () => render() }),
    onMonth: (year, month0) => openMonth(year, month0),
  };
  if (state.view === 'month') renderMonth(view, ctx);
  else if (state.view === 'week') renderWeek(view, ctx);
  else if (state.view === 'year') renderYear(view, ctx);
  else if (state.view === 'haircuts') renderHaircuts(view, ctx);
  else renderBirthdays(view, ctx);
}

/* ───────── Navigation ───────── */

function setView(view, anim = 'fade') {
  if (view === state.view) return;
  state.view = view;
  try { localStorage.setItem('kalender.view', view); } catch { /* optional */ }
  render(anim);
}

/** Herauszoomen: vom Monat zur Jahresansicht. */
const zoomOut = () => state.view === 'month' && setView('year', 'zoom-out');

/** Hineinzoomen: einen Monat aus der Jahresansicht öffnen. */
function openMonth(year, month0) {
  const today = startOfDay(new Date());
  const target = new Date(year, month0, 1);
  state.cursor = isSameMonth(target, today) ? today : target;
  setView('month', 'zoom-in');
}

/** delta: +1 = vor, -1 = zurück (Monat bzw. Woche) */
function go(delta) {
  if (state.view === 'birthdays') return;
  const today = startOfDay(new Date());
  if (state.view === 'month') {
    const target = addMonths(state.cursor, delta);
    state.cursor = isSameMonth(target, today) ? today : target;
  } else if (state.view === 'year' || state.view === 'haircuts') {
    const target = new Date(state.cursor.getFullYear() + delta, 0, 1);
    state.cursor = target.getFullYear() === today.getFullYear() ? today : target;
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
  if (state.view === 'haircuts') return openEventForm({ date: startOfDay(new Date()), haircut: true });
  const today = startOfDay(new Date());
  if (state.view === 'week') {
    const inWeek = weekDays(state.cursor).some((d) => isSameDay(d, today));
    return openEventForm({ date: inWeek ? today : startOfWeek(state.cursor) });
  }
  if (state.view === 'year') {
    const inYear = state.cursor.getFullYear() === today.getFullYear();
    return openEventForm({ date: inYear ? today : state.cursor });
  }
  openEventForm({ date: state.cursor });
}

$('#btn-today').addEventListener('click', goToday);
$('#btn-prev').addEventListener('click', () => go(-1));
$('#btn-next').addEventListener('click', () => go(1));
// Pfeiltasten (z. B. am Rechner), wenn gerade kein Sheet/Eingabefeld aktiv ist
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select') || document.querySelector('.sheet')) return;
  if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'ArrowRight') go(1);
});
$('#btn-add').addEventListener('click', addForCurrentView);
$('#title').addEventListener('click', zoomOut);
document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

// Wischen: links = vor, rechts = zurück. Zwei Finger: zusammenziehen = herauszoomen (Monat → Jahr),
// auseinanderziehen = hineinzoomen (Jahr → Monat unter den Fingern).
(() => {
  const view = $('#view');
  let x0 = 0, y0 = 0, t0 = 0, tracking = false;
  let pinch = null; // { dist, cx, cy, ratio }
  const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const center = (t) => ({ cx: (t[0].clientX + t[1].clientX) / 2, cy: (t[0].clientY + t[1].clientY) / 2 });

  // iOS würde sonst die ganze Seite zoomen
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());

  view.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      tracking = false;
      pinch = { dist: spread(e.touches), ...center(e.touches), ratio: 1 };
      return;
    }
    if (e.touches.length !== 1 || pinch) { tracking = false; return; }
    ({ clientX: x0, clientY: y0 } = e.touches[0]);
    t0 = Date.now();
    tracking = true;
  }, { passive: true });

  view.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    pinch.ratio = spread(e.touches) / pinch.dist;
  }, { passive: false });

  view.addEventListener('touchend', (e) => {
    if (pinch) {
      if (e.touches.length === 0) {
        const { ratio, cx, cy } = pinch;
        pinch = null;
        if (state.view === 'month' && ratio < 0.78) zoomOut();
        else if (state.view === 'year' && ratio > 1.3) {
          const mini = document.elementFromPoint(cx, cy)?.closest?.('[data-month]');
          const today = startOfDay(new Date());
          if (mini) openMonth(Number(mini.dataset.year), Number(mini.dataset.month));
          else openMonth(state.cursor.getFullYear(), state.cursor.getFullYear() === today.getFullYear() ? today.getMonth() : 0);
        }
      }
      return;
    }
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0 < 700) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  view.addEventListener('touchcancel', () => { pinch = null; tracking = false; }, { passive: true });
})();

/* ───────── Erinnerungen ───────── */

function checkReminders() {
  const due = dueReminders({ events: store.events(), birthdays: store.birthdays(), seen: store.seen(), now: new Date() });
  syncBanners(due, {
    onDismiss: (item) => store.markSeen(item.key),
    onOpen: (item) => (item.kind === 'birthday' ? openBirthdayForm({ birthday: item.birthday }) : openEventForm({ event: item.event })),
  });
}

/* ───────── Push: Ereignisse (Geburtstage …) beim Server aktuell halten ───────── */

const birthdaySignature = () => JSON.stringify(store.birthdays().map((b) => [b.id, b.name, b.day, b.month, b.year, b.type || 'birthday']));
let lastSignature = '';
let lastSync = 0;
let syncTimer;

function syncPush({ force = false } = {}) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (!force && Date.now() - lastSync < 6 * 3600 * 1000 && birthdaySignature() === lastSignature) return;
    lastSignature = birthdaySignature();
    lastSync = Date.now();
    const result = await push.sync();
    if (result.lost) render(); // iOS hat das Abo entzogen: Anzeige auf "Aus" aktualisieren
  }, 1000);
}

/** Klick auf eine Benachrichtigung: ?open=birthday:<id> öffnet das Ereignis (der Name "birthday" ist historisch). */
function openFromUrl(href) {
  let target;
  try { target = new URL(href, location.href).searchParams.get('open'); } catch { return; }
  const m = /^birthday:(.+)$/.exec(target || '');
  if (!m) return;
  const birthday = store.birthdays().find((b) => b.id === m[1]);
  history.replaceState(null, '', location.pathname);
  if (!birthday) return;
  setView('birthdays');
  openBirthdayForm({ birthday });
}

/* ───────── Start ───────── */

/* ───────── Abgleich zwischen Geräten ───────── */
let deviceSyncTimer = null;
const runSync = () => syncer.status().state === 'on' && syncer.sync().catch(() => { /* Fehler zeigt das Abgleich-Fenster */ });
const scheduleSync = () => { clearTimeout(deviceSyncTimer); deviceSyncTimer = setTimeout(runSync, 3000); };

async function start() {
  await store.load();
  lastSignature = birthdaySignature();
  store.onChange(() => {
    render();
    checkReminders();
    if (birthdaySignature() !== lastSignature) syncPush();
    scheduleSync();
  });
  render();
  checkReminders();
  syncPush({ force: true });
  runSync();
  openFromUrl(location.href);
  navigator.serviceWorker?.addEventListener('message', (e) => e.data?.type === 'open' && openFromUrl(e.data.url));

  setInterval(() => {
    // Tageswechsel (App blieb über Mitternacht offen): "heute" neu markieren
    if (toKey(new Date()) !== renderedDay) render();
    checkReminders();
  }, 30000);
  setInterval(() => document.visibilityState === 'visible' && runSync(), 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    render();
    checkReminders();
    syncPush();
    runSync();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
  }
}

start();
