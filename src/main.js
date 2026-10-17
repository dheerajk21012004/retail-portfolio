import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource/caveat/400.css';
import 'lenis/dist/lenis.css';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import looks from '../looks.json';
import photos from './photos.json';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const base = import.meta.env.BASE_URL;
const $ = (s) => document.querySelector(s);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Full 3D atelier on capable desktops, the flat lookbook on phones and low power devices,
// and a calm version with no motion when the visitor asks for reduced motion.
const motion = new URLSearchParams(location.search).get('motion');
const calm = motion === 'off' || (motion !== 'on' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const webgl = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
})();
const roomy = matchMedia('(pointer: fine) and (min-width: 900px) and (min-height: 560px)').matches;
const frugal = navigator.connection?.saveData || navigator.deviceMemory < 4;
let mode = calm ? 'calm' : webgl && roomy && !frugal ? 'full' : 'lite';
root.dataset.mode = mode;

const toggle = $('#mode-toggle');
toggle.textContent = calm ? 'Full version' : 'Calm version';
toggle.href = `?motion=${calm ? 'on' : 'off'}`;

const entries = looks
  .filter((l) => photos[l.photo])
  .map((l, i) => ({
    ...l,
    ...photos[l.photo],
    no: String(i + 1).padStart(2, '0'),
    alt: l.alt || `Dheeraj wearing ${l.pieces.charAt(0).toLowerCase()}${l.pieces.slice(1)}`,
  }));

function picture(e, eager = false, alt = e.alt) {
  return `<picture><img src="${base}looks/${e.id}.jpg" width="${e.w}" height="${e.h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

const list = $('#looks');
list.innerHTML = entries
  .map(
    // --card: portrait photos fill their card, square and landscape ones sit on a mount so nothing is cropped
    (e, i) => `<li class="look" style="--card:${Math.min(e.w / e.h, 0.8).toFixed(4)};--placeholder:${e.color}">
  <div class="look-flip">
    <span class="look-hanger" aria-hidden="true"></span>
    <button class="look-btn" type="button" aria-expanded="false" aria-controls="tag-${i}" aria-describedby="look-hint" aria-label="${esc(`Look ${e.no}, ${e.name}. ${e.alt}`)}">
      ${picture(e)}
    </button>
    <div class="tag" id="tag-${i}" role="group" aria-labelledby="tag-name-${i}" tabindex="-1" inert>
      <span class="tag-eyelet" aria-hidden="true"></span>
      <p class="tag-no">Look ${e.no}</p>
      <h3 class="tag-name" id="tag-name-${i}">${esc(e.name)}</h3>
      <dl class="tag-notes"><dt>Key pieces</dt><dd>${esc(e.pieces)}</dd><dt>Colour and fabric</dt><dd>${esc(e.colour)}</dd></dl>
      <p class="tag-why"><span>Why it works</span>${esc(e.why)}</p>
      <button class="tag-close" type="button">Turn back</button>
    </div>
  </div>
  <p class="look-caption" aria-hidden="true"><span>No. ${e.no}</span> ${esc(e.name)}</p>
</li>`,
  )
  .join('');
const items = [...list.children];
$('#rail').style.setProperty('--n', entries.length);

let atelier = null;
let lenis = null;
let openIndex = -1;
let m = {};

function measure() {
  const rail = $('#rail');
  m = { heroH: $('.hero').offsetHeight, railTop: rail.offsetTop, railH: rail.offsetHeight };
  m.run = Math.max(1, m.railH - innerHeight);
}

const goTo = (i) => lenis?.scrollTo(m.railTop + (m.run * i) / Math.max(1, items.length - 1), { duration: 1.2 });

function setOpen(i, open, moveFocus = false) {
  const li = items[i];
  const btn = li.querySelector('.look-btn');
  const tag = li.querySelector('.tag');
  if (open && openIndex > -1 && openIndex !== i) setOpen(openIndex, false);
  if (!open && (moveFocus || tag.contains(document.activeElement))) btn.focus({ preventScroll: true });
  li.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', open);
  tag.inert = !open;
  atelier?.turn(i, open);
  if (open) {
    openIndex = i;
    root.classList.add('has-opened');
    if (moveFocus) tag.focus({ preventScroll: true });
  } else if (openIndex === i) openIndex = -1;
}

items.forEach((li, i) => {
  const btn = li.querySelector('.look-btn');
  btn.addEventListener('click', () => {
    const open = !li.classList.contains('is-open');
    if (open) goTo(i);
    setOpen(i, open, true);
  });
  li.querySelector('.tag').addEventListener('click', () => setOpen(i, false, true));
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openIndex > -1) setOpen(openIndex, false, true);
});
list.addEventListener('keydown', (e) => {
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  const i = items.findIndex((li) => li.contains(document.activeElement));
  if (!d || i < 0) return;
  e.preventDefault();
  items[Math.max(0, Math.min(items.length - 1, i + d))].querySelector('.look-btn').focus();
});
$('.skip').addEventListener('click', (e) => {
  e.preventDefault();
  if (lenis) lenis.scrollTo(m.railTop, { duration: 1.2 });
  else $('#rail').scrollIntoView();
  items[0].querySelector('.look-btn').focus({ preventScroll: true });
});

// The stitching loader: a needle runs along the initials while the first textures arrive.
function stitchLoader() {
  const el = $('#loader');
  const needle = el.querySelector('.needle');
  const reveals = [...el.querySelectorAll('.reveal')].map((p) => ({ p, len: p.getTotalLength() }));
  const total = reveals.reduce((s, r) => s + r.len, 0);
  for (const r of reveals) r.p.style.strokeDasharray = r.p.style.strokeDashoffset = r.len;
  return {
    el,
    draw(progress) {
      let d = progress * total;
      for (const r of reveals) {
        const shown = Math.min(r.len, Math.max(0, d));
        r.p.style.strokeDashoffset = r.len - shown;
        if (d > 0 && d <= r.len) {
          const a = r.p.getPointAtLength(shown);
          const b = r.p.getPointAtLength(Math.max(0, shown - 3));
          needle.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${(Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI})`);
        }
        d -= r.len;
      }
    },
  };
}

function runFull() {
  lenis = new Lenis({ lerp: 0.085, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  items.forEach((li, i) => {
    const btn = li.querySelector('.look-btn');
    btn.addEventListener('pointerenter', () => atelier.hover(i, true));
    btn.addEventListener('pointerleave', () => atelier.hover(i, false));
    btn.addEventListener('pointermove', (e) => atelier.pointer(i, e.offsetX / btn.clientWidth, 1 - e.offsetY / btn.clientHeight));
    btn.addEventListener('focus', () => {
      atelier.hover(i, true);
      if (btn.matches(':focus-visible')) goTo(i);
    });
    btn.addEventListener('blur', () => atelier.hover(i, false));
  });

  const capNo = $('#cap-no');
  const capName = $('#cap-name');
  let current = -1;
  let wasActive = null;
  gsap.ticker.add((t, dms) => {
    const y = scrollY;
    const rail = clamp01((y - m.railTop) / m.run);
    // once "Why me" covers the screen there is nothing to draw
    if (y < m.railTop + m.railH) atelier.frame(clamp01(y / m.heroH), rail, Math.min(dms / 1000, 1 / 20));
    const active = y >= m.railTop - 1 && y <= m.railTop + m.run + 1;
    if (active) {
      for (let i = 0; i < items.length; i++) {
        const r = atelier.rect(i);
        items[i].classList.toggle('is-off', !r.on);
        if (r.on) Object.assign(items[i].style, { transform: `translate3d(${r.x}px,${r.y}px,0)`, width: `${r.w}px`, height: `${r.h}px` });
      }
      const now = Math.round(rail * (items.length - 1));
      if (now !== current) {
        current = now;
        capNo.textContent = `No. ${entries[now].no} of ${entries.length}`;
        capName.textContent = entries[now].name;
        if (openIndex > -1 && openIndex !== now) setOpen(openIndex, false);
      }
    } else if (wasActive !== false) items.forEach((li) => li.classList.add('is-off'));
    if (active !== wasActive) root.classList.toggle('in-rail', (wasActive = active));
  });
}

function runLookbook() {
  $('#hero-cover').innerHTML = picture(entries[0], true, '');
  $('#rail-hint').textContent = matchMedia('(pointer: coarse)').matches ? 'Tap a garment to turn it round' : 'Select a garment to turn it round';
  if (mode === 'calm') return;
  const io = new IntersectionObserver((seen) => seen.forEach((s) => s.isIntersecting && s.target.classList.add('is-in')), { threshold: 0.3 });
  items.forEach((li) => io.observe(li));
}

// Magazine page turns: the cover folds away, later pages swing in from the spine.
function pageTurns() {
  gsap.to('.hero-inner', {
    rotateY: -28,
    x: -60,
    autoAlpha: 0,
    transformOrigin: '0% 50%',
    transformPerspective: 1200,
    ease: 'power1.in',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true },
  });
  for (const page of gsap.utils.toArray('.page')) {
    gsap.fromTo(
      page,
      { rotateY: 18, '--sheen': 1 },
      { rotateY: 0, '--sheen': 0, transformOrigin: '0% 50%', transformPerspective: 2000, ease: 'none', scrollTrigger: { trigger: page, start: 'top bottom', end: 'top 20%', scrub: true } },
    );
  }
}

const tape = $('.tape');
function tapeMarks() {
  $('#tape-strip').innerHTML = Array.from({ length: Math.ceil(innerWidth / 50) }, (_, k) => `<span style="left:${(k + 1) * 50}px">${(k + 1) * 5}</span>`).join('');
}
function tapeProgress() {
  tape.style.setProperty('--p', clamp01(scrollY / Math.max(1, root.scrollHeight - innerHeight)).toFixed(4));
}
tapeMarks();
addEventListener('scroll', tapeProgress, { passive: true });

// A needle for a cursor that leaves a faint running stitch behind it.
function needleCursor() {
  const el = $('#cursor');
  const cv = $('#trail');
  const g = cv.getContext('2d');
  let x = -99;
  let y = -99;
  let pts = [];
  let pulled = 0;
  let drawn = false;
  const size = () => {
    const r = Math.min(devicePixelRatio, 2);
    cv.width = innerWidth * r;
    cv.height = innerHeight * r;
    g.setTransform(r, 0, 0, r, 0, 0);
  };
  size();
  addEventListener('resize', size);
  root.classList.add('has-cursor');
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    pts.push({ x, y, t: performance.now() });
    el.classList.add('is-on');
  });
  root.addEventListener('mouseleave', () => el.classList.remove('is-on'));
  addEventListener('pointerover', (e) => el.classList.toggle('is-hover', !!e.target.closest?.('a, button')));
  gsap.ticker.add(() => {
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    const now = performance.now();
    while (pts.length > 1 && now - pts[0].t > 450) {
      pulled = (pulled + Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)) % 11; // keeps stitches still as the thread pulls through
      pts.shift();
    }
    if (pts.length < 2 && !drawn) return;
    g.clearRect(0, 0, innerWidth, innerHeight);
    drawn = pts.length > 1;
    if (!drawn) return;
    g.setLineDash([5, 6]);
    g.lineDashOffset = pulled;
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(201,163,95,.75)';
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) g.lineTo(p.x, p.y);
    g.stroke();
  });
}

async function boot() {
  const loader = stitchLoader();
  let target = 0;
  let shown = 0;
  const add = (w) => (target = Math.min(1, target + w));
  const t0 = performance.now();
  const minMs = mode === 'calm' ? 0 : 1700;
  let finish;
  const stitched = new Promise((r) => (finish = r));
  const tick = (now) => {
    const cap = minMs ? Math.min(1, (now - t0) / minMs) : 1;
    shown += (Math.min(target, cap) - shown) * (minMs ? 0.12 : 1);
    loader.draw(shown);
    if (target < 1 || shown < 0.996) return requestAnimationFrame(tick);
    loader.draw(1);
    finish();
  };
  requestAnimationFrame(tick);

  const fonts = document.fonts.ready.then(() => add(0.2));
  if (mode === 'full') {
    try {
      const { createAtelier } = await import('./atelier.js');
      await fonts; // the woven labels use the serif
      atelier = createAtelier($('#stage'), entries, base);
      await atelier.load(() => add(0.7 / atelier.eager));
      if ((await atelier.benchmark()) < 28) throw new Error('too slow for the 3D rail');
    } catch {
      atelier?.dispose();
      atelier = null;
      root.dataset.mode = mode = 'lite';
    }
  }
  if (mode !== 'full') {
    runLookbook();
    await Promise.all([fonts, $('#hero-cover img').decode().catch(() => {})]);
  }
  target = 1;
  await stitched;

  root.classList.remove('is-loading');
  measure();
  if (mode === 'full') {
    runFull();
    atelier.loadRest();
  }
  if (mode !== 'calm') {
    pageTurns();
    if (matchMedia('(pointer: fine)').matches) needleCursor();
    gsap.from('.hero-inner > *', { y: 30, autoAlpha: 0, duration: 1.2, stagger: 0.12, ease: 'power3.out', delay: 0.2 });
  }
  addEventListener('resize', () => {
    measure();
    atelier?.resize();
    tapeMarks();
  });
  ScrollTrigger.refresh();
  tapeProgress();
  gsap.to(loader.el, { autoAlpha: 0, duration: mode === 'calm' ? 0 : 0.9, onComplete: () => loader.el.remove() });
}

boot();

// Dev only: lets a headless check step frames and open tags.
if (import.meta.env.DEV) window.__dev = { gsap, ScrollTrigger, setOpen, get lenis() { return lenis; } };
