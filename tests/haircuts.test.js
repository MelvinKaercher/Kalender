import test from 'node:test';
import assert from 'node:assert/strict';
import { isHaircut, eventColor, earned, endOf, isDone, parseEuro, fmtEuro, statsForYear, haircutsOfYear, HAIRCUT_COLOR } from '../js/haircuts.js';
import { PALETTE } from '../js/colors.js';

const hc = (date, start, end, price, tip, extra = {}) =>
  ({ id: `${date}${start}`, title: 'Haareschneiden', date, allDay: false, start, end, color: '#f76b15', haircut: { customer: '', price, tip }, ...extra });

test('Orange ist die Orange der Palette', () => {
  assert.equal(HAIRCUT_COLOR, PALETTE.find((p) => p.name === 'Orange').value);
  assert.equal(eventColor({ haircut: { price: 1 }, color: '#3e63dd' }), HAIRCUT_COLOR);
  assert.equal(eventColor({ color: '#3e63dd' }), '#3e63dd');
  assert.equal(eventColor({}), undefined);
});

test('isHaircut und Verdienst = Preis + Trinkgeld', () => {
  assert.equal(isHaircut({ title: 'x' }), false);
  assert.equal(isHaircut(null), false);
  assert.equal(isHaircut(hc('2026-11-25', '10:00', '11:00', 25, 5)), true);
  assert.equal(earned(hc('2026-11-25', '10:00', '11:00', 25, 5)), 30);
  assert.equal(earned(hc('2026-11-25', '10:00', '11:00', 19.9, 0.1)), 20);
  assert.equal(earned(hc('2026-11-25', '10:00', '11:00', 25, null)), 25);
  assert.equal(earned(hc('2026-11-25', '10:00', '11:00', null, null)), 0);
  assert.equal(earned({ title: 'Zahnarzt' }), 0);
});

test('parseEuro: Komma und Punkt, leer, ungültig', () => {
  assert.equal(parseEuro('25'), 25);
  assert.equal(parseEuro('12,5'), 12.5);
  assert.equal(parseEuro('12.50'), 12.5);
  assert.equal(parseEuro(' 20 € '), 20);
  assert.equal(parseEuro(''), null);
  assert.equal(parseEuro(null), null);
  for (const bad of ['-5', 'abc', '1,234', '1.2.3', '12,'] ) assert.ok(Number.isNaN(parseEuro(bad)), bad);
});

test('fmtEuro: deutsches Format', () => {
  assert.match(fmtEuro(1234.5), /^1\.234,50\s€$/);
  assert.match(fmtEuro(0), /^0,00\s€$/);
});

test('isDone / endOf', () => {
  const ev = hc('2026-11-25', '10:00', '11:00', 25, 0);
  assert.equal(isDone(ev, new Date(2026, 10, 25, 10, 59)), false);
  assert.equal(isDone(ev, new Date(2026, 10, 25, 11, 0)), true);
  assert.equal(endOf({ date: '2026-11-25', allDay: true }).getDate(), 26);
});

test('Jahresauswertung: Monate, Vergangen/Geplant, Ø, Jahresgrenzen', () => {
  const now = new Date(2026, 10, 25, 12, 0); // 25.11.2026 12:00
  const events = [
    hc('2026-01-10', '10:00', '11:00', 20, 2),
    hc('2026-01-10', '12:00', '13:00', 30, 0),
    hc('2026-11-25', '09:00', '10:00', 25, 5),   // heute, vorbei
    hc('2026-11-25', '15:00', '16:00', 40, 0),   // heute, später → geplant
    hc('2026-12-24', '10:00', '11:00', 50, 10),  // geplant
    hc('2025-12-31', '10:00', '11:00', 99, 0),   // anderes Jahr
    hc('2027-01-01', '10:00', '11:00', 99, 0),   // anderes Jahr
    { id: 'z', title: 'Zahnarzt', date: '2026-01-11', allDay: false, start: '10:00', end: '11:00' },
  ];
  const { months, total } = statsForYear(events, 2026, now);
  assert.equal(months.length, 12);
  assert.deepEqual([months[0].count, months[0].earned, months[0].avg], [2, 52, 26]);
  assert.deepEqual([months[10].count, months[10].earned, months[10].planned, months[10].plannedEarned], [1, 30, 1, 40]);
  assert.deepEqual([months[11].count, months[11].planned, months[11].plannedEarned], [0, 1, 60]);
  assert.equal(months[5].count + months[5].planned, 0);
  assert.deepEqual(total, { count: 3, earned: 82, planned: 2, plannedEarned: 100, avg: 27.33 });
  assert.equal(haircutsOfYear(events, 2026).length, 5);
  assert.deepEqual(months[0].items.map((e) => e.start), ['10:00', '12:00'], 'nach Zeit sortiert');
});

test('Leeres Jahr: alles 0, kein Teilen durch 0', () => {
  const { months, total } = statsForYear([], 2026, new Date(2026, 5, 1));
  assert.deepEqual(total, { count: 0, earned: 0, planned: 0, plannedEarned: 0, avg: 0 });
  assert.ok(months.every((m) => m.avg === 0));
});
