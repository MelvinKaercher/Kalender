// Schulferien Baden-Württemberg (Stand: November 2026, bis Sommerferien 2027).
//
// Quelle: mehrere Ferienportale (u. a. kalenderpedia.de, travelbook.de, Stuttgarter Zeitung), die
// untereinander übereinstimmen. Offizielle Termine: Kultusministerium Baden-Württemberg (km-bw.de).
// Ohne Gewähr. Die „beweglichen Ferientage" der einzelnen Schulen sind nicht enthalten.
//
// kind: 'ferien' = Ferienzeitraum, 'frei' = einzelner unterrichtsfreier Tag
// Zum Ergänzen einfach eine Zeile hinzufügen (Datum als 'JJJJ-MM-TT', Ende einschließlich).
import { toKey } from './calendar.js';

export const SCHOOL_HOLIDAYS = [
  { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11', kind: 'ferien' },
  { name: 'Pfingstferien', start: '2026-05-26', end: '2026-06-05', kind: 'ferien' },
  { name: 'Sommerferien', start: '2026-07-30', end: '2026-09-12', kind: 'ferien' },
  { name: 'Herbstferien', start: '2026-10-26', end: '2026-10-30', kind: 'ferien' },
  { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-09', kind: 'ferien' },
  // Osterferien 2027: einige Portale nennen 25.03.–03.04.; hier die Lesart "Ferien ab 30.03., 25.03. einzeln frei".
  { name: 'Unterrichtsfreier Tag (Gründonnerstag)', start: '2027-03-25', end: '2027-03-25', kind: 'frei' },
  { name: 'Osterferien', start: '2027-03-30', end: '2027-04-03', kind: 'ferien' },
  { name: 'Pfingstferien', start: '2027-05-18', end: '2027-05-29', kind: 'ferien' },
  { name: 'Sommerferien', start: '2027-07-29', end: '2027-09-11', kind: 'ferien' },
];

export const SOURCE_NOTE =
  'Schulferien Baden-Württemberg bis Sommer 2027, Stand November 2026, ohne Gewähr. Bewegliche Ferientage einzelner Schulen sind nicht enthalten. Offizielle Termine: Kultusministerium Baden-Württemberg.';

/** Ferien bzw. freie Tage, die auf `date` fallen. */
export function vacationsOn(date) {
  const key = toKey(date);
  return SCHOOL_HOLIDAYS.filter((v) => v.start <= key && key <= v.end);
}
