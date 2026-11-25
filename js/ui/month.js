// Monatsansicht: endloses Runterscrollen von Monat zu Monat. Jeder Monat ist ein eigener Block mit eigenem
// Raster und beginnt deshalb in einer neuen Zeile; Tage außerhalb des Monats bleiben leer.
import { el, WEEKDAYS, MONTHS } from './dom.js';
import { monthGrid, isSameDay } from '../calendar.js';
import { itemsForDay } from '../items.js';
import { colorStyle } from '../colors.js';
import { typeInfo } from '../birthdays.js';
import { isHaircut } from '../haircuts.js';

const BEFORE = 2; // Monate vor dem gewählten
const AFTER = 14; // Monate danach
const EXTEND = 6; // so viele Monate werden beim Scrollen nachgeladen

function cell(c, today, events, birthdays, display, onDay) {
  const items = itemsForDay(events, birthdays, c.date);
  const nEvents = items.events.length;
  const nBdays = items.birthdays.length;
  const holiday = display.holidays ? items.holidays[0] : null;
  const vacation = display.vacations ? items.vacations[0] : null;
  // Namen direkt im Feld (wie bei Feiertagen): Ereignisse zuerst, dann Termine; maximal 3 Zeilen inkl. Feiertag
  const room = Math.max(0, 3 - (holiday ? 1 : 0));
  const hairs = items.events.filter(isHaircut);
  const plain = items.events.filter((e) => !isHaircut(e));
  const bdayLabels = items.birthdays.map(({ birthday }) => el('i', { class: 'lbl bday', text: `${typeInfo(birthday).emoji}${birthday.name}` }));
  const plainLabels = plain.map((ev) => el('i', { class: 'lbl', style: colorStyle(ev.color), text: ev.title }));
  const hairLabels = hairs.map((ev) => el('i', { class: 'lbl', style: colorStyle(ev.color), text: `✂︎${ev.haircut.customer || 'Haare'}` }));
  // Zu voll? Zuerst die Haarschnitte ohne Namen zusammenfassen ("✂︎ 4"), danach auch die übrigen Termine.
  const sumLabel = (list, text) => (list.length ? [el('i', { class: 'lbl', style: colorStyle(list[0].color), text })] : []);
  let names = [...bdayLabels, ...plainLabels, ...hairLabels];
  if (names.length > room) names = [...bdayLabels, ...plainLabels, ...sumLabel(hairs, `✂︎ ${hairs.length}`)];
  if (names.length > room) names = [...bdayLabels, ...sumLabel(plain, `${plain.length} Termin${plain.length === 1 ? '' : 'e'}`), ...sumLabel(hairs, `✂︎ ${hairs.length}`)];
  const shown = names.length > room ? names.slice(0, Math.max(0, room - 1)) : names;
  const more = names.length - shown.length;
  const label = [
    c.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
    nEvents ? `${nEvents} ${nEvents === 1 ? 'Termin' : 'Termine'}` : null,
    nBdays ? `${nBdays} ${nBdays === 1 ? 'Ereignis' : 'Ereignisse'}: ${items.birthdays.map((x) => x.birthday.name).join(', ')}` : null,
    holiday ? `Feiertag: ${holiday.name}` : null,
    vacation ? vacation.name : null,
  ].filter(Boolean).join(', ');
  return el('button', {
    class: `cell${isSameDay(c.date, today) ? ' today' : ''}${holiday ? ' holiday' : ''}${vacation ? ' vac' : ''}`,
    type: 'button',
    'aria-label': label,
    'data-key': c.key,
    onclick: () => onDay(c.date),
  }, el('span', { class: 'num', text: String(c.date.getDate()) }),
    holiday ? el('span', { class: 'hname', text: holiday.short }) : null,
    el('span', { class: 'lbls' }, shown, more ? el('i', { class: 'lbl more', text: `+${more}` }) : null));
}

const idxOf = (y, m) => y * 12 + m;
const ymOf = (idx) => [Math.floor(idx / 12), ((idx % 12) + 12) % 12];

function monthBlock(idx, { today, events, birthdays, display, onPickDay }) {
  const [year, month0] = ymOf(idx);
  const weeks = monthGrid(year, month0);
  const offset = weeks[0].findIndex((c) => c.inMonth); // Spalte des Monatsersten
  return el('section', { class: 'mblock', 'data-idx': String(idx), 'aria-label': `${MONTHS[month0]} ${year}` },
    el('h2', { class: 'mhead', style: `--off:${offset}`, text: month0 === 0 ? `${MONTHS[month0]} ${year}` : MONTHS[month0] }),
    el('div', { class: 'grid', role: 'grid' },
      weeks.flat().map((c) => (c.inMonth ? cell(c, today, events, birthdays, display, onPickDay) : el('i', { class: 'blank', 'aria-hidden': 'true' })))));
}

// Scroll-Zustand über Neuzeichnen hinweg: oberster sichtbarer Monat + Abstand darin.
let anchor = null; // { idx, offset }
let visibleIdx = null;
let pending = null; // Zielmonat eines laufenden weichen Scrollens (wird nach Nachladen erneut angesteuert)
/** Nach bewusstem Wechsel (anderer Monat gewählt) die gemerkte Scrollposition vergessen. */
export const resetMonthScroll = () => { anchor = null; visibleIdx = null; pending = null; };

const scroller = () => document.querySelector('#view .month');
const blockOf = (idx) => document.querySelector(`#view .mblock[data-idx="${idx}"]`);
const headHeight = (sc) => sc.querySelector('.weekdays')?.offsetHeight || 0;

/** Weich oder sofort zum Monat scrollen. false, wenn der Monat (noch) nicht geladen ist. */
export function scrollToMonth(year, month0, smooth = false) {
  const sc = scroller();
  const block = sc && blockOf(idxOf(year, month0));
  if (!block) return false;
  pending = smooth ? idxOf(year, month0) : null;
  sc.scrollTo({ top: block.offsetTop - headHeight(sc), behavior: smooth ? 'smooth' : 'auto' });
  return true;
}

export function renderMonth(root, ctx) {
  const { cursor, onVisibleMonth } = ctx;
  const sc = el('div', { class: 'month' });
  const list = el('div', { class: 'months' });
  sc.append(el('div', { class: 'weekdays', 'aria-hidden': 'true' }, WEEKDAYS.map((d) => el('span', { text: d }))), list);
  root.append(sc);

  const center = anchor ? anchor.idx : idxOf(cursor.getFullYear(), cursor.getMonth());
  let lo = center - BEFORE;
  let hi = center + AFTER;
  for (let i = lo; i <= hi; i++) list.append(monthBlock(i, ctx));

  const place = () => {
    const block = blockOf(anchor ? anchor.idx : idxOf(cursor.getFullYear(), cursor.getMonth()));
    if (block) sc.scrollTop = block.offsetTop - headHeight(sc) + (anchor ? anchor.offset : 0);
  };
  place();

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!sc.isConnected) return; // Ansicht wurde inzwischen gewechselt
      const wH = headHeight(sc);
      const y = sc.scrollTop + wH; // Oberkante des sichtbaren Bereichs (unter der Wochentagsleiste)
      // oberster Monat + Abstand darin (für Neuzeichnen)
      const blocks = [...list.children];
      const top = [...blocks].reverse().find((b) => b.offsetTop <= y) || blocks[0];
      anchor = { idx: Number(top.dataset.idx), offset: y - top.offsetTop };
      // Monat im oberen Drittel bestimmt den Titel
      const probe = y + (sc.clientHeight - wH) / 3;
      const cur = [...blocks].reverse().find((b) => b.offsetTop <= probe) || blocks[0];
      const idx = Number(cur.dataset.idx);
      if (pending === idx) pending = null;
      if (idx !== visibleIdx) { visibleIdx = idx; const [yy, mm] = ymOf(idx); onVisibleMonth?.(yy, mm); }
      // nachladen
      if (sc.scrollTop < 500) {
        const before = sc.scrollHeight;
        const frag = document.createDocumentFragment();
        for (let i = lo - EXTEND; i < lo; i++) frag.append(monthBlock(i, ctx));
        lo -= EXTEND;
        list.prepend(frag);
        sc.scrollTop += sc.scrollHeight - before;
        const target = pending !== null && blockOf(pending);
        if (target) sc.scrollTo({ top: target.offsetTop - wH, behavior: 'smooth' }); // laufendes Scrollen fortsetzen
      }
      if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 900) {
        const frag = document.createDocumentFragment();
        for (let i = hi + 1; i <= hi + EXTEND; i++) frag.append(monthBlock(i, ctx));
        hi += EXTEND;
        list.append(frag);
      }
    });
  }
  sc.addEventListener('scroll', onScroll, { passive: true });
}
