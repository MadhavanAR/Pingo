'use strict';

const form = document.getElementById('form');
const fields = {
  name: document.getElementById('name'),
  message: document.getElementById('message'),
  interval: document.getElementById('interval'),
  start: document.getElementById('start'),
  end: document.getElementById('end'),
  allDay: document.getElementById('allDay'),
  snooze: document.getElementById('snooze'),
};
const chips = document.getElementById('chips');
const statusEl = document.getElementById('status');

const pad = (n) => String(n).padStart(2, '0');

for (const select of [fields.start, fields.end]) {
  for (let hour = 0; hour < 24; hour++) {
    select.add(new Option(`${pad(hour)}:00`, String(hour)));
  }
}

function syncChips() {
  const minutes = Math.round(Number(fields.interval.value));
  for (const chip of chips.querySelectorAll('.chip')) {
    chip.classList.toggle('active', Number(chip.dataset.min) === minutes);
  }
}

function syncAllDay() {
  fields.start.disabled = fields.end.disabled = fields.allDay.checked;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function fill(settings) {
  fields.name.value = settings.name;
  fields.message.value = settings.message;
  fields.interval.value = settings.intervalMin;
  fields.snooze.value = settings.snoozeMin;
  const allDay = settings.activeStartHour === settings.activeEndHour;
  fields.allDay.checked = allDay;
  fields.start.value = String(allDay ? 10 : settings.activeStartHour);
  fields.end.value = String(allDay ? 23 : settings.activeEndHour);
  syncChips();
  syncAllDay();
}

function readForm() {
  const allDay = fields.allDay.checked;
  return {
    name: fields.name.value,
    message: fields.message.value,
    intervalMin: fields.interval.value,
    snoozeMin: fields.snooze.value,
    activeStartHour: allDay ? 0 : fields.start.value,
    activeEndHour: allDay ? 0 : fields.end.value,
  };
}

chips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  fields.interval.value = chip.dataset.min;
  syncChips();
});
fields.interval.addEventListener('input', syncChips);
fields.allDay.addEventListener('change', syncAllDay);
form.addEventListener('input', () => setStatus(''));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!fields.allDay.checked && fields.start.value === fields.end.value) {
    setStatus('Start and end time are the same. Tick "Any time of day" instead.', true);
    return;
  }
  try {
    fill(await window.pingo.saveSettings(readForm()));
    setStatus('Saved ✓');
  } catch {
    setStatus('Could not save settings. Please try again.', true);
  }
});

document.getElementById('character').addEventListener('click', () => {
  window.pingo.openCharacterWindow();
});
document.getElementById('cancel').addEventListener('click', () => window.pingo.closeSettings());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.pingo.closeSettings();
});

window.pingo.getSettings().then((settings) => {
  fill(settings);
  fields.name.focus();
});
