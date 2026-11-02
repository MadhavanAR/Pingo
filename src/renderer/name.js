'use strict';

const input = document.getElementById('name');
const saveBtn = document.getElementById('save');
const cancelBtn = document.getElementById('cancel');

// Pre-fill with the currently saved name.
window.pingo.getName().then((name) => {
  input.value = name || '';
  input.focus();
  input.select();
});

async function save() {
  await window.pingo.saveName(input.value);
  window.pingo.closeNameWindow();
}

saveBtn.addEventListener('click', save);
cancelBtn.addEventListener('click', () => window.pingo.closeNameWindow());
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') save();
  if (e.key === 'Escape') window.pingo.closeNameWindow();
});
