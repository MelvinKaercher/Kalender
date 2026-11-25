// Termin-Farben. Ein Termin hat `color: '#rrggbb'` oder `null` (= Akzentfarbe der App).
// Reine Logik, ohne DOM – gut testbar.

export const PALETTE = [
  { name: 'Rot', value: '#e5484d' },
  { name: 'Orange', value: '#f76b15' },
  { name: 'Gelb', value: '#e5a50a' },
  { name: 'Grün', value: '#30a46c' },
  { name: 'Türkis', value: '#12a594' },
  { name: 'Blau', value: '#3e63dd' },
  { name: 'Violett', value: '#8e4ec6' },
  { name: 'Pink', value: '#d6409f' },
];

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Gültige Farbe in Kleinbuchstaben, sonst null. */
export const normalizeHex = (v) => (isHex(v) ? v.toLowerCase() : null);

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Halbtransparente Fläche aus der Farbe, z. B. für Hintergründe von Terminblöcken. */
export function softOf(hex, alpha = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Inline-Style, der die Farbe als CSS-Variablen setzt (--c, --c-soft).
 * Leerer String ohne Farbe: dann gelten die Standardwerte im Stylesheet.
 */
export function colorStyle(color) {
  return isHex(color) ? `--c:${color.toLowerCase()};--c-soft:${softOf(color)};` : '';
}
