// The builder's 3D blueprint of a ship: the hull's rim and nose, every room
// with its walls and doorways, the fittings inside, the slots still free on
// the frame, and what the player is doing (the selection, a part being
// placed). Pure: ship data in, models (mesh.js) of named styles out, which
// the painter draws with the blueprint styles.
import { frameCells } from '../sim/frame.js';
import { footprint, placedDoors } from '../sim/modules.js';
import { box, closed, createModel, cylinder, face, glow, mapModel, merge, polyline, rect } from './mesh.js';
import { palette } from './palette.js';
import { placeModel, propsModel } from './props.js';

export const WALL = 0.26; // room walls
export const RIM = 0.4; // the hull's rim
export const INSET = 0.07; // how far room walls sit inside their cells
export const DOOR = 0.38; // a doorway's width
export const HOVER = 0.55; // how high a part being placed floats

// The ship and its overlays. Returns { model, labels }.
// input: {
//   ship, defs, frame,
//   doors     doorStates(ship, defs)
//   hull      traceHull(ship, defs)
//   selected  uid or null
//   lifted    uid of a part being dragged (left out, its floor dashed) or null
//   flagged   Set of uids to outline in red (loose, or off the frame)
// }
export function blueprintScene(input) {
  const { ship, defs, frame, doors, hull } = input;
  const model = createModel();
  const labels = [];
  const occupied = new Set(hull.cells.map(([x, y]) => `${x},${y}`));

  for (const [x, y] of frameCells(frame)) {
    if (!occupied.has(`${x},${y}`)) slot(model, x, y);
  }
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

// The blueprint grid under the ship, every half cell, reaching `margin`
// cells past the frame so it fills the view as the ship turns.
export function gridModel(frame, margin = 6) {
  const model = createModel();
  const [x0, x1, y0, y1] = [-margin, frame.width + margin, -margin, frame.height + margin];
  for (let x = x0; x <= x1; x += 0.5) polyline(model, Number.isInteger(x) ? 'gridMajor' : 'gridMinor', [[x, y0, -0.01], [x, y1, -0.01]]);
  for (let y = y0; y <= y1; y += 0.5) polyline(model, Number.isInteger(y) ? 'gridMajor' : 'gridMinor', [[x0, y, -0.01], [x1, y, -0.01]]);
  return model;
}

// A free cell on the frame: a dashed square on the deck.
function slot(model, x, y) {
  const [a, b] = [0.1, 0.9];
  const k = 0.12;
  const pts = [
    [x + a + k, y + a], [x + b - k, y + a], [x + b, y + a + k], [x + b, y + b - k],
    [x + b - k, y + b], [x + a + k, y + b], [x + a, y + b - k], [x + a, y + a + k],
  ].map(([px, py]) => [px, py, 0.002]);
  polyline(model, 'slot', closed(pts));
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

// One room: floor, walls broken by doorways, door markers and fittings.
// `doors` are the module's entries from doorStates; a ghost passes its own
// sockets with no state, and gets a doorway at each.
function room(def, module, doors) {
  const model = createModel();
  const [x0, y0, x1, y1] = roomBounds(def, module);
  rect(model, [x0, y0], [x1, y1], 0, { fill: 'roomFloor', edge: 'roomEdge' });
  const sides = { n: [], e: [], s: [], w: [] };
  const airlock = def.tags.includes('airlock');
  for (const door of doors) {
    const at = door.side === 'n' || door.side === 's' ? door.x + 0.5 : door.y + 0.5;
    const open = !door.state || door.state === 'linked' || (airlock && door.state === 'outside');
    sides[door.side].push({ at, style: open ? null : DOOR_STYLE[door.state] });
  }
  wallRun(model, sides.n, x0, x1, (t) => [t, y0]);
  wallRun(model, sides.s, x0, x1, (t) => [t, y1]);
  wallRun(model, sides.w, y0, y1, (t) => [x0, t]);
  wallRun(model, sides.e, y0, y1, (t) => [x1, t]);
  return merge(model, placeModel(propsModel(def), def, module));
}

const DOOR_STYLE = { open: 'doorOpen', blocked: 'doorBlocked', outside: 'doorSealed' };

// The wall along one side, from t0 to t1, as point(t) on the deck. Doorways
// (style null) leave a gap framed by posts; other sockets are a coloured
// panel in the wall that shows why the door doesn't open.
function wallRun(model, doors, t0, t1, point) {
  const cuts = doors.filter((d) => !d.style).map((d) => d.at).sort((a, b) => a - b);
  const stops = [t0];
  for (const at of cuts) stops.push(at - DOOR / 2, at + DOOR / 2);
  stops.push(t1);
  for (let i = 0; i < stops.length; i += 2) {
    const [a, b] = [point(stops[i]), point(stops[i + 1])];
    face(model, 'wallFace', [[...a, 0], [...b, 0], [...b, WALL], [...a, WALL]]);
    polyline(model, 'wallTop', [[...a, WALL], [...b, WALL]]);
    if (i > 0) polyline(model, 'wallPost', [[...a, 0], [...a, WALL]]);
    if (i + 2 < stops.length) polyline(model, 'wallPost', [[...b, 0], [...b, WALL]]);
  }
  for (const door of doors.filter((d) => d.style)) {
    const [a, b] = [point(door.at - DOOR / 2), point(door.at + DOOR / 2)];
    face(model, door.style, [[...a, 0], [...b, 0], [...b, WALL], [...a, WALL]]);
    polyline(model, door.style, [[...a, WALL + 0.004], [...b, WALL + 0.004]]);
  }
}

// What sticks out of the hull: nozzles with their exhaust, gun barrels and
// docking collars.
function greebles(model, hull) {
  for (const { x, y, side } of hull.nozzles) {
    const [dx, dy] = STEP[side];
    const start = [x + 0.5 + dx * 0.48, y + 0.5 + dy * 0.48, 0.24];
    cylinder(model, start, 0.15, (dx || dy) * 0.44, { axis: dx ? 'x' : 'y', r1: 0.3, fill: null, ends: 'nozzleFace', edge: 'propEdge' });
    glow(model, [x + 0.5 + dx * 1.25, y + 0.5 + dy * 1.25, 0.24], 0.36, palette.bpLine);
  }
  for (const { x, y, side } of hull.barrels) {
    const [dx, dy] = STEP[side];
    for (const off of [-0.06, 0.06]) {
      const [cx, cy] = [x + 0.5 + (dy ? off : 0), y + 0.5 + (dx ? off : 0)];
      const from = [cx + dx * 0.5, cy + dy * 0.5];
      const to = [cx + dx * 1.05, cy + dy * 1.05];
      const [u, v] = [dy ? 0.025 : 0, dx ? 0.025 : 0];
      box(model, [Math.min(from[0], to[0]) - u, Math.min(from[1], to[1]) - v, 0.22], [Math.max(from[0], to[0]) + u, Math.max(from[1], to[1]) + v, 0.27], { fill: null, top: null, edge: 'propEdge' });
    }
  }
  for (const { x, y, side } of hull.collars) {
    const [dx, dy] = STEP[side];
    const [cx, cy] = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5];
    const [along, out] = [0.22, 0.16];
    const a = [cx - (dy ? along : 0) + Math.min(0, dx * out), cy - (dx ? along : 0) + Math.min(0, dy * out)];
    const b = [cx + (dy ? along : 0) + Math.max(0, dx * out), cy + (dx ? along : 0) + Math.max(0, dy * out)];
    box(model, [...a, 0], [...b, 0.22], { fill: 'propFace', edge: 'propEdge' });
  }
}

const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// A part being placed floats above its spot in green (red where it can't
// go), with lines down to a dashed outline on the deck.
function floating(model, defs, placement, ok) {
  const def = defs.modules.get(placement.type);
  const tone = ok ? 'ghost' : 'ghostBad';
  const sockets = placedDoors(def, placement).map(([x, y, side]) => ({ x, y, side }));
  const lifted = mapModel(room(def, placement, sockets), ([x, y, z]) => [x, y, z + HOVER]);
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
