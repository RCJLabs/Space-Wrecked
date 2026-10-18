// Marks on a ship's hull seen from outside (M38b), drawn over the hull
// (exterior.js) on the approach screen: what an approach has done to her,
// and the parts a Fire order aims at. Pure: plain data in, solid faces
// (solid.js, sorted with the hull's) and glows out. The blotches and flames
// lie where a roll seeded by the part puts them, the same every time.
import { next, seedFrom } from '../core/rng.js';
import { footprint } from '../sim/modules.js';
import { HULL } from './exterior.js';
import { palette, rgba } from './palette.js';
import { plate } from './solid.js';

// Just over the roof, and sorted as nearer, so a mark lies on its part's
// plate and under the fittings standing on it.
const ON_ROOF = HULL + 0.006;
const BIAS = -0.015;
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
// approach.js keeps them. A part hit but not wrecked is scorched; a wrecked
// one shows its hazard: flames over scorched plating, a breach venting air,
// or broken plating under a haze of dust. { faces, glows }.
export function damageMarks({ ship, defs, damage = {}, wrecked = {} }) {
  const faces = [];
  const glows = [];
  for (const module of ship.modules) {
    const roof = roofOf(ship, defs, module.uid);
    if (!roof) continue;
    const hazard = wrecked[module.uid];
    if (!hazard && !(damage[module.uid] > 0)) continue;
    const roll = roller(`hull mark ${module.uid}`);
    const spots = spotsOn(roof, roll);
    if (hazard === 'vacuum') {
      const [cx, cy] = [(roof[0] + roof[2]) / 2, (roof[1] + roof[3]) / 2];
      const r = Math.min(roof[2] - roof[0], roof[3] - roof[1]) * 0.3;
      faces.push(blot([cx, cy], r, palette.frost, 0.85, roll), blot([cx, cy], r * 0.7, palette.breach, 0.95, roll));
      glows.push({ at: [cx, cy, HULL + 0.25], r: 0.5, color: palette.vacuum }, { at: [cx + 0.15, cy - 0.1, HULL + 0.6], r: 0.35, color: palette.vacuum });
      continue;
    }
    for (const at of spots) faces.push(blot(at, 0.22 + 0.16 * roll(), hazard === 'rubble' ? palette.dust : palette.scorch, hazard ? 0.85 : 0.6, roll));
    if (hazard === 'fire') {
      for (const [x, y] of spots) glows.push({ at: [x, y, HULL + 0.2], r: 0.55, color: palette.fire }, { at: [x, y, HULL + 0.12], r: 0.26, color: palette.fireCore });
    } else if (hazard === 'rubble') {
      for (const [x, y] of spots) {
        faces.push(blot([x + 0.12, y - 0.08], 0.1, palette.rubble, 0.95, roll));
        glows.push({ at: [x, y, HULL + 0.35], r: 0.4, color: palette.rubble });
      }
    }
  }
  return { faces, glows };
}

// The parts a Fire order aims at, picked out on her hull, the one it would
// hit first the brightest. uids: the targets (approach.js targetsOf), first
// first. Faces only.
export function targetMarks({ ship, defs, uids }) {
  const faces = [];
  uids.forEach((uid, i) => {
    const roof = roofOf(ship, defs, uid);
    if (!roof) return;
    const inset = 0.06;
    plate(faces, [roof[0] + inset, roof[1] + inset], [roof[2] - inset, roof[3] - inset], ON_ROOF + 0.002, palette.target, {
      emissive: true,
      alpha: i === 0 ? 0.34 : 0.16,
      edge: rgba(palette.target, i === 0 ? 0.95 : 0.6),
      bias: BIAS - 0.005,
    });
  });
  return faces;
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

// Where a part's marks go: a spot a cell, at most four, each somewhere in
// the middle of its cell.
function spotsOn([x0, y0, x1, y1], roll) {
  const spots = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) spots.push([x + 0.3 + 0.4 * roll(), y + 0.3 + 0.4 * roll()]);
  return spots.slice(0, 4);
}

// A ragged blotch on the roof: seven points round `at`, each `r` give or
// take a third.
function blot([x, y], r, color, alpha, roll) {
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const k = r * (0.67 + 0.66 * roll());
    pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k, ON_ROOF]);
  }
  return { pts, normal: UP, color, alpha, emissive: true, bias: BIAS };
}
