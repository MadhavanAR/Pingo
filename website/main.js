'use strict';

/* global Stage */

(function () {
  const { repo } = window.PINGO_SITE;
  const repoUrl = `https://github.com/${repo}`;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pose = (name) => `assets/poses/${name}.webp`;

  // Links. GitHub serves `releases/latest/download/<file>` as the file itself; the names
  // must match the mac `artifactName` in package.json.

  $$('[data-repo-link]').forEach((a) => (a.href = repoUrl));
  $$('[data-repo-path]').forEach((a) => (a.href = repoUrl + a.dataset.repoPath));
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

  // The name, the closing verb and the footer name each fill their width exactly.

  function fit(el, width) {
    el.style.fontSize = '100px';
    const natural = el.offsetWidth;
    if (natural) el.style.fontSize = `${(100 * width) / natural}px`;
  }

  const gutter = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--m')) || 24;

  function fitAll() {
    const m = gutter();
    const fold = $('[data-fold]');
    const word = $('[data-monument]');
    if (fold && word) fit(word, fold.clientWidth - 2 * m);
    const cta = $('.cta');
    const ctaWord = $('.cta-word');
    if (cta && ctaWord) fit(ctaWord, cta.clientWidth - 2 * m);
    const footerName = $('.footer-name');
    if (footerName) fit(footerName, footerName.parentElement.clientWidth - 2 * m);
    window.dispatchEvent(new Event('pingo:fit'));
  }

  // Pingo walks in along the top of the name and stops on the O.

  const walker = $('[data-walker]'); // GSAP fades this one on scroll
  const walkerInner = $('[data-walker-inner]'); // the walk animates this one
  const sprite = $('[data-walker-sprite]');
  const walkerBubble = $('[data-walker-bubble]');
  const walkerText = $('[data-walker-text]');

  function placeWalker() {
    const word = $('[data-monument]');
    const o = $('[data-o]');
    if (!walker || !word || !o) return;
    const fontSize = parseFloat(word.style.fontSize) || o.offsetHeight;
    const centre = word.offsetLeft + o.offsetLeft + o.offsetWidth / 2;
    const capTop = word.offsetTop + o.offsetTop + fontSize * 0.005;
    walker.style.left = `${centre - walker.offsetWidth * 0.52}px`;
    walker.style.top = `${capTop - walker.offsetHeight * 0.985}px`;
  }

  const LINES = [
    // Full-body poses only: Pingo is standing on the O.
    ['Time for a glass of water.', 'drink'],
    ['Stand up and stretch your back.', 'wave'],
    ['Look out of the window for 20 seconds.', 'think'],
    ['Time for your vitamin D.', 'point'],
  ];

  async function walkIn() {
    if (!walker) return;
    placeWalker();
    const distance = window.innerWidth - walker.offsetLeft + 40;
    if (!reducedMotion) {
      walker.classList.add('is-walking', 'is-mirrored');
      await walkerInner.animate([{ translate: `${distance}px 0` }, { translate: '0 0' }], {
        duration: 2400,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
        fill: 'backwards',
      }).finished;
      walker.classList.remove('is-walking', 'is-mirrored');
    }
    let i = 0;
    for (;;) {
      const [text, name] = LINES[i % LINES.length];
      sprite.src = pose(name);
      walkerText.textContent = text;
      walkerBubble.classList.add('is-shown');
      await wait(3600);
      walkerBubble.classList.remove('is-shown');
      await wait(450);
      i += 1;
    }
  }

  // Entrances: the parts of each section rise in turn as it comes into view.

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

  // Try a reminder: type it, Pingo says it; Done celebrates, Snooze thinks it over.

  const input = $('[data-try-input]');
  if (input) {
    const line = $('[data-plate-line]');
    const bubble = $('[data-plate-bubble]');
    const char = $('[data-plate-char]');
    const whenEl = $('[data-try-when]');
    const confetti = $('[data-confetti]');
    const tabs = $$('.tabs [data-example]');

    const TYPES = [
      {
        test: /medic|pill|tablet|vitamin|dose/i,
        pose: 'point',
        when: 'At 09:00 and 21:00',
        cheer: 'Taken care of!',
      },
      {
        test: /posture|sit up|straight|shoulder/i,
        pose: 'think',
        when: 'Every 30 minutes',
        cheer: 'Standing tall!',
      },
      {
        test: /eye|screen|look away|window/i,
        pose: 'rest',
        when: 'Every 20 minutes',
        cheer: 'Eyes refreshed!',
      },
      {
        test: /stretch|stand|walk|move|back|neck/i,
        pose: 'stretch',
        when: 'Every 60 minutes',
        cheer: 'Nice stretch!',
      },
      {
        test: /water|drink|hydrat|glass/i,
        pose: 'drink',
        when: 'Every 45 minutes',
        cheer: 'Hydrated and happy!',
      },
    ];
    const CUSTOM = { pose: 'point', when: 'Every 60 minutes', cheer: 'Nice work!' };
    const pad = (n) => String(n).padStart(2, '0'); // clock times, 09:00

    function parse(raw) {
      let text = raw.trim();
      let when = null;
      const every = text.match(/\bevery\s+(\d{1,3})\s*(m|min|mins|minutes?|h|hr|hrs|hours?)\b/i);
      if (every) {
        const n = Number(every[1]);
        when = /^h/i.test(every[2])
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

    let current = TYPES[4];
    let busy = false;

    function render() {
      const { text, when } = parse(input.value);
      const message = text || 'Drink a glass of water';
      current = TYPES.find((t) => t.test.test(message)) ?? CUSTOM;
      if (!busy) {
        line.textContent = `${message.charAt(0).toUpperCase()}${message.slice(1)}.`;
        char.src = pose(current.pose);
      }
      whenEl.textContent = `${when ?? current.when}, every day`;
    }

    function burst() {
      if (reducedMotion) return;
      const colours = ['#e6dbc7', '#ffffff', '#9db4ff', '#d2c3a7'];
      for (let i = 0; i < 28; i++) {
        const bit = document.createElement('i');
        const angle = Math.random() * Math.PI * 2;
        const reach = 90 + Math.random() * 160;
        bit.style.background = colours[i % colours.length];
        bit.style.setProperty('--dx', `${Math.cos(angle) * reach}px`);
        bit.style.setProperty('--dy', `${Math.sin(angle) * reach - 60}px`);
        bit.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
        bit.style.animationDelay = `${Math.random() * 120}ms`;
        confetti.append(bit);
        setTimeout(() => bit.remove(), 1500);
      }
    }

    async function answer(text, name, celebrate) {
      if (busy) return;
      busy = true;
      bubble.classList.add('is-swapping');
      await wait(200);
      line.textContent = text;
      char.src = pose(name);
      bubble.classList.remove('is-swapping');
      if (celebrate) {
        burst();
        if (!reducedMotion) char.classList.add('is-hopping');
      }
      await wait(1900);
      char.classList.remove('is-hopping');
      bubble.classList.add('is-swapping');
      await wait(200);
      busy = false;
      render();
      bubble.classList.remove('is-swapping');
    }

    input.addEventListener('input', render);
    $('[data-try-done]').addEventListener('click', () => answer(current.cheer, 'happy', true));
    $('[data-try-snooze]').addEventListener('click', () =>
      answer('I’ll come back in 10 minutes.', 'think', false),
    );
    tabs.forEach((tab) =>
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        input.value = tab.dataset.example;
        render();
      }),
    );
    render();
  }

  // Features: hover or focus a capability to read it, and see the screen it lives on.

  const tip = $('[data-detail-tip]');
  const shots = $$('[data-shot]');
  $$('.group li').forEach((li) => {
    const show = () => {
      $$('.group li.is-on').forEach((x) => x.classList.remove('is-on'));
      li.classList.add('is-on');
      tip.textContent = li.dataset.tip;
      const group = li.closest('[data-group]').dataset.group;
      shots.forEach((img) => img.classList.toggle('is-on', img.dataset.shot === group));
    };
    li.addEventListener('mouseenter', show);
    li.addEventListener('focus', show);
  });
  $('.group li')?.classList.add('is-on');

  // Start: fit the type once the fonts are in, then walk Pingo on and start the scenes.

  const start = () => {
    fitAll();
    if (window.Stage) {
      Stage.smooth();
      Stage.init();
    }
    walkIn();
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fitAll();
      placeWalker();
      window.ScrollTrigger?.refresh();
    }, 150);
  });
})();
