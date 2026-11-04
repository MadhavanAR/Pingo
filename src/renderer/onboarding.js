'use strict';

/* global TYPE_ORDER, typeInfo, formatDuration, h, icon */

/**
 * First-run setup: your name, a first reminder, a character. Re-running it
 * from the tray edits the first reminder in place instead of adding another.
 */

const api = window.pingo;
const stepEl = document.getElementById('step');
const heroImg = document.getElementById('hero');
const progress = document.getElementById('progress');
const backBtn = document.getElementById('back');
const nextBtn = document.getElementById('next');

const INTERVALS = [15, 30, 45, 60, 90];

let step = 0;
let userName = '';
let reminder = { type: 'water', message: '', mode: 'interval', everyMin: 45, times: ['09:00'] };
let avatarKey = 'boy';
let avatars = [];
let platform = '';

function setHero(key) {
  const a = avatars.find((x) => x.key === key) ?? avatars[0];
  if (!a?.thumb || heroImg.src === a.thumb) return;
  heroImg.classList.add('swap');
  setTimeout(() => {
    heroImg.src = a.thumb;
    heroImg.style.transform = a.flip ? 'scaleX(-1)' : '';
    heroImg.classList.remove('swap');
  }, 160);
}

function chips(options, current, onPick, label) {
  return h(
    'div.chips',
    { role: 'radiogroup', 'aria-label': label },
    options.map((o) =>
      h(
        'button.chip',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(o.value === current),
          onclick: () => onPick(o.value),
        },
        o.label,
      ),
    ),
  );
}

const STEPS = [
  function nameStep() {
    const input = h('input.input', {
      type: 'text',
      maxlength: '24',
      value: userName,
      placeholder: 'e.g. Alex',
      'aria-label': 'Your name',
      oninput: (e) => {
        userName = e.target.value;
      },
      onkeydown: (e) => e.key === 'Enter' && next(),
    });
    setTimeout(() => input.focus(), 50);
    return [
      h('h1', 'Hi, I’m Pingo.'),
      h('p.lede', 'I walk onto your screen when it’s time for something. What should I call you?'),
      input,
      h('p.hint', 'Leave it empty and I’ll keep things generic.'),
    ];
  },

  function reminderStep() {
    const render = () => show(false);
    const message = h('input.input', {
      type: 'text',
      maxlength: '120',
      value: reminder.message,
      placeholder: typeInfo(reminder.type).prompts[0],
      'aria-label': 'Message',
      oninput: (e) => {
        reminder.message = e.target.value;
      },
    });
    const when =
      reminder.mode === 'interval'
        ? chips(
            [
              ...INTERVALS.map((m) => ({ value: m, label: formatDuration(m) })),
              { value: 'times', label: 'At set times' },
            ],
            reminder.everyMin,
            (v) => {
              if (v === 'times') reminder.mode = 'times';
              else reminder.everyMin = v;
              render();
            },
            'How often',
          )
        : h(
            'div.times',
            reminder.times.map((t, i) =>
              h('input.input', {
                type: 'time',
                value: t,
                'aria-label': `Time ${i + 1}`,
                onchange: (e) => {
                  if (e.target.value) reminder.times[i] = e.target.value;
                },
              }),
            ),
            reminder.times.length < 3
              ? h(
                  'button.btn.small',
                  {
                    type: 'button',
                    onclick: () => {
                      reminder.times.push(reminder.times.length === 1 ? '21:00' : '13:00');
                      render();
                    },
                  },
                  icon('plus'),
                  'Add a time',
                )
              : null,
            h(
              'button.link.small',
              {
                type: 'button',
                onclick: () => {
                  reminder.mode = 'interval';
                  render();
                },
              },
              'Every few minutes instead',
            ),
          );
    return [
      h('h1', 'What should I remind you about?'),
      chips(
        TYPE_ORDER.map((t) => ({ value: t, label: typeInfo(t).label })),
        reminder.type,
        (type) => {
          reminder.type = type;
          if (type === 'medicine' && reminder.mode === 'interval') {
            reminder.mode = 'times';
            reminder.times = ['09:00', '21:00'];
          }
          render();
        },
        'Kind of reminder',
      ),
      message,
      h('div.field', h('span.label', 'How often?'), when),
      h('p.hint', 'You can add as many reminders as you like later, each with its own schedule.'),
    ];
  },

  function characterStep() {
    return [
      h('h1', 'Who should remind you?'),
      h('p.lede', 'Make your own later from any picture or GIF, under Avatars.'),
      h(
        'div.picks',
        { role: 'radiogroup', 'aria-label': 'Character' },
        avatars.map((a) =>
          h(
            'button.pick',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(a.key === avatarKey),
              onclick: () => {
                avatarKey = a.key;
                setHero(a.key);
                show(false);
              },
            },
            h('div.portrait', h('img', { src: a.thumb, alt: '' })),
            h('span', a.label),
          ),
        ),
      ),
      h(
        'p.hint',
        `After this I’ll live in your ${platform === 'darwin' ? 'menu bar' : 'system tray'}. Click my face there for everything else.`,
      ),
    ];
  },
];

function show(animate = true) {
  stepEl.replaceChildren(...STEPS[step]());
  stepEl.classList.remove('enter');
  if (animate) {
    void stepEl.offsetWidth;
    stepEl.classList.add('enter');
  }
  [...progress.children].forEach((bar, i) => bar.classList.toggle('on', i <= step));
  progress.setAttribute('aria-valuenow', String(step + 1));
  backBtn.classList.toggle('hidden', step === 0);
  nextBtn.textContent = step === STEPS.length - 1 ? 'Start' : 'Next';
}

async function finish() {
  nextBtn.disabled = true;
  try {
    await api.saveSettings({ name: userName });
    await api.saveReminder(reminder);
    await api.selectAvatar(avatarKey);
  } finally {
    api.closeOnboarding(); // setup must never trap someone on its last step
  }
}

function next() {
  if (step === STEPS.length - 1) return finish();
  step += 1;
  show();
}

backBtn.addEventListener('click', () => {
  step = Math.max(0, step - 1);
  show();
});
nextBtn.addEventListener('click', next);
document.getElementById('skip').addEventListener('click', () => api.closeOnboarding());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.closeOnboarding();
});

(async () => {
  const [state, list] = await Promise.all([api.getState(), api.getAvatars()]);
  avatars = list.avatars;
  avatarKey = list.defaultKey;
  userName = state.settings.name;
  platform = state.platform;
  const first = state.reminders[0];
  // Re-running setup edits the first reminder rather than adding another.
  if (first) reminder = { ...first, times: [...first.times] };
  setHero(avatarKey);
  show();
})();
