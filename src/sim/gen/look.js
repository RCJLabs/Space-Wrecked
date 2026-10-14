// What a generated ship wears (M23f): its side's paint and trim, and
// styling pieces from its preset's look (data/ships.json), each put on at
// random where it fits by the builder's own rules (styling.js). Pure and
// seeded, from a roll of its own: the same preset and seed always give the
// same look, and the layout is what it was before ships had looks.
import { int, pick, seedFrom } from '../../core/rng.js';
import { placedCells } from '../modules.js';
import { hullSite, mirroredPiece, pieceCells, pieceError, pieceFootprint } from '../styling.js';

// The ship in its preset's look, or as it is for a preset without one. Of
// each piece the look names it gets a count (rolled where it is a range);
// a symmetric ship wears them in mirrored pairs, so an odd count gets one
// more, and one on the middle line, its own mirror, stands for a pair. A
// piece with no spot left is left off.
export function dressShip(defs, preset, ship, seed) {
  const { look } = preset;
  if (!look) return ship;
  let state = seedFrom(`look ${preset.id} ${seed}`);
  let dressed = { ...ship, paint: look.paint, trim: look.trim };
  const site = hullSite(dressed, defs);
  // A piece goes against the hull, so only spots touching it are tried.
  const near = new Set();
  const frame = defs.frames.get(ship.frame);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (!site.hull(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => site.hull(x + dx, y + dy))) near.add(`${x},${y}`);
    }
  }
  const rows = ship.modules.flatMap((m) => placedCells(defs.modules.get(m.type), m).map(([, y]) => y));
  const across = preset.symmetric ? Math.min(...rows) + Math.max(...rows) : null;
  for (const [type, count] of Object.entries(look.pieces ?? {})) {
    const roll = int(state, ...(Array.isArray(count) ? count : [count, count]));
    state = roll.state;
    let left = across === null ? roll.value : roll.value + (roll.value % 2);
    let spots = spotsFor(defs, dressed, type, { site, near, across });
    while (left > 0 && spots.length) {
      const spot = pick(state, spots);
      state = spot.state;
      for (const placement of spot.value) dressed = put(dressed, placement);
      left -= across === null ? 1 : 2;
      // The rest only lose spots to what went on.
      spots = spots.filter((pair) => fitsAll(defs, dressed, pair, site));
    }
  }
  return dressed;
}

// Every spot the piece fits on the ship as it is, each a list of the
// placements that go on together: one, or on a symmetric ship a piece and
// its mirror (just the one if it is its own). near: the cells touching the
// hull, as 'x,y'; across as in mirroredPiece, or null.
function spotsFor(defs, ship, type, { site, near, across }) {
  const def = defs.styling.get(type);
  const frame = defs.frames.get(ship.frame);
  const spots = [];
  const seen = new Set();
  for (const rot of def.turns) {
    const [w, h] = pieceFootprint(def, rot);
    for (let y = 0; y + h <= frame.height; y++) {
      for (let x = 0; x + w <= frame.width; x++) {
        const placement = { type, x, y, rot };
        if (!pieceCells(def, placement).some(([cx, cy]) => near.has(`${cx},${cy}`)) || pieceError(ship, defs, placement, null, site)) continue;
        if (across === null) {
          spots.push([placement]);
          continue;
        }
        const mirror = mirroredPiece(def, placement, across);
        if (!mirror) continue;
        const same = mirror.x === x && mirror.y === y && mirror.rot === rot;
        const pair = same ? [placement] : [placement, mirror];
        const key = pair.map((p) => `${p.x},${p.y},${p.rot}`).sort().join(' ');
        if (seen.has(key) || !fitsAll(defs, ship, pair, site)) continue;
        seen.add(key);
        spots.push(pair);
      }
    }
  }
  return spots;
}

// True if the placements all go on, one after another.
function fitsAll(defs, ship, placements, site) {
  let next = ship;
  for (const placement of placements) {
    if (pieceError(next, defs, placement, null, site)) return false;
    next = put(next, placement);
  }
  return true;
}

// The ship with a piece on that has been checked to fit (as placePiece in
// builder.js puts it on, without working out the hull again).
function put(ship, { type, x, y, rot }) {
  return { ...ship, styling: [...(ship.styling ?? []), { uid: ship.nextUid, type, x, y, rot }], nextUid: ship.nextUid + 1 };
}
