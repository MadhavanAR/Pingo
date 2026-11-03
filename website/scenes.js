'use strict';

/* global gsap, Stage */

// Pingo's two scroll scenes, built on the shared stage (vendor/stage.js).

(() => {
  const Scenes = (window.Scenes = window.Scenes || {});
  const lerp = (a, b, t) => a + (b - a) * t;

  // Scene 1. The O is the corner of your screen. Its counter already holds the app; scrolling
  // flies through it until the app's window fills the screen.
  Scenes['through-the-o'] = (root, opts = {}) => {
    const word = root.querySelector('[data-monument]');
    const o = root.querySelector('[data-o]');
    const through = root.querySelector('[data-through]');
    const win = root.querySelector('[data-through-window]');
    const geo = {};
    let progress = 0;

    // Offsets, not bounding boxes: they ignore the transforms this scene applies.
    function measure() {
      const stageW = through.offsetWidth || window.innerWidth;
      const stageH = through.offsetHeight || window.innerHeight;
      const ox = o.offsetLeft + o.offsetWidth / 2;
      const oy = o.offsetTop + o.offsetHeight * 0.5;
      Object.assign(geo, {
        ox,
        oy,
        cx: word.offsetLeft + ox,
        cy: word.offsetTop + oy,
        r0: o.offsetWidth * 0.16,
        stageW,
        stageH,
        winW: win.offsetWidth,
      });
      geo.scale = (Math.hypot(stageW, stageH) * 1.1) / geo.r0;
      gsap.set(word, { transformOrigin: `${ox}px ${oy}px` });
    }

    function paint(p) {
      progress = p;
      const fly = Math.pow(p, 2.4); // accelerate, like a camera picking up speed
      const s = 1 + (geo.scale - 1) * fly;
      const settle = gsap.parseEase('power2.inOut')(Math.min(1, p * 1.15));
      gsap.set(word, { scale: s });
      through.style.clipPath = `circle(${(geo.r0 * s).toFixed(1)}px at ${geo.cx}px ${geo.cy}px)`;
      gsap.set(win, {
        xPercent: -50,
        yPercent: -50,
        x: lerp(geo.cx - geo.stageW / 2, 0, settle),
        y: lerp(geo.cy - geo.stageH / 2, 0, settle),
        scale: lerp((geo.r0 * 2.6) / geo.winW, 1, settle),
      });
    }

    return Stage.scene(root, {
      hold: opts.hold ?? 2,
      scrub: true,
      phone: 'rest',
      build(tl, { q }) {
        measure();
        paint(0);
        // main.js re-fits the name on resize, then announces it.
        window.addEventListener('pingo:fit', () => {
          measure();
          paint(progress);
        });
        const proxy = { p: 0 };
        tl.to(proxy, { p: 1, duration: 0.78, onUpdate: () => paint(proxy.p) }, 0.04)
          .to(
            q('[data-hero-copy], [data-walker]'),
            { autoAlpha: 0, y: -32, duration: 0.12, stagger: 0.03 },
            0,
          )
          .fromTo(
            q('[data-through-caption]'),
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' },
            0.84,
          );
      },
      rest() {
        gsap.set([word, win], { clearProps: 'transform' });
        through.style.clipPath = '';
      },
    });
  };

  // Scene 2. Make it yours: one character steps aside for the next, ending on your own.
  Scenes.parade = (root, opts = {}) =>
    Stage.scene(root, {
      hold: opts.hold ?? 2,
      scrub: true,
      phone: 'rest',
      beats: 4,
      build(tl, { q }) {
        const cards = q('[data-card]');
        gsap.set(cards.slice(1), { autoAlpha: 0, yPercent: 10 });
        cards.slice(1).forEach((card, i) => {
          const at = (i + 1) * 0.25 - 0.06;
          tl.to(
            cards[i],
            { autoAlpha: 0, yPercent: -6, scale: 0.96, duration: 0.1, ease: 'power2.in' },
            at,
          ).fromTo(
            card,
            { autoAlpha: 0, yPercent: 10, scale: 1.03 },
            { autoAlpha: 1, yPercent: 0, scale: 1, duration: 0.12, ease: 'power2.out' },
            at + 0.04,
          );
        });
      },
    });
})();
