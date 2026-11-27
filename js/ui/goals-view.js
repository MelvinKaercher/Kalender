// Tab "Vorsätze": Liste mit Abhak-Kreis für heute, Serie, Wochenpunkten und Erinnerungstext; unten das Archiv "Erreicht".
import { el } from './dom.js';
import { toKey, startOfWeek, startOfDay } from '../calendar.js';
import { streak, weekMarks, describeRemind, sortGoals, isScheduled, isChecked } from '../goals.js';
import * as store from '../store.js';

let archiveOpen = false;
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function renderGoals(root, { goals, now, onGoal, onAdd }) {
  const today = startOfDay(now);
  const active = sortGoals(goals.filter((g) => !g.done));
  const done = sortGoals(goals.filter((g) => g.done)).reverse();

  if (!goals.length) {
    root.append(el('div', { class: 'goals' },
      el('div', { class: 'empty' },
        el('div', { class: 'big', text: '🎯' }),
        el('div', { text: 'Noch keine Vorsätze.' }),
        el('div', { text: 'Zum Beispiel „Mehr Englisch lernen“ – mit täglicher Erinnerung und Abhaken.' }),
        el('button', { type: 'button', onclick: onAdd, text: 'Vorsatz hinzufügen' }))));
    return;
  }

  const row = (g) => {
    const checked = isChecked(g, today);
    const dueToday = isScheduled(g, today);
    const n = streak(g, today);
    const marks = weekMarks(g, startOfWeek(today));
    return el('div', { class: `goal${checked ? ' ticked' : ''}` },
      el('button', {
        class: `tick${checked ? ' on' : ''}`, type: 'button', role: 'checkbox', 'aria-checked': String(checked),
        'aria-label': `${g.title}: heute ${checked ? 'erledigt' : 'noch offen'}`,
        onclick: () => store.toggleCheck(g.id, toKey(today)),
      }, checked ? '✓' : ''),
      el('button', { class: 'goal-main', type: 'button', onclick: () => onGoal(g) },
        el('div', { class: 'goal-title', text: g.title }),
        g.note ? el('div', { class: 'goal-note', text: g.note }) : null,
        el('div', { class: 'goal-meta' },
          n ? el('span', { class: 'streak', text: `🔥 ${n} ${n === 1 ? 'Tag' : 'Tage'}` }) : el('span', { class: 'streak none', text: dueToday ? 'Heute dran' : 'Heute frei' }),
          g.remind ? el('span', { class: 'remind', text: `🔔 ${describeRemind(g.remind)}` }) : null),
        el('div', { class: 'week-dots', 'aria-hidden': 'true' }, marks.map((m, i) =>
          el('span', { class: `dot${m.checked ? ' on' : ''}${m.scheduled ? '' : ' off'}${m.key === toKey(today) ? ' today' : ''}`, title: WD[i] }, WD[i][0])))));
  };

  const archive = done.length
    ? el('div', { class: 'goal-archive' },
        el('button', { class: 'archive-head', type: 'button', 'aria-expanded': String(archiveOpen), onclick: () => { archiveOpen = !archiveOpen; root.replaceChildren(); renderGoals(root, { goals: store.goals(), now, onGoal, onAdd }); } },
          el('span', { text: `Erreicht (${done.length})` }), el('span', { text: archiveOpen ? '▾' : '▸' })),
        archiveOpen ? done.map((g) =>
          el('button', { class: 'goal-done', type: 'button', onclick: () => onGoal(g) }, el('span', { text: '✓' }), el('span', { text: g.title }))) : null)
    : null;

  root.append(el('div', { class: 'goals' },
    active.length ? active.map(row) : el('div', { class: 'empty small' }, el('div', { text: 'Alle Vorsätze erreicht 🎉' })),
    archive));
}
