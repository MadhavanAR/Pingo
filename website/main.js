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

  // Navigation shadow once the page scrolls

  const nav = $('[data-nav]');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Headline: reveal word by word, keeping styled spans (the gradient accent)

  const headline = $('[data-split]');
  if (headline && !reducedMotion) {
    let index = 0;
    const words = [];
    for (const node of [...headline.childNodes]) {
      const className = node.nodeType === Node.ELEMENT_NODE ? node.className : '';
      for (const text of node.textContent.trim().split(/ +/).filter(Boolean)) {
        words.push({ text, className });
      }
    }
    headline.textContent = '';
    words.forEach(({ text, className }, i) => {
      const span = document.createElement('span');
      span.className = `word ${className}`.trim();
      span.style.setProperty('--i', index++);
      span.textContent = text;
      headline.append(span, i < words.length - 1 ? ' ' : '');
    });
  }

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
          el.style.setProperty('--delay', `${Math.max(0, siblings.indexOf(el)) * 70}ms`);
          el.classList.add('in');
          observer.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    revealables.forEach((el) => observer.observe(el));
  }

  // Interactive cards: a light that follows the cursor, and a gentle tilt

  $$('.spot').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      if (card.hasAttribute('data-tilt') && !reducedMotion) {
        card.style.setProperty('--ry', `${(x / rect.width - 0.5) * 4}deg`);
        card.style.setProperty('--rx', `${(0.5 - y / rect.height) * 4}deg`);
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  // Showcase: switch characters on click, cycle until the visitor picks one,
  // and act out each feature row on hover

  const showcase = $('.showcase');
  const showcaseImg = $('[data-showcase-img]');
  const charButtons = $$('[data-char]');
  if (showcase && showcaseImg && charButtons.length) {
    const poseSrc = (char, pose) =>
      // Only the classic character has the full pose set; others use happy.
      char === 'boy' ? `assets/poses/${pose}.webp` : `assets/poses/${char}-happy.webp`;
    charButtons.forEach((btn) => (new Image().src = `assets/poses/${btn.dataset.char}-idle.webp`));
    ['point', 'think', 'happy', 'wave'].forEach(
      (p) => (new Image().src = `assets/poses/${p}.webp`),
    );

    let current = 0;
    let hovering = false;
    const setImage = (src, alt) => {
      if (showcaseImg.getAttribute('src') === src) return;
      showcaseImg.classList.add('swap');
      setTimeout(
        () => {
          showcaseImg.src = src;
          if (alt) showcaseImg.alt = alt;
          showcaseImg.classList.remove('swap');
        },
        reducedMotion ? 0 : 200,
      );
    };
    const show = (i) => {
      current = i;
      charButtons.forEach((btn, n) => btn.setAttribute('aria-checked', String(n === i)));
      const { char, label } = charButtons[i].dataset;
      setImage(`assets/poses/${char}-idle.webp`, label);
    };

    let auto = reducedMotion
      ? null
      : setInterval(() => {
          if (!hovering) show((current + 1) % charButtons.length);
        }, 3200);
    charButtons.forEach((btn, i) =>
      btn.addEventListener('click', () => {
        clearInterval(auto);
        auto = null;
        show(i);
      }),
    );

    const rows = $$('[data-pose]', showcase);
    const actOut = (row) => {
      hovering = Boolean(row);
      rows.forEach((r) => r.classList.toggle('active', r === row));
      const { char } = charButtons[current].dataset;
      setImage(row ? poseSrc(char, row.dataset.pose) : `assets/poses/${char}-idle.webp`);
    };
    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => actOut(row));
      row.addEventListener('focus', () => actOut(row));
      row.addEventListener('blur', () => actOut(null));
    });
    $('.showcase-list', showcase).addEventListener('pointerleave', () => actOut(null));
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
    const colors = ['#1c1917', '#16a34a', '#a8a29e', '#86efac', '#57534e'];
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
