// Wochenplan: Mo–So mit Zeitraster. Zeigt denselben Datenbestand wie die Monatsansicht.
import { el, WEEKDAYS } from './dom.js';
import { weekDays, isSameDay, toKey, toMinutes, fromMinutes } from '../calendar.js';
import { itemsForDay } from '../items.js';
import { colorStyle } from '../colors.js';
import { typeInfo } from '../birthdays.js';
import { attachDrag, attachSlotHold, clickSuppressed } from './week-drag.js';

const DEFAULT_START_H = 8; // sichtbares Zeitfenster (wächst bei Terminen davor/danach)
const DEFAULT_END_H = 21;
const MIN_HOUR_PX = 30;
const MAX_HOUR_PX = 56;
const MIN_BLOCK_MIN = 30; // kürzere Termine werden mindestens so hoch gezeichnet
const SNAP = 30; // Antippen eines freien Slots rastet auf halbe Stunden ein

let savedScroll = null;

/** Überlappende Termine nebeneinander anordnen (Spalten-Layout je Überlappungsgruppe). */
export function layoutDay(events) {
  const items = events
    .map((ev) => {
      const s = toMinutes(ev.start);
      const e = ev.end && toMinutes(ev.end) > s ? toMinutes(ev.end) : s + 60;
      return { ev, s, e, vis: Math.max(e, s + MIN_BLOCK_MIN) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const it of group) {
      let lane = lanes.findIndex((end) => end <= it.s);
      if (lane === -1) { lane = lanes.length; lanes.push(it.vis); } else lanes[lane] = it.vis;
      it.lane = lane;
    }
    for (const it of group) it.lanes = lanes.length;
    out.push(...group);
    group = [];
  };
  for (const it of items) {
    if (group.length && it.s >= groupEnd) { flush(); groupEnd = -1; }
    group.push(it);
    groupEnd = Math.max(groupEnd, it.vis);
  }
  flush();
  return out;
}

/** Sichtbares Zeitfenster [startH, endH) der Woche: Standard 8–21 Uhr, erweitert um Termine mit Uhrzeit davor/danach. */
export function windowOf(timedEvents) {
  let startH = DEFAULT_START_H;
  let endH = DEFAULT_END_H;
  for (const ev of timedEvents) {
    const s = toMinutes(ev.start);
    const e = ev.end && toMinutes(ev.end) > s ? toMinutes(ev.end) : s + 60;
    startH = Math.min(startH, Math.floor(s / 60));
    endH = Math.max(endH, Math.min(24, Math.ceil(Math.max(e, s + MIN_BLOCK_MIN) / 60)));
  }
  return { startH, endH };
}

export function renderWeek(root, ctx, hourOverride = null) {
  const { cursor, today, now, events, birthdays, display, onDay, onEvent, onBirthday, onNewEvent, onMoveEvent } = ctx;
  const days = weekDays(cursor);
  const data = days.map((d) => itemsForDay(events, birthdays, d));
  const { startH, endH } = windowOf(data.flatMap((x) => x.events.filter((e) => !e.allDay)));
  const hours = endH - startH;
  const HOUR = hourOverride || 40;
  const originMin = startH * 60;
  const endMin = endH * 60;

  const head = el('div', { class: 'w-head' },
    el('span'),
    days.map((d, i) =>
      el('button', {
        'data-key': toKey(d),
        class: `d${isSameDay(d, today) ? ' today' : ''}${display.vacations && data[i].vacations.length ? ' vac' : ''}${data[i].events.some((e) => e.vacation) ? ' trip' : ''}`, type: 'button',
        'aria-label': d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
        onclick: () => onDay(d),
      }, el('span', { class: 'wd', text: WEEKDAYS[i] }), el('span', { class: 'dn', text: String(d.getDate()) }))
    )
  );

  // Ganztägige Termine + Geburtstage
  const holidayOf = (x) => (display.holidays ? x.holidays[0] : null);
  const hasAllDay = data.some((x) => holidayOf(x) || x.birthdays.length || x.events.some((e) => e.allDay));
  const allDay = hasAllDay
    ? el('div', { class: 'w-allday' },
        el('span', { class: 'gutter', text: 'ganzt.' }),
        data.map((x) =>
          el('div', { class: 'ad' },
            holidayOf(x) ? el('span', { class: 'chip holiday', title: holidayOf(x).name }, holidayOf(x).short) : null,
            x.birthdays.map(({ birthday }) =>
              el('button', { class: 'chip bday', type: 'button', onclick: () => onBirthday(birthday) }, `${typeInfo(birthday).emoji} ${birthday.name}`)),
            x.events.filter((e) => e.allDay).map((e) =>
              el('button', { class: 'chip', type: 'button', style: colorStyle(e.color), onclick: () => onEvent(e) }, e.occKey && !e.vacation ? `${e.title} ⟳` : e.title))
          )
        ))
    : el('div', { class: 'w-allday' });

  // Zeitraster
  const times = el('div', { class: 'w-times', 'aria-hidden': 'true' },
    Array.from({ length: hours - 1 }, (_, i) => el('span', { style: `top:${(i + 1) * HOUR}px`, text: `${startH + i + 1}:00` })));

  const cols = days.map((d, i) => {
    const col = el('div', { class: `w-col${isSameDay(d, today) ? ' today' : ''}`, 'data-key': toKey(d) });
    for (const it of layoutDay(data[i].events.filter((e) => !e.allDay))) {
      const w = 100 / it.lanes;
      const blockEl = el('button', {
          class: `block${it.lanes > 1 ? ' narrow' : ''}`, type: 'button',
          style: `${colorStyle(it.ev.color)}top:${((it.s - originMin) / 60) * HOUR}px;height:${((it.vis - it.s) / 60) * HOUR - 1}px;left:calc(${it.lane * w}% + 1px);width:calc(${w}% - 2px)`,
          'aria-label': `${it.ev.title}, ${it.ev.start} bis ${it.ev.end}`,
          onclick: (e) => { e.stopPropagation(); if (!clickSuppressed()) onEvent(it.ev); },
        }, it.ev.occKey ? `${it.ev.title} ⟳` : it.ev.title, it.lanes === 1 && it.vis - it.s >= 45 ? el('span', { class: 't', text: it.ev.start }) : null);
      col.append(blockEl);
      // Lange drücken und ziehen = verschieben (die Raster-Elemente werden erst beim Ziehen gebraucht)
      attachDrag(blockEl, { ev: it.ev, hourPx: HOUR, originMin, endMin, geometry: () => ({ scroll, body: scroll.firstChild, cols }), onDrop: onMoveEvent });
    }
    if (isSameDay(d, today)) {
      const mins = now.getHours() * 60 + now.getMinutes();
      if (mins >= originMin && mins <= endMin) col.append(el('div', { class: 'now-line', style: `top:${((mins - originMin) / 60) * HOUR}px` }));
    }
    // Lange auf einen freien Slot drücken => neuer Termin zu dieser Uhrzeit (wie Apple). Kurzes Antippen tut nichts;
    // nur die Maus (Rechner) legt weiterhin per Klick an.
    attachSlotHold(col, { hourPx: HOUR, originMin, endMin, onCreate: (m) => onNewEvent(d, fromMinutes(m)) });
    col.addEventListener('click', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (clickSuppressed()) return;
      const y = e.clientY - col.getBoundingClientRect().top;
      const minutes = Math.max(originMin, Math.min(Math.max(originMin, endMin - 60), Math.floor(((y / HOUR) * 60 + originMin) / SNAP) * SNAP));
      onNewEvent(d, fromMinutes(minutes));
    });
    return col;
  });

  const scroll = el('div', { class: 'w-scroll' }, el('div', { class: 'w-body', style: `height:${hours * HOUR}px;--hour:${HOUR}px` }, times, cols));
  scroll.addEventListener('scroll', () => { savedScroll = scroll.scrollTop; }, { passive: true });
  root.append(el('div', { class: 'week' }, head, allDay, scroll));

  // Stundenhöhe an die verfügbare Höhe anpassen, damit (möglichst) nicht gescrollt werden muss: einmal messen, neu zeichnen
  if (!hourOverride) {
    const fit = Math.floor((scroll.clientHeight / hours) * 10) / 10;
    const next = Math.max(MIN_HOUR_PX, Math.min(MAX_HOUR_PX, fit || 40));
    if (Math.abs(next - HOUR) > 0.5) {
      root.replaceChildren();
      return renderWeek(root, ctx, next);
    }
  }

  // Scrollposition nur, wenn das Fenster überhaupt höher ist als der Platz
  if (scroll.scrollHeight > scroll.clientHeight + 1) {
    const hasToday = days.some((d) => isSameDay(d, today));
    const focusH = hasToday ? now.getHours() - 1 : DEFAULT_START_H;
    scroll.scrollTop = savedScroll ?? Math.max(0, (focusH - startH) * HOUR);
  }
}
