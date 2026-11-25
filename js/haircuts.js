// Haarschnitt-Termine: normale Termine mit Zusatzfeld `haircut: { customer, price, tip }` (Euro).
// Sie sind automatisch orange und werden in der Übersicht (Tab "Haare") nach Monaten ausgewertet.
// Reine Logik, ohne DOM – gut testbar.
import { fromKey, toMinutes } from './calendar.js';

export const HAIRCUT_COLOR = '#f76b15'; // Orange aus der Farbpalette
export const HAIRCUT_TITLE = 'Haareschneiden';

export const isHaircut = (ev) => !!ev && !!ev.haircut && typeof ev.haircut === 'object';
export const eventColor = (ev) => (isHaircut(ev) ? HAIRCUT_COLOR : ev.color);

const money = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0);
/** Verdienst eines Haarschnitts: Preis + Trinkgeld (in Euro, auf Cent gerundet). */
export const earned = (ev) => (isHaircut(ev) ? Math.round((money(ev.haircut.price) + money(ev.haircut.tip)) * 100) / 100 : 0);

/** Ende des Termins als Date (ganztägig: Tagesende). */
export function endOf(ev) {
  const day = fromKey(ev.date);
  if (ev.allDay || !ev.end) return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const m = toMinutes(ev.end);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);
}
/** Erledigt = Ende liegt nicht in der Zukunft. */
export const isDone = (ev, now) => endOf(ev) <= now;

/** "12,5" / "12.50" / " 20 " → 12.5 / 12.5 / 20; leer → null (kein Wert); ungültig oder negativ → NaN. */
export function parseEuro(text) {
  const t = String(text ?? '').trim().replace(/\s|€/g, '');
  if (t === '') return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t.replace(',', '.')) * 100) / 100;
}

const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const fmtEuro = (v) => eurFmt.format(v || 0).replace(/ /g, ' ');

/** Alle Haarschnitte eines Jahres, nach Datum/Beginn sortiert. */
export function haircutsOfYear(events, year) {
  return events
    .filter((e) => isHaircut(e) && e.date.startsWith(`${year}-`))
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
}

/**
 * Auswertung eines Jahres. Verdient zählt nur für erledigte Haarschnitte,
 * künftige stehen unter `planned`.
 * @returns {{months: Array, total: {count, earned, planned, plannedEarned, avg}}}
 */
export function statsForYear(events, year, now) {
  const months = Array.from({ length: 12 }, (_, m) => ({ month: m, count: 0, earned: 0, planned: 0, plannedEarned: 0, avg: 0, items: [] }));
  for (const ev of haircutsOfYear(events, year)) {
    const m = months[Number(ev.date.slice(5, 7)) - 1];
    m.items.push(ev);
    if (isDone(ev, now)) { m.count += 1; m.earned = money(m.earned + earned(ev)); }
    else { m.planned += 1; m.plannedEarned = money(m.plannedEarned + earned(ev)); }
  }
  for (const m of months) m.avg = m.count ? Math.round((m.earned / m.count) * 100) / 100 : 0;
  const total = months.reduce((t, m) => ({
    count: t.count + m.count, earned: money(t.earned + m.earned),
    planned: t.planned + m.planned, plannedEarned: money(t.plannedEarned + m.plannedEarned),
  }), { count: 0, earned: 0, planned: 0, plannedEarned: 0 });
  total.avg = total.count ? Math.round((total.earned / total.count) * 100) / 100 : 0;
  return { months, total };
}
