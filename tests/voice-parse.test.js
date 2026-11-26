import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoice, describeVoice } from '../js/voice-parse.js';

const NOW = new Date(2026, 10, 26, 10, 0); // Do 26.11.2026
const p = (t) => parseVoice(t, NOW);

test('heute um 13 Uhr mit Titel', () => {
  const r = p('Trag mir einen Termin heute um 13 Uhr ein mit dem Titel Zahnarzt');
  assert.deepEqual([r.kind, r.date, r.start, r.end, r.allDay, r.title], ['event', '2026-11-26', '13:00', '14:00', false, 'Zahnarzt']);
});
test('morgen halb drei', () => {
  const r = p('Termin morgen um halb drei Besprechung');
  assert.deepEqual([r.date, r.start, r.title], ['2026-11-27', '14:30', 'Besprechung']);
});
test('Uhrzeit mit Doppelpunkt und Wochentag', () => {
  const r = p('Freitag 15:30 Kaffee mit Anna');
  assert.deepEqual([r.date, r.start, r.title], ['2026-11-27', '15:30', 'Kaffee mit Anna']);
});
test('Wochentag nächste Woche: gleicher Wochentag wie heute = in 7 Tagen', () => {
  assert.equal(p('am Donnerstag um 9 Uhr Arzt').date, '2026-12-03');
  assert.equal(p('am Donnerstag um 9 Uhr Arzt').start, '09:00');
});
test('Datum mit Monatsname, Jahr wird ergänzt', () => {
  assert.equal(p('am 5. Dezember um 18 Uhr Weihnachtsfeier').date, '2026-12-05');
  assert.equal(p('am 5. Januar um 18 Uhr Treffen').date, '2027-01-05');
  assert.equal(p('am 5.12. um 18 Uhr Treffen').date, '2026-12-05');
});
test('Dauer und Ende', () => {
  const a = p('heute um 13 Uhr für 2 Stunden Training');
  assert.deepEqual([a.start, a.end, a.title], ['13:00', '15:00', 'Training']);
  const b = p('heute von 14 bis 16 Uhr Meeting');
  assert.deepEqual([b.start, b.end, b.title], ['14:00', '16:00', 'Meeting']);
});
test('ohne Uhrzeit oder ausdrücklich: ganztägig', () => {
  assert.equal(p('morgen Geburtstagsfeier').allDay, true);
  assert.equal(p('übermorgen ganztägig Messe').allDay, true);
  assert.equal(p('übermorgen ganztägig Messe').date, '2026-11-28');
});
test('Erinnerung', () => {
  const r = p('heute um 18 Uhr Training mit Erinnerung 30 Minuten vorher');
  assert.deepEqual([r.start, r.remind, r.title], ['18:00', 30, 'Training']);
});
test('Urlaub von … bis …', () => {
  const r = p('Urlaub vom 10. bis 14. August');
  assert.deepEqual([r.kind, r.date, r.endDate, r.title], ['vacation', '2027-08-10', '2027-08-14', 'Urlaub']);
  const r2 = p('Urlaub Mallorca vom 3.12. bis zum 10.12.');
  assert.deepEqual([r2.date, r2.endDate, r2.title], ['2026-12-03', '2026-12-10', 'Mallorca']);
  const r3 = p('Urlaub ab morgen für 5 Tage');
  assert.deepEqual([r3.date, r3.endDate], ['2026-11-27', '2026-12-01']);
});
test('Haareschneiden mit Kunde und Preis', () => {
  const r = p('Haareschneiden bei Salim morgen um 16 Uhr 15 Euro');
  assert.deepEqual([r.date, r.start, r.title, r.haircut], ['2026-11-27', '16:00', 'Haareschneiden · Salim', { customer: 'Salim', price: 15 }]);
});
test('leerer Satz: heute, ganztägig, ohne Titel', () => {
  const r = p('');
  assert.deepEqual([r.date, r.allDay, r.title], ['2026-11-26', true, '']);
});
test('Vorschau-Text', () => {
  assert.equal(describeVoice(p('heute um 13 Uhr Zahnarzt'), NOW), 'Heute · 13:00–14:00 · Zahnarzt');
});
