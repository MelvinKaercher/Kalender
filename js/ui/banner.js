// Erinnerungs-Banner am oberen Rand. Bleiben stehen, bis sie weggewischt/angetippt werden.
import { el } from './dom.js';

const shown = new Map(); // key -> Element

function remove(key) {
  const node = shown.get(key);
  if (!node) return;
  shown.delete(key);
  node.classList.add('leaving');
  setTimeout(() => node.remove(), 260);
}

/**
 * Gleicht die angezeigten Banner mit der Liste fälliger Erinnerungen ab.
 * @param {Array} due   Ergebnis von dueReminders()
 * @param {{onOpen:Function, onDismiss:Function}} cb
 */
export function syncBanners(due, { onOpen, onDismiss }) {
  const host = document.getElementById('banners');
  const keys = new Set(due.map((d) => d.key));
  for (const key of [...shown.keys()]) if (!keys.has(key)) remove(key);

  for (const item of due) {
    if (shown.has(item.key)) continue;
    const node = el('div', { class: `banner${item.kind === 'birthday' ? ' bday' : ''}`, role: 'status' },
      el('span', { class: 'ico', 'aria-hidden': 'true', text: item.kind === 'birthday' ? '🎂' : '🔔' }),
      el('button', { class: 'main', type: 'button', onclick: () => { onDismiss(item); onOpen(item); } },
        el('div', { class: 'b-title', text: item.title }),
        el('div', { class: 'b-text', text: item.text })),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Erinnerung schließen', onclick: () => onDismiss(item) },
        el('span', { 'aria-hidden': 'true', text: '✕' }))
    );
    shown.set(item.key, node);
    host.append(node);
  }
}
