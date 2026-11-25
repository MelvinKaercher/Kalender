// Bottom-Sheet: schiebt von unten herein, schließt per Tipp auf den Hintergrund,
// per Abbrechen-Button, Escape oder Nach-unten-Ziehen.
import { el } from './dom.js';

let current = null;

export function closeSheet({ instant = false } = {}) {
  if (current) current.close({ instant });
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {HTMLElement|null} [o.left]   Element links in der Leiste (z. B. Abbrechen)
 * @param {HTMLElement|null} [o.right]  Element rechts (z. B. Sichern)
 * @param {HTMLElement|HTMLElement[]} o.content
 */
export function openSheet({ title, left = null, right = null, content, flush = false }) {
  closeSheet({ instant: true });
  const overlay = document.getElementById('overlay');

  const backdrop = el('div', { class: 'backdrop' });
  const grabber = el('div', { class: 'grabber' });
  const bar = el('div', { class: 'sheet-bar' }, left || el('span'), el('h2', { class: 'sheet-title', text: title }), right || el('span'));
  const body = el('div', { class: `sheet-body${flush ? ' flush' : ''}` }, content);
  const sheet = el('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, grabber, bar, body);
  overlay.append(backdrop, sheet);
  overlay.style.pointerEvents = 'auto';

  let closed = false;
  function close({ instant = false } = {}) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    if (current === handle) current = null;
    const done = () => {
      backdrop.remove();
      sheet.remove();
      if (!current) overlay.style.pointerEvents = 'none';
    };
    if (instant) return done();
    sheet.style.transform = '';
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(done, 280);
  }
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', () => close());

  // Nach unten ziehen zum Schließen (an Griff und Leiste)
  let startY = null;
  const onStart = (e) => { startY = e.touches[0].clientY; sheet.classList.add('dragging'); };
  const onMove = (e) => {
    if (startY === null) return;
    const dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = (e) => {
    if (startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    startY = null;
    sheet.classList.remove('dragging');
    if (dy > 90) close();
    else sheet.style.transform = '';
  };
  for (const h of [grabber, bar]) {
    h.addEventListener('touchstart', onStart, { passive: true });
    h.addEventListener('touchmove', onMove, { passive: true });
    h.addEventListener('touchend', onEnd);
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  }));

  const handle = { close, sheet, body };
  current = handle;
  return handle;
}
