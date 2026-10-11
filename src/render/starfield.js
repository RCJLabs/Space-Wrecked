// Seeded, code-drawn starfield. Generation is pure (seed in, plain data out);
// drawing only reads that data.
import { next } from '../core/rng.js';
import { palette, rgba } from './palette.js';

// Stars sit on a square tile of this many CSS px, repeated across the screen,
// so the same seed gives the same sky on both Fold screens.
const TILE = 1024;
const TINT_ORDER = ['star', 'starCool', 'starWarm'];

export function makeStarfield(seed, count = 360) {
  let state = seed;
  const roll = () => {
    const r = next(state);
    state = r.state;
    return r.value;
  };

  const stars = [];
  for (let i = 0; i < count; i++) {
    const depth = roll(); // 0 is far, 1 is near
    const tint = roll();
    const twinkles = roll() < 0.25;
    const twinkleSpeed = 0.6 + roll() * 1.4;
    stars.push({
      x: roll() * TILE,
      y: roll() * TILE,
      depth,
      size: 0.7 + depth * depth * 1.8,
      alpha: 0.3 + roll() * 0.7,
      twinkle: twinkles ? twinkleSpeed : 0,
      phase: roll() * Math.PI * 2,
      tint: tint < 0.7 ? 'star' : tint < 0.88 ? 'starCool' : 'starWarm',
    });
  }
  // Grouped by tint so drawing changes fillStyle only twice.
  stars.sort((a, b) => TINT_ORDER.indexOf(a.tint) - TINT_ORDER.indexOf(b.tint));

  const nebulae = [];
  for (let i = 0; i < 3; i++) {
    nebulae.push({
      x: roll(),
      y: roll(),
      radius: 0.35 + roll() * 0.35,
      alpha: 0.22 + roll() * 0.18,
      color: i % 2 ? 'nebulaB' : 'nebulaA',
    });
  }
  return { stars, nebulae };
}

// The static layer (background and nebulae), painted once per resize.
export function paintBackdrop(field, view) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(view.width * view.dpr));
  canvas.height = Math.max(1, Math.round(view.height * view.dpr));
  const g = canvas.getContext('2d', { alpha: false });
  g.scale(view.dpr, view.dpr);
  const { width: w, height: h } = view;
  g.fillStyle = palette.space;
  g.fillRect(0, 0, w, h);
  const span = Math.max(w, h);
  for (const n of field.nebulae) {
    const cx = n.x * w;
    const cy = n.y * h;
    const r = n.radius * span;
    const gradient = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, rgba(palette[n.color], n.alpha));
    gradient.addColorStop(1, rgba(palette[n.color], 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, h);
  }
  return canvas;
}

// Stars drift left with parallax: near stars move faster than far ones.
export function drawStars(ctx, field, view, timeMs) {
  const { width: w, height: h } = view;
  const t = timeMs / 1000;
  let tint = '';
  for (const s of field.stars) {
    if (s.tint !== tint) {
      tint = s.tint;
      ctx.fillStyle = palette[tint];
    }
    let x = (s.x - t * (3 + s.depth * 9)) % TILE;
    if (x < 0) x += TILE;
    ctx.globalAlpha = s.twinkle ? s.alpha * (0.7 + 0.3 * Math.sin(t * s.twinkle + s.phase)) : s.alpha;
    const half = s.size / 2;
    for (let ty = s.y; ty < h + half; ty += TILE) {
      for (let tx = x; tx < w + half; tx += TILE) ctx.fillRect(tx - half, ty - half, s.size, s.size);
    }
  }
  ctx.globalAlpha = 1;
}
