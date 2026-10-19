// The approach screen's picture (M38b): deep space, and the two ships seen
// from outside side by side (exterior.js), the player's on the left nose
// right and the other turned to face it, each with what the approach has
// done to her and, on hers, the parts a Fire order aims at (hullMarks.js).
// While a round plays (approachPlayback.js), its shots fly between them,
// hits flash, shields shimmer and the ships move as they flee or close.
// Each ship is painted once into a layer of her own, as big as she is, and
// her marks drawn over a copy of it when they change; deep space is
// painted once a size. So a round's frames copy three pictures and draw the
// shots over them. Never changes what it is given.
//   view = createApproachView()
//   view.setShip(side, { ship, defs, hull, skin })   when a ship changes
//   view.setMarks(side, { damage, wrecked, target })  target: the uids a
//                               Fire order aims at, first first, or null
//   view.place(side, cam, rect, box)   her camera, her part of the screen
//                               and the box the camera was fitted to
//   view.draw(ctx, size, frame)  size: { width, height } in CSS pixels;
//                               frame: approachPlayback.js frameAt's, or
//                               restingPose's ({ moves, gone, grapple,
//                               close })
import { exteriorScene } from './exterior.js';
import { damageMarks, targetMarks } from './hullMarks.js';
import { project, screenBounds } from './orbit.js';
import { paintOver, paintSolid, prepareSolid } from './painter.js';
import { palette, rgba } from './palette.js';
import { drawSpace } from './shipView.js';
import { shade } from './solid.js';

const SIDES = ['you', 'them'];
const TAIL = 0.2; // a shot's streak, as a share of its flight
// A gun's shot, and a torpedo's (M39): heavier, its trail longer.
const SHELL = { tail: TAIL, width: 2.5, head: 7 };
const TORPEDO = { tail: 0.4, width: 4.5, head: 12 };
const FLASH = { hit: 14, burst: 26 }; // a flash's size in CSS pixels
const ARM = 0.3; // a target's bracket, as a share of each side
const ROOM = 26; // CSS px left between the noses of two ships come together

export function createApproachView() {
  const sides = Object.fromEntries(SIDES.map((side) => [side, { hull: null, marks: null, cam: null, rect: null, box: null, painted: { canvas: null, key: null, crop: null }, layer: { canvas: null, key: null, crop: null }, shipVersion: 0, version: 0 }]));
  const space = { canvas: null, key: null };
  return {
    setShip(side, input) {
      const { faces, glows } = exteriorScene(input);
      const s = sides[side];
      s.hull = { faces: prepareSolid(faces, shade), glows, ship: input.ship, defs: input.defs };
      s.marks = null;
      s.shipVersion++;
      s.version++;
    },
    setMarks(side, { damage = {}, wrecked = {}, target = null }) {
      const s = sides[side];
      if (!s.hull) return;
      const key = JSON.stringify([damage, wrecked, target]);
      if (s.marks?.key === key) return;
      const { ship, defs } = s.hull;
      const scars = damageMarks({ ship, defs, damage, wrecked });
      const aimed = targetMarks({ ship, defs, uids: target ?? [] });
      s.marks = { key, faces: prepareSolid([...scars.faces, ...aimed.faces], shade), glows: scars.glows, frames: aimed.frames };
      s.version++;
    },
    place(side, cam, rect, box) {
      Object.assign(sides[side], { cam, rect, box });
    },
    draw(ctx, size, frame) {
      const ratio = ctx.getTransform().a;
      ctx.drawImage(spaceOf(space, size, ratio), 0, 0, size.width, size.height);
      const placed = (side) => sides[side].cam && sides[side].hull && !frame.gone?.[side];
      // Coming together to board, each closes half the gap between their
      // noses but for ROOM.
      const noses = placed('you') && placed('them') ? { you: noseOf(sides.you, 1), them: noseOf(sides.them, -1) } : null;
      const step = noses && frame.close ? (frame.close * Math.max(0, noses.them[0] - noses.you[0] - ROOM)) / 2 : 0;
      const offset = (side) => (frame.moves?.[side] ?? 0) * (sides[side].rect?.w ?? 0) + (side === 'you' ? step : -step);
      for (const side of SIDES) {
        if (!placed(side)) continue;
        const { canvas, crop } = layerOf(sides[side], ratio);
        ctx.drawImage(canvas, crop.x + offset(side), crop.y, crop.w, crop.h);
      }
      // Where a point on a ship is on the screen, as she stands now.
      const at = (side, p) => {
        const s = sides[side];
        const [x, y] = project(s.cam, p[0], p[1], p[2]);
        return [x + offset(side), y];
      };
      if (frame.grapple && noses) grapple(ctx, [noses.you[0] + offset('you'), noses.you[1]], [noses.them[0] + offset('them'), noses.them[1]]);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const shimmer of frame.shimmers ?? []) {
        if (placed(shimmer.side)) shield(ctx, sides[shimmer.side], offset(shimmer.side), shimmer.progress);
      }
      for (const shot of frame.shots ?? []) {
        if (placed(shot.side) && sides[shot.target].cam) streak(ctx, at(shot.side, shot.from), at(shot.target, shot.to), shot.progress, shot.side === 'you' ? palette.tracer : palette.enemyTracer, shot.torpedo ? TORPEDO : SHELL, shot.side !== 'you');
      }
      for (const flash of frame.flashes ?? []) {
        if (sides[flash.side].cam) burst(ctx, at(flash.side, flash.at), flash, sides[flash.side].rect);
      }
      ctx.restore();
    },
  };
}

// Deep space behind the ships, painted once a size: its haze and stars
// cost more to draw than all the rest of a frame.
function spaceOf(space, size, ratio) {
  const key = `${size.width} ${size.height} ${ratio}`;
  if (space.key === key) return space.canvas;
  space.key = key;
  space.canvas ??= document.createElement('canvas');
  space.canvas.width = Math.max(1, Math.round(size.width * ratio));
  space.canvas.height = Math.max(1, Math.round(size.height * ratio));
  const g = space.canvas.getContext('2d');
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawSpace(g, { x: 0, y: 0, w: size.width, h: size.height }, palette.space);
  return space.canvas;
}

// A ship's picture: her hull, and over it her marks and her targets
// bracketed. The hull is painted once (hullOf) and copied in, so a hit
// makes again only her marks. { canvas, crop }, as hullOf's; made again
// only when she, her marks, her camera or the pixel ratio change.
function layerOf(s, ratio) {
  const painted = hullOf(s, ratio);
  const { layer } = s;
  const key = `${s.version} ${painted.key}`;
  if (layer.key === key) return layer;
  layer.key = key;
  layer.crop = painted.crop;
  const g = canvasFor(layer, painted.canvas.width, painted.canvas.height);
  g.drawImage(painted.canvas, 0, 0);
  if (s.marks) {
    g.setTransform(ratio, 0, 0, ratio, -layer.crop.x * ratio, -layer.crop.y * ratio);
    paintOver(g, s.marks.faces, s.marks.glows, s.cam);
    for (const frame of s.marks.frames) brackets(g, frame.corners.map((p) => project(s.cam, p[0], p[1], p[2])), frame.first);
  }
  return layer;
}

// Her hull drawn through her camera onto a clear canvas that covers only
// what of her part of the screen she does: her box, and a cell round it
// for her nozzles' glow and her smoke. { canvas, crop, key }, crop in CSS
// pixels; made again only when she, her camera or the pixel ratio change.
function hullOf(s, ratio) {
  const { painted, rect, cam, box } = s;
  const key = `${s.shipVersion} ${ratio} ${rect.x} ${rect.y} ${rect.w} ${rect.h} ${cam.scale} ${cam.x} ${cam.y} ${cam.yaw}`;
  if (painted.key === key) return painted;
  painted.key = key;
  const b = screenBounds(cam, box);
  const pad = cam.scale * 1.2;
  const [x0, y0] = [Math.max(rect.x, Math.floor(b.x0 - pad)), Math.max(rect.y, Math.floor(b.y0 - pad))];
  const [x1, y1] = [Math.min(rect.x + rect.w, Math.ceil(b.x1 + pad)), Math.min(rect.y + rect.h, Math.ceil(b.y1 + pad))];
  painted.crop = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  const g = canvasFor(painted, Math.max(1, Math.round(painted.crop.w * ratio)), Math.max(1, Math.round(painted.crop.h * ratio)));
  g.setTransform(ratio, 0, 0, ratio, -painted.crop.x * ratio, -painted.crop.y * ratio);
  paintSolid(g, s.hull.faces, s.hull.glows, cam);
  return painted;
}

// A layer's canvas at w × h pixels, cleared, ready to draw on.
function canvasFor(layer, w, h) {
  layer.canvas ??= document.createElement('canvas');
  if (layer.canvas.width !== w || layer.canvas.height !== h) {
    layer.canvas.width = w;
    layer.canvas.height = h;
  }
  const g = layer.canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}

// A target's corners picked out on the screen: an arm along each side from
// each corner, over a dark one so it shows on any paint, the first thicker.
function brackets(ctx, corners, first) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [[first ? 5 : 4, rgba(palette.space, 0.8)], [first ? 2.5 : 1.6, rgba(palette.target, first ? 1 : 0.85)]]) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    corners.forEach(([x, y], i) => {
      const [a, b] = [corners[(i + 3) % 4], corners[(i + 1) % 4]];
      ctx.moveTo(x + (a[0] - x) * ARM, y + (a[1] - y) * ARM);
      ctx.lineTo(x, y);
      ctx.lineTo(x + (b[0] - x) * ARM, y + (b[1] - y) * ARM);
    });
    ctx.stroke();
  }
  ctx.restore();
}

// A shot in flight: a bright head and a streak behind it, from where it
// was fired toward where it goes, as `look` has it (SHELL or TORPEDO).
// Theirs trail in dashes, ours whole (M42: told apart without color).
function streak(ctx, [ax, ay], [bx, by], progress, color, look = SHELL, dashed = false) {
  const lerp = (p) => [ax + (bx - ax) * p, ay + (by - ay) * p];
  const [hx, hy] = lerp(progress);
  const [tx, ty] = lerp(Math.max(0, progress - look.tail));
  const line = ctx.createLinearGradient(tx, ty, hx, hy);
  line.addColorStop(0, rgba(color, 0));
  line.addColorStop(1, rgba(color, 0.95));
  ctx.strokeStyle = line;
  ctx.lineWidth = look.width;
  ctx.lineCap = dashed ? 'butt' : 'round';
  ctx.setLineDash(dashed ? [look.width * 2.5, look.width * 1.5] : []);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.setLineDash([]);
  glowAt(ctx, hx, hy, look.head, color, 0.9);
}

// Where a shot struck: a flash, bigger for a part wrecked, and for a ship
// blowing apart one that fills her part of the screen with a ring going out.
function burst(ctx, [x, y], { kind, progress }, rect) {
  const fade = 1 - progress;
  if (kind === 'blowup') {
    const r = Math.max(rect.w, rect.h) * (0.15 + 0.35 * progress);
    glowAt(ctx, x, y, r, palette.fire, 0.9 * fade);
    glowAt(ctx, x, y, r * 0.5, palette.fireCore, fade);
    ctx.strokeStyle = rgba(palette.fireCore, 0.7 * fade);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const r = FLASH[kind] * (0.6 + 0.6 * progress);
  glowAt(ctx, x, y, r, palette.fire, 0.85 * fade);
  glowAt(ctx, x, y, r * 0.45, palette.fireCore, fade);
}

// A shield taking a shot: a ring round the ship, fading.
function shield(ctx, s, dx, progress) {
  const b = screenBounds(s.cam, s.box);
  const [cx, cy] = [(b.x0 + b.x1) / 2 + dx, (b.y0 + b.y1) / 2];
  const [rx, ry] = [(b.x1 - b.x0) / 2 + 6, (b.y1 - b.y0) / 2 + 6];
  const fade = 1 - progress;
  ctx.fillStyle = rgba(palette.shield, 0.1 * fade);
  ctx.strokeStyle = rgba(palette.shield, 0.75 * fade);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// Where a ship's nose is on the screen as she stands at rest: the point of
// her hull furthest toward the other ship (toward: 1 to the right, -1 to
// the left). Kept until her picture or her camera changes.
function noseOf(s, toward) {
  if (s.nose?.hull === s.hull && s.nose.cam === s.cam) return s.nose.at;
  let at = null;
  for (const face of s.hull.faces) {
    for (const p of face.pts) {
      const q = project(s.cam, p[0], p[1], p[2]);
      if (!at || q[0] * toward > at[0] * toward) at = [q[0], q[1]];
    }
  }
  s.nose = { hull: s.hull, cam: s.cam, at };
  return at;
}

// The boarded ship grappled: a line from one nose to the other.
function grapple(ctx, a, b) {
  ctx.save();
  ctx.strokeStyle = rgba(palette.dash, 0.9);
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.restore();
}

function glowAt(ctx, x, y, r, color, alpha) {
  if (r <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
