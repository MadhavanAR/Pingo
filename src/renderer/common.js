'use strict';

/* eslint-disable no-unused-vars -- globals shared with the page scripts loaded after this one */

/**
 * Shared by every renderer page: reminder copy, formatting, a tiny DOM
 * builder (no innerHTML, so user text can never inject markup), icons and the
 * reminder sounds.
 */

/** What each kind of reminder says. Mirrors TYPES in src/main/reminders.js. */
const REMINDER_TYPES = Object.freeze({
  water: {
    label: 'Drink water',
    done: 'I drank',
    prompts: [
      'Time to drink some water. Stay glowing!',
      'Hydration check! Take a few sips.',
      'Water break! Your body will thank you.',
      'Psst… a glass of water?',
    ],
    cheers: ['Hydrated and happy!', 'Amazing, keep it up!', "That's the spirit!"],
  },
  stretch: {
    label: 'Stretch',
    done: 'Stretched',
    prompts: [
      'Stand up and stretch for a minute.',
      'Roll your shoulders, reach for the sky.',
      'Time for a quick stretch break.',
    ],
    cheers: ['Feeling looser already!', 'Nice stretch!', 'Your back says thanks!'],
  },
  eyes: {
    label: 'Rest your eyes',
    done: 'Done',
    prompts: [
      'Look at something far away for 20 seconds.',
      'Eye break: blink slowly and look out the window.',
      'Give your eyes a rest from the screen.',
    ],
    cheers: ['Eyes refreshed!', 'Nice and easy.', 'Well rested!'],
  },
  posture: {
    label: 'Sit up straight',
    done: 'Fixed it',
    prompts: ['Posture check! Shoulders back, sit tall.', 'How are you sitting? Straighten up.'],
    cheers: ['Standing tall!', 'Looking sharp!', 'Great posture!'],
  },
  medicine: {
    label: 'Take your medicine',
    done: 'Taken',
    prompts: ['Time to take your medicine.', "Don't forget your medicine."],
    cheers: ['Taken care of!', 'Great job!', 'Well done!'],
  },
  custom: {
    label: 'Reminder',
    done: 'Done',
    prompts: ['Time for your reminder.'],
    cheers: ['Nice work!', 'Done and dusted!', 'Great job!'],
  },
});

const TYPE_ORDER = ['water', 'stretch', 'eyes', 'posture', 'medicine', 'custom'];

const typeInfo = (type) => REMINDER_TYPES[type] ?? REMINDER_TYPES.custom;

/** The name shown in lists: the user's own words, or the type's label. */
const reminderTitle = (r) => r.message || typeInfo(r.type).label;

const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- Time ------------------------------------------------------------------

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** Monday first, the way most calendars outside the US lay out a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const pad2 = (n) => String(n).padStart(2, '0');
const minutesToHHMM = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const hhmmToMinutes = (s) => {
  const [h, m] = String(s).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const clockTime = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "in 12 min", "in 2 h 5 min", "now". */
function relativeIn(ms, now = Date.now()) {
  const minutes = Math.max(0, Math.round((ms - now) / 60000));
  return minutes === 0 ? 'now' : `in ${formatDuration(minutes)}`;
}

/** "Today 14:30", "Tomorrow 09:00", "Mon 09:00". */
function dayAndTime(ms, now = Date.now()) {
  const d = new Date(ms);
  const today = new Date(now);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(today)) / 86400000);
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : DAY_SHORT[d.getDay()];
  return `${label} ${clockTime(ms)}`;
}

function describeDays(days) {
  const set = [...days].sort((a, b) => a - b).join();
  if (set === '0,1,2,3,4,5,6') return 'Every day';
  if (set === '1,2,3,4,5') return 'Weekdays';
  if (set === '0,6') return 'Weekends';
  return WEEK_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(', ');
}

/** One line that says when a reminder appears. */
function describeSchedule(r) {
  const when =
    r.mode === 'times' ? `At ${r.times.join(', ')}` : `Every ${formatDuration(r.everyMin)}`;
  const hours =
    r.mode === 'interval' && r.start !== r.end
      ? `${minutesToHHMM(r.start)}–${minutesToHHMM(r.end)}`
      : null;
  return [when, describeDays(r.days), hours].filter(Boolean).join(' · ');
}

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// --- DOM ---------------------------------------------------------------------

/**
 * h('button.btn.primary', { onclick, 'aria-label': 'x' }, 'Text', child)
 * Attributes starting with "on" become listeners; strings become text nodes.
 */
function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'class') el.className += ` ${value}`;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key in el && key !== 'list' && typeof value !== 'string') el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Outline icons, 24-unit grid, 1.5 stroke. Each entry is a list of path data. */
const ICON_PATHS = Object.freeze({
  home: ['M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z'],
  bell: ['M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z', 'M10 20.5a2 2 0 0 0 4 0'],
  smile: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M8.5 14.5a4.5 4.5 0 0 0 7 0',
    'M9 9.5h.01M15 9.5h.01',
  ],
  palette: [
    'M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.9 1.2-1.8l-.4-.9c-.5-1 .3-2.3 1.4-2.3H17a4 4 0 0 0 4-4c0-5-4-9-9-9z',
    'M7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  ],
  gear: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],
  plus: ['M12 5v14M5 12h14'],
  play: ['M8 5.5v13l10.5-6.5z'],
  pause: ['M8 5v14M16 5v14'],
  chevron: ['M9 6l6 6-6 6'],
  back: ['M15 6l-6 6 6 6'],
  trash: [
    'M4 7h16',
    'M10 11v6M14 11v6',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
    'M9 7V4h6v3',
  ],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
  close: ['M6 6l12 12M18 6 6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  volume: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
});

function icon(name, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', name === 'play' ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICON_PATHS[name] ?? []) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

// --- Sound -------------------------------------------------------------------

let audioContext = null;

/** Notes as [frequency Hz, start s, length s]. Synthesised: no audio files, no network. */
const SOUNDS = Object.freeze({
  chime: {
    wave: 'sine',
    gain: 0.18,
    notes: [
      [880, 0, 0.5],
      [1318.5, 0.12, 0.7],
    ],
  },
  pop: {
    wave: 'triangle',
    gain: 0.22,
    notes: [
      [523.3, 0, 0.09],
      [784, 0.07, 0.14],
    ],
  },
  bell: {
    wave: 'sine',
    gain: 0.16,
    notes: [
      [659.3, 0, 1.1],
      [1318.5, 0, 0.6],
      [987.8, 0.18, 0.9],
    ],
  },
});

function playSound(name) {
  const sound = SOUNDS[name];
  if (!sound) return;
  try {
    audioContext ??= new AudioContext();
    const t0 = audioContext.currentTime + 0.02;
    for (const [freq, start, length] of sound.notes) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = sound.wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(sound.gain, t0 + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + length + 0.05);
    }
  } catch (err) {
    console.warn('Sound unavailable:', err);
  }
}
