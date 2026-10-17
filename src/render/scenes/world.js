// A world seen whole (M34): the sky with the world rising into it from the
// lower right, as the ship leaves it at the lift-off or comes in at the
// landing. A FRAME-sized picture: the sky's haze and stars, then the world's
// disc, its face by its kind clipped to it, the night side turned away to
// the lower right, and its air lit along the edge. Pure: the same kind and
// seed always make the same shapes.
import { palette, sceneColors as S } from '../palette.js';
import { colorsOf } from './ground.js';
import { blob, ellipse, glow, grain, group, inFrame, line, linear, radial, rect, roller, vignette, wander } from './shapes.js';

export const FRAME = [1600, 900];
// The world's disc: its middle and size in the frame.
export const DISC = { x: 1260, y: 1010, r: 780 };

// The shapes of world `kind` seen whole ('homeworld' for the grey rock):
// { size, shapes }.
export function worldScene(kind, seed) {
  const [w, h] = FRAME;
  const { x, y, r } = DISC;
  const c = colorsOf(kind);
  const dice = roller(`world ${kind} ${seed}`);
  const shapes = [rect(0, 0, w, h, linear(0, 0, 0, h, [[0, palette.space, 1], [1, palette.spaceHi, 1]]))];
  shapes.push(glow(420, 260, 620, palette.nebulaA, 0.35), glow(980, 140, 520, palette.nebulaB, 0.4));
  for (let i = 0; i < 260; i++) {
    const [sx, sy] = [dice.between(0, w), dice.between(0, h)];
    if (Math.hypot(sx - x, sy - y) < r + 30) continue;
    const size = 0.8 + 1.8 * dice.roll() ** 3;
    shapes.push(ellipse(sx, sy, size, size, dice.pick([palette.star, palette.star, palette.starCool, palette.starWarm]), { alpha: dice.between(0.3, 0.95) }));
  }
  // The air: a haze beyond the edge, as thick as the kind's (AIR).
  const air = AIR[kind] ?? AIR.rock;
  if (air) shapes.push(ellipse(x, y, r * 1.07, r * 1.07, radial(x, y, r * 1.07, [[0.9, S.air, 0], [0.935, S.air, air], [1, S.air, 0]])));
  const disc = ellipse(x, y, r, r, radial(x - r * 0.55, y - r * 0.6, r * 1.5, [[0, c.planetLight, 1], [0.45, c.planet, 1], [1, c.planetDark, 1]]));
  const face = [disc];
  (FACES[kind] ?? FACES.rock)(face, dice, c, x, y, r);
  // The night side, turned away from the sun.
  face.push(rect(x - r, y - r, r * 2, r * 2, linear(x - r * 0.35, y - r * 0.55, x + r * 0.25, y + r * 0.05, [[0, S.night, 0], [0.55, S.night, 0.55], [1, S.night, 0.92]])));
  shapes.push(group(disc, face));
  // The edge lit: warm where the sun is, cool all round where there is air.
  shapes.push(ellipse(x, y, r, r, null, { stroke: linear(x - r, y - r, x + r * 0.2, y, [[0, S.warm, 0.85], [0.5, S.air, air * 1.7], [1, S.air, 0]]), width: 5, blur: 2 }));
  shapes.push(glow(x - r * 0.72, y - r * 0.72, 260, S.warm, 0.18, { blend: 'lighter' }));
  shapes.push(...grain(dice, w, h, 700, S.speck, S.shade));
  shapes.push(vignette(w, h, S.shade, 0.55));
  return { size: FRAME, shapes: inFrame(shapes, w, h) };
}

// How thick each kind's air shows at its edge: barren rock has none, the
// homeworld's grey rock a thin haze.
const AIR = { homeworld: 0.15, rock: 0, desert: 0.3, ice: 0.3, jungle: 0.4, ocean: 0.4 };

// Somewhere on the lit, visible part of the disc: within the frame and
// inside the disc by `margin`.
function onFace(dice, x, y, r, margin) {
  for (let tries = 0; tries < 40; tries++) {
    const [px, py] = [dice.between(440, 1600), dice.between(200, 900)];
    if (Math.hypot(px - x, py - y) < r - margin) return [px, py];
  }
  return [x - r * 0.5, y - r * 0.5];
}

// A crater seen from afar: dark bowl, lit lower-left wall.
function farCrater(face, x, y, r, c) {
  face.push(ellipse(x, y, r, r * 0.92, c.planetLight, { alpha: 0.35 }));
  face.push(ellipse(x + r * 0.15, y - r * 0.15, r * 0.82, r * 0.76, c.planetDark, { alpha: 0.75 }));
}

// Clouds: soft white swirls.
function clouds(face, dice, x, y, r, count, alpha) {
  for (let i = 0; i < count; i++) {
    const [cx, cy] = onFace(dice, x, y, r, 20);
    const turn = dice.between(-0.6, 0.2);
    face.push(ellipse(cx, cy, dice.between(50, 150), dice.between(10, 26), S.cloud, { turn, alpha, blur: 9 }));
    face.push(line(wander(dice, cx, cy, turn, 26, 6, 0.3), S.cloud, dice.between(3, 7), { smooth: true, alpha: alpha * 0.8, blur: 3 }));
  }
}

const FACES = {
  // The grey rock: craters and dark plains, and the Tailings' lights on the
  // night side.
  homeworld(face, dice, c, x, y, r) {
    for (let i = 0; i < 6; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 80), dice.between(60, 140), 0.35, c.planetDark, { alpha: 0.4, blur: 14 }));
    for (let i = 0; i < 36; i++) farCrater(face, ...onFace(dice, x, y, r, 20), 4 + 22 * dice.roll() ** 2, c);
    for (let i = 0; i < 40; i++) {
      const a = dice.between(-0.2, 1.1);
      const d = r * dice.between(0.55, 0.97);
      face.push(glow(x + Math.cos(a) * d * 0.6, y - Math.sin(a) * d * 0.55, dice.between(3, 8), c.lamp, 0.5, { blend: 'lighter' }));
    }
  },
  // Barren rock: craters and dark plains.
  rock(face, dice, c, x, y, r) {
    for (let i = 0; i < 7; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 80), dice.between(60, 160), 0.35, c.planetDark, { alpha: 0.38, blur: 14 }));
    for (let i = 0; i < 48; i++) farCrater(face, ...onFace(dice, x, y, r, 20), 4 + 26 * dice.roll() ** 2, c);
  },
  // Desert: bands of ochre and rust, dune seas, a thin haze of dust.
  desert(face, dice, c, x, y, r) {
    for (let i = 0; i < 9; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 60), dice.between(70, 180), 0.4, dice.roll() < 0.5 ? c.planetDark : c.rockTop, { alpha: 0.35, blur: 16 }));
    for (let i = 0; i < 30; i++) {
      const [px, py] = onFace(dice, x, y, r, 30);
      face.push(line([[px - 30, py], [px, py - 6], [px + 30, py]], c.planetLight, 2, { smooth: true, alpha: 0.25 }));
    }
    clouds(face, dice, x, y, r, 3, 0.12);
  },
  // Ice: white plains, blue-grey seams, a few bright cracks.
  ice(face, dice, c, x, y, r) {
    for (let i = 0; i < 8; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 60), dice.between(60, 170), 0.4, dice.roll() < 0.5 ? c.planetLight : c.mid, { alpha: 0.4, blur: 14 }));
    for (let i = 0; i < 9; i++) {
      const [px, py] = onFace(dice, x, y, r, 40);
      face.push(line(wander(dice, px, py, dice.between(0, Math.PI * 2), 24, 10, 0.4), c.planetDark, 2.4, { alpha: 0.45 }));
    }
    clouds(face, dice, x, y, r, 4, 0.2);
  },
  // Jungle: green land and dark seas, the land's own shades, heavy cloud.
  jungle(face, dice, c, x, y, r) {
    face.push(ellipse(x, y, r, r, c.sea, { alpha: 0.75 }));
    for (let i = 0; i < 5; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 120), dice.between(120, 230), 0.45, c.planet, { blur: 3 }, 12));
    for (let i = 0; i < 10; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 60), dice.between(30, 80), 0.4, dice.roll() < 0.5 ? c.planetLight : c.planetDark, { alpha: 0.35, blur: 8 }));
    clouds(face, dice, x, y, r, 9, 0.45);
  },
  // Ocean: open sea, island chains, storms.
  ocean(face, dice, c, x, y, r) {
    for (let i = 0; i < 6; i++) face.push(blob(dice, ...onFace(dice, x, y, r, 60), dice.between(80, 200), 0.4, dice.roll() < 0.5 ? c.planetLight : c.planetDark, { alpha: 0.3, blur: 18 }));
    for (let i = 0; i < 4; i++) {
      let [px, py] = onFace(dice, x, y, r, 60);
      for (let k = 0; k < 6; k++) {
        face.push(blob(dice, px, py, dice.between(5, 13), 0.4, c.land));
        px += dice.between(10, 28);
        py += dice.between(-14, 10);
      }
    }
    clouds(face, dice, x, y, r, 8, 0.4);
    const [sx, sy] = onFace(dice, x, y, r, 160);
    const spiral = Array.from({ length: 26 }, (_, i) => [sx + Math.cos(i * 0.5) * (6 + i * 3.4), sy + Math.sin(i * 0.5) * (6 + i * 2.6)]);
    face.push(line(spiral, S.cloud, 6, { smooth: true, alpha: 0.5, blur: 3 }));
  },
};

// The kinds of world drawn whole.
export const WORLD_KINDS = Object.keys(FACES);
