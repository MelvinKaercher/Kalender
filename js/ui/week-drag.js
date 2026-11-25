// Termine in der Wochenansicht mit dem Finger verschieben (wie im Apple-Kalender):
// lange auf den Termin drücken, dann ziehen. Rastet auf 15 Minuten ein, kann in andere Tage gezogen werden.
// Normales Wischen scrollt weiter, kurzes Antippen öffnet das Bearbeiten.
import { WEEKDAYS } from './dom.js';
import { fromKey, fromMinutes } from '../calendar.js';
import { columnFromX, movedStart, yToMinutes, moveChanges, durationOf, isMove } from '../drag-math.js';

const HOLD_MS = 380; // so lange drücken, bis der Termin "abhebt"
const TOLERANCE = 10; // px: bewegt sich der Finger vorher, ist es ein Scrollen
const EDGE = 44; // px vom Rand des Rasters, ab dem automatisch gescrollt wird

let suppressUntil = 0;
/** Nach dem Loslassen eines Zuges darf kein "Antippen" mehr ankommen. */
export const clickSuppressed = () => performance.now() < suppressUntil;

/**
 * @param {HTMLElement} block   der Termin-Block
 * @param {object} o
 * @param {object} o.ev         der Termin
 * @param {number} o.hourPx     Höhe einer Stunde im Raster
 * @param {() => {scroll:HTMLElement, body:HTMLElement, cols:HTMLElement[]}} o.geometry   aktuelle Raster-Elemente
 * @param {(ev:object, changes:{date:string,start:string,end:string}) => void} o.onDrop
 */
export function attachDrag(block, { ev, hourPx, geometry, onDrop }) {
  let timer = null;
  let armed = false;
  let touchId = null;
  let sx = 0, sy = 0;
  let last = { x: 0, y: 0 };
  let ghost = null, bubble = null;
  let grabOffsetMin = 0;
  let duration = 60;
  let target = null;
  let raf = 0;

  function update(x, y) {
    const g = geometry();
    const rects = g.cols.map((c) => c.getBoundingClientRect());
    const col = columnFromX(x, rects);
    const bodyTop = g.body.getBoundingClientRect().top;
    const startMin = movedStart({ pointerMin: yToMinutes(y - bodyTop, hourPx), grabOffsetMin, duration });
    const date = g.cols[col].dataset.key;
    target = { date, startMin };

    const top = bodyTop + (startMin / 60) * hourPx;
    ghost.style.left = `${rects[col].left + 1}px`;
    ghost.style.width = `${rects[col].width - 2}px`;
    ghost.style.top = `${top}px`;

    const d = fromKey(date);
    bubble.textContent = `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1}. · ${fromMinutes(startMin)}–${fromMinutes(startMin + duration)}`;
    const bw = bubble.offsetWidth || 120;
    bubble.style.left = `${Math.max(6, Math.min(window.innerWidth - bw - 6, rects[col].left + rects[col].width / 2 - bw / 2))}px`;
    bubble.style.top = `${top > 70 ? top - 34 : top + parseFloat(ghost.style.height) + 6}px`;
  }

  function tick() {
    if (!armed) return;
    const g = geometry();
    const r = g.scroll.getBoundingClientRect();
    let dy = 0;
    if (last.y < r.top + EDGE) dy = -Math.min(14, Math.ceil((r.top + EDGE - last.y) / 5));
    else if (last.y > r.bottom - EDGE) dy = Math.min(14, Math.ceil((last.y - (r.bottom - EDGE)) / 5));
    if (dy) {
      g.scroll.scrollTop += dy;
      update(last.x, last.y);
    }
    raf = requestAnimationFrame(tick);
  }

  function arm() {
    timer = null;
    armed = true;
    const r = block.getBoundingClientRect();
    duration = durationOf(ev);
    grabOffsetMin = ((sy - r.top) / hourPx) * 60;

    ghost = block.cloneNode(true);
    ghost.classList.remove('narrow', 'drag-src');
    ghost.classList.add('drag-ghost');
    ghost.style.height = `${r.height}px`;
    ghost.style.left = `${r.left}px`;
    ghost.style.top = `${r.top}px`;
    ghost.style.width = `${r.width}px`;
    bubble = document.createElement('div');
    bubble.className = 'drag-time';
    document.body.append(ghost, bubble);
    block.classList.add('drag-src');
    navigator.vibrate?.(10); // Android; iOS ignoriert das
    update(last.x, last.y);
    raf = requestAnimationFrame(tick);
  }

  function finish(drop) {
    armed = false;
    cancelAnimationFrame(raf);
    ghost?.remove();
    bubble?.remove();
    ghost = bubble = null;
    block.classList.remove('drag-src');
    suppressUntil = performance.now() + 350;
    if (drop && target) {
      const changes = moveChanges(ev, { date: target.date, startMin: target.startMin });
      if (isMove(ev, changes)) onDrop(ev, changes);
    }
    target = null;
  }

  block.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || armed) return;
    const t = e.touches[0];
    touchId = t.identifier;
    sx = last.x = t.clientX;
    sy = last.y = t.clientY;
    clearTimeout(timer);
    timer = setTimeout(arm, HOLD_MS);
  }, { passive: true });

  block.addEventListener('touchmove', (e) => {
    const t = [...e.touches].find((x) => x.identifier === touchId);
    if (!t) return;
    last = { x: t.clientX, y: t.clientY };
    if (!armed) {
      // Bewegt sich der Finger vor dem "Abheben", ist es Scrollen: nichts abfangen
      if (timer && Math.hypot(t.clientX - sx, t.clientY - sy) > TOLERANCE) { clearTimeout(timer); timer = null; }
      return;
    }
    e.preventDefault(); // beim Ziehen nicht scrollen
    update(last.x, last.y);
  }, { passive: false });

  block.addEventListener('touchend', (e) => {
    clearTimeout(timer);
    timer = null;
    if (!armed) return;
    e.preventDefault(); // kein nachfolgendes "Antippen"
    e.stopPropagation(); // und kein Wisch-Blättern der Ansicht
    finish(true);
  }, { passive: false });

  block.addEventListener('touchcancel', () => {
    clearTimeout(timer);
    timer = null;
    if (armed) finish(false);
  }, { passive: true });

  // Langer Druck soll kein Kontextmenü/keine Textauswahl öffnen
  block.addEventListener('contextmenu', (e) => e.preventDefault());
}
