// Kleine DOM-Helfer. Nutzereingaben gehen immer über textContent – nie über innerHTML.

export function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  const deferred = [];
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') deferred.push([k, v]);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  // value erst nach den <option>-Kindern setzen
  for (const [k, v] of deferred) node[k] = v;
  return node;
}

export const clear = (node) => node.replaceChildren();

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const dayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
export const fmtDayLong = (d) => dayLong.format(d);
export const fmtDayShort = (d) => dayShort.format(d); // "30. Nov."

/** "Mi 25" */
export const fmtWeekdayDay = (d) => `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}`;

/** Zeitspanne eines Termins: "14:00–15:00" bzw. "Ganztägig" */
export const fmtRange = (ev) => (ev.allDay ? 'Ganztägig' : `${ev.start}–${ev.end}`);
