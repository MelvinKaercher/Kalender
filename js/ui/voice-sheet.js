// Sprach-Eingabe: Mikrofon antippen (oder das Mikrofon der iPhone-Tastatur nutzen), Satz sagen,
// die App wertet ihn lokal aus und öffnet den Termin vorausgefüllt zur Bestätigung.
import { el } from './dom.js';
import { openSheet } from './sheet.js';
import { openEventForm, openVacationForm } from './forms.js';
import { parseVoice, describeVoice } from '../voice-parse.js';
import { fromKey } from '../calendar.js';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function openVoiceSheet({ now = () => new Date() } = {}) {
  const text = el('textarea', {
    class: 'voice-text', rows: '3', maxlength: '400', autocomplete: 'off', autocapitalize: 'sentences',
    placeholder: 'z. B. „Termin heute um 13 Uhr mit dem Titel Zahnarzt“', 'aria-label': 'Gesprochener Text',
  });
  const preview = el('div', { class: 'voice-preview empty', 'aria-live': 'polite', text: 'Sag oder tippe, was eingetragen werden soll.' });
  const hint = el('p', { class: 'voice-hint' });
  hint.textContent = Recognition
    ? 'Mikrofon antippen und sprechen. Alternativ: ins Textfeld tippen und das Mikrofon der Tastatur benutzen. Die Sprache wird vom iPhone (Apple) in Text umgewandelt, den Termin erkennt die App nur lokal.'
    : 'Tippe ins Textfeld und dann auf das Mikrofon unten rechts auf der iPhone-Tastatur (Diktieren). Die Sprache wird vom iPhone in Text umgewandelt, den Termin erkennt die App nur lokal.';

  let rec = null;
  const mic = Recognition
    ? el('button', { class: 'voice-mic', type: 'button', onclick: toggle }, '🎙 Aufnehmen')
    : null;

  function paint() {
    const t = text.value.trim();
    preview.classList.toggle('empty', !t);
    preview.textContent = t ? describeVoice(parseVoice(t, now()), now()) : 'Sag oder tippe, was eingetragen werden soll.';
  }
  text.addEventListener('input', paint);

  function stop() { try { rec && rec.stop(); } catch { /* ignorieren */ } }
  function toggle() {
    if (rec) { stop(); return; }
    rec = new Recognition();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      text.value = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
      paint();
    };
    rec.onerror = (e) => {
      hint.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Das Mikrofon ist nicht erlaubt. Erlaube es in den iPhone-Einstellungen, oder nutze das Mikrofon der Tastatur im Textfeld.'
        : 'Das hat nicht geklappt. Versuche es noch einmal oder nutze das Mikrofon der Tastatur im Textfeld.';
    };
    rec.onend = () => { rec = null; if (mic) { mic.classList.remove('rec'); mic.textContent = '🎙 Aufnehmen'; } };
    try {
      rec.start();
      mic.classList.add('rec');
      mic.textContent = '■ Stopp';
    } catch { rec = null; }
  }

  function proceed() {
    stop();
    const t = text.value.trim();
    if (!t) { text.focus(); return; }
    const p = parseVoice(t, now());
    const date = fromKey(p.date);
    if (p.kind === 'vacation') openVacationForm({ date, prefill: p });
    else {
      openEventForm({
        date, haircut: !!p.haircut,
        prefill: { title: p.title, allDay: p.allDay, ...(p.allDay ? {} : { start: p.start, end: p.end }), remind: p.remind, haircut: p.haircut || undefined },
      });
    }
  }

  const sheet = openSheet({
    title: 'Sprache',
    left: el('button', { class: 'bar-btn', type: 'button', text: 'Abbrechen', onclick: () => { stop(); sheet.close(); } }),
    right: el('button', { class: 'bar-btn strong', type: 'button', text: 'Weiter', onclick: proceed }),
    content: [mic, el('div', { class: 'group' }, el('div', { class: 'row stack' }, text)), preview, hint],
  });
  if (!Recognition) setTimeout(() => text.focus(), 350);
  return sheet;
}
