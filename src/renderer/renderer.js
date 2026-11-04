'use strict';

/* global typeInfo, pickFrom, playSound */

const WALK_MS = 1150; // must match the #pet transition duration in style.css
const POSE_HOLD_MS = 1100;
const GOODBYE_MS = 600;
const SNOOZE_GOODBYE_MS = 1400;
const CONFETTI_COUNT = 36;
const CONFETTI_LIFETIME_MS = 2200;
const FALLBACK_SPRITES = {
  kind: 'preset',
  idle: '../../assets/characters/boy/idle.png',
  celebrate: '../../assets/characters/boy/drink.png',
  flip: false,
  scale: 100,
};

const root = document.documentElement;
const stage = document.getElementById('stage');
const pet = document.getElementById('pet');
const spriteIdle = document.getElementById('sprite-idle');
const spriteCelebrate = document.getElementById('sprite-drinking');
const spritePose = document.getElementById('sprite-pose');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');
const buttons = document.getElementById('buttons');
const yesBtn = document.getElementById('yes-btn');
const snoozeBtn = document.getElementById('snooze-btn');
const confetti = document.getElementById('confetti');

/** Pose name -> data URL for multi-pose characters; null for one-image avatars. */
let poses = null;
let busy = false;
/** A reminder that arrived mid-animation; it runs as soon as that ends. */
let queued = null;
let autoHideTimer = null;
let reminder = { type: 'water', message: '', name: '', snoozeMin: 10, look: {} };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lower-case the first letter so a prompt can follow "Name, ". */
const lead = (text) => text.charAt(0).toLowerCase() + text.slice(1);

function promptFor({ type, name, message }) {
  if (message) return name ? `Hey ${name}! ${message}` : message;
  const prompt = pickFrom(typeInfo(type).prompts);
  return name ? `${name}, ${lead(prompt)}` : prompt;
}

function cheerFor({ type, name }) {
  const cheer = pickFrom(typeInfo(type).cheers);
  return name ? `${cheer.replace(/[!.]$/, '')}, ${name}!` : cheer;
}

function snoozeMessage({ name, snoozeMin }) {
  const when = `${snoozeMin} min${snoozeMin === 1 ? '' : 's'}`;
  return name ? `I'll come back in ${when}, ${name}!` : `I'll come back in ${when}!`;
}

/** Which way the character faces while walking in, given the corner it uses. */
const entersFromLeft = () => reminder.look.side === 'left';

/**
 * Multi-pose characters swap to the named sprite (falling back to wave/idle).
 * One-image avatars only distinguish celebrating from everything else.
 */
function setPose(name, { mirrored = false } = {}) {
  pet.classList.toggle('flipped', mirrored);
  if (poses) {
    const src = poses[name] || poses.wave || poses.idle;
    if (spritePose.getAttribute('src') !== src) spritePose.src = src;
    spritePose.classList.remove('hidden');
    spriteIdle.classList.add('hidden');
    spriteCelebrate.classList.add('hidden');
  } else {
    const celebrating = name === 'celebrate';
    spritePose.classList.add('hidden');
    spriteIdle.classList.toggle('hidden', celebrating);
    spriteCelebrate.classList.toggle('hidden', !celebrating);
  }
  pet.classList.toggle('sipping', name === 'drink');
}

async function walkIn() {
  // The walking sprite faces right; mirror it when arriving from the right.
  if (poses?.walking) setPose('walking', { mirrored: !entersFromLeft() });
  else setPose('wave');
  pet.classList.remove('celebrate', 'face-away');
  pet.classList.add('offstage');
  void pet.offsetWidth; // flush styles so the transition starts from offstage
  pet.classList.add('walking');
  pet.classList.remove('offstage');
  await wait(WALK_MS);
  pet.classList.remove('walking');
}

async function walkOut(fallbackPose) {
  if (poses?.walking) setPose('walking', { mirrored: entersFromLeft() });
  else setPose(fallbackPose);
  bubble.classList.add('hidden');
  pet.classList.add('face-away', 'walking', 'offstage');
  await wait(WALK_MS);
  pet.classList.remove('walking', 'face-away');
}

function showBubble(text, withButtons) {
  bubbleText.textContent = text;
  buttons.classList.toggle('hidden', !withButtons);
  bubble.classList.remove('hidden');
}

function burstConfetti() {
  const accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#1b6e66';
  const colors = [accent, '#4aa3df', '#ffd447', '#ff7a59', '#8ad6ff', '#7bd389'];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement('div');
    piece.className = `confetti-piece${Math.random() < 0.4 ? ' round' : ''}`;
    piece.style.background = pickFrom(colors);
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--dur', `${0.9 + Math.random() * 0.9}s`);
    piece.style.setProperty('--fall', `${280 + Math.random() * 160}px`);
    piece.style.setProperty('--drift', `${Math.random() * 60 - 30}px`);
    piece.style.setProperty('--spin', `${Math.random() * 720 - 360}deg`);
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    confetti.appendChild(piece);
    setTimeout(() => piece.remove(), CONFETTI_LIFETIME_MS);
  }
}

async function celebrate() {
  showBubble(cheerFor(reminder), false);
  const pose = { water: 'drink', stretch: 'stretch', eyes: 'rest' }[reminder.type];
  if (poses && pose && poses[pose]) {
    setPose(pose);
    await wait(POSE_HOLD_MS);
  }
  setPose(poses ? 'happy' : 'celebrate');
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
    if (queued) {
      const next = queued;
      queued = null;
      runReminder(next);
    }
  }
}

function applySprites(sprites) {
  const s = sprites?.idle ? sprites : FALLBACK_SPRITES;
  poses = s.kind === 'preset' && s.poses && Object.keys(s.poses).length ? s.poses : null;
  pet.classList.toggle('poses', Boolean(poses));
  pet.classList.remove('portrait'); // re-detected once the new image loads
  pet.classList.toggle('custom', s.kind === 'custom');
  pet.classList.toggle('mirror', Boolean(s.flip));
  pet.style.setProperty('--avatar-scale', String((s.scale ?? 100) / 100));
  for (const url of Object.values(poses ?? {})) new Image().src = url;
  spriteIdle.src = s.idle;
  spriteCelebrate.src = s.celebrate || s.idle;
}

function applyLook(look) {
  root.style.zoom = String((look.size ?? 100) / 100);
  root.dataset.accent = look.accent ?? 'teal';
  root.dataset.theme = look.dark ? 'dark' : 'light';
  stage.classList.toggle('pixel', look.bubbleStyle === 'pixel');
  stage.classList.toggle('modern', look.bubbleStyle !== 'pixel');
  stage.classList.toggle('left', look.side === 'left');
}

function runReminder(payload) {
  if (busy) {
    queued = payload;
    return undefined;
  }
  return exclusive(async () => {
    clearTimeout(autoHideTimer);
    reminder = { ...reminder, ...payload, look: payload.look ?? {} };
    applyLook(reminder.look);
    applySprites(payload.sprites);
    yesBtn.textContent = typeInfo(reminder.type).done;
    snoozeBtn.textContent = 'Snooze';
    snoozeBtn.title = `Remind me in ${reminder.snoozeMin} min`;
    bubble.classList.add('hidden');
    playSound(reminder.look.sound);
    await walkIn();
    setPose('point');
    showBubble(promptFor(reminder), true);
    pet.classList.add('chatty');
    yesBtn.focus({ preventScroll: true });
    if (reminder.look.autoHideMin > 0) {
      autoHideTimer = setTimeout(onSnooze, reminder.look.autoHideMin * 60_000);
    }
  });
}

function onYes() {
  return exclusive(async () => {
    clearTimeout(autoHideTimer);
    pet.classList.remove('chatty');
    window.pingo.done();
    await celebrate();
    showBubble('See you in a bit!', false);
    setPose('wave');
    await wait(GOODBYE_MS);
    await walkOut('wave');
    if (!queued) window.pingo.hide();
  });
}

function onSnooze() {
  return exclusive(async () => {
    clearTimeout(autoHideTimer);
    pet.classList.remove('chatty');
    window.pingo.snooze();
    setPose('think');
    showBubble(snoozeMessage(reminder), false);
    await wait(SNOOZE_GOODBYE_MS);
    await walkOut('think');
    if (!queued) window.pingo.hide();
  });
}

// Square one-image avatars (e.g. a photo or a GIF) get the livelier portrait animations.
function markPortrait() {
  if (poses || !spriteIdle.naturalWidth) return;
  const ratio = spriteIdle.naturalWidth / spriteIdle.naturalHeight;
  pet.classList.toggle('portrait', ratio > 0.85 && ratio < 1.18);
}

yesBtn.addEventListener('click', onYes);
snoozeBtn.addEventListener('click', onSnooze);
spriteIdle.addEventListener('load', markPortrait);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') onSnooze();
});
window.pingo.onShow(runReminder);
applySprites(FALLBACK_SPRITES);
