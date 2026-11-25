// Anzeige-Einstellungen (nur auf diesem Gerät): Feiertage und Schulferien ein-/ausblenden.
import * as store from './store.js';

const DEFAULTS = { holidays: true, vacations: true };

export const getDisplay = () => ({ ...DEFAULTS, ...(store.meta.get('display') || {}) });
export const setDisplay = (patch) => store.meta.set('display', { ...getDisplay(), ...patch });
