// Macht aus dem Kalender-Datenstand Markdown für Obsidian. Rein (kein Dateizugriff, kein Netz), in Node testbar.
import { toKey, fromKey, startOfDay, addDays } from '../../js/calendar.js';
import { expandEvents } from '../../js/repeat.js';
import { isHaircut, statsForYear, customerStats, fmtEuro, earned } from '../../js/haircuts.js';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const dayLabel = (key) => { const d = fromKey(key); return `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const HEAD = '<!-- Automatisch aus der Kalender-App erzeugt. Nicht hier bearbeiten – Änderungen werden überschrieben. -->\n';

function eventLine(ev, includeHaircuts) {
  const title = ev.haircut ? (includeHaircuts ? oneLine(ev.title) : 'Haareschneiden') : oneLine(ev.title);
  let when = ev.allDay ? 'ganztägig' : `${ev.start}–${ev.end || ''}`.replace(/–$/, '');
  if (ev.endDate) when = `bis ${dayLabel(ev.endDate)}`;
  const tag = (ev.vacation ? ' 🌴' : ev.haircut ? ' ✂︎' : '') + (ev.occKey ? ' ⟳' : '');
  const note = ev.note && !ev.haircut ? ` – ${oneLine(ev.note)}` : '';
  return `- ${when}: ${title}${tag}${note}`;
}

/** Termine: die letzten 30 Tage und die nächsten 120 Tage, nach Datum gruppiert (mehrtägige an jedem Tag). */
export function renderTermine(snapshot, now = new Date(), { includeHaircuts = true } = {}) {
  const today = startOfDay(now);
  const from = toKey(addDays(today, -30));
  const to = toKey(addDays(today, 120));
  const days = new Map();
  for (const ev of expandEvents(snapshot.events || [], from, to)) {
    const last = ev.endDate || ev.date;
    let k = ev.date < from ? from : ev.date;
    while (k <= last && k <= to) {
      if (!days.has(k)) days.set(k, []);
      days.get(k).push(ev);
      const d = fromKey(k); k = toKey(addDays(d, 1));
    }
  }
  const sortEv = (a, b) => Number(!!b.allDay) - Number(!!a.allDay) || (a.start || '').localeCompare(b.start || '') || oneLine(a.title).localeCompare(oneLine(b.title), 'de');
  const section = (title, keys) => {
    if (!keys.length) return `## ${title}\n\n_Nichts eingetragen._\n`;
    return `## ${title}\n\n${keys.map((k) => `### ${dayLabel(k)}\n${days.get(k).sort(sortEv).map((e) => eventLine(e, includeHaircuts)).join('\n')}\n`).join('\n')}`;
  };
  const keys = [...days.keys()].sort();
  const todayKey = toKey(today);
  return `${HEAD}# Termine\n\nStand: ${toKey(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}\n\n${section('Anstehend', keys.filter((k) => k >= todayKey))}\n${section('Zuletzt (30 Tage)', keys.filter((k) => k < todayKey).reverse())}`;
}

/** Jährliche Ereignisse (Geburtstage, Sonstiges) nach Monat. */
export function renderGeburtstage(snapshot) {
  const list = (snapshot.birthdays || []).slice().sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, 'de'));
  const out = [`${HEAD}# Geburtstage und Ereignisse\n`];
  for (let m = 1; m <= 12; m++) {
    const rows = list.filter((b) => b.month === m);
    if (!rows.length) continue;
    out.push(`## ${MONTHS[m - 1]}\n${rows.map((b) => `- ${b.day}.${m}.: ${oneLine(b.name)}${b.type === 'other' || b.type === 'anniversary' ? ' 📌' : ' 🎂'}${b.year ? ` (${b.type === 'birthday' || !b.type ? 'geboren' : 'seit'} ${b.year})` : ''}`).join('\n')}\n`);
  }
  if (list.length === 0) out.push('_Keine Einträge._\n');
  return out.join('\n');
}

/** Haarschnitte: Monats-Übersicht je Jahr und Kunden-Tabelle. */
export function renderHaare(snapshot, now = new Date()) {
  const events = (snapshot.events || []).filter(isHaircut);
  const years = [...new Set(events.map((e) => e.date.slice(0, 4)))].sort().reverse();
  const out = [`${HEAD}# Haareschneiden\n`];
  for (const y of years) {
    const { months, total } = statsForYear(events, Number(y), now);
    out.push(`## ${y}\n\nGesamt: **${fmtEuro(total.earned)}** bei ${total.count} Haarschnitten (Ø ${fmtEuro(total.avg)})${total.planned ? `, noch geplant: ${total.planned} (${fmtEuro(total.plannedEarned)})` : ''}\n`);
    out.push('| Monat | Anzahl | Verdient | Geplant |\n|---|---|---|---|');
    for (const m of months.filter((x) => x.count || x.planned)) out.push(`| ${MONTHS[m.month]} | ${m.count} | ${fmtEuro(m.earned)} | ${m.planned || ''} |`);
    out.push('');
  }
  const cust = customerStats(events, now).filter((c) => c.visits || c.planned);
  out.push('## Kunden\n', '| Kunde | Besuche | Bezahlt gesamt | Ø | Zuletzt | Alle ca. |\n|---|---|---|---|---|---|');
  for (const c of cust) out.push(`| ${oneLine(c.name).replace(/\|/g, '/')} | ${c.visits}${c.planned ? ` (+${c.planned} geplant)` : ''} | ${fmtEuro(c.earned)} | ${fmtEuro(c.avg)} | ${c.last ? dayLabel(c.last) : '–'} | ${c.avgGapDays ? `${c.avgGapDays} Tage` : '–'} |`);
  out.push('');
  if (!events.length) out.push('_Noch keine Haarschnitte._\n');
  return out.join('\n');
}

export const renderStand = (now, counts) => `${HEAD}# Stand des Abgleichs\n\nLetzter Abgleich: ${toKey(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}\n\n- Termine: ${counts.events}\n- Geburtstage/Ereignisse: ${counts.birthdays}\n`;
