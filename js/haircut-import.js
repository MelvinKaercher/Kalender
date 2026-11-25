// Import früherer Haarschnitte aus Text: pro Zeile `TT.MM.JJJJ;Name;Preis;Notiz` (Notiz optional).
// Reine Logik, ohne DOM. Die Daten stehen nur auf dem Gerät, nicht im Code.
import { parseEuro, isHaircut, HAIRCUT_COLOR, HAIRCUT_TITLE } from './haircuts.js';
import { toKey } from './calendar.js';

/** "11.05.2026" oder "2026-05-11" → "2026-05-11" (nur echte Kalendertage), sonst null. */
export function parseDate(text) {
  const t = text.trim();
  let y, m, d;
  let r = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (r) [, d, m, y] = r;
  else if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) [, y, m, d] = r;
  else return null;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  return toKey(date);
}

/** @returns {{items: Array<{date, customer, price, note}>, errors: Array<{line:number, text:string, reason:string}>}} */
export function parseImport(text) {
  const items = [];
  const errors = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const [dateText = '', customer = '', priceText = '', ...noteParts] = line.split(/[;\t]/).map((x) => x.trim());
    const date = parseDate(dateText);
    const price = parseEuro(priceText);
    const bad = (reason) => errors.push({ line: i + 1, text: line, reason });
    if (!date) return bad('Datum nicht lesbar (z. B. 11.05.2026)');
    if (!customer) return bad('Name fehlt');
    if (price === null || Number.isNaN(price)) return bad('Preis nicht lesbar (z. B. 10 oder 7,5)');
    items.push({ date, customer, price, note: noteParts.join('; ') });
  });
  return { items, errors };
}

const keyOf = (date, customer, price) => `${date}|${customer.trim().toLowerCase()}|${price}`;

/** Trennt bereits vorhandene Haarschnitte (gleiches Datum, gleicher Kunde, gleicher Preis) von neuen. */
export function splitNew(items, existingEvents) {
  const have = new Set(existingEvents.filter(isHaircut).map((e) => keyOf(e.date, e.haircut.customer || '', e.haircut.price || 0)));
  const fresh = [];
  let skipped = 0;
  for (const it of items) {
    const k = keyOf(it.date, it.customer, it.price);
    if (have.has(k)) { skipped += 1; continue; }
    have.add(k);
    fresh.push(it);
  }
  return { fresh, skipped };
}

/** Termin-Objekt (ohne id) für einen importierten Haarschnitt: ganztägig, orange. */
export function toEvent(it) {
  return {
    title: `${HAIRCUT_TITLE} · ${it.customer}`, date: it.date, allDay: true, start: null, end: null,
    note: it.note || '', remind: null, color: HAIRCUT_COLOR,
    haircut: { customer: it.customer, price: it.price, tip: null },
  };
}
