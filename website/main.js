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

  // Platform detection, download links and install tabs

  // Asset patterns must match `artifactName` in package.json.
  const platforms = {
    windows: { label: 'Download for Windows', pattern: /\.exe$/i },
    mac: { label: 'Download for macOS', pattern: /\.dmg$/i },
    linux: { label: 'Download for Linux', pattern: /\.AppImage$/i },
  };

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return 'mac';
    if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return 'linux';
    return null;
  }

  const platformKey = detectPlatform();
  const platform = platforms[platformKey];
  const downloads = $$('[data-download]');
  downloads.forEach((a) => (a.href = `${repoUrl}/releases/latest`));
  if (platform) $$('[data-download-label]').forEach((el) => (el.textContent = platform.label));

  // Link straight to the installer when the GitHub API is reachable; the
  // releases page stays as the fallback (e.g. when rate-limited).
  fetch(`https://api.github.com/repos/${repo}/releases/latest`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
    .then((release) => {
      if (release.tag_name) {
        $('[data-version]').textContent = `${release.tag_name} is out — free & open source`;
      }
      const asset = platform && release.assets.find((a) => platform.pattern.test(a.name));
      if (asset) downloads.forEach((a) => (a.href = asset.browser_download_url));
    })
    .catch(() => {});

  const tabs = $$('[data-tab]');
  function selectTab(key) {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === key;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    $$('[data-panel]').forEach((panel) => (panel.hidden = panel.dataset.panel !== key));
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      selectTab(next.dataset.tab);
      next.focus();
    });
  });
  selectTab(platformKey ?? 'windows');

  // Navigation shadow once the page scrolls

  const nav = $('[data-nav]');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Headline: reveal word by word

  const headline = $('[data-split]');
  if (headline && !reducedMotion) {
    const words = headline.textContent.trim().split(/ +/); // keeps non-breaking pairs together
    headline.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.style.setProperty('--i', i);
      span.textContent = word;
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

  // Cursor-following spotlight on cards

  $$('.spot').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });

  // Seamless marquee: duplicate the items once so the loop never shows a gap

  const marquee = $('[data-marquee]');
  if (marquee && !reducedMotion) {
    [...marquee.children].forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      marquee.append(clone);
    });
  }

  // Character cards switch to their happy pose on hover

  $$('img[data-hover]').forEach((img) => {
    const idle = img.src;
    const happy = img.dataset.hover;
    new Image().src = happy;
    const card = img.closest('.char');
    card.addEventListener('pointerenter', () => (img.src = happy));
    card.addEventListener('pointerleave', () => (img.src = idle));
  });

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
    { text: 'Hey Priya! Time to drink some water 💧', water: true, next: 45 },
    { text: 'Hey Arjun! Stand up, stretch and rest your eyes 🧘', next: 60 },
    { text: 'Hey Meera! Time for your evening medicine 💊', next: 120 },
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
    const colors = ['#3ddc84', '#4cc3ff', '#a78bfa', '#ffd166', '#ff7a59'];
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
    toastText.textContent = `Done · next reminder in ${next} min`;
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
