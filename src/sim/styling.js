// Styling pieces (data/styling.json, M23f): wings, fins, a spoiler,
// antennas, a dish, lights and armor plates on the hull's side, and shaped
// pieces, wedges and curves, that the hull's skin wraps (render/hull.js).
// They change how a ship looks from outside and nothing else: no stat, rule
// or boarding map reads them (ROADMAP.md §1, Law 1). A ship keeps them
// apart from its rooms, as styling: [{ uid, type, x, y, rot }], with uids
// from the ship's one count (builder.js), beside its paint and trim.
//
// A piece's placement is a part's, (x, y) the top-left cell of its turned
// footprint, except that rot runs 0 to 7: its quarter turns clockwise
// (rot & 3), plus 4 when it is mirrored, north and south swapped before it
// turns, so a wing sweeps back on either side. Each piece lists the turns
// it takes (`turns`).
//
// Unturned, a piece is against the hull along its south side. One that
// stands on the hull's side has a room beyond each cell of that side (its
// mount). A shaped piece (`shape`) fills its cells below a line from the
// top of its west side to the far end of its south side, those two sides
// its legs: a wedge's line is straight, a curve's an S that leaves and
// meets the hull level. One leg at least is against a room, and the slope
// faces open space.
//
// Where a piece can go (pieceError): on open cells in the frame, beside the
// hull, never on a room, in a gap the hull fills or on another piece; never
// ahead of the bow, where the nose is; never in the cell in front of an
// exhaust, a barrel or a hatch; and up to the frame's cap. Rooms come first:
// a room change that leaves a piece with nothing to hold it takes the piece
// off (misfits, which builder.js applyCommand uses).
import { occupancy, openings, spaceTest } from './builder.js';
import { inFrame } from './frame.js';
import { cellAt } from './grid.js';
import { facingSide, footprint, sideCells } from './modules.js';

const CLOCKWISE = { n: 'e', e: 's', s: 'w', w: 'n' };
const MIRROR = { n: 's', s: 'n', e: 'e', w: 'w' };
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// [width, height] in cells after a turn.
export function pieceFootprint(def, rot) {
  const [w, h] = def.size;
  return rot & 1 ? [h, w] : [w, h];
}

// The cells a placement covers, as [x, y], row by row.
export function pieceCells(def, { x, y, rot }) {
  const [w, h] = pieceFootprint(def, rot);
  const cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.push([x + i, y + j]);
  return cells;
}

// Where a side of the unturned piece ends up after rot.
export function turnSide(side, rot) {
  let turned = rot & 4 ? MIRROR[side] : side;
  for (let i = 0; i < (rot & 3); i++) turned = CLOCKWISE[turned];
  return turned;
}

// The cells of a placement along one of its sides, left to right or top to
// bottom.
export function edgeCells(def, { x, y, rot }, side) {
  const [w, h] = pieceFootprint(def, rot);
  if (side === 'n' || side === 's') return Array.from({ length: w }, (_, i) => [x + i, side === 'n' ? y : y + h - 1]);
  return Array.from({ length: h }, (_, j) => [side === 'w' ? x : x + w - 1, y + j]);
}

// The side a standing piece is against the hull by, after its turn.
export function mountSide(rot) {
  return turnSide('s', rot);
}

// A shaped piece's legs after its turn: [{ side, cells }], each the side
// of its footprint the shape runs right along.
export function pieceLegs(def, placement) {
  return ['w', 's'].map((local) => {
    const side = turnSide(local, placement.rot);
    return { side, cells: edgeCells(def, placement, side) };
  });
}

// Maps a point in the unturned piece's frame (w × h cells, the origin at
// its top left) onto the grid: mirrored, turned, then moved to (x, y).
export function piecePoint(def, { x, y, rot }, [px, py]) {
  let [w, h] = def.size;
  if (rot & 4) py = h - py;
  for (let i = 0; i < (rot & 3); i++) {
    [px, py] = [h - py, px];
    [w, h] = [h, w];
  }
  return [x + px, y + py];
}

// The same for a direction (a normal): mirrored and turned, not moved.
export function pieceDirection({ rot }, [dx, dy]) {
  if (rot & 4) dy = -dy;
  for (let i = 0; i < (rot & 3); i++) [dx, dy] = [-dy, dx];
  return [dx, dy];
}

// How many pieces a curve's outline is drawn with, from leg to leg.
export const CURVE_STEPS = 8;

// A shaped piece's outline on the grid: { region, rim }. region is the
// solid's polygon, [x, y] points; rim is its outer side, the run from the
// end of one leg to the end of the other that faces away from the hull, as
// [{ a, b, normal }] pieces (the hull's tracer, render/hull.js, takes them
// as edges).
export function pieceShape(def, placement) {
  const [w, h] = def.size;
  // Unturned: from the top of the west leg, (0, 0), round to the far end of
  // the south leg, (w, h).
  const rim = [[0, 0]];
  if (def.shape === 'curve') {
    // An S from level to level: it leaves the west leg's top heading east
    // and comes down to the south leg's far end heading east again, so the
    // hull flows on from it with no notch where the room beyond goes on.
    for (let i = 1; i < CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      rim.push([w * t, h * t * t * (3 - 2 * t)]);
    }
  }
  rim.push([w, h]);
  const region = [[0, h], ...rim].map((p) => piecePoint(def, placement, p));
  const corner = piecePoint(def, placement, [0, h]);
  const out = rim.map((p) => piecePoint(def, placement, p));
  const pieces = [];
  for (let i = 0; i + 1 < out.length; i++) {
    const [a, b] = [out[i], out[i + 1]];
    // The normal faces away from the corner the shape is round.
    let normal = [b[1] - a[1], a[0] - b[0]];
    const len = Math.hypot(...normal);
    normal = [normal[0] / len, normal[1] / len];
    const mid = [(a[0] + b[0]) / 2 - corner[0], (a[1] + b[1]) / 2 - corner[1]];
    if (normal[0] * mid[0] + normal[1] * mid[1] < 0) normal = [-normal[0], -normal[1]];
    pieces.push({ a, b, normal });
  }
  return { region, rim: pieces };
}

export function stepSide(x, y, side) {
  const [dx, dy] = STEP[side];
  return [x + dx, y + dy];
}

// The cells beyond a placement's sides that its shape leaves open: a
// shaped piece's slope faces space, so nothing solid may stand across its
// two other sides. None for a standing piece.
function keptOpen(def, placement) {
  if (!def.shape) return [];
  const legs = new Set(['w', 's'].map((local) => turnSide(local, placement.rot)));
  return ['n', 'e', 's', 'w'].filter((side) => !legs.has(side)).flatMap((side) => edgeCells(def, placement, side).map(([x, y]) => stepSide(x, y, side)));
}

// What the hull and the rooms make of the grid, worked out once for a ship
// and shared by every check on it: { room(x, y) uid or null, hull(x, y)
// true on a room or a gap the hull fills, front (the bow's column, or
// null), clear: Map 'x,y' -> { uid, what } of cells kept clear in front of
// an exhaust, a barrel or a hatch }.
export function hullSite(ship, defs) {
  const frame = defs.frames.get(ship.frame);
  const grid = occupancy(ship, defs);
  const isSpace = spaceTest(ship, defs);
  const room = (x, y) => cellAt(grid, x, y) ?? null;
  const hull = (x, y) => room(x, y) !== null || (inFrame(frame, x, y) && !isSpace(x, y));
  let front = null;
  const clear = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    // The bow: the rooms' front column.
    front = Math.max(front ?? -Infinity, module.x + footprint(def, module.rot)[0] - 1);
    const side = facingSide(def, module.rot);
    if (side) {
      for (const [x, y] of sideCells(def, module, side)) clear.set(key(...stepSide(x, y, side)), { uid: module.uid, what: def.facesSpace.what, name: def.name });
    }
  }
  for (const { uid, x, y, side, kind } of openings(ship, defs)) {
    if (kind !== 'hatch') continue;
    const module = ship.modules.find((m) => m.uid === uid);
    clear.set(key(...stepSide(x, y, side)), { uid, what: 'hatch', name: defs.modules.get(module.type).name });
  }
  return { frame, room, hull, front, clear };
}

// Why a piece can't go at a placement, as { rule, message, uids? }, or null
// if it can. `ignore` is the uid of a piece that doesn't count: one being
// moved. `site` is hullSite(ship, defs), if the caller has it.
export function pieceError(ship, defs, placement, ignore = null, site = null) {
  const def = defs.styling?.get(placement.type);
  if (!def) return { rule: 'type', message: `Unknown styling piece "${placement.type}".` };
  if (!def.turns.includes(placement.rot)) return { rule: 'rotation', message: `${def.name} doesn't turn that way.` };
  const frame = defs.frames.get(ship.frame);
  const others = (ship.styling ?? []).filter((piece) => piece.uid !== ignore);
  if (others.length >= (frame?.maxStyling ?? 0)) return { rule: 'cap', message: `The ${frame?.name ?? 'frame'} takes at most ${frame?.maxStyling ?? 0} styling pieces.` };
  return fitError(defs, def, placement, others, site ?? hullSite(ship, defs));
}

// The rules a piece keeps once it is on: all of pieceError's but the cap.
function fitError(defs, def, placement, others, site) {
  const { frame, room, hull, front, clear } = site;
  const cells = pieceCells(def, placement);
  if (front === null) return { rule: 'hull', message: 'Build a room first: styling goes against the hull.' };
  for (const [x, y] of cells) {
    if (!inFrame(frame, x, y)) return { rule: 'bounds', message: `${def.name} would go past the edge of the build area.` };
  }
  for (const [x, y] of cells) {
    const uid = room(x, y);
    if (uid !== null) return { rule: 'room', message: `${def.name} goes beside the hull, not over a room.`, uids: [uid] };
  }
  for (const [x, y] of cells) {
    if (hull(x, y)) return { rule: 'hull', message: `The hull fills that gap: ${def.name} can't go there.` };
  }
  const taken = new Map();
  for (const piece of others) {
    const other = defs.styling.get(piece.type);
    if (!other) continue;
    for (const [x, y] of pieceCells(other, piece)) taken.set(key(x, y), piece);
  }
  for (const [x, y] of cells) {
    const piece = taken.get(key(x, y));
    if (piece) return { rule: 'overlap', message: `${def.name} would overlap the ${defs.styling.get(piece.type).name}.`, uids: [piece.uid] };
  }
  if (cells.some(([x]) => x > front)) return { rule: 'bow', message: `Nothing goes ahead of the bow: the nose is there.` };
  for (const [x, y] of cells) {
    const kept = clear.get(key(x, y));
    if (kept) return { rule: 'clear', message: `${def.name} would be in front of the ${kept.name}'s ${kept.what}.`, uids: [kept.uid] };
  }
  if (def.shape) {
    const legs = pieceLegs(def, placement);
    const against = legs.some(({ side, cells: along }) => along.every(([x, y]) => hull(...stepSide(x, y, side))));
    if (!against) return { rule: 'hull', message: `${def.name} needs a room all along one of its straight sides.` };
    // Its slope faces open space: nothing solid across its other sides.
    for (const [x, y] of keptOpen(def, placement)) {
      if (hull(x, y) || taken.has(key(x, y))) return { rule: 'open', message: `${def.name}'s slope has to face open space.` };
    }
    // A curve leaves its top heading along the hull: the hull mustn't go on
    // up past it there, where the two would meet in a notch.
    if (def.shape === 'curve') {
      const [cx, cy] = piecePoint(def, placement, [-0.5, -0.5]).map(Math.floor);
      if (hull(cx, cy)) return { rule: 'open', message: `${def.name} has to lead off the top of the hull, not run into it.` };
    }
  } else {
    const side = mountSide(placement.rot);
    if (!edgeCells(def, placement, side).every(([x, y]) => hull(...stepSide(x, y, side)))) {
      return { rule: 'hull', message: `${def.name} goes against the hull: its root all along a room's side.` };
    }
  }
  // Nor across another wedge's or curve's slope.
  for (const piece of others) {
    const other = defs.styling.get(piece.type);
    if (!other?.shape) continue;
    const open = new Set(keptOpen(other, piece).map(([x, y]) => key(x, y)));
    if (cells.some(([x, y]) => open.has(key(x, y)))) return { rule: 'open', message: `${def.name} would shut in the ${other.name}'s slope.`, uids: [piece.uid] };
  }
  return null;
}

// The uids of the pieces that no longer fit the ship as it is (a room
// built over one, the room it was against gone, an exhaust now pointing at
// it): a room change takes them off.
export function misfits(ship, defs) {
  const styling = ship.styling ?? [];
  if (!styling.length) return [];
  const site = hullSite(ship, defs);
  return styling
    .filter((piece) => {
      const def = defs.styling?.get(piece.type);
      if (!def) return false;
      return fitError(defs, def, piece, styling.filter((other) => other.uid !== piece.uid), site) !== null;
    })
    .map((piece) => piece.uid);
}

// The uid of the piece covering cell (x, y), or null.
export function pieceAt(ship, defs, x, y) {
  for (const piece of ship.styling ?? []) {
    const def = defs.styling?.get(piece.type);
    if (def && pieceCells(def, piece).some(([cx, cy]) => cx === x && cy === y)) return piece.uid;
  }
  return null;
}

// The turn after rot in a piece's list, round to the first.
export function nextTurn(def, rot) {
  const at = def.turns.indexOf(rot);
  return def.turns[(at + 1) % def.turns.length];
}

// The placement of a piece under point (px, py) that fits there, trying
// `rot` first: each spot of its footprint that covers the cell under the
// point, the one centred nearest the point first; then the piece's other
// turns the same way (unless `turnsToo` is false). Failing those, any spot
// that comes within `reach` cells of the point, the nearest first (so a
// tap on the hull finds its side). If none fits, the first try, for a
// ghost that says why. `site` as in pieceError.
export function fitPiece(ship, defs, type, rot, px, py, { ignore = null, turnsToo = true, site = null, reach = 0 } = {}) {
  const def = defs.styling.get(type);
  const frame = defs.frames.get(ship.frame);
  const here = site ?? hullSite(ship, defs);
  const [cx, cy] = [Math.floor(px), Math.floor(py)];
  const turns = turnsToo ? [rot, ...rotations(def.turns, rot)] : [rot];
  const fits = (placement) => !pieceError(ship, defs, placement, ignore, here);
  let first = null;
  for (const turn of turns) {
    const [w, h] = pieceFootprint(def, turn);
    const spots = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const [x, y] = [Math.max(0, Math.min(cx - i, frame.width - w)), Math.max(0, Math.min(cy - j, frame.height - h))];
        spots.push({ x, y, far: Math.hypot(x + w / 2 - px, y + h / 2 - py) });
      }
    }
    spots.sort((a, b) => a.far - b.far || a.y - b.y || a.x - b.x);
    for (const { x, y } of spots) {
      const placement = { type, x, y, rot: turn };
      first ??= placement;
      if (fits(placement)) return placement;
    }
  }
  if (reach > 0) {
    const near = [];
    for (const turn of turns) {
      const [w, h] = pieceFootprint(def, turn);
      for (let y = Math.max(0, cy - h + 1 - reach); y <= Math.min(frame.height - h, cy + reach); y++) {
        for (let x = Math.max(0, cx - w + 1 - reach); x <= Math.min(frame.width - w, cx + reach); x++) {
          // How far the point is from the footprint (none inside it).
          const gap = Math.hypot(Math.max(x - px, 0, px - (x + w)), Math.max(y - py, 0, py - (y + h)));
          if (gap <= reach) near.push({ placement: { type, x, y, rot: turn }, gap, far: Math.hypot(x + w / 2 - px, y + h / 2 - py) });
        }
      }
    }
    near.sort((a, b) => a.gap - b.gap || a.far - b.far);
    for (const { placement } of near) if (fits(placement)) return placement;
  }
  return first;
}

// The turns after `rot` in the list, round in order.
function rotations(turns, rot) {
  const at = turns.indexOf(rot);
  return at < 0 ? turns.filter((t) => t !== rot) : [...turns.slice(at + 1), ...turns.slice(0, at)];
}

function key(x, y) {
  return `${x},${y}`;
}
