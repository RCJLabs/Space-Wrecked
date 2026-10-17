// The ground seen from above (M34): what lies under the ship at the
// lift-off and the landing, a TILE-square of it with the ship's place in
// the middle. The homeworld's grey rock has the pad and the hangar, pits
// and haul roads; each kind of world has its own, with a clearing burned
// for the ship to set down in. Lit from the upper right, so shadows fall to
// the lower left. Pure: the same kind and seed always make the same shapes.
import { groundFor, sceneColors as S } from '../palette.js';
import { blob, ellipse, glow, grain, group, inFrame, line, linear, poly, radial, rect, roller, vignette, wander } from './shapes.js';

export const TILE = 1000;
const MID = TILE / 2;
// Around the ship's place nothing stands but its pad or clearing.
export const CLEAR = 150;

// The ground's shapes for a kind of world ('homeworld' for the grey rock the
// ship leaves): { size, base, shapes }, base the color under it all.
export function groundScene(kind, seed) {
  const paint = GROUNDS[kind] ?? GROUNDS.rock;
  const c = colorsOf(kind);
  const dice = roller(`ground ${kind} ${seed}`);
  const shapes = [rect(0, 0, TILE, TILE, radial(700, 260, 900, [[0, c.light, 1], [0.42, c.ground, 1], [1, c.dark, 1]]))];
  for (let i = 0; i < 12; i++) {
    shapes.push(ellipse(dice.between(0, TILE), dice.between(0, TILE), dice.between(70, 220), dice.between(50, 170), dice.roll() < 0.5 ? c.light : c.dark, { turn: dice.between(0, Math.PI), alpha: dice.between(0.08, 0.2), blur: 30 }));
  }
  paint(shapes, dice, c);
  shapes.push(glow(900, 80, 760, S.warm, 0.13, { blend: 'lighter' }));
  shapes.push(glow(80, 940, 620, S.cool, 0.07, { blend: 'lighter' }));
  shapes.push(...grain(dice, TILE, TILE, 1100, S.speck, S.shade));
  shapes.push(vignette(TILE, TILE, S.shade, 0.6));
  return { size: [TILE, TILE], base: c.ground, shapes: inFrame(shapes, TILE, TILE) };
}

// A kind's colors: the colony's land for its ground (palette.js grounds),
// the rest its scene's own; a kind without its own takes barren rock's.
export function colorsOf(kind) {
  if (kind === 'homeworld') return S.homeworld;
  const own = S[kind] && GROUNDS[kind] ? S[kind] : S.rock;
  return { ...own, ground: groundFor(kind).land };
}

// A spot at least `margin` clear of the ship's place, within the tile.
function spot(dice, margin) {
  for (let tries = 0; tries < 30; tries++) {
    const [x, y] = [dice.between(30, TILE - 30), dice.between(30, TILE - 30)];
    if (Math.hypot(x - MID, y - MID) > CLEAR + margin) return [x, y];
  }
  return [dice.between(30, 200), dice.between(30, 200)];
}

// A crater lit from the upper right: its rim, its bowl, the lit wall to the
// lower left and the shadow the upper rim throws.
function crater(x, y, r, c) {
  const bowl = ellipse(x, y, r * 0.84, r * 0.8, c.dark);
  return [
    glow(x, y, r * 1.6, c.dust, 0.16),
    ellipse(x, y, r, r * 0.95, c.dust),
    group(bowl, [bowl, ellipse(x, y, r * 0.84, r * 0.8, c.light, { alpha: 0.55 }), ellipse(x + r * 0.2, y - r * 0.2, r * 0.8, r * 0.76, c.dark)]),
  ];
}

// A boulder: its shadow to the lower left, the stone, its lit top.
function boulder(x, y, s, c) {
  return [
    ellipse(x - s * 0.5, y + s * 0.45, s, s * 0.8, S.shade, { alpha: 0.45 }),
    ellipse(x, y, s, s * 0.8, c.dust),
    ellipse(x + s * 0.25, y - s * 0.25, s * 0.5, s * 0.4, c.light, { alpha: 0.7 }),
  ];
}

// A clearing burned for the ship: dark ground, its edge ragged.
function burned(shapes, dice, color, r) {
  shapes.push(glow(MID, MID, r * 1.4, S.shade, 0.35));
  shapes.push(blob(dice, MID, MID, r, 0.16, color, { alpha: 0.85, blur: 6 }, 14));
  for (let i = 0; i < 11; i++) {
    const a = dice.between(0, Math.PI * 2);
    const [r0, r1] = [r * 0.85, r * dice.between(1.15, 1.9)];
    shapes.push(line([[MID + Math.cos(a) * r0, MID + Math.sin(a) * r0], [MID + Math.cos(a) * r1, MID + Math.sin(a) * r1]], color, dice.between(5, 16), { alpha: dice.between(0.12, 0.3), blur: 7 }));
  }
}

const GROUNDS = {
  // The grey rock of the homeworld: the pad in the middle, the hangar beside
  // it, open pits stepped down into the rock, haul roads, and the lights of
  // the Tailings.
  homeworld(shapes, dice, c) {
    for (const [x, y, r] of [[220, 280, 200], [800, 790, 130]]) {
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const k = 1 - i / steps;
        shapes.push(blob(roller(`pit ${x} ${y}`), x, y, r * k, 0.09, i % 2 ? c.terrace : c.dust, { alpha: 1 }, 11));
        shapes.push(blob(roller(`pit ${x} ${y}`), x + r * k * 0.04, y - r * k * 0.04, r * k * 0.93, 0.09, i % 2 ? c.dark : c.terrace, { alpha: 0.55 }, 11));
      }
      shapes.push(blob(roller(`pit ${x} ${y}`), x, y, r * 0.12, 0.09, c.pit, {}, 11));
    }
    for (let i = 0; i < 8; i++) {
      const [x, y] = spot(dice, 60);
      shapes.push(...crater(x, y, dice.between(12, 40), c));
    }
    const roads = [
      [[MID - 230, MID], [380, 470], [300, 420], [260, 360]],
      [[MID + 230, MID + 20], [760, 560], [880, 520], [1040, 560]],
      [[MID + 40, MID + 230], [540, 820], [500, 920], [520, 1040]],
      [[MID + 130, MID + 180], [690, 690], [760, 740]],
    ];
    for (const road of roads) {
      shapes.push(line(road, c.road, 18, { smooth: true }));
      shapes.push(line(road, c.roadLine, 2, { smooth: true, alpha: 0.45 }));
      for (const [x, y] of road.slice(1).filter(([x, y]) => x < TILE && y < TILE)) shapes.push(glow(x, y, 26, c.lamp, 0.35, { blend: 'lighter' }));
    }
    // The hangar, its mouth open to the pad.
    shapes.push(rect(176, 452, 160, 128, S.shade, { alpha: 0.5, blur: 8 }));
    shapes.push(rect(186, 436, 150, 126, c.roof));
    for (let i = 1; i < 6; i++) shapes.push(rect(186 + i * 25, 436, 2, 126, c.roofLine));
    shapes.push(rect(332, 456, 8, 86, c.lamp, { alpha: 0.9 }));
    shapes.push(glow(345, 499, 70, c.lamp, 0.4, { blend: 'lighter' }));
    // The Tailings' sheds, lit.
    for (const [x, y, w, h] of [[640, 300, 60, 40], [710, 330, 44, 34], [600, 640, 52, 38], [360, 650, 70, 44], [420, 300, 46, 32]]) {
      shapes.push(rect(x - 8, y + 10, w, h, S.shade, { alpha: 0.45, blur: 5 }));
      shapes.push(rect(x, y, w, h, c.roof));
      shapes.push(rect(x + 4, y + h - 8, w - 8, 3, c.lamp, { alpha: 0.75 }));
      shapes.push(glow(x + w / 2, y + h, 34, c.lamp, 0.25, { blend: 'lighter' }));
    }
    // The pad: concrete, a ring of hazard paint, its lamps.
    shapes.push(glow(MID, MID, 280, S.shade, 0.35));
    shapes.push(ellipse(MID, MID, 222, 222, c.padRing));
    shapes.push(ellipse(MID, MID, 212, 212, c.pad));
    for (let i = 0; i < 28; i++) {
      const [a0, a1] = [(i / 28) * Math.PI * 2, ((i + 0.5) / 28) * Math.PI * 2];
      const arc = [a0, (a0 + a1) / 2, a1];
      shapes.push(poly([...arc.map((a) => [MID + Math.cos(a) * 214, MID + Math.sin(a) * 214]), ...arc.reverse().map((a) => [MID + Math.cos(a) * 200, MID + Math.sin(a) * 200])], c.hazard, { alpha: 0.85 }));
    }
    shapes.push(ellipse(MID, MID, 150, 150, null, { stroke: c.padRing, width: 3, alpha: 0.7 }));
    shapes.push(glow(MID, MID, 150, S.shade, 0.3));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      shapes.push(glow(MID + Math.cos(a) * 232, MID + Math.sin(a) * 232, 22, c.lamp, 0.55, { blend: 'lighter' }));
      shapes.push(ellipse(MID + Math.cos(a) * 232, MID + Math.sin(a) * 232, 4, 4, S.warmCore));
    }
  },

  // Barren rock: craters, boulders and cracks, dust blown into streaks.
  rock(shapes, dice, c) {
    const lean = dice.between(-0.6, -0.2);
    for (let i = 0; i < 9; i++) shapes.push(ellipse(dice.between(0, TILE), dice.between(0, TILE), dice.between(160, 320), dice.between(18, 40), c.dust, { turn: lean, alpha: 0.13, blur: 16 }));
    for (let i = 0; i < 9; i++) {
      const [x, y] = spot(dice, 20);
      shapes.push(line(wander(dice, x, y, dice.between(0, Math.PI * 2), 18, 12, 0.5), c.dark, dice.between(1.5, 3.2), { alpha: 0.7 }));
    }
    for (let i = 0; i < 28; i++) {
      const r = 10 + 72 * dice.roll() ** 2.2;
      const [x, y] = spot(dice, r);
      shapes.push(...crater(x, y, r, c));
    }
    for (let i = 0; i < 70; i++) {
      const s = dice.between(3, 11);
      const [x, y] = spot(dice, s);
      shapes.push(...boulder(x, y, s, c));
    }
    burned(shapes, dice, c.dark, 120);
  },

  // Desert: dunes in long ranks, lit on their north faces, rock standing
  // out of the sand, and ripples.
  desert(shapes, dice, c) {
    const phase = dice.between(0, Math.PI * 2);
    const crests = [];
    for (let row = 0; row < 11; row++) {
      const y0 = row * 100 + dice.between(-20, 20);
      const crest = [];
      for (let x = -60; x <= TILE + 60; x += 40) crest.push([x, y0 + 24 * Math.sin(x / 160 + phase + row) + 9 * Math.sin(x / 57 + row * 2.1)]);
      shapes.push(poly([...crest, ...crest.slice().reverse().map(([x, y]) => [x, y - 52])], c.light, { smooth: true, alpha: 0.45, blur: 6 }));
      shapes.push(poly([...crest, ...crest.slice().reverse().map(([x, y]) => [x, y + 34])], c.dark, { smooth: true, alpha: 0.42, blur: 5 }));
      crests.push(line(crest, c.light, 2.2, { smooth: true, alpha: 0.75 }));
    }
    shapes.push(...crests);
    for (let i = 0; i < 44; i++) {
      const [x, y] = spot(dice, 10);
      shapes.push(line([[x, y], [x + 26, y - 4], [x + 52, y]], c.light, 1.4, { smooth: true, alpha: 0.2 }));
    }
    for (let i = 0; i < 4; i++) {
      const r = dice.between(40, 80);
      const [x, y] = spot(dice, r);
      const seed = dice.roll();
      shapes.push(blob(roller(seed), x - r * 0.3, y + r * 0.35, r, 0.3, S.shade, { alpha: 0.4, blur: 8 }));
      shapes.push(blob(roller(seed), x, y, r, 0.3, c.rock));
      shapes.push(blob(roller(seed), x + r * 0.12, y - r * 0.14, r * 0.72, 0.3, c.rockTop, { alpha: 0.85 }));
    }
    // The salt flat the ship sets down on, crusted into plates.
    shapes.push(blob(dice, MID, MID, 290, 0.22, c.salt, { alpha: 0.9, blur: 14 }, 12));
    for (let i = 0; i < 40; i++) {
      const a = dice.between(0, Math.PI * 2);
      const d = dice.between(0, 240);
      shapes.push(line(wander(dice, MID + Math.cos(a) * d, MID + Math.sin(a) * d, dice.between(0, Math.PI * 2), 14, 4, 1.1), c.saltLine, 1.6, { alpha: 0.5 }));
    }
    // The dust the ship threw up, settling in a ring.
    shapes.push(ellipse(MID, MID, 190, 190, null, { stroke: c.mid, width: 60, alpha: 0.22, blur: 18 }));
    burned(shapes, dice, c.mid, 95);
  },

  // Ice: a sheet cracked into plates, the dark seams between them, drifts
  // of snow, short pressure ridges, a lead of open water, and the melt the
  // ship's engines left.
  ice(shapes, dice, c) {
    shapes.push(rect(0, 0, TILE, TILE, c.dark, { alpha: 0.5 }));
    const step = 96;
    const sheens = [];
    for (let gy = -1; gy <= 12; gy++) {
      for (let gx = -1; gx <= 11; gx++) {
        const x = gx * step + (gy % 2 ? step / 2 : 0) + dice.between(-30, 30);
        const y = gy * step * 0.87 + dice.between(-26, 26);
        const r = step * dice.between(0.38, 0.6);
        const [seed, sides] = [dice.roll(), dice.int(5, 7)];
        const plate = blob(roller(seed), x, y, r, 0.28, dice.roll() < 0.6 ? c.mid : c.light, { smooth: false, alpha: dice.between(0.5, 0.8) }, sides);
        if (!plate.points.some(([px, py]) => px > 0 && py > 0 && px < TILE && py < TILE)) continue;
        shapes.push(plate);
        sheens.push(blob(roller(seed), x + r * 0.14, y - r * 0.16, r * 0.62, 0.28, c.light, { smooth: false, alpha: 0.18, blur: 6 }, sides));
      }
    }
    shapes.push(...sheens);
    for (let i = 0; i < 9; i++) shapes.push(blob(dice, dice.between(0, TILE), dice.between(0, TILE), dice.between(60, 140), 0.3, c.light, { alpha: 0.25, blur: 24 }));
    const lead = [[-30, dice.between(120, 260)], [260, dice.between(150, 250)], [520, dice.between(120, 200)], [760, dice.between(150, 240)], [1030, dice.between(160, 300)]];
    shapes.push(line(lead, c.lead, 22, { smooth: true }));
    shapes.push(line(lead, c.crack, 26, { smooth: true, alpha: 0.12, blur: 4 }));
    for (let i = 0; i < 6; i++) {
      const [x, y] = spot(dice, 40);
      const ridge = wander(dice, x, y, dice.between(0, Math.PI * 2), 16, 6, 0.5);
      shapes.push(line(ridge.map(([px, py]) => [px - 3, py + 4]), c.dark, 7, { alpha: 0.45, blur: 2 }));
      shapes.push(line(ridge, c.light, 3.5, { alpha: 0.9 }));
    }
    burned(shapes, dice, c.dark, 100);
    // The long crack the ship's weight opened.
    const crack = wander(dice, MID + 30, MID + 10, dice.between(-0.5, 0.5), 34, 16, 0.45);
    shapes.push(line(crack, c.crack, 9, { alpha: 0.25, blur: 3 }));
    shapes.push(line(crack, c.lead, 3, { alpha: 0.9 }));
    shapes.push(blob(dice, MID, MID, 80, 0.2, c.crack, { alpha: 0.2, blur: 10 }));
    shapes.push(ellipse(MID + 24, MID - 26, 34, 12, c.light, { turn: -0.6, alpha: 0.35, blur: 6 }));
  },

  // Jungle: a canopy of crowns, a river through it, mist over the trees,
  // and the clearing the ship burned.
  jungle(shapes, dice, c) {
    const river = [[-40, 330], [180, 280], [380, 210], [600, 240], [760, 390], [860, 600], [1040, 760]];
    shapes.push(line(river, c.river, 74, { smooth: true }));
    shapes.push(line(river, c.glint, 50, { smooth: true, alpha: 0.18 }));
    for (let i = 0; i < 26; i++) {
      const k = dice.roll() * (river.length - 1.001);
      const [a, b] = [river[Math.floor(k)], river[Math.floor(k) + 1]];
      const u = k % 1;
      const [x, y] = [a[0] + (b[0] - a[0]) * u + dice.between(-18, 18), a[1] + (b[1] - a[1]) * u + dice.between(-18, 18)];
      if (x > 10 && x < TILE - 10) shapes.push(line([[x - 9, y], [x + 9, y - 1]], c.glint, 2.4, { alpha: 0.55 }));
    }
    const crowns = [];
    for (let i = 0; i < 560; i++) {
      const r = dice.between(13, 32);
      const [x, y] = [dice.between(-20, TILE + 20), dice.between(-20, TILE + 20)];
      if (Math.hypot(x - MID, y - MID) < CLEAR + r) continue;
      if (river.some(([rx, ry], j) => j < river.length - 1 && segmentDistance([x, y], [rx, ry], river[j + 1]) < 34 + r * 0.6)) continue;
      crowns.push([x, y, r, dice.pick(c.leaves)]);
    }
    crowns.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r, leaf] of crowns) {
      shapes.push(ellipse(x - r * 0.35, y + r * 0.4, r, r * 0.95, c.dark, { alpha: 0.55 }));
      shapes.push(ellipse(x, y, r, r * 0.95, leaf));
      shapes.push(ellipse(x + r * 0.25, y - r * 0.28, r * 0.55, r * 0.5, c.light, { alpha: 0.28 }));
    }
    for (let i = 0; i < 7; i++) shapes.push(blob(dice, dice.between(0, TILE), dice.between(0, TILE), dice.between(70, 150), 0.3, c.mist, { alpha: 0.1, blur: 34 }));
    burned(shapes, dice, c.scorch, 130);
    for (let i = 0; i < 34; i++) {
      const a = dice.between(0, Math.PI * 2);
      const d = dice.between(0, 120);
      shapes.push(glow(MID + Math.cos(a) * d, MID + Math.sin(a) * d, dice.between(3, 7), c.ember, 0.6, { blend: 'lighter' }));
    }
  },

  // Ocean: open sea, its waves catching the light, an island for the ship
  // to set down on, with its beach, reef and surf, and islets further out.
  ocean(shapes, dice, c) {
    shapes.push(rect(0, 0, TILE, TILE, linear(TILE, 0, 0, TILE, [[0, c.sea, 1], [1, c.deep, 1]])));
    for (let i = 0; i < 150; i++) {
      const [x, y] = spot(dice, 120);
      const w = dice.between(14, 34);
      shapes.push(line([[x - w, y], [x, y - w * 0.18], [x + w, y]], c.foam, dice.between(1.2, 2.4), { smooth: true, alpha: dice.between(0.1, 0.24) }));
    }
    const isle = (x, y, r, seed) => {
      const shape = (k) => blob(roller(seed), x, y, r * k, 0.24, null, {}, 12);
      shapes.push({ ...shape(1.45), fill: c.shallow, alpha: 0.55, blur: 22 });
      shapes.push({ ...shape(1.09), stroke: c.foam, width: 4, alpha: 0.65, blur: 2 });
      shapes.push({ ...shape(1.04), fill: c.sand });
      shapes.push({ ...shape(0.92), fill: c.land });
    };
    for (let i = 0; i < 3; i++) {
      const r = dice.between(30, 60);
      const [x, y] = spot(dice, 260);
      isle(x, y, r, dice.roll());
    }
    isle(MID, MID, 235, `isle ${dice.roll()}`);
    for (let i = 0; i < 5; i++) shapes.push(blob(dice, MID + dice.between(-120, 120), MID + dice.between(-120, 120), dice.between(30, 60), 0.3, c.landDark, { alpha: 0.6, blur: 6 }));
    burned(shapes, dice, c.landDark, 95);
  },
};

// How far point p is from the segment a to b.
function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const [dx, dy] = [bx - ax, by - ay];
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}

// The kinds of ground drawn: the homeworld's and each kind of world's.
export const GROUND_KINDS = Object.keys(GROUNDS);
