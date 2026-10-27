// What a fight shows over the 3D board, drawn flat on top of it: each
// unit's hit points as pips (and overwatch, or how long until it bleeds
// out), the hit chance over each enemy the selected unit can shoot, a job's
// crates and terminal tagged (since M38 its way out, targets, charges and
// the way in held too), shots in flight, a charge's blast, words rising
// over the units hit, and the banner for whose turn it is. Draws in CSS
// pixels through the orbit camera; never changes anything.
import { project } from './orbit.js';
import { palette, rgba } from './palette.js';
import { FLIGHT, FLOAT_MS } from './playback.js';
import { textScale } from './textScale.js';
import { LYING_TOP, UNIT_TOP } from './units.js';

// The labels' fonts at Settings' Text size (M42), 10 px at the least.
const mono = (weight, px) => `${weight} ${px * textScale()}px ui-monospace, 'Roboto Mono', Menlo, Consolas, monospace`;
const sans = (px) => `800 ${px * textScale()}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const SMALL = () => mono(600, 10);
const BADGE = () => mono(700, 11);
const FLOAT = () => sans(15);
const BANNER = () => sans(26);
const BAR_W = 34; // a unit's hit point bar, in px, however many it has
// Read as drawn: Settings' Colors can swap them (M42).
const toneColor = (name) => ({ hit: palette.bpGlow, hurt: palette.bad, miss: palette.inkDim, good: palette.good, info: palette.visor })[name];

// input: {
//   units    [{ at: [x, y], status, hp, maxHp, color, initial, overwatch,
//            bleed, selected, carrying }]: at is the point it stands on,
//            color its pips'; initial a crew member's, by them (M42); the
//            selected unit has a marker over it
//   badges   [{ at: [x, y], text, strong }]: over tiles
//   marks    [{ at: [x, y], text, done, tone }]: a job's objective, on its
//            tiles; tone 'charge' for a charge set (M38)
//   floats   playback.js frame floats
//   shot     playback.js frame shot, or null
//   blast    playback.js frame blast, or null
//   banner   { text, progress } or null
// }
export function paintFightLabels(ctx, cam, rect, { units = [], badges = [], marks = [], welds = [], floats = [], shot = null, blast = null, banner = null }) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const mark of marks) tag(ctx, cam, mark);
  for (const weld of welds) seam(ctx, cam, weld);
  if (shot) tracer(ctx, cam, shot);
  if (blast) burst(ctx, cam, blast);
  // A unit's word (PINNED, MARKED…) is never under its tile's hit chance
  // (M57): the badge rises clear of the word.
  const tops = new Map();
  for (const unit of units) if (unit.status !== 'dead') tops.set(tileKey(unit.at), bar(ctx, cam, unit));
  for (const badge of badges) pill(ctx, cam, badge, tops.get(tileKey(badge.at)));
  for (const float of floats) rising(ctx, cam, float);
  if (banner) sign(ctx, rect, banner);
  ctx.restore();
}

const tileKey = ([x, y]) => `${Math.floor(x)},${Math.floor(y)}`;

// Hit points over a standing unit, or over one lying on the deck, and a
// word for its state. A captive held (M38) stands. Returns the top of its
// word on the screen, or undefined with none.
function bar(ctx, cam, { at: [x, y], status, hp, maxHp, color, initial, overwatch, bleed, selected, marked, suppressed, asleep, carrying }) {
  const standing = status === 'active' || status === 'held';
  const [sx, sy] = project(cam, x, y, standing ? UNIT_TOP + 0.16 : LYING_TOP + 0.14);
  const seg = (BAR_W - (maxHp - 1)) / maxHp;
  const [x0, y0] = [Math.round(sx - BAR_W / 2), Math.round(sy)];
  ctx.fillStyle = rgba(palette.space, 0.78);
  ctx.fillRect(x0 - 2, y0 - 2, BAR_W + 4, 9);
  for (let i = 0; i < maxHp; i++) {
    ctx.fillStyle = i < hp ? color : rgba(palette.ink, 0.16);
    ctx.fillRect(x0 + i * (seg + 1), y0, seg, 5);
  }
  // One of the crew: their initial by the bar in their trim, so whose it is
  // needs no color (M42).
  if (initial) {
    ctx.font = SMALL();
    const w = ctx.measureText(initial).width + 6;
    ctx.fillStyle = rgba(palette.space, 0.78);
    ctx.fillRect(x0 - 3 - w, y0 - 4, w, 13);
    ctx.fillStyle = color;
    ctx.fillText(initial, x0 - 3 - w / 2, y0 + 2.5);
  }
  const word = status === 'down' ? [`DOWN · ${bleed}${carrying ? ' · CRATE' : ''}`, palette.bad] : status === 'stable' ? ['STABLE', palette.good] : status === 'out' ? ['OUT', palette.inkDim] : status === 'held' ? ['HELD', palette.accent] : standing ? orderWord({ overwatch, marked, suppressed, asleep, carrying }) : null;
  let top = y0 - 2;
  if (word) {
    ctx.font = SMALL();
    const w = ctx.measureText(word[0]).width + 8;
    ctx.fillStyle = rgba(palette.space, 0.78);
    ctx.fillRect(Math.round(sx - w / 2), y0 - 15, w, 12);
    ctx.fillStyle = word[1];
    ctx.fillText(word[0], sx, y0 - 8.5);
    top = y0 - 15;
  }
  if (selected) {
    // A marker pointing down at the unit giving orders.
    ctx.beginPath();
    ctx.moveTo(sx - 7, top - 11);
    ctx.lineTo(sx + 7, top - 11);
    ctx.lineTo(sx, top - 3);
    ctx.closePath();
    ctx.fillStyle = palette.accent;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(palette.space, 0.9);
    ctx.stroke();
  }
  return word ? top : undefined;
}

// What a standing unit's word says, the first that holds: asleep,
// suppressed or marked (M32: what orders left on it), a crate in hand (an
// extract, M38), or on overwatch.
function orderWord({ overwatch, marked, suppressed, asleep, carrying }) {
  if (asleep) return ['ASLEEP', palette.inkDim];
  if (suppressed) return ['PINNED', palette.good];
  if (marked) return [overwatch ? 'MARKED · WATCHING' : 'MARKED', palette.target];
  if (carrying) return ['CARRYING', palette.good];
  return overwatch ? ['OVERWATCH', palette.accent] : null;
}

// A hit chance over an enemy the selected unit can shoot, or (tone
// 'order', M32) what a job's order shown reaches; below: the top of the
// unit's word on that tile, which the badge sits clear above (M57).
function pill(ctx, cam, { at: [x, y], text, strong, tone }, below = Infinity) {
  const [sx, at] = project(cam, x + 0.5, y + 0.5, UNIT_TOP + 0.62);
  const sy = Math.min(at, below - 11);
  const color = tone === 'order' ? palette.good : palette.target;
  ctx.font = BADGE();
  const w = ctx.measureText(text).width + 12;
  ctx.beginPath();
  ctx.roundRect(sx - w / 2, sy - 9, w, 18, 9);
  ctx.fillStyle = strong ? color : rgba(palette.space, 0.85);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = strong ? palette.space : color;
  ctx.fillText(text, sx, sy + 0.5);
}

// A welded door (M32): a plate low on its edge, under the units' bars,
// with the rounds it still holds.
function seam(ctx, cam, { at: [x, y], text }) {
  const [sx, sy] = project(cam, x, y, 0.18);
  ctx.font = SMALL();
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = rgba(palette.space, 0.85);
  ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - 6), w, 12);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(sx - w / 2) + 0.5, Math.round(sy - 6) + 0.5, w - 1, 11);
  ctx.fillStyle = palette.accent;
  ctx.fillText(text, sx, sy + 0.5);
}

// A tag on a pole over a tile of the objective's: a crate to grab, or the
// terminal; since M38 a crate to carry out, the way out, a target and the
// charge by it, the way in held. Done, it goes quiet.
function tag(ctx, cam, { at: [x, y], text, done, tone }) {
  const [bx, by] = project(cam, x + 0.5, y + 0.5, 0.36);
  const [sx, sy] = project(cam, x + 0.5, y + 0.5, 0.95);
  const color = done ? palette.good : tone === 'charge' ? palette.fire : palette.accent;
  ctx.strokeStyle = rgba(color, done ? 0.5 : 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(sx, sy + 8);
  ctx.stroke();
  ctx.font = SMALL();
  const w = ctx.measureText(text).width + 10;
  ctx.beginPath();
  ctx.roundRect(sx - w / 2, sy - 8, w, 16, 4);
  ctx.fillStyle = done ? rgba(palette.space, 0.8) : color;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = done ? color : palette.space;
  ctx.fillText(text, sx, sy + 0.5);
}

// Words over a tile, rising and fading.
function rising(ctx, cam, { at: [x, y], text, tone, age, stack = 0 }) {
  const t = age / FLOAT_MS;
  const [sx, sy0] = project(cam, x + 0.5, y + 0.5, UNIT_TOP + 0.3);
  const sy = sy0 - stack * 17 * textScale();
  ctx.globalAlpha = t < 0.6 ? 1 : Math.max(0, (1 - t) / 0.4);
  ctx.font = FLOAT();
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(palette.space, 0.9);
  ctx.strokeText(text, sx, sy - 6 - t * 26);
  ctx.fillStyle = toneColor(tone) ?? palette.ink;
  ctx.fillText(text, sx, sy - 6 - t * 26);
  ctx.globalAlpha = 1;
}

// A shot: it flies from the shooter's gun to the target, or past it on a
// miss, then fades.
function tracer(ctx, cam, { from, to, hit, progress }) {
  const [ax, ay] = [from[0] + 0.5, from[1] + 0.5];
  let [bx, by] = [to[0] + 0.5, to[1] + 0.5];
  if (!hit) {
    // Wide of the target, and on past it.
    const [dx, dy] = [bx - ax, by - ay];
    const len = Math.hypot(dx, dy) || 1;
    [bx, by] = [bx + (dx / len) * 0.7 - (dy / len) * 0.35, by + (dy / len) * 0.7 + (dx / len) * 0.35];
  }
  const flying = Math.min(1, progress / FLIGHT);
  const fade = progress <= FLIGHT ? 1 : Math.max(0, 1 - (progress - FLIGHT) / 0.4);
  if (fade <= 0) return;
  const [tx, ty] = [ax + (bx - ax) * flying, ay + (by - ay) * flying];
  const [p, q] = [project(cam, ax, ay, 0.33), project(cam, tx, ty, 0.38)];
  ctx.lineCap = 'round';
  ctx.globalAlpha = fade;
  ctx.strokeStyle = rgba(palette.tracer, 0.35);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(q[0], q[1]);
  ctx.stroke();
  ctx.strokeStyle = palette.tracer;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (hit && progress >= FLIGHT) {
    // Where it lands, a flash.
    const r = 18 * (1 - fade * 0.4);
    const glow = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
    glow.addColorStop(0, rgba(palette.tracer, 0.9));
    glow.addColorStop(1, rgba(palette.fire, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// A charge blowing (M38): a flash over its tile and the tiles beside it,
// swelling, then fading.
function burst(ctx, cam, { at: [x, y], progress }) {
  const [cx, cy] = project(cam, x + 0.5, y + 0.5, 0.3);
  // A tile's width on screen, near enough, for the blast's reach.
  const [ex] = project(cam, x + 1.5, y + 0.5, 0.3);
  const tile = Math.max(12, Math.hypot(ex - cx, project(cam, x + 1.5, y + 0.5, 0.3)[1] - cy));
  const r = tile * (0.6 + 1.1 * Math.min(1, progress / 0.35));
  const fade = progress < 0.35 ? 1 : Math.max(0, 1 - (progress - 0.35) / 0.65);
  if (fade <= 0) return;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0, rgba(palette.fireCore, 0.95 * fade));
  glow.addColorStop(0.45, rgba(palette.fire, 0.7 * fade));
  glow.addColorStop(1, rgba(palette.fire, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// Whose turn it is, across the middle of the board: in, held, out.
function sign(ctx, rect, { text, progress }) {
  const alpha = Math.min(1, progress / 0.15, (1 - progress) / 0.25);
  if (alpha <= 0) return;
  const [cx, cy] = [rect.x + rect.w / 2, rect.y + rect.h * 0.42];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgba(palette.space, 0.7);
  ctx.fillRect(rect.x, cy - 24, rect.w, 48);
  ctx.font = BANNER();
  ctx.letterSpacing = '6px';
  ctx.fillStyle = palette.ink;
  ctx.fillText(text, cx, cy + 1);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
}
