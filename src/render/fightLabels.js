// What a fight shows over the 3D board, drawn flat on top of it: each
// unit's hit points as pips (and overwatch, or how long until it bleeds
// out), the hit chance over each enemy the selected unit can shoot, shots in
// flight, words rising over the units hit, and the banner for whose turn it
// is. Draws in CSS pixels through the orbit camera; never changes anything.
import { project } from './orbit.js';
import { palette, rgba } from './palette.js';
import { FLIGHT, FLOAT_MS } from './playback.js';
import { UNIT_TOP } from './units.js';

const SMALL = "600 9.5px ui-monospace, 'Roboto Mono', Menlo, Consolas, monospace";
const BADGE = "700 11px ui-monospace, 'Roboto Mono', Menlo, Consolas, monospace";
const FLOAT = "800 15px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const BANNER = "800 26px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const BAR_W = 34; // a unit's hit point bar, in px, however many it has
const TONES = { hit: palette.bpGlow, hurt: palette.bad, miss: palette.inkDim, good: palette.good, info: palette.visor };

// input: {
//   units    [{ at: [x, y], status, hp, maxHp, color, overwatch, bleed, selected }]:
//            at is the point it stands on, color its pips'; the selected
//            unit has a marker over it
//   badges   [{ at: [x, y], text, strong }]: over tiles
//   floats   playback.js frame floats
//   shot     playback.js frame shot, or null
//   banner   { text, progress } or null
// }
export function paintFightLabels(ctx, cam, rect, { units = [], badges = [], floats = [], shot = null, banner = null }) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (shot) tracer(ctx, cam, shot);
  for (const unit of units) if (unit.status !== 'dead') bar(ctx, cam, unit);
  for (const badge of badges) pill(ctx, cam, badge);
  for (const float of floats) rising(ctx, cam, float);
  if (banner) sign(ctx, rect, banner);
  ctx.restore();
}

// Hit points over a standing unit, or over one lying on the deck, and a
// word for its state.
function bar(ctx, cam, { at: [x, y], status, hp, maxHp, color, overwatch, bleed, selected }) {
  const standing = status === 'active';
  const [sx, sy] = project(cam, x, y, standing ? UNIT_TOP + 0.16 : 0.3);
  const seg = (BAR_W - (maxHp - 1)) / maxHp;
  const [x0, y0] = [Math.round(sx - BAR_W / 2), Math.round(sy)];
  ctx.fillStyle = rgba(palette.space, 0.78);
  ctx.fillRect(x0 - 2, y0 - 2, BAR_W + 4, 9);
  for (let i = 0; i < maxHp; i++) {
    ctx.fillStyle = i < hp ? color : rgba(palette.ink, 0.16);
    ctx.fillRect(x0 + i * (seg + 1), y0, seg, 5);
  }
  const word = status === 'down' ? [`DOWN · ${bleed}`, palette.bad] : status === 'stable' ? ['STABLE', palette.good] : status === 'out' ? ['OUT', palette.inkDim] : overwatch ? ['OVERWATCH', palette.accent] : null;
  let top = y0 - 2;
  if (word) {
    ctx.font = SMALL;
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
}

// A hit chance over an enemy the selected unit can shoot.
function pill(ctx, cam, { at: [x, y], text, strong }) {
  const [sx, sy] = project(cam, x + 0.5, y + 0.5, UNIT_TOP + 0.62);
  ctx.font = BADGE;
  const w = ctx.measureText(text).width + 12;
  ctx.beginPath();
  ctx.roundRect(sx - w / 2, sy - 9, w, 18, 9);
  ctx.fillStyle = strong ? palette.target : rgba(palette.space, 0.85);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = palette.target;
  ctx.stroke();
  ctx.fillStyle = strong ? palette.space : palette.target;
  ctx.fillText(text, sx, sy + 0.5);
}

// Words over a tile, rising and fading.
function rising(ctx, cam, { at: [x, y], text, tone, age }) {
  const t = age / FLOAT_MS;
  const [sx, sy] = project(cam, x + 0.5, y + 0.5, UNIT_TOP + 0.3);
  ctx.globalAlpha = t < 0.6 ? 1 : Math.max(0, (1 - t) / 0.4);
  ctx.font = FLOAT;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(palette.space, 0.9);
  ctx.strokeText(text, sx, sy - 6 - t * 26);
  ctx.fillStyle = TONES[tone] ?? palette.ink;
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

// Whose turn it is, across the middle of the board: in, held, out.
function sign(ctx, rect, { text, progress }) {
  const alpha = Math.min(1, progress / 0.15, (1 - progress) / 0.25);
  if (alpha <= 0) return;
  const [cx, cy] = [rect.x + rect.w / 2, rect.y + rect.h * 0.42];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgba(palette.space, 0.7);
  ctx.fillRect(rect.x, cy - 24, rect.w, 48);
  ctx.font = BANNER;
  ctx.letterSpacing = '6px';
  ctx.fillStyle = palette.ink;
  ctx.fillText(text, cx, cy + 1);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
}
