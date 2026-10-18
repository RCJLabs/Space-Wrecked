// Marks on a ship's hull seen from outside (M38b), drawn over the hull
// (exterior.js) on the approach screen: what an approach has done to her,
// and the parts a Fire order aims at. Pure: plain data in, flat faces
// (solid.js) and glows out. They are painted over the finished hull in the
// order given (painter.js paintOver), not sorted with it, so no fitting on
// the roof hides them; each keeps to its own part's roof, but for smoke.
// Burns, shards and flames lie where a roll seeded by the part puts them,
// the same every time.
import { next, seedFrom } from '../core/rng.js';
import { footprint } from '../sim/modules.js';
import { HULL } from './exterior.js';
import { palette } from './palette.js';
import { plate } from './solid.js';

const ON_ROOF = HULL + 0.006;
const SMOKE = HULL + 0.3; // smoke hangs over the roof
const INSET = 0.05; // how far in from her part's edge a mark keeps
const UP = [0, 0, 1];

// A part's roof, as the hull plates it: [x0, y0, x1, y1], or null for a
// part the ship hasn't got.
export function roofOf(ship, defs, uid) {
  const module = ship.modules.find((each) => each.uid === uid);
  const def = module && defs.modules.get(module.type);
  if (!def) return null;
  const [w, h] = footprint(def, module.rot);
  return [module.x, module.y, module.x + w, module.y + h];
}

// The middle of a part's roof: where a shot at it lands. [x, y, z] or null.
export function partPoint(ship, defs, uid) {
  const roof = roofOf(ship, defs, uid);
  return roof && [(roof[0] + roof[2]) / 2, (roof[1] + roof[3]) / 2, HULL];
}

// What an approach has done to a ship, on her hull: damage { [uid]: hit
// points lost } and wrecked { [uid]: 'fire' | 'vacuum' | 'rubble' }, as
// approach.js keeps them. A part hit but not wrecked is scorched: black
// burns ringed with heat. A wrecked one is charred all over and shows its
// hazard: flames, a breach venting air (torn plating round a hole as dark
// as space), or broken plating under smoke. { faces, glows }, the faces in
// the order they are painted, the smoke last.
export function damageMarks({ ship, defs, damage = {}, wrecked = {} }) {
  const faces = [];
  const smoke = [];
  const glows = [];
  for (const module of ship.modules) {
    const hazard = wrecked[module.uid];
    if (!hazard && !(damage[module.uid] > 0)) continue;
    const roof = roofOf(ship, defs, module.uid);
    if (!roof) continue;
    const roll = roller(`hull mark ${module.uid}`);
    const keep = keeper(roof);
    const spots = spotsOn(roof, roll);
    if (!hazard) {
      for (const at of spots) {
        const r = 0.24 + 0.14 * roll();
        faces.push(blot(at, r * 1.45, palette.burn, 0.6, roll, keep), blot(at, r, palette.scorch, 0.9, roll, keep));
      }
      continue;
    }
    faces.push(charred(roof, roll));
    if (hazard === 'fire') {
      for (const at of spots) faces.push(blot(at, 0.3, palette.scorch, 0.9, roll, keep));
      for (const [x, y] of spots) glows.push({ at: [x, y, HULL + 0.25], r: 0.7, color: palette.fire }, { at: [x, y, HULL + 0.1], r: 0.32, color: palette.fireCore });
    } else if (hazard === 'vacuum') {
      const at = [(roof[0] + roof[2]) / 2, (roof[1] + roof[3]) / 2];
      const r = Math.min(roof[2] - roof[0], roof[3] - roof[1]) * 0.3;
      faces.push(blot(at, r * 1.35, palette.frost, 0.9, roll, keep), ...shards(at, r * 1.15, roll, keep), blot(at, r, palette.breach, 1, roll, keep));
      glows.push({ at: [at[0], at[1], HULL + 0.25], r: 0.55, color: palette.vacuum }, { at: [at[0] + 0.2, at[1] - 0.15, HULL + 0.65], r: 0.4, color: palette.vacuum });
    } else {
      for (const at of spots) faces.push(blot(at, 0.2, palette.breach, 0.9, roll, keep), ...shards(at, 0.34, roll, keep));
      for (const [x, y] of spots) smoke.push(blot([x + 0.12, y - 0.1], 0.42, palette.smoke, 0.32, roll, null, SMOKE), blot([x + 0.24, y - 0.22], 0.3, palette.smoke, 0.26, roll, null, SMOKE + 0.2));
    }
  }
  return { faces: [...faces, ...smoke], glows };
}

// The parts a Fire order aims at, picked out on her hull, the one it would
// hit first the brightest. uids: the targets (approach.js targetsOf), first
// first. { faces, frames }: a tint over each part's roof, and its corners
// ([x, y, z] each way round), which the screen brackets.
export function targetMarks({ ship, defs, uids }) {
  const faces = [];
  const frames = [];
  uids.forEach((uid, i) => {
    const roof = roofOf(ship, defs, uid);
    if (!roof) return;
    const [x0, y0, x1, y1] = [roof[0] + INSET, roof[1] + INSET, roof[2] - INSET, roof[3] - INSET];
    plate(faces, [x0, y0], [x1, y1], ON_ROOF, palette.target, { emissive: true, alpha: i === 0 ? 0.32 : 0.14 });
    frames.push({ uid, first: i === 0, corners: [[x0, y0, ON_ROOF], [x1, y0, ON_ROOF], [x1, y1, ON_ROOF], [x0, y1, ON_ROOF]] });
  });
  return { faces, frames };
}

// A float in [0, 1) at each call, from a seed.
function roller(seed) {
  let state = seedFrom(seed);
  return () => {
    const r = next(state);
    state = r.state;
    return r.value;
  };
}

// A point kept on a part's roof, a little in from its edge.
function keeper([x0, y0, x1, y1]) {
  return ([x, y]) => [Math.min(x1 - INSET, Math.max(x0 + INSET, x)), Math.min(y1 - INSET, Math.max(y0 + INSET, y))];
}

// Where a part's marks go: a spot a cell, at most four, each somewhere in
// the middle of its cell.
function spotsOn([x0, y0, x1, y1], roll) {
  const spots = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) spots.push([x + 0.3 + 0.4 * roll(), y + 0.3 + 0.4 * roll()]);
  return spots.slice(0, 4);
}

// A ragged blotch: seven points round `at`, each `r` give or take a third,
// kept to the roof (keep) unless it hangs over it.
function blot([x, y], r, color, alpha, roll, keep = null, z = ON_ROOF) {
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const k = r * (0.67 + 0.66 * roll());
    const p = [x + Math.cos(a) * k, y + Math.sin(a) * k];
    pts.push([...(keep ? keep(p) : p), z]);
  }
  return { pts, normal: UP, color, alpha, emissive: true };
}

// A part burnt black all over: its roof, its edges eaten in here and there.
function charred([x0, y0, x1, y1], roll) {
  const pts = [];
  const side = (ax, ay, bx, by, inward) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) * 3));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const d = INSET + 0.12 * roll();
      pts.push([ax + (bx - ax) * t + inward[0] * d, ay + (by - ay) * t + inward[1] * d, ON_ROOF]);
    }
  };
  side(x0, y0, x1, y0, [0, 1]);
  side(x1, y0, x1, y1, [-1, 0]);
  side(x1, y1, x0, y1, [0, -1]);
  side(x0, y1, x0, y0, [1, 0]);
  return { pts, normal: UP, color: palette.scorch, alpha: 0.62, emissive: true };
}

// Plating torn up round a point: three bright slivers, splayed out from it.
function shards([x, y], r, roll, keep) {
  const out = [];
  const turn = roll() * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const a = turn + (i / 3) * Math.PI * 2 + (roll() - 0.5) * 0.8;
    const [cos, sin] = [Math.cos(a), Math.sin(a)];
    const [near, far, wide] = [r * 0.35, r * (0.85 + 0.45 * roll()), 0.05 + 0.04 * roll()];
    const pts = [
      [x + cos * near - sin * wide, y + sin * near + cos * wide],
      [x + cos * far, y + sin * far],
      [x + cos * near + sin * wide, y + sin * near - cos * wide],
    ];
    out.push({ pts: pts.map((p) => [...keep(p), ON_ROOF]), normal: UP, color: palette.rubble, alpha: 0.95, emissive: true });
  }
  return out;
}
