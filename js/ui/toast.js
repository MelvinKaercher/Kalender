// Kleine Hinweisleiste mit Aktion (z. B. "Gelöscht · Rückgängig"), verschwindet nach ein paar Sekunden.
import { el } from './dom.js';

let timer = null;

export function showToast(message, actionLabel, onAction, ms = 6000) {
  hideToast();
  const bar = el('div', { class: 'toast', role: 'status' },
    el('span', { text: message }),
    actionLabel
      ? el('button', { type: 'button', text: actionLabel, onclick: () => { hideToast(); onAction && onAction(); } })
      : null);
  document.body.append(bar);
  requestAnimationFrame(() => bar.classList.add('show'));
  timer = setTimeout(hideToast, ms);
}

export function hideToast() {
  clearTimeout(timer);
  document.querySelectorAll('.toast').forEach((n) => n.remove());
}
