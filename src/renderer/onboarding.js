'use strict';

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const nameInput = document.getElementById('name');
const minsInput = document.getElementById('mins');
const chips = document.getElementById('chips');
const charCards = document.getElementById('charCards');

// Pre-fill from whatever's already saved.
window.pingo.getName().then((n) => {
  nameInput.value = n || '';
  nameInput.focus();
  nameInput.select();
});
window.pingo.getInterval().then((m) => {
  minsInput.value = m || '';
  syncChips();
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
  window.pingo.saveName(nameInput.value);
  show(step2);
  minsInput.focus();
  minsInput.select();
});
document.getElementById('b2to1').addEventListener('click', () => {
  show(step1);
  nameInput.focus();
});
document.getElementById('to3').addEventListener('click', () => {
  const n = Math.round(Number(minsInput.value));
  if (Number.isFinite(n) && n >= 1) window.pingo.saveInterval(n);
  show(step3);
  renderChars();
});
document.getElementById('b3to2').addEventListener('click', () => {
  show(step2);
  minsInput.focus();
});
document.getElementById('finish').addEventListener('click', () => {
  window.pingo.closeOnboarding();
});

// Enter advances, Escape dismisses the wizard.
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('to2').click();
  if (e.key === 'Escape') window.pingo.closeOnboarding();
});
minsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('to3').click();
  if (e.key === 'Escape') window.pingo.closeOnboarding();
});
