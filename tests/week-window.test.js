import test from 'node:test';
import assert from 'node:assert/strict';
import { windowOf } from '../js/ui/week.js';

test('windowOf: Standard 8–21, wächst bei frühen/späten Terminen', () => {
  assert.deepEqual(windowOf([]), { startH: 8, endH: 21 });
  assert.deepEqual(windowOf([{ start: '09:00', end: '10:00' }, { start: '20:00', end: '21:00' }]), { startH: 8, endH: 21 });
  assert.deepEqual(windowOf([{ start: '07:30', end: '08:30' }]), { startH: 7, endH: 21 });
  assert.deepEqual(windowOf([{ start: '21:30', end: '22:15' }]), { startH: 8, endH: 23 });
  assert.deepEqual(windowOf([{ start: '23:00', end: '23:59' }]), { startH: 8, endH: 24 });
  assert.deepEqual(windowOf([{ start: '06:00' }]), { startH: 6, endH: 21 }); // ohne Ende: 1 Stunde
});
