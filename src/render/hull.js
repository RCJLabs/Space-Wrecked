// The hull around a ship, worked out from its layout. The body follows the
// occupied cells, fairings slope across the corners between them, a nose
// caps the front, and engines, guns and airlocks get the parts that stick
// out: nozzles, barrels and docking collars. Pure geometry on the deck, in
// cells (the board's world units); the 3D scenes raise it into walls. Ships
// fly toward +x.
import { spaceTest } from '../sim/builder.js';
import { createGrid, exteriorOf, SIDES, step, withCells } from '../sim/grid.js';
import { facingSide, hasTag, placedCells, sideCells } from '../sim/modules.js';

// Room the camera keeps around the ship, in cells, for what sticks out of
// the hull: nozzles at the stern, the nose at the front, barrels and collars
// above and below.
export const OVERHANG = { left: 1.1, right: 1.7, top: 0.7, bottom: 0.7 };

// The longest a nose gets, in cells.
export const NOSE_MAX = 1.5;

const NORMAL = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// Returns plain data, in cells:
//   cells     [x, y] under a module, row by row
//   pockets   [x, y] empty cells the hull closes over: modules on three or
//             four sides, or shut in by the ship, out of reach of open
//             space (as the rules have them: builder.js spaceTest)
//   fairings  triangles [[x, y] × 3] across empty corners with modules on
//             two adjacent sides; the middle point is the inside corner
//   edges     the outline as { a, b, normal }: segments [x, y] to [x, y]
//             with the outward normal, fairing slopes included
//   noses     { x, y0, y1, length }: one per run of cells on the front
//             column; x is the hull's front edge, y0 to y1 its span
//   nozzles   { x, y, side } engine cells whose exhaust side faces space
//   barrels   { x, y, side } weapon cells whose muzzle side faces space
//   collars   { x, y, side } an airlock's hatches: one in the middle of each
//             side that faces space (builder.js joins())
//   lights    { x, y, side: 'port' | 'starboard' } at the stern corners
export function traceHull(ship, defs) {
  const owners = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    for (const [x, y] of placedCells(def, module)) owners.set(key(x, y), module.uid);
  }
  const hull = { cells: [], pockets: [], fairings: [], edges: [], noses: [], nozzles: [], barrels: [], collars: [], lights: [] };
  if (!owners.size) return hull;

  const occupied = (x, y) => owners.has(key(x, y));
  hull.cells = [...owners.keys()].map((k) => k.split(',').map(Number)).sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
  const xs = hull.cells.map(([x]) => x);
  const ys = hull.cells.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  // Open space: empty cells joined to the ring of cells round the ship.
  const [ox, oy] = [minX - 1, minY - 1];
  const around = withCells(createGrid(maxX - minX + 3, maxY - minY + 3, false), hull.cells.map(([x, y]) => [x - ox, y - oy]), true);
  const open = exteriorOf(around, (taken) => !taken);

  const pocketKeys = new Set();
  const corners = [];
  for (let y = minY - 1; y <= maxY + 1; y++) {
    for (let x = minX - 1; x <= maxX + 1; x++) {
      if (occupied(x, y)) continue;
      const n = occupied(x, y - 1);
      const e = occupied(x + 1, y);
      const s = occupied(x, y + 1);
      const w = occupied(x - 1, y);
      const count = n + e + s + w;
      if (count >= 3 || !open(x - ox, y - oy)) {
        hull.pockets.push([x, y]);
        pocketKeys.add(key(x, y));
      } else if (count === 2 && !(n && s) && !(e && w)) {
        corners.push({ x, y, e, s });
      }
    }
  }
  const solid = (x, y) => occupied(x, y) || pocketKeys.has(key(x, y));

  // The outline: every side of the body that faces open space...
  const edges = new Map();
  for (const [x, y] of [...hull.cells, ...hull.pockets]) {
    for (const side of SIDES) {
      if (solid(...step(x, y, side))) continue;
      const [a, b] = sideOf(x, y, side);
      edges.set(edgeKey(a, b), { a, b, normal: NORMAL[side] });
    }
  }
  // ...except where a fairing slopes across a corner instead. Its inside
  // corner is where the two neighbours' walls meet; the slope runs from the
  // far end of one wall to the far end of the other.
  for (const { x, y, e, s } of corners) {
    const cx = e ? x + 1 : x;
    const cy = s ? y + 1 : y;
    const a = [cx, s ? y : y + 1];
    const b = [e ? x : x + 1, cy];
    hull.fairings.push([a, [cx, cy], b]);
    edges.delete(edgeKey([cx, y], [cx, y + 1]));
    edges.delete(edgeKey([x, cy], [x + 1, cy]));
    edges.set(edgeKey(a, b), { a, b, normal: [e ? -Math.SQRT1_2 : Math.SQRT1_2, s ? -Math.SQRT1_2 : Math.SQRT1_2] });
  }
  hull.edges = [...edges.values()];

  // A nose on each run of cells in the front column.
  let start = null;
  for (let y = minY; y <= maxY + 1; y++) {
    if (y <= maxY && occupied(maxX, y)) {
      if (start === null) start = y;
    } else if (start !== null) {
      hull.noses.push({ x: maxX + 1, y0: start, y1: y, length: Math.min(NOSE_MAX, 0.6 + 0.25 * (y - start)) });
      start = null;
    }
  }

  // Engines blow and guns point out of their facesSpace side, where it
  // faces space, which is the rule the checklist holds them to.
  const isSpace = spaceTest(ship, defs);
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const away = facingSide(def, module.rot);
    const out = away ? sideCells(def, module, away).filter(([x, y]) => isSpace(...step(x, y, away))) : [];
    if (hasTag(def, 'engine')) for (const [x, y] of out) hull.nozzles.push({ x, y, side: away });
    if (hasTag(def, 'weapon')) for (const [x, y] of out) hull.barrels.push({ x, y, side: away });
    if (hasTag(def, 'airlock')) {
      for (const side of SIDES) {
        const open = sideCells(def, module, side).filter(([x, y]) => isSpace(...step(x, y, side)));
        if (open.length) hull.collars.push({ ...pointOf(open[Math.floor((open.length - 1) / 2)]), side });
      }
    }
  }

  // Running lights: red to port (the top, flying right), green to starboard.
  const stern = hull.cells.filter(([x]) => x === minX).map(([, y]) => y);
  hull.lights.push(
    { x: minX + 0.08, y: Math.min(...stern) + 0.12, side: 'port' },
    { x: minX + 0.08, y: Math.max(...stern) + 0.88, side: 'starboard' },
  );
  return hull;
}

function pointOf([x, y]) {
  return { x, y };
}

// The two ends of a cell's side, in order around the cell clockwise.
function sideOf(x, y, side) {
  if (side === 'n') return [[x, y], [x + 1, y]];
  if (side === 'e') return [[x + 1, y], [x + 1, y + 1]];
  if (side === 's') return [[x + 1, y + 1], [x, y + 1]];
  return [[x, y + 1], [x, y]];
}

function edgeKey([ax, ay], [bx, by]) {
  return ax < bx || (ax === bx && ay < by) ? `${ax},${ay},${bx},${by}` : `${bx},${by},${ax},${ay}`;
}

function key(x, y) {
  return `${x},${y}`;
}
