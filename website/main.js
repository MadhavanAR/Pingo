'use strict';

(function () {
  const { downloads, repo } = window.PINGO_SITE;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

  $$('[data-repo-link]').forEach((a) => (a.href = `https://github.com/${repo}`));

  // Downloads. Every installer has a fixed name (the mac and nsis `artifactName` in
  // package.json), so each button links straight to its file and the download starts at once.
  const MAC = `${downloads}/Pingo-mac-arm64.dmg`;
  const MAC_INTEL = `${downloads}/Pingo-mac-x64.dmg`;
  const WINDOWS = `${downloads}/Pingo-Setup.exe`;
  const ua = navigator.userAgentData?.platform || navigator.userAgent;
  const isWindows = /win/i.test(ua) && !/darwin|mac/i.test(ua);
  document.documentElement.classList.toggle('is-windows', isWindows);

  $$('[data-download="mac"]').forEach((a) => (a.href = MAC));
  $$('[data-download="win"]').forEach((a) => {
    a.href = WINDOWS;
    a.setAttribute('download', '');
  });
  $$('[data-download-intel]').forEach((a) => (a.href = MAC_INTEL));

  // Install steps: Mac or Windows, starting with the visitor's own.
  const tabs = $$('[data-os-tab]');
  function showSteps(os) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.osTab === os)));
    $$('[data-os-steps]').forEach((ol) => {
      ol.hidden = ol.dataset.osSteps !== os;
      if (!ol.hidden) $$('.rise', ol).forEach((el) => el.classList.add('is-in'));
    });
  }
  tabs.forEach((t) => t.addEventListener('click', () => showSteps(t.dataset.osTab)));
  showSteps(isWindows ? 'win' : 'mac');

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // --- The desktop -------------------------------------------------------------------------

  const pingo = $('[data-pingo]');
  const sprite = $('[data-sprite]');
  const bubble = $('[data-bubble]');
  const bubbleText = $('[data-bubble-text]');
  const bubbleButtons = $('[data-bubble-buttons]');
  const confetti = $('[data-confetti]');
  const hint = $('[data-hint]');
  const ask = $('[data-ask]');
  const askInput = $('[data-ask-input]');

  // Only the classic character has a full set of poses; the others stand or cheer.
  const CHARACTERS = {
    boy: (p) => p,
    'boy-badge': (p) => (p === 'happy' ? 'boy-badge-happy' : 'boy-badge-idle'),
    'boy-sticker': (p) => (p === 'happy' ? 'boy-sticker-happy' : 'boy-sticker-idle'),
  };
  let character = 'boy';
  let currentPose = 'walking';
  const setPose = (p) => {
    currentPose = p;
    sprite.src = `assets/poses/${CHARACTERS[character](p)}.webp`;
  };

  const REMINDERS = {
    water: { text: 'Time for a glass of water.', pose: 'drink', cheer: 'Hydrated and happy!' },
    stretch: { text: 'Stand up and stretch.', pose: 'stretch', cheer: 'Nice stretch!' },
    eyes: {
      text: 'Look away from the screen for 20 seconds.',
      pose: 'rest',
      cheer: 'Eyes refreshed!',
    },
    medicine: { text: 'Time for your vitamins.', pose: 'point', cheer: 'Taken care of!' },
  };

  let onStage = false;
  let current = null; // the reminder on screen
  let act = 0; // bumps on every new action, so a newer click cancels the older sequence

  function showBubble(text, withButtons) {
    bubbleText.textContent = text;
    bubbleButtons.hidden = !withButtons;
    bubble.classList.add('is-shown');
  }

  async function walk(from, to, mirrored, ms, easing) {
    pingo.classList.toggle('is-mirrored', mirrored);
    if (reducedMotion) {
      pingo.style.translate = to;
      return;
    }
    pingo.classList.add('is-walking');
    setPose('walking');
    const anim = pingo.animate([{ translate: from }, { translate: to }], { duration: ms, easing });
    await anim.finished.catch(() => {});
    pingo.style.translate = to;
    pingo.classList.remove('is-walking', 'is-mirrored');
  }

  async function call(reminder) {
    const me = ++act;
    current = reminder;
    hint?.classList.add('is-gone');
    $$('.app').forEach((a) =>
      a.classList.toggle('is-running', a.dataset.reminder === reminder.key),
    );
    bubble.classList.remove('is-shown');
    if (!onStage) {
      onStage = true;
      await walk('160% 0', '0 0', true, 1400, EASE_OUT);
    } else {
      await wait(160);
    }
    if (me !== act) return;
    setPose(reminder.pose);
    showBubble(reminder.text, true);
  }

  async function leave(me, delay) {
    await wait(delay);
    if (me !== act) return;
    bubble.classList.remove('is-shown');
    await wait(150);
    if (me !== act) return;
    onStage = false;
    $$('.app').forEach((a) => a.classList.remove('is-running'));
    await walk('0 0', '160% 0', false, 1100, EASE_IN_OUT);
  }

  function burst() {
    if (reducedMotion) return;
    const colours = ['#0a8a64', '#2f8cf0', '#f39a1e', '#ef5b5b', '#ffffff'];
    for (let i = 0; i < 34; i++) {
      const bit = document.createElement('i');
      const angle = Math.random() * Math.PI * 2;
      const reach = 90 + Math.random() * 170;
      bit.style.background = colours[i % colours.length];
      bit.style.setProperty('--dx', `${Math.cos(angle) * reach}px`);
      bit.style.setProperty('--dy', `${Math.sin(angle) * reach - 70}px`);
      bit.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
      bit.style.animationDelay = `${Math.random() * 120}ms`;
      confetti.append(bit);
      setTimeout(() => bit.remove(), 1500);
    }
  }

  $('[data-done]').addEventListener('click', () => {
    const me = ++act;
    setPose('happy');
    showBubble(current?.cheer ?? 'Nice work!', false);
    burst();
    if (!reducedMotion) {
      pingo.classList.remove('is-hopping');
      void pingo.offsetWidth;
      pingo.classList.add('is-hopping');
    }
    leave(me, 1700);
  });

  $('[data-snooze]').addEventListener('click', () => {
    const me = ++act;
    setPose('think');
    showBubble('Okay! I’ll come back in 10 minutes.', false);
    leave(me, 1500);
  });

  $$('[data-reminder]').forEach((app) =>
    app.addEventListener('click', () => {
      ask.hidden = true;
      call({ key: app.dataset.reminder, ...REMINDERS[app.dataset.reminder] });
    }),
  );

  // Your own words: a small field grows out of the "+" app.
  $('[data-own]').addEventListener('click', () => {
    ask.hidden = !ask.hidden;
    if (!ask.hidden) askInput.focus();
  });
  ask.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = askInput.value.trim();
    if (!text) return;
    ask.hidden = true;
    const line = `${text.charAt(0).toUpperCase()}${text.slice(1).replace(/[.!]?$/, '.')}`;
    call({ key: 'own', text: line, pose: 'point', cheer: 'Nice work!' });
  });

  // Character menu in the menu bar.
  const menu = $('[data-menu]');
  const menuButton = $('[data-menu-button]');
  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!menu.classList.contains('is-open'));
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) setMenu(false);
  });
  $$('[data-character]').forEach((item) =>
    item.addEventListener('click', () => {
      character = item.dataset.character;
      $$('[data-character]').forEach((i) => i.setAttribute('aria-checked', String(i === item)));
      setMenu(false);
      setPose(currentPose);
      if (!onStage) call({ key: 'water', ...REMINDERS.water });
    }),
  );
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setMenu(false);
    ask.hidden = true;
  });

  // A live clock, like the real menu bar.
  const clock = $('[data-clock]');
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 20_000);

  // If nobody clicks, Pingo shows how it works by itself.
  setTimeout(() => {
    if (act === 0) call({ key: 'water', ...REMINDERS.water });
  }, 1800);

  // --- Below the desktop -------------------------------------------------------------------

  // Sections rise in as they arrive.
  const risers = $$('.rise');
  risers.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('rise'));
    el.style.setProperty('--i', String(Math.min(siblings.indexOf(el), 5)));
  });
  if (reducedMotion || !('IntersectionObserver' in window)) {
    risers.forEach((el) => el.classList.add('is-in'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    risers.forEach((el) => observer.observe(el));
  }
})();
