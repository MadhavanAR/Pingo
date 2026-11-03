'use strict';

(function () {
  const root = document.documentElement;
  root.classList.add('js');

  const { repo } = window.PINGO_SITE;
  const repoUrl = `https://github.com/${repo}`;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Links

  $$('[data-repo-link]').forEach((a) => (a.href = repoUrl));
  $$('[data-repo-path]').forEach((a) => (a.href = repoUrl + a.dataset.repoPath));

  // Direct downloads. GitHub serves `releases/latest/download/<file>` as the
  // file itself; names must match the mac `artifactName` in package.json.
  const latest = `${repoUrl}/releases/latest/download`;
  $$('[data-download]').forEach((a) => {
    a.href = `${latest}/Pingo-mac-arm64.dmg`;
    a.setAttribute('download', '');
  });
  $$('[data-download-intel]').forEach((a) => {
    a.href = `${latest}/Pingo-mac-x64.dmg`;
    a.setAttribute('download', '');
  });

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // Scroll reveal, staggered within each group of siblings

  const revealables = $$('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('in'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          const siblings = [...el.parentElement.children].filter((c) => c.matches('.reveal'));
          el.style.setProperty('--delay', `${Math.max(0, siblings.indexOf(el)) * 80}ms`);
          el.classList.add('in');
          observer.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    revealables.forEach((el) => observer.observe(el));
  }

  // Radio-style segmented controls

  function radios(buttons, onPick) {
    buttons.forEach((btn) =>
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
        onPick(btn);
      }),
    );
  }

  // The app window: switch the screenshot's theme, and let it rise into place

  const appWindow = $('[data-window]');
  if (appWindow) {
    radios($$('[data-shot-theme]'), (btn) => {
      appWindow.dataset.themeShot = btn.dataset.shotTheme;
    });

    if (!reducedMotion) {
      let ticking = false;
      const update = () => {
        ticking = false;
        const rect = appWindow.getBoundingClientRect();
        // 0 when the window's top enters at the bottom, 1 once it reaches mid-screen.
        const t = Math.min(1, Math.max(0, (innerHeight - rect.top) / (innerHeight * 0.5)));
        appWindow.style.transform = `scale(${0.92 + 0.08 * t})`;
      };
      addEventListener(
        'scroll',
        () => {
          if (!ticking) requestAnimationFrame(update);
          ticking = true;
        },
        { passive: true },
      );
      update();
    }
  }

  // "What should Pingo say?": type a reminder, see it as Pingo would show it

  const sayInput = $('[data-say-input]');
  if (sayInput) {
    const typeEl = $('[data-say-type]');
    const msgEl = $('[data-say-msg]');
    const whenEl = $('[data-say-when]');
    const lineEl = $('[data-say-line]');
    const bubbleEl = $('[data-say-bubble]');
    const charEl = $('[data-say-char]');

    // Reminder types and the pose the classic character takes for each.
    const TYPES = [
      {
        name: 'Medicine',
        test: /medic|pill|tablet|vitamin|dose/i,
        pose: 'point',
        alt: 'Pingo pointing',
        when: 'At 09:00 and 21:00',
      },
      {
        name: 'Posture',
        test: /posture|sit up|straight|shoulder/i,
        pose: 'think',
        alt: 'Pingo checking posture',
        when: 'Every 30 minutes',
      },
      {
        name: 'Rest your eyes',
        test: /eye|screen|look away/i,
        pose: 'rest',
        alt: 'Pingo resting its eyes',
        when: 'Every 20 minutes',
      },
      {
        name: 'Stretch',
        test: /stretch|stand|walk|move|back|neck/i,
        pose: 'stretch',
        alt: 'Pingo stretching',
        when: 'Every 60 minutes',
      },
      {
        name: 'Water',
        test: /water|drink|hydrat|glass/i,
        pose: 'drink',
        alt: 'Pingo holding a glass of water',
        when: 'Every 45 minutes',
      },
    ];
    const CUSTOM = {
      name: 'Custom',
      pose: 'point',
      alt: 'Pingo pointing',
      when: 'Every 60 minutes',
    };

    let avatar = 'boy';
    let pose = 'drink';
    let alt = TYPES[4].alt;

    const pad = (n) => String(n).padStart(2, '0');

    function parse(raw) {
      let text = raw.trim();
      let when = null;
      const every = text.match(/\bevery\s+(\d{1,3})\s*(m|min|mins|minutes?|h|hr|hrs|hours?)\b/i);
      if (every) {
        const n = Number(every[1]);
        const hours = /^h/i.test(every[2]);
        when = hours
          ? `Every ${n} hour${n === 1 ? '' : 's'}`
          : `Every ${n} minute${n === 1 ? '' : 's'}`;
        text = text.replace(every[0], '');
      }
      const at = text.match(
        /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*(?:,|and|&)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)*)/i,
      );
      if (at) {
        const times = at[1]
          .split(/\s*(?:,|and|&)\s*/i)
          .map((t) => {
            const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (!m) return null;
            let h = Number(m[1]);
            const min = Number(m[2] || 0);
            if (m[3] && /pm/i.test(m[3]) && h < 12) h += 12;
            if (m[3] && /am/i.test(m[3]) && h === 12) h = 0;
            return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
          })
          .filter(Boolean);
        if (times.length) {
          when = `At ${times.length > 1 ? `${times.slice(0, -1).join(', ')} and ${times.at(-1)}` : times[0]}`;
          text = text.replace(at[0], '');
        }
      }
      text = text
        .replace(/\s{2,}/g, ' ')
        .replace(/[\s,.;:-]+$/, '')
        .trim();
      return { text, when };
    }

    function render() {
      const { text, when } = parse(sayInput.value);
      const message = text || 'Drink a glass of water';
      const type = TYPES.find((t) => t.test.test(message)) || CUSTOM;
      const clean = message.charAt(0).toUpperCase() + message.slice(1);
      typeEl.textContent = type.name;
      msgEl.textContent = clean;
      whenEl.textContent = when || type.when;
      lineEl.textContent = `Hey! Time to ${clean.charAt(0).toLowerCase()}${clean.slice(1)}.`;
      pose = type.pose;
      alt = type.alt;
      updateChar();
    }

    function updateChar() {
      // Only the classic character has the full pose set.
      const src =
        avatar === 'boy' ? `assets/poses/${pose}.webp` : `assets/poses/${avatar}-happy.webp`;
      if (charEl.getAttribute('src') === src) return;
      charEl.classList.add('swap');
      setTimeout(
        () => {
          charEl.src = src;
          charEl.alt = avatar === 'boy' ? alt : 'Pingo, in the chosen avatar style, cheering';
          charEl.classList.remove('swap');
        },
        reducedMotion ? 0 : 180,
      );
    }

    ['drink', 'stretch', 'rest', 'think', 'point'].forEach(
      (p) => (new Image().src = `assets/poses/${p}.webp`),
    );

    sayInput.addEventListener('input', render);
    $$('[data-example]').forEach((btn) =>
      btn.addEventListener('click', () => {
        sayInput.value = btn.dataset.example;
        render();
      }),
    );
    radios($$('[data-avatar]'), (btn) => {
      avatar = btn.dataset.avatar;
      updateChar();
    });
    radios($$('[data-bubble-style]'), (btn) => {
      bubbleEl.classList.toggle('retro', btn.dataset.bubbleStyle === 'retro');
    });
    render();
  }

  // How it works: a horizontal accordion, one stage open at a time

  const acc = $('[data-acc]');
  if (acc) {
    const panels = $$('.acc-panel', acc);
    panels.forEach((panel) => {
      const btn = $('h3 button', panel);
      btn.addEventListener('click', () => {
        panels.forEach((p) => {
          const open = p === panel;
          p.classList.toggle('is-open', open);
          $('h3 button', p).setAttribute('aria-expanded', String(open));
        });
      });
    });
  }

  // Closing setup window: the name feeds the greeting, the choice picks the build

  const setupName = $('[data-setup-name]');
  const setupLine = $('[data-setup-line]');
  const setupGo = $('[data-download-choice]');
  if (setupName && setupLine && setupGo) {
    const greet = () => {
      const name = setupName.value.trim();
      setupLine.textContent = `Hey${name ? ` ${name}` : ''}! Time to drink some water.`;
    };
    setupName.addEventListener('input', greet);
    greet();
    const pick = (arch) => {
      setupGo.href = `${latest}/Pingo-mac-${arch}.dmg`;
      setupGo.setAttribute('download', '');
      setupGo.textContent = arch === 'x64' ? 'Download for Intel Mac' : 'Download for Mac';
    };
    radios($$('[data-mac]'), (btn) => pick(btn.dataset.mac));
    pick('arm64');
  }

  // Product demo

  const stage = $('[data-stage]');
  if (!stage) return;

  const pet = $('[data-pet]', stage);
  const sprite = $('[data-sprite]', stage);
  const bubble = $('[data-bubble]', stage);
  const bubbleText = $('[data-bubble-text]', stage);
  const doneBtn = $('[data-done]', stage);
  const cursor = $('[data-cursor]', stage);
  const confetti = $('[data-confetti]', stage);
  const toast = $('[data-toast]', stage);
  const toastText = $('[data-toast-text]', stage);
  const demo = $('.demo', stage);

  const POSES = ['walking', 'point', 'drink', 'happy', 'wave', 'think'];
  const poseUrl = (pose) => `assets/poses/${pose}.webp`;
  POSES.forEach((pose) => (new Image().src = poseUrl(pose)));
  const setPose = (pose) => (sprite.src = poseUrl(pose));

  const SCRIPT = [
    { text: 'Hey Priya! Time to drink some water.', water: true, next: 45 },
    { text: 'Hey Arjun! Stand up, stretch and rest your eyes.', next: 60 },
    { text: 'Hey Meera! Time for your evening medicine.', next: 120 },
  ];

  if (reducedMotion) {
    pet.classList.add('in');
    setPose('point');
    bubbleText.textContent = SCRIPT[0].text;
    bubble.classList.add('show', 'typed');
    return;
  }

  let visible = false;
  const visibility = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), {
    threshold: 0.25,
  });
  visibility.observe(stage);

  async function whenVisible() {
    while (!visible || document.hidden) await wait(250);
  }

  async function type(text) {
    bubble.classList.remove('typed');
    bubbleText.textContent = '';
    for (const char of text) {
      bubbleText.textContent += char;
      await wait(char === ' ' ? 24 : 34);
    }
    bubble.classList.add('typed');
  }

  function moveCursor(x, y) {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function pointAt(el) {
    const box = demo.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    moveCursor(r.left - box.left + r.width * 0.45, r.top - box.top + r.height * 0.55);
  }

  function burst() {
    const colors = ['#ffffff', '#ff3b1f', '#0a0a0a', '#050a5c', '#ffffff'];
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement('i');
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 300)}px`);
      piece.style.setProperty('--dy', `${Math.round(-60 - Math.random() * 160)}px`);
      piece.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
      piece.style.animationDelay = `${Math.random() * 120}ms`;
      confetti.append(piece);
      setTimeout(() => piece.remove(), 1600);
    }
  }

  async function play({ text, water, next }) {
    await whenVisible();

    // Walk in from the right, facing left.
    setPose('walking');
    pet.classList.add('walking', 'mirrored');
    pet.classList.add('in');
    await wait(1300);
    pet.classList.remove('walking', 'mirrored');

    // Point at the bubble and type the reminder.
    setPose('point');
    bubble.classList.add('show');
    await wait(250);
    await type(text);
    await wait(500);

    // The user's cursor glides over and taps Done.
    const box = demo.getBoundingClientRect();
    moveCursor(box.width * 0.3, box.height * 0.9);
    await wait(50);
    cursor.classList.add('show');
    await wait(80);
    pointAt(doneBtn);
    await wait(1000);
    doneBtn.classList.add('pressed');
    await wait(180);
    doneBtn.classList.remove('pressed');
    bubble.classList.remove('show');
    cursor.classList.remove('show');

    // Celebrate, confirm, and walk off.
    if (water) {
      setPose('drink');
      await wait(900);
    }
    setPose('happy');
    pet.classList.add('hop');
    burst();
    toastText.textContent = `Done. Next reminder in ${next} min`;
    toast.classList.add('show');
    await wait(1500);
    pet.classList.remove('hop');
    setPose('wave');
    await wait(700);

    setPose('walking');
    pet.classList.add('walking');
    pet.classList.remove('in');
    await wait(1300);
    pet.classList.remove('walking');
    toast.classList.remove('show');
    await wait(900);
  }

  (async function loop() {
    await wait(900);
    for (let i = 0; ; i = (i + 1) % SCRIPT.length) {
      await play(SCRIPT[i]);
    }
  })();
})();
