'use strict';

const WALK_MS = 1150; // must match the #pet transition duration in style.css
const POSE_HOLD_MS = 1100;
const GOODBYE_MS = 600;
const SNOOZE_GOODBYE_MS = 1400;
const CONFETTI_COUNT = 42;
const CONFETTI_LIFETIME_MS = 2200;
const FALLBACK_SPRITES = {
  idle: '../../assets/characters/boy/idle.png',
  drinking: '../../assets/characters/boy/drink.png',
};

const pet = document.getElementById('pet');
const spriteIdle = document.getElementById('sprite-idle');
const spriteDrinking = document.getElementById('sprite-drinking');
const spritePose = document.getElementById('sprite-pose');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');
const buttons = document.getElementById('buttons');
const yesBtn = document.getElementById('yes-btn');
const snoozeBtn = document.getElementById('snooze-btn');
const confetti = document.getElementById('confetti');

/** Pose name -> data URL for multi-pose characters; null for idle/drinking-only ones. */
let poses = null;
let busy = false;
let reminder = { name: '', message: '', snoozeMin: 10 };

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// An empty message means the built-in drink-water reminder.
const isCustom = ({ message }) => Boolean(message);

function promptFor({ name, message }) {
  if (message) return name ? `Hey ${name}! ${message}` : message;
  if (name) {
    return pick([
      `${name}, time to drink water to keep your skin glowing!`,
      `${name}, hydration check! Take a sip 💧`,
      `Water break, ${name}! Your body will thank you.`,
      `Psst ${name}… a few sips of water? Stay glowing!`,
      `Don't forget me, ${name} — drink some water!`,
    ]);
  }
  return pick([
    'Time to drink water to keep your skin glowing!',
    'Hydration check! Take a sip of water 💧',
    'Water break! Your body will thank you.',
    'Psst… a few sips of water? Stay glowing!',
    "Don't forget me — drink some water!",
  ]);
}

function cheerFor({ name, message }) {
  if (message) {
    return name
      ? pick([`Nice work, ${name}! ✨`, `Done and dusted, ${name}! 🙌`, `Great job, ${name}! ⭐`])
      : pick(['Nice work! ✨', 'Done and dusted! 🙌', 'Great job! ⭐']);
  }
  if (name) {
    return pick([
      `Yay ${name}! Stay glowing ✨`,
      `Amazing, ${name}! Keep it up 💧`,
      `That's the spirit, ${name}! 🥤`,
      `Hydrated and happy, ${name}! ✨`,
    ]);
  }
  return pick([
    'Yay! Stay glowing ✨',
    'Amazing! Keep it up 💧',
    "That's the spirit! 🥤",
    'Hydrated and happy! ✨',
  ]);
}

function snoozeMessage({ name, snoozeMin }) {
  const when = `${snoozeMin} min${snoozeMin === 1 ? '' : 's'}`;
  return name ? `I'll come back in ${when}, ${name}!` : `I'll come back in ${when}!`;
}

/**
 * Multi-pose characters swap to the named sprite (falling back to wave/idle).
 * Simple characters only distinguish drinking from everything else.
 */
function setPose(name, { mirrored = false } = {}) {
  pet.classList.toggle('flipped', mirrored);
  if (poses) {
    const src = poses[name] || poses.wave || poses.idle;
    if (spritePose.getAttribute('src') !== src) spritePose.src = src;
    spritePose.classList.remove('hidden');
    spriteIdle.classList.add('hidden');
    spriteDrinking.classList.add('hidden');
  } else {
    const drinking = name === 'drink';
    spriteIdle.classList.toggle('hidden', drinking);
    spriteDrinking.classList.toggle('hidden', !drinking);
  }
  pet.classList.toggle('sipping', name === 'drink');
}

async function walkIn() {
  if (poses?.walking) setPose('walking', { mirrored: true });
  else setPose('wave');
  pet.classList.remove('celebrate', 'face-right');
  pet.classList.add('offstage');
  void pet.offsetWidth; // flush styles so the transition starts from offstage
  pet.classList.add('walking');
  pet.classList.remove('offstage');
  await wait(WALK_MS);
  pet.classList.remove('walking');
}

async function walkOut(fallbackPose) {
  if (poses?.walking) setPose('walking');
  else setPose(fallbackPose);
  bubble.classList.add('hidden');
  pet.classList.add('face-right', 'walking', 'offstage');
  await wait(WALK_MS);
  pet.classList.remove('walking', 'face-right');
}

function showBubble(text, withButtons) {
  bubbleText.textContent = text;
  buttons.classList.toggle('hidden', !withButtons);
  bubble.classList.remove('hidden');
}

function burstConfetti() {
  const glyphs = ['💧', '✨', '💙', '🫧', '⭐'];
  const colors = ['#37c24a', '#4aa3df', '#ffd447', '#ff7a59', '#8ad6ff'];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    if (Math.random() < 0.5) {
      piece.textContent = pick(glyphs);
    } else {
      piece.textContent = '■';
      piece.style.color = pick(colors);
    }
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--dur', `${0.9 + Math.random() * 0.9}s`);
    piece.style.setProperty('--fall', `${280 + Math.random() * 160}px`);
    piece.style.setProperty('--spin', `${Math.random() * 720 - 360}deg`);
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    confetti.appendChild(piece);
    setTimeout(() => piece.remove(), CONFETTI_LIFETIME_MS);
  }
}

async function celebrate() {
  showBubble(cheerFor(reminder), false);
  if (!isCustom(reminder)) {
    setPose('drink');
    await wait(POSE_HOLD_MS);
  }
  setPose('happy');
  pet.classList.add('celebrate');
  burstConfetti();
  await wait(POSE_HOLD_MS);
  pet.classList.remove('celebrate');
}

/** Serialises animations so double-clicks can't interleave two sequences. */
async function exclusive(sequence) {
  if (busy) return;
  busy = true;
  try {
    await sequence();
  } finally {
    busy = false;
  }
}

function runReminder(payload) {
  return exclusive(async () => {
    reminder = { ...reminder, ...payload };
    yesBtn.textContent = isCustom(reminder) ? 'DONE' : 'YES, I DRANK';
    await walkIn();
    setPose('point');
    showBubble(promptFor(reminder), true);
    pet.classList.add('chatty');
  });
}

function onYes() {
  return exclusive(async () => {
    pet.classList.remove('chatty');
    window.pingo.yes();
    await celebrate();
    showBubble('See you in a bit! 👋', false);
    setPose('wave');
    await wait(GOODBYE_MS);
    await walkOut('wave');
    window.pingo.hide();
  });
}

function onSnooze() {
  return exclusive(async () => {
    pet.classList.remove('chatty');
    window.pingo.snooze();
    setPose('think');
    showBubble(snoozeMessage(reminder), false);
    await wait(SNOOZE_GOODBYE_MS);
    await walkOut('think');
    window.pingo.hide();
  });
}

// Square custom images (e.g. a photo) get the livelier portrait animations.
function markPortrait() {
  if (poses || !spriteIdle.naturalWidth) return;
  const ratio = spriteIdle.naturalWidth / spriteIdle.naturalHeight;
  pet.classList.toggle('portrait', ratio > 0.85 && ratio < 1.18);
}

function preload(urls) {
  for (const src of urls) new Image().src = src;
}

async function loadSprites() {
  try {
    const sprites = await window.pingo.getSprites();
    if (sprites?.idle && sprites?.drinking) {
      poses = sprites.poses && Object.keys(sprites.poses).length ? sprites.poses : null;
      pet.classList.toggle('poses', Boolean(poses));
      if (poses) {
        pet.classList.remove('portrait');
        preload(Object.values(poses));
      }
      spriteIdle.src = sprites.idle;
      spriteDrinking.src = sprites.drinking;
      setPose('wave');
      return;
    }
  } catch (err) {
    console.error('Could not load sprites, using defaults:', err);
  }
  poses = null;
  pet.classList.remove('poses');
  spriteIdle.src = FALLBACK_SPRITES.idle;
  spriteDrinking.src = FALLBACK_SPRITES.drinking;
}

yesBtn.addEventListener('click', onYes);
snoozeBtn.addEventListener('click', onSnooze);
spriteIdle.addEventListener('load', markPortrait);
window.pingo.onShow(runReminder);
window.pingo.onSpritesChanged(loadSprites);
loadSprites();
