'use strict';

/**
 * Shared by the onboarding wizard and the "Change character" window: renders
 * the preset gallery with DOM APIs (no innerHTML, so labels can't inject markup).
 *
 * @param {HTMLElement} container
 * @param {(preset: { key: string, label: string }) => void} [onSelected]
 */
// eslint-disable-next-line no-unused-vars, no-redeclare -- global used by page scripts
async function renderCharacterCards(container, onSelected) {
  const info = await window.pingo.getPresets();
  const cards = info.presets.map((preset) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card' + (info.active === preset.key ? ' active' : '');
    card.setAttribute('aria-pressed', String(info.active === preset.key));

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = '✓';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = '';
    if (preset.thumb) img.src = preset.thumb;
    thumb.appendChild(img);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = preset.label;

    card.append(badge, thumb, name);
    card.addEventListener('click', async () => {
      await window.pingo.selectCharacter(preset.key);
      onSelected?.(preset);
      renderCharacterCards(container, onSelected);
    });
    return card;
  });
  container.replaceChildren(...cards);
  return info;
}
