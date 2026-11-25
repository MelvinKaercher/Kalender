import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, isHex, normalizeHex, hexToRgb, softOf, colorStyle } from '../js/colors.js';

test('isHex akzeptiert nur #rrggbb', () => {
  assert.ok(isHex('#3e63dd'));
  assert.ok(isHex('#ABCDEF'));
  for (const bad of ['3e63dd', '#fff', '#12345', '#1234567', '#gggggg', '', null, undefined, 42, 'red']) {
    assert.ok(!isHex(bad), String(bad));
  }
});

test('normalizeHex: klein schreiben oder verwerfen', () => {
  assert.equal(normalizeHex('#ABCDEF'), '#abcdef');
  assert.equal(normalizeHex('blau'), null);
  assert.equal(normalizeHex(null), null);
});

test('hexToRgb und softOf', () => {
  assert.deepEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
  assert.equal(softOf('#ff8000', 0.2), 'rgba(255, 128, 0, 0.2)');
});

test('colorStyle: Variablen nur bei gültiger Farbe', () => {
  assert.equal(colorStyle(null), '');
  assert.equal(colorStyle('kaputt'), '');
  const s = colorStyle('#E5484D');
  assert.match(s, /--c:#e5484d;/);
  assert.match(s, /--c-soft:rgba\(229, 72, 77, 0\.15\);/);
});

test('Palette: 8 gültige, verschiedene Farben mit Namen', () => {
  assert.equal(PALETTE.length, 8);
  assert.ok(PALETTE.every((c) => isHex(c.value) && c.name));
  assert.equal(new Set(PALETTE.map((c) => c.value)).size, 8);
});
