'use strict';

/* global REMINDER_TYPES, TYPE_ORDER, typeInfo, reminderTitle, DAY_LETTER, DAY_SHORT, WEEK_ORDER,
   minutesToHHMM, hhmmToMinutes, clockTime, formatDuration, relativeIn, dayAndTime, describeSchedule,
   greetingFor, h, append, icon, playSound, processSprite, isAnimatedFormat, readFileAsDataUrl */

/**
 * The control center: one window, five views behind hash routes.
 *
 *   #home                 today at a glance
 *   #reminders            every reminder; #reminders/<id> edits one,
 *                         #reminders/new-<type> creates one from a template
 *   #avatars              characters; #avatars/<id> or #avatars/new opens the studio
 *   #appearance           theme, bubble, accent, size, corner, sound
 *   #general              name, pause, start at login, about
 *
 * Every control saves itself (with a quiet "Saved" stamp), except the avatar
 * studio, whose images are processed first and saved with one button.
 */

const api = window.pingo;
const viewEl = document.getElementById('view');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');

const NAV = [
  { route: 'home', label: 'Home', icon: 'home' },
  { route: 'reminders', label: 'Reminders', icon: 'bell' },
  { route: 'avatars', label: 'Avatars', icon: 'smile' },
  { route: 'appearance', label: 'Appearance', icon: 'palette' },
  { route: 'general', label: 'General', icon: 'gear' },
];

const ACCENTS = [
  { key: 'teal', label: 'Teal', color: '#1b6e66' },
  { key: 'ocean', label: 'Ocean', color: '#1d5fbf' },
  { key: 'grass', label: 'Grass', color: '#2e7d32' },
  { key: 'sun', label: 'Amber', color: '#9a6400' },
  { key: 'coral', label: 'Coral', color: '#c23a4b' },
  { key: 'ink', label: 'Ink', color: '#1f201d' },
];

/** Sensible starting schedules for each template. */
const TEMPLATE_DEFAULTS = {
  water: { mode: 'interval', everyMin: 45 },
  stretch: { mode: 'interval', everyMin: 60 },
  eyes: { mode: 'interval', everyMin: 20 },
  posture: { mode: 'interval', everyMin: 30 },
  medicine: { mode: 'times', times: ['09:00', '21:00'] },
  custom: { mode: 'interval', everyMin: 60 },
};

/** Views that only display state re-render when it changes; editors keep their draft. */
const PASSIVE_VIEWS = new Set(['home', 'reminders', 'avatars']);

let state = null;
let avatars = { defaultKey: 'boy', avatars: [] };
let route = { name: 'home', id: null };
/** An image dropped on the gallery, waiting for the studio to pick it up. */
let pendingImage = null;

// --- Helpers -------------------------------------------------------------------

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/** A "Saved" stamp that fades in after each autosave. */
function makeStamp() {
  const el = h('span.stamp', { role: 'status' }, 'Saved');
  let timer = null;
  el.flash = (text = 'Saved') => {
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 1600);
  };
  return el;
}

const go = (hash) => {
  location.hash = hash;
};

function avatarByKey(key) {
  return (
    avatars.avatars.find((a) => a.key === key) ??
    avatars.avatars.find((a) => a.key === avatars.defaultKey) ??
    avatars.avatars[0]
  );
}

function thumb(key, size = 'thumb') {
  const a = avatarByKey(key);
  return h(`div.${size}`, a?.thumb ? h('img', { src: a.thumb, alt: '' }) : null);
}

/** Radio-style chip row. options: [{ value, label }] */
function chipGroup(options, current, onPick, label) {
  const group = h('div.chips', { role: 'radiogroup', 'aria-label': label });
  for (const opt of options) {
    group.append(
      h(
        'button.chip',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(opt.value === current),
          onclick: () => onPick(opt.value),
        },
        opt.label,
      ),
    );
  }
  return group;
}

function segmented(options, current, onPick, label) {
  const group = h('div.segmented', { role: 'radiogroup', 'aria-label': label });
  for (const opt of options) {
    group.append(
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(opt.value === current),
          onclick: () => onPick(opt.value),
        },
        opt.label,
      ),
    );
  }
  return group;
}

function toggle(checked, onChange, label, { disabled = false } = {}) {
  const el = h('button.switch', {
    type: 'button',
    role: 'switch',
    'aria-checked': String(checked),
    'aria-label': label,
    disabled,
  });
  el.addEventListener('click', (event) => {
    event.stopPropagation();
    const next = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return el;
}

function rangeInput({ min, max, step = 1, value, label, format, onInput }) {
  const output = h('output', format(value));
  const input = h('input', {
    type: 'range',
    min,
    max,
    step,
    value: String(value),
    'aria-label': label,
  });
  const paint = () => {
    input.style.setProperty('--fill', `${((input.value - min) / (max - min)) * 100}%`);
    output.textContent = format(Number(input.value));
  };
  input.addEventListener('input', () => {
    paint();
    onInput(Number(input.value));
  });
  paint();
  return h('div.range-row', input, output);
}

function titleRow(title, subline, actions = [], { greeting = false } = {}) {
  return h(
    'header.title-row',
    h('div', h(greeting ? 'h1.greeting' : 'h1', title), subline ? h('p.subline', subline) : null),
    actions.length ? h('div.actions', actions) : null,
  );
}

function pauseLabel() {
  if (state.pausedUntil === -1) return 'Paused until you resume';
  if (state.pausedUntil) return `Paused until ${clockTime(state.pausedUntil)}`;
  return null;
}

function pauseControls() {
  if (state.pausedUntil) {
    return h(
      'div.pause-options',
      h(
        'button.btn.small.primary',
        { type: 'button', onclick: () => setPaused(0) },
        icon('play'),
        'Resume',
      ),
    );
  }
  const options = [
    ['30 min', 30],
    ['1 hour', 60],
    ['2 hours', 120],
    ['Until tomorrow', 'tomorrow'],
  ];
  return h(
    'div.pause-options',
    options.map(([label, value]) =>
      h('button.btn.small', { type: 'button', onclick: () => setPaused(value) }, label),
    ),
  );
}

async function setPaused(value) {
  state = await api.setPaused(value);
  renderChrome();
  if (PASSIVE_VIEWS.has(route.name) || route.name === 'general') render();
  toast(value === 0 ? 'Reminders resumed' : pauseLabel());
}

function bubblePreview(text, doneLabel, style = state.settings.bubbleStyle) {
  return h(
    `div.mini-bubble${style === 'pixel' ? '.pixel' : ''}`,
    h('p.mini-text', text),
    h('div.mini-actions', h('span', doneLabel), h('span', 'Snooze')),
  );
}

function promptPreview(reminder) {
  const name = state.settings.name;
  if (reminder.message) return name ? `Hey ${name}! ${reminder.message}` : reminder.message;
  const prompt = typeInfo(reminder.type).prompts[0];
  return name ? `${name}, ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}` : prompt;
}

const enabledUpcoming = () =>
  state.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt);

// --- Home ------------------------------------------------------------------------

function homeView() {
  const name = state.settings.name;
  const next = enabledUpcoming();
  const on = state.reminders.filter((r) => r.enabled).length;
  const weekDone = state.week.reduce((n, d) => n + d.done, 0);

  let finding;
  if (state.pausedUntil) finding = `${pauseLabel()}.`;
  else if (next.length) {
    finding = [
      'Next: ',
      h('strong', reminderTitle(next[0])),
      ` at ${clockTime(next[0].nextAt)}, ${relativeIn(next[0].nextAt, Date.now())}.`,
    ];
  } else finding = 'No reminders are on. Add one and Pingo will walk on when it’s time.';

  const kpi = (label, value, suffix) =>
    h(
      'div.kpi',
      h('div.kpi-label', label),
      h('div.kpi-value', String(value), suffix ? h('small', suffix) : null),
    );

  const upNext = h(
    'section.panel.span-8',
    h(
      'div.panel-title',
      h('span', 'Up next'),
      h('a.small', { href: '#reminders' }, 'All reminders'),
    ),
    next.length
      ? h(
          'div.rows',
          next
            .slice(0, 5)
            .map((r) =>
              h(
                'a.row',
                { href: `#reminders/${r.id}` },
                h(
                  'div.row-time',
                  clockTime(r.nextAt),
                  h('small', dayAndTime(r.nextAt).split(' ')[0]),
                ),
                thumb(r.avatar ?? state.defaultAvatar),
                h(
                  'div',
                  h('div.row-title', reminderTitle(r)),
                  h('div.row-meta', describeSchedule(r)),
                ),
                h('span.small.muted.num', relativeIn(r.nextAt)),
              ),
            ),
        )
      : h(
          'div.empty',
          'Nothing scheduled.',
          h(
            'button.btn.small',
            { type: 'button', onclick: () => go('reminders/new-water') },
            icon('plus'),
            'New reminder',
          ),
        ),
  );

  const buddy = avatarByKey(state.defaultAvatar);
  const buddyPanel = h(
    'section.panel.span-4',
    h('div.panel-title', h('span', 'Your buddy')),
    h(
      'div.buddy',
      h('div.portrait', buddy?.thumb ? h('img', { src: buddy.thumb, alt: buddy.label }) : null),
      h(
        'div.buddy-name',
        h('span', buddy?.label ?? 'Classic'),
        h('a.small', { href: '#avatars' }, 'Change'),
      ),
    ),
  );

  const max = Math.max(1, ...state.week.map((d) => d.done));
  const todayIndex = state.week.length - 1;
  const week = h(
    'section.panel.span-8',
    h(
      'div.panel-title',
      h('span', 'Done this week'),
      h('span.small.muted.num', `${weekDone} in 7 days`),
    ),
    h(
      'div.week',
      {
        role: 'img',
        'aria-label': state.week.map((d) => `${DAY_SHORT[d.weekday]} ${d.done}`).join(', '),
      },
      state.week.map((d, i) =>
        h(
          'div.bar-col',
          h('span.bar-value', String(d.done)),
          h(
            'div.bar-track',
            h(`div.bar${i === todayIndex ? '.today' : ''}${d.done === 0 ? '.zero' : ''}`, {
              style: { height: `${(d.done / max) * 96}px`, animationDelay: `${i * 30}ms` },
            }),
          ),
          h(
            `span.bar-label${i === todayIndex ? '.today' : ''}`,
            i === todayIndex ? 'Today' : DAY_SHORT[d.weekday],
          ),
        ),
      ),
    ),
  );

  const pause = h(
    'section.panel.span-4',
    h('div.panel-title', h('span', state.pausedUntil ? 'Paused' : 'Need some quiet?')),
    h(
      'p.muted',
      state.pausedUntil
        ? `${pauseLabel()}. Reminders that fall due meanwhile are skipped.`
        : 'Pause every reminder for a while, then pick up where you left off.',
    ),
    pauseControls(),
  );

  return [
    titleRow(
      `${greetingFor()}${name ? `, ${name}` : ''}.`,
      finding,
      [
        h(
          'button.btn',
          {
            type: 'button',
            disabled: !next.length,
            onclick: () => api.previewReminder(next[0]),
          },
          icon('play'),
          'Show the next one',
        ),
        h(
          'button.btn.primary',
          { type: 'button', onclick: () => go('reminders/new-water') },
          icon('plus'),
          'New reminder',
        ),
      ],
      { greeting: true },
    ),
    h(
      'div.grid',
      h(
        'section.kpis.span-12',
        kpi('Done today', state.today.done),
        kpi('Snoozed today', state.today.snoozed),
        kpi('Reminders on', on, `of ${state.reminders.length}`),
        kpi('Done this week', weekDone),
      ),
      upNext,
      buddyPanel,
      week,
      pause,
    ),
  ];
}

// --- Reminders list ----------------------------------------------------------------

function remindersView() {
  const list = state.reminders;
  const on = list.filter((r) => r.enabled);
  const next = enabledUpcoming()[0];
  const subline = state.pausedUntil
    ? `${on.length} on · ${pauseLabel().toLowerCase()}`
    : `${on.length} on${next ? ` · next ${reminderTitle(next).toLowerCase()} at ${clockTime(next.nextAt)}` : ''}`;

  const rows = list.map((r) => {
    const row = h(
      `div.list-row${r.enabled ? '' : '.off'}`,
      {
        role: 'link',
        tabindex: '0',
        'aria-label': `Edit ${reminderTitle(r)}`,
        onclick: () => go(`reminders/${r.id}`),
        onkeydown: (e) => e.key === 'Enter' && go(`reminders/${r.id}`),
      },
      toggle(
        r.enabled,
        (enabled) => api.saveReminder({ id: r.id, enabled }),
        `${reminderTitle(r)} on`,
      ),
      thumb(r.avatar ?? state.defaultAvatar),
      h('div', h('div.row-title', reminderTitle(r)), h('div.row-meta', describeSchedule(r))),
      h('div.next', r.enabled && r.nextAt ? dayAndTime(r.nextAt) : h('span.muted', 'Off')),
      h('div.done-count', `${r.doneToday} today`),
      icon('chevron'),
    );
    return row;
  });

  const templates = h(
    'section.templates',
    h('h2', 'Start from a template'),
    h('p.muted', 'Each comes with its own wording, celebration and a schedule you can change.'),
    h(
      'div.chips',
      TYPE_ORDER.map((type) =>
        h(
          'button.chip',
          { type: 'button', onclick: () => go(`reminders/new-${type}`) },
          typeInfo(type).label,
        ),
      ),
    ),
  );

  return [
    titleRow('Reminders', subline, [
      h(
        'button.btn.primary',
        {
          type: 'button',
          disabled: list.length >= state.maxReminders,
          onclick: () => go('reminders/new-custom'),
        },
        icon('plus'),
        'New reminder',
      ),
    ]),
    list.length
      ? h(
          'div',
          h(
            'div.list-head',
            h('span', 'On'),
            h('span'),
            h('span', 'Reminder'),
            h('span.num', 'Next'),
            h('span.num.done-head', 'Done'),
            h('span'),
          ),
          rows,
        )
      : h('div.empty', 'No reminders yet. Pick a template below to make your first one.'),
    templates,
  ];
}

async function createReminder(type) {
  const kind = Object.hasOwn(REMINDER_TYPES, type) ? type : 'custom';
  const saved = await api.saveReminder({ type: kind, message: '', ...TEMPLATE_DEFAULTS[kind] });
  if (!saved) {
    toast(`You can have up to ${state.maxReminders} reminders.`);
    location.replace('#reminders');
    return;
  }
  state = await api.getState();
  location.replace(`#reminders/${saved.id}`);
}

// --- Reminder editor ----------------------------------------------------------------

function reminderEditorView(id) {
  const found = state.reminders.find((r) => r.id === id);
  if (!found) {
    return [
      h('a.crumb', { href: '#reminders' }, icon('back', 14), 'Reminders'),
      titleRow('Reminder not found', 'It may have been deleted.'),
    ];
  }
  const draft = structuredClone(found);
  delete draft.nextAt; // view-only fields, not part of the reminder
  delete draft.doneToday;
  const stamp = makeStamp();

  const persist = debounce(async () => {
    const saved = await api.saveReminder(draft);
    if (saved) stamp.flash();
    else stamp.flash('Couldn’t save');
  }, 350);

  const titleEl = h('h1', reminderTitle(draft));
  const sublineEl = h('p.subline', describeSchedule(draft));
  const previewText = h('p.mini-text');
  const sections = {};

  function changed({ rerender = [] } = {}) {
    titleEl.textContent = reminderTitle(draft);
    sublineEl.textContent = describeSchedule(draft);
    for (const key of rerender) {
      const fresh = SECTION_BUILDERS[key]();
      sections[key].replaceWith(fresh);
      sections[key] = fresh;
    }
    paintPreview();
    persist();
  }

  const SECTION_BUILDERS = {
    what() {
      const message = h('input.input', {
        type: 'text',
        maxlength: '120',
        value: draft.message,
        placeholder: typeInfo(draft.type).prompts[0],
        'aria-label': 'Message',
        oninput: (e) => {
          draft.message = e.target.value;
          changed();
        },
      });
      return h(
        'section.section',
        h('h2', 'What'),
        chipGroup(
          TYPE_ORDER.map((t) => ({ value: t, label: typeInfo(t).label })),
          draft.type,
          (type) => {
            draft.type = type;
            changed({ rerender: ['what'] });
          },
          'Kind of reminder',
        ),
        h(
          'div.field',
          h('label.label', 'Message'),
          message,
          h('p.hint', 'Leave it empty and Pingo varies the wording each time.'),
        ),
      );
    },

    when() {
      const body =
        draft.mode === 'interval'
          ? h(
              'div.field',
              chipGroup(
                [15, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: formatDuration(m) })),
                draft.everyMin,
                (m) => {
                  draft.everyMin = m;
                  changed({ rerender: ['when'] });
                },
                'Interval',
              ),
              h(
                'div.inline',
                h('input.input.narrow', {
                  type: 'number',
                  min: '1',
                  max: '720',
                  value: String(draft.everyMin),
                  'aria-label': 'Minutes between reminders',
                  oninput: (e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n >= 1 && n <= 720) {
                      draft.everyMin = n;
                      changed();
                    }
                  },
                  onchange: () => changed({ rerender: ['when'] }),
                }),
                h('span.muted', 'minutes between reminders'),
              ),
            )
          : h(
              'div.times',
              draft.times.map((t, i) =>
                h(
                  'span.time-item',
                  h('input.input', {
                    type: 'time',
                    value: t,
                    'aria-label': `Time ${i + 1}`,
                    onchange: (e) => {
                      if (!e.target.value) return;
                      draft.times[i] = e.target.value;
                      draft.times = [...new Set(draft.times)].sort();
                      changed({ rerender: ['when'] });
                    },
                  }),
                  draft.times.length > 1
                    ? h(
                        'button.btn.quiet.icon',
                        {
                          type: 'button',
                          'aria-label': `Remove ${t}`,
                          onclick: () => {
                            draft.times.splice(i, 1);
                            changed({ rerender: ['when'] });
                          },
                        },
                        icon('close', 14),
                      )
                    : null,
                ),
              ),
              draft.times.length < 12
                ? h(
                    'button.btn.small',
                    {
                      type: 'button',
                      onclick: () => {
                        const last = hhmmToMinutes(draft.times[draft.times.length - 1]) ?? 540;
                        draft.times = [
                          ...new Set([...draft.times, minutesToHHMM((last + 180) % 1440)]),
                        ].sort();
                        changed({ rerender: ['when'] });
                      },
                    },
                    icon('plus'),
                    'Add a time',
                  )
                : null,
            );
      return h(
        'section.section',
        h('h2', 'When'),
        segmented(
          [
            { value: 'interval', label: 'Every few minutes' },
            { value: 'times', label: 'At set times' },
          ],
          draft.mode,
          (mode) => {
            draft.mode = mode;
            changed({ rerender: ['when', 'hours'] });
          },
          'Schedule',
        ),
        body,
      );
    },

    days() {
      const set = (days) => {
        draft.days = days;
        changed({ rerender: ['days'] });
      };
      return h(
        'section.section',
        h('h2', 'Days'),
        h(
          'div.days',
          { role: 'group', 'aria-label': 'Days of the week' },
          WEEK_ORDER.map((d) =>
            h(
              'button.day',
              {
                type: 'button',
                'aria-pressed': String(draft.days.includes(d)),
                'aria-label': DAY_SHORT[d],
                onclick: () => {
                  const on = draft.days.includes(d);
                  if (on && draft.days.length === 1) return toast('Keep at least one day.');
                  set(on ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort());
                },
              },
              DAY_LETTER[d],
            ),
          ),
        ),
        h(
          'div.inline.small',
          h(
            'button.link',
            { type: 'button', onclick: () => set([0, 1, 2, 3, 4, 5, 6]) },
            'Every day',
          ),
          h('span.muted', '·'),
          h('button.link', { type: 'button', onclick: () => set([1, 2, 3, 4, 5]) }, 'Weekdays'),
          h('span.muted', '·'),
          h('button.link', { type: 'button', onclick: () => set([0, 6]) }, 'Weekends'),
        ),
      );
    },

    hours() {
      if (draft.mode === 'times') {
        return h(
          'section.section',
          h('h2', 'Active hours'),
          h('p.muted', 'Set times always ring on the days above, whatever the hour.'),
        );
      }
      const allDay = draft.start === draft.end;
      const timeInput = (key, label) =>
        h('input.input', {
          type: 'time',
          value: minutesToHHMM(draft[key]),
          disabled: allDay,
          'aria-label': label,
          onchange: (e) => {
            const m = hhmmToMinutes(e.target.value);
            if (m === null) return;
            draft[key] = m;
            if (draft.start === draft.end) {
              toast('Start and end are the same. Turn on “Any time of day” instead.');
              draft[key] = key === 'start' ? (m + 1380) % 1440 : (m + 60) % 1440;
            }
            changed({ rerender: ['hours'] });
          },
        });
      return h(
        'section.section',
        h('h2', 'Active hours'),
        h(
          'div.switch-row',
          h(
            'div',
            h('div.label', 'Any time of day'),
            h('p.hint', 'Off: only between the hours below, in your time zone.'),
          ),
          toggle(
            allDay,
            (on) => {
              if (on) {
                draft.start = 0;
                draft.end = 0;
              } else {
                draft.start = 10 * 60;
                draft.end = 23 * 60;
              }
              changed({ rerender: ['hours'] });
            },
            'Any time of day',
          ),
        ),
        h(
          'div.inline',
          h('span.muted', 'From'),
          timeInput('start', 'Start'),
          h('span.muted', 'to'),
          timeInput('end', 'End'),
        ),
      );
    },

    snooze() {
      return h(
        'section.section',
        h('h2', 'Snooze'),
        h('p.hint', 'How long Pingo waits when you press Snooze.'),
        chipGroup(
          [5, 10, 15, 30, 60].map((m) => ({ value: m, label: formatDuration(m) })),
          draft.snoozeMin,
          (m) => {
            draft.snoozeMin = m;
            changed({ rerender: ['snooze'] });
          },
          'Snooze length',
        ),
      );
    },

    character() {
      const def = avatarByKey(state.defaultAvatar);
      const pick = (key, content, label) =>
        h(
          'button.avatar-pick',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String((draft.avatar ?? null) === key),
            onclick: () => {
              draft.avatar = key;
              changed({ rerender: ['character'] });
            },
          },
          content,
          h('span', label),
        );
      return h(
        'section.section',
        h('h2', 'Character'),
        h('p.hint', 'Who walks on for this reminder.'),
        h(
          'div.avatar-picks',
          { role: 'radiogroup', 'aria-label': 'Character' },
          pick(null, h('div.default-face', `Default (${def?.label ?? 'Classic'})`), 'Default'),
          avatars.avatars.map((a) =>
            pick(a.key, h('div.portrait', h('img', { src: a.thumb, alt: '' })), a.label),
          ),
        ),
      );
    },

    remove() {
      return h(
        'section.section',
        h(
          'div.danger-zone',
          h(
            'div',
            h('div.label', 'Delete this reminder'),
            h('p.hint', 'Its schedule is removed. Today’s counts stay.'),
          ),
          h(
            'button.btn.danger',
            {
              type: 'button',
              onclick: async () => {
                if (!window.confirm(`Delete “${reminderTitle(draft)}”?`)) return;
                await api.deleteReminder(draft.id);
                toast('Reminder deleted');
                go('reminders');
              },
            },
            icon('trash'),
            'Delete',
          ),
        ),
      );
    },
  };

  for (const key of Object.keys(SECTION_BUILDERS)) sections[key] = SECTION_BUILDERS[key]();

  const petImg = h('img', { alt: '' });
  const doneLabel = h('span');
  const bubble = h(
    `div.mini-bubble${state.settings.bubbleStyle === 'pixel' ? '.pixel' : ''}`,
    previewText,
    h('div.mini-actions', doneLabel, h('span', 'Snooze')),
  );
  function paintPreview() {
    previewText.textContent = promptPreview(draft);
    doneLabel.textContent = typeInfo(draft.type).done;
    const a = avatarByKey(draft.avatar ?? state.defaultAvatar);
    if (a?.thumb && petImg.src !== a.thumb) petImg.src = a.thumb;
  }
  paintPreview();

  const enabledToggle = toggle(
    draft.enabled,
    (enabled) => {
      draft.enabled = enabled;
      changed();
    },
    'Reminder on',
  );

  return [
    h('a.crumb', { href: '#reminders' }, icon('back', 14), 'Reminders'),
    h(
      'header.title-row',
      h('div', titleEl, sublineEl),
      h(
        'div.actions',
        { style: { alignItems: 'center' } },
        stamp,
        h('span.small.muted', 'On'),
        enabledToggle,
      ),
    ),
    h(
      'div.editor',
      h('div.sections', Object.values(sections)),
      h(
        'aside.preview',
        h('div.desk', bubble, h('div.mini-pet', petImg)),
        h(
          'button.btn',
          { type: 'button', onclick: () => api.previewReminder(draft) },
          icon('play'),
          'Show it on my screen',
        ),
        h('p.hint', 'Previews don’t change the schedule or today’s counts.'),
      ),
    ),
  ];
}

// --- Avatars gallery ----------------------------------------------------------------

function avatarsView() {
  const def = avatarByKey(avatars.defaultKey);

  const dropSlot = h(
    'div.drop-slot',
    {
      role: 'button',
      tabindex: '0',
      onclick: () => go('avatars/new'),
      onkeydown: (e) => e.key === 'Enter' && go('avatars/new'),
    },
    icon('upload', 22),
    h('div.label', 'Drop an image or GIF'),
    h('p.small', 'Or click to choose one. Animated GIFs keep moving.'),
  );
  wireDrop(dropSlot, (dataUrl) => {
    pendingImage = dataUrl;
    go('avatars/new');
  });

  const cards = avatars.avatars.map((a) => {
    const isDefault = a.key === avatars.defaultKey;
    const kind =
      a.kind === 'preset'
        ? 'Bundled · full set of poses'
        : a.animated
          ? 'Your animation'
          : 'Your image';
    return h(
      `article.avatar-card${isDefault ? '.is-default' : ''}`,
      h(
        'div.portrait',
        h('img', {
          src: a.thumb,
          alt: a.label,
          style: a.flip ? { transform: 'scaleX(-1)' } : null,
        }),
      ),
      h(
        'div.meta',
        h('div.meta-top', h('span', a.label), isDefault ? h('span.pill', 'Default') : null),
        h('span.small.muted', kind),
      ),
      h(
        'div.card-actions',
        isDefault
          ? null
          : h(
              'button.btn.small',
              {
                type: 'button',
                onclick: async () => {
                  await api.selectAvatar(a.key);
                  await loadAvatars();
                  render();
                  toast(`${a.label} is now the default`);
                },
              },
              'Make default',
            ),
        a.kind === 'custom'
          ? h(
              'button.btn.small.quiet',
              { type: 'button', onclick: () => go(`avatars/${a.id}`) },
              'Edit',
            )
          : null,
        h(
          'button.btn.small.quiet',
          {
            type: 'button',
            'aria-label': `Preview ${a.label}`,
            onclick: () => api.previewReminder({ type: 'water', avatar: a.key }),
          },
          'Preview',
        ),
      ),
    );
  });

  return [
    titleRow(
      'Avatars',
      ['Reminders use ', h('strong', def?.label ?? 'Classic'), ' unless they pick their own.'],
      [
        h(
          'button.btn.primary',
          { type: 'button', onclick: () => go('avatars/new') },
          icon('plus'),
          'New avatar',
        ),
      ],
    ),
    h('div.gallery', cards, dropSlot),
  ];
}

/** Accept image files dropped onto `el`. */
function wireDrop(el, onImage) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.classList.remove('over');
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (!file) return toast('That isn’t an image.');
    if (file.size > 10 * 1024 * 1024) return toast('Images can be up to 10 MB.');
    onImage(await readFileAsDataUrl(file));
  });
}

// --- Avatar studio ------------------------------------------------------------------

function avatarStudioView(id) {
  const isNew = id === 'new';
  const draft = {
    id: isNew ? null : id,
    label: '',
    flip: false,
    scale: 100,
    cutout: true,
    strength: 50,
    slots: {
      idle: { original: null, processed: null, changed: false },
      celebrate: { original: null, processed: null, changed: false, removed: false },
    },
  };
  let celebrating = false;
  const statusLine = h('p.small.muted', { role: 'status' });
  const titleEl = h('h1', isNew ? 'New avatar' : 'Edit avatar');
  const container = h('div.editor');

  async function process(slot) {
    const s = draft.slots[slot];
    if (!s.original) return;
    statusLine.textContent = 'Cutting out the background…';
    try {
      s.processed = await processSprite(s.original, {
        cutout: draft.cutout,
        strength: draft.strength,
      });
      statusLine.textContent = '';
    } catch {
      s.processed = null;
      s.original = null;
      statusLine.textContent = 'That image couldn’t be read. Try another one.';
    }
  }

  async function setImage(slot, dataUrl) {
    const s = draft.slots[slot];
    s.original = dataUrl;
    s.changed = true;
    if (slot === 'celebrate') s.removed = false;
    await process(slot);
    paint();
  }

  const reprocess = debounce(async () => {
    for (const slot of ['idle', 'celebrate']) {
      if (draft.slots[slot].original && draft.slots[slot].changed) await process(slot);
    }
    paint();
  }, 200);

  const anyAnimated = () =>
    ['idle', 'celebrate'].some(
      (s) => draft.slots[s].original && isAnimatedFormat(draft.slots[s].original),
    );

  function slotBlock(slot, title, hint) {
    const s = draft.slots[slot];
    const image = s.processed;
    const box = h(
      `div.portrait${image ? '' : '.empty-slot'}`,
      image ? h('img', { src: image, alt: '' }) : icon('upload', 20),
    );
    wireDrop(box, (dataUrl) => setImage(slot, dataUrl));
    return h(
      'div.slot',
      box,
      h(
        'div',
        h('div.label', title),
        h('p.hint', hint),
        h(
          'div.slot-actions',
          h(
            'button.btn.small',
            {
              type: 'button',
              onclick: async () => {
                const picked = await api.pickImage();
                if (picked) setImage(slot, picked);
              },
            },
            image ? 'Replace…' : 'Choose image…',
          ),
          slot === 'celebrate' && image
            ? h(
                'button.btn.small.quiet',
                {
                  type: 'button',
                  onclick: () => {
                    Object.assign(s, {
                      original: null,
                      processed: null,
                      changed: false,
                      removed: true,
                    });
                    paint();
                  },
                },
                'Remove',
              )
            : null,
        ),
      ),
    );
  }

  function paint() {
    const idle = draft.slots.idle.processed;
    const celebrate = draft.slots.celebrate.processed;
    titleEl.textContent = draft.label || (isNew ? 'New avatar' : 'Edit avatar');
    const animated = anyAnimated();

    const sectionsEl = h(
      'div.sections',
      h(
        'section.section',
        h('h2', 'Name'),
        h('input.input', {
          type: 'text',
          maxlength: '24',
          value: draft.label,
          placeholder: 'e.g. Dancing cat',
          'aria-label': 'Avatar name',
          oninput: (e) => {
            draft.label = e.target.value;
            titleEl.textContent = draft.label || (isNew ? 'New avatar' : 'Edit avatar');
          },
        }),
      ),
      h(
        'section.section',
        h('h2', 'Images'),
        slotBlock(
          'idle',
          'Standing',
          'Shown when Pingo walks on. PNG, JPG, WebP or GIF, up to 10 MB.',
        ),
        slotBlock(
          'celebrate',
          'Celebrating (optional)',
          'Shown when you press Done. Empty reuses the standing image.',
        ),
      ),
      h(
        'section.section',
        h('h2', 'Background'),
        h(
          'div.switch-row',
          h(
            'div',
            h('div.label', 'Cut out a plain background'),
            h(
              'p.hint',
              animated
                ? 'GIFs and WebP animations are kept exactly as they are, so pick one with a transparent background.'
                : 'Works best when the character stands on one flat colour.',
            ),
          ),
          toggle(
            draft.cutout && !animated,
            (on) => {
              draft.cutout = on;
              for (const s of Object.values(draft.slots)) if (s.original) s.changed = true;
              reprocess();
            },
            'Cut out background',
            { disabled: animated },
          ),
        ),
        draft.cutout && !animated
          ? h(
              'div.field',
              h('span.label', 'Strength'),
              rangeInput({
                min: 0,
                max: 100,
                value: draft.strength,
                label: 'Cut-out strength',
                format: (v) => `${v}%`,
                onInput: (v) => {
                  draft.strength = v;
                  for (const s of Object.values(draft.slots)) if (s.original) s.changed = true;
                  reprocess();
                },
              }),
              h(
                'p.hint',
                'Raise it if a halo of background is left; lower it if parts of the character vanish.',
              ),
            )
          : null,
      ),
      h(
        'section.section',
        h('h2', 'Size and direction'),
        h(
          'div.field',
          h('span.label', 'Size'),
          rangeInput({
            min: 50,
            max: 160,
            step: 5,
            value: draft.scale,
            label: 'Avatar size',
            format: (v) => `${v}%`,
            onInput: (v) => {
              draft.scale = v;
              petBox.style.transform = `scale(${v / 100})`;
            },
          }),
        ),
        h(
          'div.switch-row',
          h(
            'div',
            h('div.label', 'Face the other way'),
            h('p.hint', 'Mirror the images left to right.'),
          ),
          toggle(
            draft.flip,
            (on) => {
              draft.flip = on;
              petBox.classList.toggle('flip', on);
            },
            'Mirror',
          ),
        ),
      ),
      h(
        'section.section',
        h(
          'div.inline',
          h(
            'button.btn.primary',
            { type: 'button', disabled: !idle, onclick: save },
            isNew ? 'Create avatar' : 'Save changes',
          ),
          h('button.btn', { type: 'button', onclick: () => go('avatars') }, 'Cancel'),
          statusLine,
        ),
      ),
      isNew
        ? null
        : h(
            'section.section',
            h(
              'div.danger-zone',
              h(
                'div',
                h('div.label', 'Delete this avatar'),
                h('p.hint', 'Reminders that use it switch to the default.'),
              ),
              h(
                'button.btn.danger',
                {
                  type: 'button',
                  onclick: async () => {
                    if (!window.confirm(`Delete “${draft.label || 'this avatar'}”?`)) return;
                    await api.deleteAvatar(draft.id);
                    await loadAvatars();
                    toast('Avatar deleted');
                    go('avatars');
                  },
                },
                icon('trash'),
                'Delete',
              ),
            ),
          ),
    );

    const shown = celebrating && celebrate ? celebrate : idle;
    const petBox = h(
      `div.mini-pet${draft.flip ? '.flip' : ''}`,
      { style: { transform: `scale(${draft.scale / 100})` } },
      shown ? h('img', { src: shown, alt: '' }) : null,
    );
    const desk = h(
      'div.desk.checker',
      bubblePreview(
        celebrating ? 'Hydrated and happy!' : promptPreview({ type: 'water', message: '' }),
        'I drank',
      ),
      petBox,
    );
    const previewEl = h(
      'aside.preview',
      desk,
      segmented(
        [
          { value: false, label: 'Standing' },
          { value: true, label: 'Celebrating' },
        ],
        celebrating,
        (v) => {
          celebrating = v;
          paint();
        },
        'Preview pose',
      ),
      isNew
        ? h('p.hint', 'After you create it, you can preview it on your screen.')
        : h(
            'button.btn',
            {
              type: 'button',
              onclick: () => api.previewReminder({ type: 'water', avatar: `custom:${draft.id}` }),
            },
            icon('play'),
            'Show it on my screen',
          ),
    );
    container.replaceChildren(sectionsEl, previewEl);
  }

  async function save() {
    const idle = draft.slots.idle;
    const celebrate = draft.slots.celebrate;
    const patch = {
      id: draft.id ?? undefined,
      label: draft.label,
      flip: draft.flip,
      scale: draft.scale,
    };
    if (idle.changed) patch.idle = idle.processed;
    if (celebrate.changed && celebrate.processed) patch.celebrate = celebrate.processed;
    if (celebrate.removed) patch.celebrate = null;
    statusLine.textContent = 'Saving…';
    const key = await api.saveAvatar(patch);
    if (!key) {
      statusLine.textContent = 'Couldn’t save. Check the image is under 10 MB.';
      return;
    }
    await loadAvatars();
    toast(isNew ? 'Avatar created' : 'Changes saved');
    if (isNew) {
      const choose = window.confirm('Use it as the default character for every reminder?');
      if (choose) await api.selectAvatar(key);
      await loadAvatars();
      go('avatars');
    } else {
      idle.changed = false;
      celebrate.changed = false;
      celebrate.removed = false;
      statusLine.textContent = '';
    }
  }

  (async () => {
    if (!isNew) {
      const existing = await api.getAvatar(id);
      if (!existing) {
        container.replaceChildren(h('p.muted', 'This avatar no longer exists.'));
        return;
      }
      Object.assign(draft, {
        label: existing.label,
        flip: existing.flip,
        scale: existing.scale,
        cutout: false,
      });
      draft.slots.idle = { original: existing.idle, processed: existing.idle, changed: false };
      draft.slots.celebrate = {
        original: existing.celebrate,
        processed: existing.celebrate,
        changed: false,
        removed: false,
      };
    }
    paint();
    if (pendingImage) {
      const dropped = pendingImage;
      pendingImage = null;
      await setImage('idle', dropped);
    }
  })();

  return [
    h('a.crumb', { href: '#avatars' }, icon('back', 14), 'Avatars'),
    h('header.title-row', h('div', titleEl)),
    container,
  ];
}

// --- Appearance --------------------------------------------------------------------

function settingRow(title, description, ...body) {
  return h(
    'section.setting',
    h('div.setting-label', h('h2', title), description ? h('p', description) : null),
    h('div.setting-body', body),
  );
}

function appearanceView() {
  const stamp = makeStamp();
  const s = state.settings;

  async function save(patch, { rerender = false } = {}) {
    state.settings = await api.saveSettings(patch);
    applyLook();
    stamp.flash();
    if (rerender) render({ animate: false });
  }

  return [
    titleRow('Appearance', 'How Pingo looks and sounds when it walks on.', [
      stamp,
      h(
        'button.btn',
        {
          type: 'button',
          onclick: () => {
            const r = enabledUpcoming()[0] ?? state.reminders[0];
            api.previewReminder(r ?? { type: 'water' });
          },
        },
        icon('play'),
        'Try it',
      ),
    ]),
    h(
      'div.settings',
      settingRow(
        'Theme',
        'For these windows and the speech bubble.',
        segmented(
          [
            { value: 'system', label: 'Match system' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ],
          s.theme,
          (theme) => save({ theme }, { rerender: true }),
          'Theme',
        ),
      ),
      settingRow(
        'Speech bubble',
        'The card Pingo holds up with your reminder.',
        h(
          'div.bubble-options',
          { role: 'radiogroup', 'aria-label': 'Bubble style' },
          [
            ['modern', 'Modern'],
            ['pixel', 'Retro pixel'],
          ].map(([value, label]) =>
            h(
              'button.bubble-option',
              {
                type: 'button',
                role: 'radio',
                'aria-checked': String(s.bubbleStyle === value),
                onclick: () => save({ bubbleStyle: value }, { rerender: true }),
              },
              bubblePreview('Time to drink some water.', 'I drank', value),
              h('span', label),
            ),
          ),
        ),
      ),
      settingRow(
        'Accent',
        'Colours the Done button and a few small marks.',
        h(
          'div.swatches',
          { role: 'radiogroup', 'aria-label': 'Accent colour' },
          ACCENTS.map((a) =>
            h('button.swatch', {
              type: 'button',
              role: 'radio',
              title: a.label,
              'aria-label': a.label,
              'aria-checked': String(s.accent === a.key),
              style: { background: a.color },
              onclick: () => save({ accent: a.key }, { rerender: true }),
            }),
          ),
        ),
      ),
      settingRow(
        'Character size',
        'Scales the character and its bubble together.',
        rangeInput({
          min: 80,
          max: 140,
          step: 5,
          value: s.size,
          label: 'Character size',
          format: (v) => `${v}%`,
          onInput: debounce((size) => save({ size }), 250),
        }),
      ),
      settingRow(
        'Where it appears',
        'The corner Pingo walks into.',
        segmented(
          [
            { value: 'right', label: 'Bottom right' },
            { value: 'left', label: 'Bottom left' },
          ],
          s.side,
          (side) => save({ side }, { rerender: true }),
          'Corner',
        ),
        segmented(
          [
            { value: 'primary', label: 'Main screen' },
            { value: 'cursor', label: 'Screen with the pointer' },
          ],
          s.screen,
          (screen) => save({ screen }, { rerender: true }),
          'Screen',
        ),
      ),
      settingRow(
        'Sound',
        'A short sound as Pingo arrives.',
        segmented(
          [
            { value: 'none', label: 'None' },
            { value: 'chime', label: 'Chime' },
            { value: 'pop', label: 'Pop' },
            { value: 'bell', label: 'Bell' },
          ],
          s.sound,
          (sound) => {
            playSound(sound);
            save({ sound }, { rerender: true });
          },
          'Sound',
        ),
      ),
      settingRow(
        'If you don’t answer',
        'Pingo can snooze itself and walk off after a while.',
        h(
          'select.input',
          {
            style: { maxWidth: '280px' },
            'aria-label': 'If you don’t answer',
            onchange: (e) => save({ autoHideMin: Number(e.target.value) }),
          },
          [0, 1, 2, 5, 10].map((m) =>
            h(
              'option',
              { value: String(m), selected: s.autoHideMin === m },
              m === 0 ? 'Stay until I answer' : `Snooze after ${formatDuration(m)}`,
            ),
          ),
        ),
      ),
    ),
  ];
}

// --- General ----------------------------------------------------------------------

function generalView() {
  const stamp = makeStamp();
  const saveName = debounce(async (name) => {
    state.settings = await api.saveSettings({ name });
    stamp.flash();
  }, 400);

  return [
    titleRow('General', 'You, your schedule and this app.', [stamp]),
    h(
      'div.settings',
      settingRow(
        'Your name',
        'Pingo greets you by name. Leave it empty to keep reminders generic.',
        h('input.input', {
          type: 'text',
          maxlength: '24',
          value: state.settings.name,
          placeholder: 'e.g. Alex',
          'aria-label': 'Your name',
          style: { maxWidth: '320px' },
          oninput: (e) => saveName(e.target.value),
        }),
      ),
      settingRow(
        'Pause',
        pauseLabel() ? `${pauseLabel()}.` : 'Every reminder is running.',
        pauseControls(),
      ),
      settingRow(
        'Start at login',
        'Open Pingo when you sign in, so reminders just keep working.',
        h(
          'div.switch-row',
          h(
            'p.hint',
            state.isPackaged
              ? state.openAtLogin
                ? 'Pingo opens when you sign in.'
                : 'You open Pingo yourself.'
              : 'Available in the installed app. In development, run npm run autostart:enable.',
          ),
          toggle(
            state.openAtLogin,
            async (on) => {
              state = await api.setOpenAtLogin(on);
              stamp.flash();
            },
            'Start at login',
            { disabled: !state.isPackaged },
          ),
        ),
      ),
      settingRow(
        'Setup',
        'The three-step welcome: your name, a first reminder and a character.',
        h(
          'div',
          h(
            'button.btn',
            { type: 'button', onclick: () => api.openApp('onboarding') },
            'Run setup again',
          ),
        ),
      ),
      settingRow(
        'About',
        null,
        h(
          'div.about',
          h('div', `Pingo ${state.version}`),
          h(
            'p.muted',
            'Your settings, avatars and counts stay on this computer. Pingo has no accounts and makes no network requests.',
          ),
        ),
      ),
    ),
  ];
}

// --- Router and chrome --------------------------------------------------------------

function parseRoute() {
  const [name, id] = location.hash.replace(/^#/, '').split('/');
  return { name: NAV.some((n) => n.route === name) ? name : 'home', id: id || null };
}

function applyLook() {
  document.documentElement.dataset.accent = state.settings.accent;
}

function renderChrome() {
  for (const link of document.querySelectorAll('.nav-item')) {
    const item = NAV.find((n) => n.route === link.dataset.route);
    if (!link.childElementCount) link.replaceChildren(icon(item.icon), h('span', item.label));
    if (item.route === route.name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const paused = pauseLabel();
  const next = enabledUpcoming()[0];
  statusEl.replaceChildren();
  append(statusEl, [
    h(
      'div.status-line',
      h(`span.status-dot${paused ? '.paused' : ''}`),
      h('span', paused ?? (next ? `Next at ${clockTime(next.nextAt)}` : 'No reminders on')),
    ),
    paused
      ? h('button.btn.small', { type: 'button', onclick: () => setPaused(0) }, 'Resume')
      : null,
  ]);
}

function render({ animate = true } = {}) {
  const previous = route;
  route = parseRoute();

  if (route.name === 'reminders' && route.id?.startsWith('new')) {
    createReminder(route.id.split('-')[1] ?? 'custom');
    return;
  }

  let content;
  if (route.name === 'reminders') {
    content = route.id ? reminderEditorView(route.id) : remindersView();
  } else if (route.name === 'avatars') {
    content = route.id ? avatarStudioView(route.id) : avatarsView();
  } else if (route.name === 'appearance') content = appearanceView();
  else if (route.name === 'general') content = generalView();
  else content = homeView();

  const scroll = viewEl.parentElement.scrollTop;
  viewEl.replaceChildren(...content);
  const samePage = previous.name === route.name && previous.id === route.id;
  if (samePage) viewEl.parentElement.scrollTop = scroll;
  else viewEl.parentElement.scrollTop = 0;
  viewEl.classList.toggle('entering', animate && !samePage);
  renderChrome();
}

async function loadAvatars() {
  avatars = await api.getAvatars();
}

async function refresh() {
  state = await api.getState();
  applyLook();
  await loadAvatars();
  renderChrome();
  if (PASSIVE_VIEWS.has(route.name) && !route.id) render({ animate: false });
}

async function init() {
  if (navigator.userAgent.includes('Mac')) document.body.classList.add('mac');
  state = await api.getState();
  applyLook();
  await loadAvatars();
  render();

  window.addEventListener('hashchange', () => render());
  api.onNavigate((r) => {
    if (location.hash.slice(1) === r) render();
    else location.hash = r;
  });
  api.onStateChanged(debounce(refresh, 120));
  // Relative times ("in 12 min") go stale; refresh passive views each half minute.
  setInterval(async () => {
    state = await api.getState();
    renderChrome();
    if (PASSIVE_VIEWS.has(route.name) && !route.id) render({ animate: false });
  }, 30_000);
}

init();
