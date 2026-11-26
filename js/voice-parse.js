// Sprach-Eingabe: macht aus einem gesprochenen deutschen Satz einen Termin-Vorschlag.
// Reine Logik (kein DOM, kein Netz) – komplett lokal und in Node testbar.
import { toKey, startOfDay, addDays, daysInMonth, fromMinutes, toMinutes, pad } from './calendar.js';

const NUMS = {
  ein: 1, eins: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7,
  acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16,
  siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20, einundzwanzig: 21, zweiundzwanzig: 22,
  dreiundzwanzig: 23, vierundzwanzig: 24,
};
const NUM_RE = `\\d{1,2}|${Object.keys(NUMS).sort((a, b) => b.length - a.length).join('|')}`;
const num = (s) => (/^\d+$/.test(s) ? Number(s) : NUMS[s.toLowerCase()]);

const MONTHS = ['januar', 'februar', 'märz|maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
const MONTH_RE = MONTHS.join('|');
const monthIndex = (s) => MONTHS.findIndex((m) => new RegExp(`^(?:${m})$`, 'i').test(s));
const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag|sonnabend']; // getDay()-Reihenfolge
const WEEKDAY_RE = WEEKDAYS.join('|');
const weekdayIndex = (s) => WEEKDAYS.findIndex((w) => new RegExp(`^(?:${w})$`, 'i').test(s));

// Wortgrenzen mit Umlauten (\b kennt nur ASCII)
const re = (src, flags = 'iu') => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, flags);

/** Arbeitskopie des Textes: gefundene Teile werden durch Leerzeichen ersetzt (Positionen bleiben stabil). */
function masker(text) {
  let work = text;
  return {
    get work() { return work; },
    take(match) {
      work = work.slice(0, match.index) + ' '.repeat(match[0].length) + work.slice(match.index + match[0].length);
    },
  };
}

function makeDate(day, month0, year, now) {
  const today = startOfDay(now);
  let y = year ? (year < 100 ? 2000 + year : year) : today.getFullYear();
  if (month0 < 0 || month0 > 11 || day < 1 || day > daysInMonth(y, month0)) return null;
  let d = new Date(y, month0, day);
  if (!year && d < today) {
    y += 1;
    if (day > daysInMonth(y, month0)) return null;
    d = new Date(y, month0, day);
  }
  return d;
}

/** Alle Datumsangaben im Text, in Sprechreihenfolge: [{ date, match }]. */
function findDates(work, now) {
  const today = startOfDay(now);
  const found = [];
  const add = (match, date) => { if (date) found.push({ date, match }); };
  const run = (regex, fn) => {
    for (const m of work.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))) {
      if (!found.some((f) => m.index < f.match.index + f.match[0].length && f.match.index < m.index + m[0].length)) fn(m);
    }
  };
  run(re('übermorgen'), (m) => add(m, addDays(today, 2)));
  run(re('morgen'), (m) => add(m, addDays(today, 1)));
  run(re('heute'), (m) => add(m, today));
  run(re(`in\\s+(${NUM_RE})\\s+tag(?:en|e)?`), (m) => add(m, addDays(today, num(m[1]))));
  run(re('in\\s+(?:einer|1)\\s+woche'), (m) => add(m, addDays(today, 7)));
  // 5.12. / 5.12.2026 / 5/12
  run(/(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.?(?:\s?(\d{4}|\d{2})(?!\d))?/u, (m) => add(m, makeDate(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : null, now)));
  // 5. Dezember (2026)
  run(re(`(\\d{1,2})\\.?\\s*(${MONTH_RE})(?:\\s+(\\d{4}))?`), (m) => add(m, makeDate(Number(m[1]), monthIndex(m[2]), m[3] ? Number(m[3]) : null, now)));
  // (nächsten|kommenden) Freitag
  run(re(`(?:(n(?:ä|ae)chste[nrms]?|kommende[nrms]?)\\s+)?(${WEEKDAY_RE})`), (m) => {
    const target = weekdayIndex(m[2]);
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    add(m, addDays(today, diff));
  });
  return found.sort((a, b) => a.match.index - b.match.index);
}

function clampHour(h, hint) {
  if (hint === 'pm' && h < 12) return h + 12;
  if (hint === 'am') return h === 12 ? 0 : h;
  return h;
}

/** Tageszeit-Hinweis: "abends/nachmittags" → pm, "morgens/früh/nachts" → am. */
function dayPartHint(text) {
  if (re('abends|nachmittags|heute abend|am abend|am nachmittag').test(text)) return 'pm';
  if (re('morgens|früh|nachts|vormittags|am morgen|am vormittag').test(text)) return 'am';
  return null;
}

/** Eine Uhrzeit "HH:MM" oder null; Ganzzahl-Stunden 1–6 ohne Hinweis gelten als Nachmittag ("um drei"). */
function findTime(m, hint, regexes) {
  for (const { regex, read } of regexes) {
    const match = m.work.match(regex);
    if (!match) continue;
    const t = read(match);
    if (!t) continue;
    m.take(match);
    let { h, min } = t;
    h = clampHour(h, hint);
    if (!hint && t.guess && h >= 1 && h <= 6) h += 12;
    if (h > 23 || min > 59) return null;
    return { start: `${pad(h)}:${pad(min)}`, end: null };
  }
  return null;
}

const TIME_PATTERNS = [
  { regex: re(`halb\\s+(${NUM_RE})(?:\\s+uhr)?`), read: (x) => ({ h: (num(x[1]) + 23) % 24, min: 30, guess: true }) },
  { regex: re(`viertel\\s+nach\\s+(${NUM_RE})`), read: (x) => ({ h: num(x[1]), min: 15, guess: true }) },
  { regex: re(`viertel\\s+vor\\s+(${NUM_RE})`), read: (x) => ({ h: (num(x[1]) + 23) % 24, min: 45, guess: true }) },
  { regex: re(`(?:um\\s+)?(\\d{1,2})[:.](\\d{2})(?:\\s*uhr)?`), read: (x) => ({ h: Number(x[1]), min: Number(x[2]) }) },
  { regex: re(`(?:um\\s+)?(${NUM_RE})\\s+uhr\\s+(\\d{1,2})`), read: (x) => ({ h: num(x[1]), min: Number(x[2]) }) },
  { regex: re(`(?:um\\s+)?(${NUM_RE})\\s+uhr`), read: (x) => ({ h: num(x[1]), min: 0, guess: true }) },
  { regex: re(`um\\s+(${NUM_RE})`), read: (x) => ({ h: num(x[1]), min: 0, guess: true }) },
  { regex: re('mittags?|zu mittag'), read: () => ({ h: 12, min: 0 }) },
];

const REMIND_VALUES = [0, 5, 15, 30, 60, 1440];
const nearest = (v) => REMIND_VALUES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/**
 * Spoken sentence → proposal.
 * @returns {{kind:'event'|'vacation', title:string, date:string, endDate?:string, allDay:boolean,
 *            start:string|null, end:string|null, remind:number|null, haircut:null|{customer:string, price:number|null}}}
 */
export function parseVoice(input, now = new Date()) {
  const orig = String(input || '').replace(/\s+/g, ' ').trim();
  const m = masker(orig);
  const hint = dayPartHint(orig);
  const isVacation = re('urlaub|ferien').test(orig);
  const isHaircut = re('haare|haareschneiden|haarschnitt|friseur|haircut').test(orig);

  // ── Urlaub: von … bis …, "für N Tage/Wochen"
  let date = null;
  let endDate = null;
  if (isVacation) {
    const range = m.work.match(re(`(?:vom\\s+|von\\s+)?(\\d{1,2})\\.?(?:\\s*(${MONTH_RE}))?\\s+bis\\s+(?:zum\\s+|einschlie(?:ß|ss)lich\\s+)?(\\d{1,2})\\.?\\s*(${MONTH_RE})(?:\\s+(\\d{4}))?`));
    if (range) {
      const month2 = monthIndex(range[4]);
      const month1 = range[2] ? monthIndex(range[2]) : month2;
      const year = range[5] ? Number(range[5]) : null;
      const a = makeDate(Number(range[1]), month1, year, now);
      let b = makeDate(Number(range[3]), month2, year, now);
      if (a && b && b < a && !year) b = makeDate(Number(range[3]), month2, a.getFullYear() + 1, now);
      if (a && b) { date = a; endDate = b; m.take(range); }
    }
  }
  if (!date) {
    const dates = findDates(m.work, now);
    if (isVacation && dates.length >= 2 && re('bis|zum').test(m.work.slice(dates[0].match.index + dates[0].match[0].length, dates[1].match.index))) {
      date = dates[0].date; endDate = dates[1].date;
      dates.slice(0, 2).forEach((d) => m.take(d.match));
    } else if (dates.length) {
      date = dates[0].date;
      m.take(dates[0].match);
    }
  }
  // ── Erinnerung
  let remind = null;
  if (re('erinner\\w*|benachrichtig\\w*').test(m.work)) {
    const r = m.work.match(re(`(?:(${NUM_RE})\\s+)?(minuten?|stunden?|tage?|tag)\\s+(?:vorher|davor|früher)`));
    if (r) {
      const n = r[1] ? num(r[1]) : 1;
      const unit = r[2].toLowerCase();
      remind = nearest(unit.startsWith('m') ? n : unit.startsWith('s') ? n * 60 : n * 1440);
      m.take(r);
    } else if (re('pünktlich|zum zeitpunkt|sofort').test(m.work)) remind = 0;
    else remind = 15;
    for (const x of m.work.matchAll(new RegExp(re('(?:mit\\s+|und\\s+)?(?:einer\\s+)?(?:bitte\\s+)?erinner\\w*(?:\\s+mich)?|benachrichtig\\w*(?:\\s+mich)?|pünktlich|zum zeitpunkt').source, 'giu'))) m.take(x);
  }

  // Dauer in Tagen/Wochen: "für 5 Tage", "eine Woche", "zwei Wochen"
  if (isVacation && date && !endDate) {
    const days = m.work.match(re(`(?:für\\s+)?(${NUM_RE})\\s+(tag(?:e|en)?|woche(?:n)?)`));
    if (days) {
      const n = num(days[1]);
      endDate = addDays(date, /^w/i.test(days[2]) ? n * 7 - 1 : n - 1);
      m.take(days);
    }
  }

  // ── Haareschneiden: Kunde und Preis
  let haircut = null;
  if (isHaircut && !isVacation) {
    let price = null;
    const p = m.work.match(/(\d+(?:[.,]\d+)?)\s*(?:euro|€)/i);
    if (p) { price = Number(p[1].replace(',', '.')); m.take(p); }
    const c = m.work.match(re('(?:bei|für|mit|von)\\s+([A-ZÄÖÜ][\\p{L}-]+)', 'u'));
    let customer = '';
    if (c) { customer = c[1]; m.take(c); }
    haircut = { customer, price };
  }

  // ── Uhrzeit, Ende, Dauer
  let start = null;
  let end = null;
  let allDay = re('ganzt(?:ä|ae)gig|den ganzen tag|ganzen tag').test(orig);
  if (allDay) { const x = m.work.match(re('ganzt(?:ä|ae)gig|den ganzen tag|ganzen tag')); if (x) m.take(x); }
  if (!isVacation && !allDay) {
    const span = m.work.match(re(`von\\s+(${NUM_RE})(?:[:.](\\d{2}))?(?:\\s*uhr)?\\s+bis\\s+(${NUM_RE})(?:[:.](\\d{2}))?(?:\\s*uhr)?`));
    if (span) {
      const h1 = clampHour(num(span[1]), hint);
      const h2 = clampHour(num(span[3]), hint);
      start = `${pad(h1)}:${span[2] || '00'}`;
      end = `${pad(h2)}:${span[4] || '00'}`;
      m.take(span);
    } else {
      const t = findTime(m, hint, TIME_PATTERNS);
      if (t) start = t.start;
    }
    if (start && !end) {
      const dur = m.work.match(re(`(?:für\\s+|ca\\.?\\s+)?(?:(${NUM_RE})\\s+)?(?:(eineinhalb|anderthalb)\\s+)?(stunden?|std\\.?|minuten?|min\\.?)`));
      let minutes = 0;
      if (dur) {
        const half = dur[2] ? 90 : 0;
        const n = dur[1] ? num(dur[1]) : (half ? 0 : 1);
        minutes = /^s/i.test(dur[3]) ? n * 60 + half : n;
        if (/^m/i.test(dur[3]) && minutes < 5) minutes = 0;
        if (minutes > 0) m.take(dur);
      }
      if (/^\d\d:\d\d$/.test(start || '') && !end) {
        end = fromMinutes(Math.min(23 * 60 + 59, toMinutes(start) + (minutes || 60)));
      }
    }
  }

  // ── Titel
  let work = m.work;
  let title = '';
  const explicit = work.match(re('(?:mit\\s+dem\\s+)?(?:titel|namens|betreff|mit\\s+dem\\s+namen|mit\\s+der\\s+überschrift)\\s*:?'));
  if (explicit) {
    title = work.slice(explicit.index + explicit[0].length);
  } else {
    title = work.replace(re(
      'trag(?:e|st)?(?:\\s+mir)?|eintragen|einen?|neuen?|neuer|termine?|bitte|mir|mich|ich\\s+(?:habe|hab|möchte|will|brauche)|soll(?:st|te)?|kannst\\s+du|könntest\\s+du|erstell(?:e|en)?|anlegen|leg(?:e)?\\s+an|hinzufügen|füge\\s+hinzu|kalender|er|wir|noch|auch|dann|mal',
      'giu'), ' ');
    if (isHaircut && !isVacation) title = title.replace(re('haare|haareschneiden|haarschnitt|friseur', 'giu'), ' ');
    if (isVacation) title = title.replace(re('urlaub|ferien', 'giu'), ' ');
  }
  title = title.replace(/[,.;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Verbindungswörter nur am Rand entfernen (innen gehören sie zum Titel: "Kaffee mit Anna")
  const EDGE = /^(?:am|um|für|von|vom|bis|zum|zur|der|die|das|den|dem|ist|hat|haben|und|bei|mit|im|in|auf|es|sein)\s+|\s+(?:am|um|für|von|vom|bis|zum|zur|der|die|das|den|dem|ist|hat|haben|und|bei|mit|im|in|auf|es|sein)$/iu;
  for (let i = 0; i < 6 && EDGE.test(title); i++) title = title.replace(EDGE, '').trim();
  if (title) title = title[0].toUpperCase() + title.slice(1);
  if (!title && isVacation) title = 'Urlaub';
  if (isHaircut && !isVacation && (!title || /^(?:haare\w*|friseur)$/i.test(title))) title = haircut?.customer ? `Haareschneiden · ${haircut.customer}` : 'Haareschneiden';

  if (!date) date = startOfDay(now);
  if (isVacation) {
    return { kind: 'vacation', title, date: toKey(date), endDate: endDate && toKey(endDate) > toKey(date) ? toKey(endDate) : undefined, allDay: true, start: null, end: null, remind: null, haircut: null };
  }
  if (!start) allDay = true; // ohne Uhrzeit: ganztägig (im Formular änderbar)
  return {
    kind: 'event', title, date: toKey(date), allDay,
    start: allDay ? null : start, end: allDay ? null : end,
    remind: allDay ? (remind === null ? null : remind >= 1440 ? 1440 : 0) : remind,
    haircut,
  };
}

/** Kurzer Vorschau-Text für die Anzeige im Sheet, z. B. "Heute · 13:00–14:00 · Zahnarzt". */
export function describeVoice(p, now = new Date()) {
  const today = startOfDay(now);
  const key = toKey(today);
  const tomorrow = toKey(addDays(today, 1));
  const [y, mo, da] = p.date.split('-').map(Number);
  const d = new Date(y, mo - 1, da);
  const dayText = p.date === key ? 'Heute' : p.date === tomorrow ? 'Morgen'
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  let when = dayText;
  if (p.endDate) {
    const [y2, m2, d2] = p.endDate.split('-').map(Number);
    when = `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${new Date(y2, m2 - 1, d2).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
  } else if (p.kind === 'event') when += p.allDay ? ' · ganztägig' : ` · ${p.start}–${p.end}`;
  return `${when} · ${p.title || (p.kind === 'vacation' ? 'Urlaub' : 'ohne Titel')}`;
}
