// The approach screen's picture (M38b): deep space, and the two ships seen
// from outside side by side (exterior.js), the player's on the left nose
// right and the other turned to face it, each with what the approach has
// done to her and, on hers, the parts a Fire order aims at (hullMarks.js).
// While a round plays (approachPlayback.js), its shots fly between them,
// hits flash, shields shimmer and the ships move as they flee or close.
// Each ship is drawn once into a layer of her own and kept until she, her
// marks or her place change, so a round's frames copy two pictures and draw
// the shots over them. Never changes what it is given.
//   view = createApproachView()
//   view.setShip(side, { ship, defs, hull, skin })   when a ship changes
//   view.setMarks(side, { damage, wrecked, target })  target: the uids a
//                               Fire order aims at, first first, or null
//   view.place(side, cam, rect, box)   her camera, her part of the screen
//                               and the box the camera was fitted to
//   view.draw(ctx, size, frame)  size: { width, height } in CSS pixels;
//                               frame: approachPlayback.js frameAt's, or
//                               restingPose's ({ moves, gone, grapple })
import { exteriorScene } from './exterior.js';
import { damageMarks, targetMarks } from './hullMarks.js';
import { project, screenBounds } from './orbit.js';
import { paintSolid, prepareSolid } from './painter.js';
import { palette, rgba } from './palette.js';
import { drawSpace } from './shipView.js';
import { shade } from './solid.js';

const SIDES = ['you', 'them'];
const TAIL = 0.2; // a shot's streak, as a share of its flight
const FLASH = { hit: 14, burst: 26 }; // a flash's size in CSS pixels

export function createApproachView() {
  const sides = Object.fromEntries(SIDES.map((side) => [side, { hull: null, marks: null, cam: null, rect: null, box: null, layer: { canvas: null, key: null }, version: 0 }]));
  return {
    setShip(side, input) {
      const { faces, glows } = exteriorScene(input);
      const s = sides[side];
      s.hull = { faces: prepareSolid(faces, shade), glows, ship: input.ship, defs: input.defs };
      s.marks = null;
      s.version++;
    },
    setMarks(side, { damage = {}, wrecked = {}, target = null }) {
      const s = sides[side];
      if (!s.hull) return;
      const key = JSON.stringify([damage, wrecked, target]);
      if (s.marks?.key === key) return;
      const { ship, defs } = s.hull;
      const scars = damageMarks({ ship, defs, damage, wrecked });
      const aimed = target ? targetMarks({ ship, defs, uids: target }) : [];
      s.marks = { key, faces: prepareSolid([...scars.faces, ...aimed], shade), glows: scars.glows };
      s.version++;
    },
    place(side, cam, rect, box) {
      Object.assign(sides[side], { cam, rect, box });
    },
    draw(ctx, size, frame) {
      drawSpace(ctx, { x: 0, y: 0, w: size.width, h: size.height }, palette.space);
      const ratio = ctx.getTransform().a;
      const offset = (side) => (frame.moves?.[side] ?? 0) * (sides[side].rect?.w ?? 0);
      for (const side of SIDES) {
        const s = sides[side];
        if (!s.hull || !s.cam || frame.gone?.[side]) continue;
        ctx.drawImage(layerOf(s, ratio), s.rect.x + offset(side), s.rect.y, s.rect.w, s.rect.h);
      }
      // Where a point on a ship is on the screen, as she stands now.
      const at = (side, p) => {
        const s = sides[side];
        const [x, y] = project(s.cam, p[0], p[1], p[2]);
        return [x + offset(side), y];
      };
      const placed = (side) => sides[side].cam && sides[side].hull && !frame.gone?.[side];
      if (frame.grapple && placed('you') && placed('them')) grapple(ctx, at, sides);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const shimmer of frame.shimmers ?? []) {
        if (placed(shimmer.side)) shield(ctx, sides[shimmer.side], offset(shimmer.side), shimmer.progress);
      }
      for (const shot of frame.shots ?? []) {
        if (placed(shot.side) && sides[shot.target].cam) streak(ctx, at(shot.side, shot.from), at(shot.target, shot.to), shot.progress, shot.side === 'you' ? palette.tracer : palette.enemyTracer);
      }
      for (const flash of frame.flashes ?? []) {
        if (sides[flash.side].cam) burst(ctx, at(flash.side, flash.at), flash, sides[flash.side].rect);
      }
      ctx.restore();
    },
  };
}

// A ship's picture: her hull and marks drawn through her camera onto a
// clear canvas the size of her part of the screen, made again only when
// she, her marks, her camera or the pixel ratio change.
function layerOf(s, ratio) {
  const { layer, rect, cam } = s;
  const key = `${s.version} ${ratio} ${rect.x} ${rect.y} ${rect.w} ${rect.h} ${cam.scale} ${cam.x} ${cam.y} ${cam.yaw}`;
  if (layer.key === key) return layer.canvas;
  layer.key = key;
  layer.canvas ??= document.createElement('canvas');
  const [w, h] = [Math.max(1, Math.round(rect.w * ratio)), Math.max(1, Math.round(rect.h * ratio))];
  if (layer.canvas.width !== w || layer.canvas.height !== h) {
    layer.canvas.width = w;
    layer.canvas.height = h;
  }
  const g = layer.canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(ratio, 0, 0, ratio, -rect.x * ratio, -rect.y * ratio);
  const faces = s.marks ? [...s.hull.faces, ...s.marks.faces] : s.hull.faces;
  const glows = s.marks ? [...s.hull.glows, ...s.marks.glows] : s.hull.glows;
  paintSolid(g, faces, glows, cam);
  return layer.canvas;
}

// A shot in flight: a bright head and a streak behind it, from where it
// was fired toward where it goes.
function streak(ctx, [ax, ay], [bx, by], progress, color) {
  const lerp = (p) => [ax + (bx - ax) * p, ay + (by - ay) * p];
  const [hx, hy] = lerp(progress);
  const [tx, ty] = lerp(Math.max(0, progress - TAIL));
  const line = ctx.createLinearGradient(tx, ty, hx, hy);
  line.addColorStop(0, rgba(color, 0));
  line.addColorStop(1, rgba(color, 0.95));
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  glowAt(ctx, hx, hy, 7, color, 0.9);
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

// The boarded ship grappled: a line from the other's nose to hers.
function grapple(ctx, at, sides) {
  const nose = (side) => {
    const { box } = sides[side];
    return at(side, [box.x1, (box.y0 + box.y1) / 2, box.z1 / 2]);
  };
  const [a, b] = [nose('you'), nose('them')];
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
