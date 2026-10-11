// The builder's 3D blueprint of a ship: the hull's rim and nose, every room
// with its walls and doorways, the fittings inside, and what the player is
// doing (the selection, a part being placed). Pure: ship data in, models
// (mesh.js) of named styles out, which the painter draws with the blueprint
// styles. Units are cells, one per battle tile.
import { footprint } from '../sim/modules.js';
import { box, closed, createModel, cylinder, face, glow, mapModel, merge, polyline, rect } from './mesh.js';
import { palette } from './palette.js';
import { placeModel, propsModel } from './props.js';

export const WALL = 0.44; // room walls
export const RIM = 0.7; // the hull's rim
export const INSET = 0.1; // how far room walls sit inside their cells
export const DOOR = 0.6; // a doorway's width
export const HOVER = 1; // how high a part being placed floats

// The ship and its overlays. Returns { model, labels }.
// input: {
//   ship, defs, frame,
//   doors     openings(ship, defs): the gaps in each room's walls
//   hull      traceHull(ship, defs)
//   selected  uid or null
//   lifted    uid of a part being dragged (left out, its floor dashed) or null
//   flagged   Set of uids to outline in red (loose, or off the frame)
// }
export function blueprintScene(input) {
  const { ship, defs, doors, hull } = input;
  const model = createModel();
  const labels = [];
  deckAndRim(model, hull);

  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const [x0, y0, x1, y1] = roomBounds(def, module);
    if (module.uid === input.lifted) {
      rect(model, [x0, y0], [x1, y1], 0.004, { edge: 'liftedEdge' });
      continue;
    }
    const mine = doors.filter((d) => d.uid === module.uid);
    merge(model, room(def, module, mine));
    if (input.flagged?.has(module.uid)) rect(model, [x0, y0], [x1, y1], 0.006, { edge: 'flagEdge' });
    if (module.uid === input.selected) {
      rect(model, [x0, y0], [x1, y1], 0.01, { fill: 'selectFace', edge: 'selectEdge' });
      polyline(model, 'selectEdge', closed([[x0, y0, WALL], [x1, y0, WALL], [x1, y1, WALL], [x0, y1, WALL]]));
      labels.push({ at: [(x0 + x1) / 2, (y0 + y1) / 2, WALL], text: def.name, tone: 'info' });
    }
  }
  greebles(model, hull);
  return { model, labels };
}

// A part being placed, drawn apart from the ship so a drag rebuilds only
// this. input: { ship, defs, ghost: { placement, ok, blockers: [uid] } }.
// Returns { model, label }.
export function ghostScene({ ship, defs, ghost: { placement, ok, blockers = [] } }) {
  const model = createModel();
  for (const uid of blockers) {
    const module = ship.modules.find((m) => m.uid === uid);
    const def = module && defs.modules.get(module.type);
    if (!def) continue;
    const [x0, y0, x1, y1] = roomBounds(def, module);
    rect(model, [x0, y0], [x1, y1], 0.008, { fill: 'blockFace', edge: 'blockEdge' });
  }
  const label = floating(model, defs, placement, ok);
  return { model, label };
}

// The blueprint grid under the ship: a line every cell, a heavier one every
// MAJOR cells, reaching `margin` cells past the frame so it fills the view
// as the ship turns, and the frame's edge, dashed: where building stops.
export const MAJOR = 4;
export function gridModel(frame, margin = 8) {
  const model = createModel();
  const [x0, x1, y0, y1] = [-margin, frame.width + margin, -margin, frame.height + margin];
  for (let x = x0; x <= x1; x++) polyline(model, x % MAJOR === 0 ? 'gridMajor' : 'gridMinor', [[x, y0, -0.01], [x, y1, -0.01]]);
  for (let y = y0; y <= y1; y++) polyline(model, y % MAJOR === 0 ? 'gridMajor' : 'gridMinor', [[x0, y, -0.01], [x1, y, -0.01]]);
  polyline(model, 'yardEdge', closed([[0, 0, 0.002], [frame.width, 0, 0.002], [frame.width, frame.height, 0.002], [0, frame.height, 0.002]]));
  return model;
}

function deckAndRim(model, hull) {
  for (const [x, y] of [...hull.cells, ...hull.pockets]) face(model, 'deck', [[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]);
  for (const tri of hull.fairings) face(model, 'deck', tri.map(([x, y]) => [x, y, 0]));
  for (const { a, b } of hull.edges) {
    face(model, 'rimFace', [[...a, 0], [...b, 0], [...b, RIM], [...a, RIM]]);
    polyline(model, 'rimTop', [[...a, RIM], [...b, RIM]]);
    polyline(model, 'rimBase', [[...a, 0], [...b, 0]]);
  }
  for (const nose of hull.noses) {
    const mid = (nose.y0 + nose.y1) / 2;
    const tip = [nose.x + nose.length, mid, RIM * 0.45];
    const base = [[nose.x, nose.y0, 0], [nose.x, nose.y0, RIM], [nose.x, nose.y1, RIM], [nose.x, nose.y1, 0]];
    for (let i = 0; i < 4; i++) {
      face(model, 'noseFace', [base[i], base[(i + 1) % 4], tip]);
      polyline(model, i === 0 || i === 3 ? 'rimBase' : 'rimTop', [base[i], tip]);
    }
  }
}

// [x0, y0, x1, y1]: a module's floor inside its walls.
export function roomBounds(def, module) {
  const [w, h] = footprint(def, module.rot);
  return [module.x + INSET, module.y + INSET, module.x + w - INSET, module.y + h - INSET];
}

// One room: floor, walls broken by its openings, and fittings. `gaps` are
// the module's entries from openings(): a doorway or hatch is a DOOR-wide
// gap framed by posts; an open side (corridors side by side) has no wall,
// and the floor and the walls beside it run on to the cell's edge so a run
// of corridors reads as one. A ghost passes no gaps.
function room(def, module, gaps) {
  const model = createModel();
  const [w, h] = footprint(def, module.rot);
  const [cx0, cy0, cx1, cy1] = [module.x, module.y, module.x + w, module.y + h];
  const [x0, y0, x1, y1] = roomBounds(def, module);
  const open = { n: [], e: [], s: [], w: [] };
  const doors = { n: [], e: [], s: [], w: [] };
  for (const gap of gaps) {
    const at = gap.side === 'n' || gap.side === 's' ? gap.x : gap.y;
    if (gap.kind === 'open') open[gap.side].push([at, at + 1]);
    else doors[gap.side].push(at + 0.5);
  }
  // Out to the cell's edge on an open side, else inset.
  const [fx0, fy0, fx1, fy1] = [open.w.length ? cx0 : x0, open.n.length ? cy0 : y0, open.e.length ? cx1 : x1, open.s.length ? cy1 : y1];
  rect(model, [fx0, fy0], [fx1, fy1], 0, { fill: 'roomFloor', edge: open.n.length + open.e.length + open.s.length + open.w.length ? null : 'roomEdge' });
  wallRun(model, doors.n, open.n, fx0, fx1, (t) => [t, y0]);
  wallRun(model, doors.s, open.s, fx0, fx1, (t) => [t, y1]);
  wallRun(model, doors.w, open.w, fy0, fy1, (t) => [x0, t]);
  wallRun(model, doors.e, open.e, fy0, fy1, (t) => [x1, t]);
  return merge(model, placeModel(propsModel(def), def, module));
}

// The wall along one side, from t0 to t1, as point(t) on the deck, less a
// DOOR-wide gap at each doorway (framed by posts) and every open span.
function wallRun(model, doors, spans, t0, t1, point) {
  const cuts = [...doors.map((at) => [at - DOOR / 2, at + DOOR / 2, true]), ...spans.map(([a, b]) => [a, b, false])].sort((a, b) => a[0] - b[0]);
  let from = t0;
  let post = false; // the piece starting at `from` follows a doorway
  const piece = (a, b, postA, postB) => {
    if (b - a < 1e-6) return;
    const [p, q] = [point(a), point(b)];
    face(model, 'wallFace', [[...p, 0], [...q, 0], [...q, WALL], [...p, WALL]]);
    polyline(model, 'wallTop', [[...p, WALL], [...q, WALL]]);
    if (postA) polyline(model, 'wallPost', [[...p, 0], [...p, WALL]]);
    if (postB) polyline(model, 'wallPost', [[...q, 0], [...q, WALL]]);
  };
  for (const [a, b, door] of cuts) {
    piece(from, Math.min(a, t1), post, door);
    from = Math.max(from, b);
    post = door;
  }
  piece(from, t1, post, false);
}

// What sticks out of the hull: nozzles with their exhaust, gun barrels and
// docking collars.
function greebles(model, hull) {
  for (const { x, y, side } of hull.nozzles) {
    const [dx, dy] = STEP[side];
    const start = [x + 0.5 + dx * 0.48, y + 0.5 + dy * 0.48, 0.36];
    cylinder(model, start, 0.17, (dx || dy) * 0.5, { axis: dx ? 'x' : 'y', r1: 0.32, fill: null, ends: 'nozzleFace', edge: 'propEdge' });
    glow(model, [x + 0.5 + dx * 1.15, y + 0.5 + dy * 1.15, 0.36], 0.4, palette.bpLine);
  }
  for (const { x, y, side } of hull.barrels) {
    const [dx, dy] = STEP[side];
    for (const off of [-0.1, 0.1]) {
      const [cx, cy] = [x + 0.5 + (dy ? off : 0), y + 0.5 + (dx ? off : 0)];
      const from = [cx + dx * 0.5, cy + dy * 0.5];
      const to = [cx + dx * 1.2, cy + dy * 1.2];
      const [u, v] = [dy ? 0.04 : 0, dx ? 0.04 : 0];
      box(model, [Math.min(from[0], to[0]) - u, Math.min(from[1], to[1]) - v, 0.4], [Math.max(from[0], to[0]) + u, Math.max(from[1], to[1]) + v, 0.48], { fill: null, top: null, edge: 'propEdge' });
    }
  }
  for (const { x, y, side } of hull.collars) {
    const [dx, dy] = STEP[side];
    const [cx, cy] = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5];
    const [along, out] = [0.34, 0.22];
    const a = [cx - (dy ? along : 0) + Math.min(0, dx * out), cy - (dx ? along : 0) + Math.min(0, dy * out)];
    const b = [cx + (dy ? along : 0) + Math.max(0, dx * out), cy + (dx ? along : 0) + Math.max(0, dy * out)];
    box(model, [...a, 0], [...b, 0.4], { fill: 'propFace', edge: 'propEdge' });
  }
}

const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// A part being placed floats above its spot in green (red where it can't
// go), with lines down to a dashed outline on the deck.
function floating(model, defs, placement, ok) {
  const def = defs.modules.get(placement.type);
  const tone = ok ? 'ghost' : 'ghostBad';
  const lifted = mapModel(room(def, placement, []), ([x, y, z]) => [x, y, z + HOVER]);
  lifted.faces = lifted.faces.map((f) => ({ ...f, style: `${tone}Face` }));
  lifted.lines = lifted.lines.map((l) => ({ ...l, style: `${tone}Line` }));
  lifted.glows = [];
  merge(model, lifted);
  const [w, h] = footprint(def, placement.rot);
  const [x0, y0, x1, y1] = [placement.x, placement.y, placement.x + w, placement.y + h];
  rect(model, [x0 + 0.03, y0 + 0.03], [x1 - 0.03, y1 - 0.03], 0.012, { fill: `${tone}Target`, edge: `${tone}Target` });
  for (const [x, y] of [[x0 + INSET, y0 + INSET], [x1 - INSET, y0 + INSET], [x1 - INSET, y1 - INSET], [x0 + INSET, y1 - INSET]]) {
    polyline(model, `${tone}Drop`, [[x, y, HOVER], [x, y, 0.012]]);
  }
  return { at: [(x0 + x1) / 2, (y0 + y1) / 2, HOVER + WALL], text: def.name, tone: ok ? 'good' : 'bad' };
}
