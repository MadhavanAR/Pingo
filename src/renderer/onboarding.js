'use strict';

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const minsInput = document.getElementById('mins');
const chips = document.getElementById('chips');
const charCards = document.getElementById('charCards');

// Pre-fill from whatever's already saved, so re-running setup edits in place.
window.pingo.getSettings().then((settings) => {
  nameInput.value = settings.name;
  messageInput.value = settings.message;
  minsInput.value = settings.intervalMin;
  syncChips();
  nameInput.focus();
  nameInput.select();
});

function show(el) {
  [step1, step2, step3].forEach((s) => s.classList.toggle('hidden', s !== el));
}

function syncChips() {
  const v = Math.round(Number(minsInput.value));
  chips.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('active', Number(c.dataset.min) === v);
  });
}
chips.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  minsInput.value = btn.dataset.min;
  syncChips();
});
minsInput.addEventListener('input', syncChips);

function renderChars() {
  return renderCharacterCards(charCards);
}

document.getElementById('to2').addEventListener('click', () => {
  window.pingo.saveSettings({ name: nameInput.value });
  show(step2);
  messageInput.focus();
});
document.getElementById('b2to1').addEventListener('click', () => {
  show(step1);
  nameInput.focus();
});
document.getElementById('to3').addEventListener('click', () => {
  const patch = { message: messageInput.value };
  if (minsInput.value !== '') patch.intervalMin = minsInput.value;
  window.pingo.saveSettings(patch);
  show(step3);
  renderChars();
});
document.getElementById('b3to2').addEventListener('click', () => {
  show(step2);
  messageInput.focus();
});
document.getElementById('finish').addEventListener('click', () => {
  window.pingo.closeOnboarding();
});

// Enter advances, Escape dismisses the wizard.
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('to2').click();
  if (e.key === 'Escape') window.pingo.closeOnboarding();
});
for (const input of [messageInput, minsInput]) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('to3').click();
    if (e.key === 'Escape') window.pingo.closeOnboarding();
  });
}
