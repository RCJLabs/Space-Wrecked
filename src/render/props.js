// The 3D fittings in each kind of room: the reactor's core, the engine's
// turbine, bunks, tanks, the gun turret. Each drawing is a model (mesh.js)
// in the module's own unrotated frame, size[0] × size[1] cells with the
// origin at the top left: the bridge's front, the gun's muzzle and the
// quarters' windows face north, the engine's exhaust faces west.
// placeModel turns and moves it onto the ship. A module type without a
// drawing here gets one from its interior template, so new content draws
// without an engine edit.
import { footprint, interiorRows } from '../sim/modules.js';
import { box, circle, closed, createModel, cylinder, glow, mapModel, polyline, rect } from './mesh.js';
import { palette } from './palette.js';

const PROP = { fill: 'propFace', edge: 'propEdge' };
const GLASS = { fill: 'glass', edge: 'propEdge' };
const CORE = { fill: null, ends: 'coreFace', edge: 'coreEdge' };
const CAN = { fill: null, ends: 'propFace', edge: 'propEdge' };

// The module's fittings as a model, unrotated.
export function propsModel(def) {
  const model = createModel();
  const draw = DRAWINGS[def.id];
  if (draw) draw(model, def);
  else fromTemplate(model, def);
  return model;
}

// A model in a module's unrotated frame, turned and moved to a placement
// { x, y, rot }: each quarter turn clockwise maps (x, y) in a w × h frame to
// (h - y, x), the way footprints and interiors turn.
export function placeModel(model, def, { x, y, rot }) {
  let [w, h] = def.size;
  const turns = [];
  for (let i = 0; i < rot; i++) {
    turns.push(h);
    [w, h] = [h, w];
  }
  return mapModel(model, ([px, py, pz]) => {
    for (const height of turns) [px, py] = [height - py, px];
    return [x + px, y + py, pz];
  });
}

const DRAWINGS = {
  bridge(m) {
    box(m, [0.15, 0.12, 0], [1.85, 0.36, 0.2], PROP); // console bank along the front
    for (const x of [0.5, 1, 1.5]) rect(m, [x - 0.15, 0.17], [x + 0.15, 0.27], 0.201, { fill: 'glass' });
    for (const x of [0.62, 1.38]) cylinder(m, [x, 0.6, 0], 0.1, 0.14, CAN); // crew seats
    cylinder(m, [1, 0.7, 0], 0.12, 0.17, CAN); // the captain's chair
  },
  reactor(m) {
    cylinder(m, [1, 1, 0], 0.55, 0.42, { ...CAN, ribs: 8 }); // housing
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const d = Math.SQRT1_2;
      polyline(m, 'propEdge', [[1 + dx * 0.55 * d, 1 + dy * 0.55 * d, 0.36], [1 + dx * 0.82 * d, 1 + dy * 0.82 * d, 0]]);
    }
    cylinder(m, [1, 1, 0], 0.24, 0.78, CORE); // the core
    glow(m, [1, 1, 0.8], 0.42, palette.bpGlow);
  },
  engine(m) {
    cylinder(m, [0.18, 0.5, 0.24], 0.2, 1.3, { ...CAN, axis: 'x' }); // turbine
    cylinder(m, [0.3, 0.5, 0.24], 0.09, 0.02, { axis: 'x', ends: 'coreFace', edge: 'coreEdge' });
    for (const y of [0.36, 0.64]) polyline(m, 'propFine', [[1.48, y, 0.12], [1.66, y, 0.12]]); // fuel lines
    box(m, [1.66, 0.3, 0], [1.86, 0.7, 0.22], PROP); // valve block
  },
  corridor(m) {
    for (const y of [0.3, 0.5, 0.7]) polyline(m, 'floorMark', [[0.15, y, 0.005], [0.85, y, 0.005]]);
  },
  airlock(m) {
    rect(m, [0.16, 0.16], [0.84, 0.84], 0.005, { edge: 'floorDash' }); // keep clear
    cylinder(m, [0.5, 0.5, 0], 0.22, 0.03, CAN); // the hatch
    polyline(m, 'propFine', [[0.38, 0.38, 0.031], [0.62, 0.62, 0.031]]);
    polyline(m, 'propFine', [[0.38, 0.62, 0.031], [0.62, 0.38, 0.031]]);
  },
  quarters(m) {
    for (const y of [0.13, 0.55]) {
      box(m, [0.08, y, 0], [0.62, y + 0.32, 0.1], PROP); // bunk
      box(m, [0.08, y, 0.24], [0.62, y + 0.32, 0.28], PROP); // and the one above
    }
    cylinder(m, [1.3, 0.45, 0], 0.15, 0.16, CAN); // table
    box(m, [1.7, 0.16, 0], [1.88, 0.84, 0.36], PROP); // lockers
  },
  lifesupport(m) {
    for (const x of [0.3, 0.7]) cylinder(m, [x, 0.3, 0], 0.13, 0.34, { fill: null, ends: 'glass', edge: 'propEdge' }); // oxygen
    box(m, [0.25, 0.56, 0], [0.75, 0.86, 0.16], PROP); // scrubber
    circle(m, 'propFine', [0.5, 0.71, 0.161], 0.1);
  },
  weapon(m) {
    cylinder(m, [0.5, 0.56, 0], 0.24, 0.18, CAN); // turret ring
    box(m, [0.38, 0.42, 0.18], [0.62, 0.7, 0.3], PROP); // breech
    for (const x of [0.44, 0.56]) box(m, [x - 0.025, 0, 0.22], [x + 0.025, 0.42, 0.27], { fill: null, top: null, edge: 'propEdge' });
  },
  cargo(m) {
    for (const [x, y] of [[0.3, 0.3], [1.7, 0.3], [0.3, 1.7], [1.7, 1.7]]) box(m, [x - 0.17, y - 0.17, 0], [x + 0.17, y + 0.17, 0.3], PROP);
    box(m, [1.56, 0.16, 0.3], [1.84, 0.44, 0.52], PROP); // stacked
    box(m, [0.62, 0.62, 0], [1.38, 1.38, 0.03], { fill: null, top: 'propFace', edge: 'propFine' }); // cargo lift
    for (const y of [1.08, 0.92]) polyline(m, 'floorMark', [[0.82, y + 0.08, 0.031], [1, y - 0.08, 0.031], [1.18, y + 0.08, 0.031]]);
  },
  medbay(m) {
    box(m, [0.12, 0.12, 0], [0.88, 0.42, 0.16], PROP); // treatment bed
    box(m, [0.14, 0.16, 0.16], [0.3, 0.38, 0.2], PROP);
    box(m, [1.08, 0.1, 0], [1.42, 0.32, 0.24], PROP); // console
    rect(m, [1.12, 0.14], [1.38, 0.24], 0.241, { fill: 'glass' });
    rect(m, [1.54, 0.44], [1.66, 0.8], 0.005, { fill: 'glass', edge: 'propFine' }); // the cross
    rect(m, [1.42, 0.56], [1.78, 0.68], 0.005, { fill: 'glass', edge: 'propFine' });
  },
  armory(m) {
    box(m, [0.12, 0.12, 0], [0.56, 0.6, 0.4], PROP); // weapon rack
    for (const x of [0.22, 0.34, 0.46]) polyline(m, 'propFine', [[x, 0.6, 0.06], [x, 0.6, 0.34]]);
    box(m, [0.62, 0.38, 0], [0.86, 0.66, 0.16], PROP); // ammunition
  },
  shield(m) {
    cylinder(m, [0.6, 0.38, 0], 0.17, 0.12, CAN); // emitter base
    cylinder(m, [0.6, 0.38, 0.12], 0.05, 0.42, { fill: null, ends: 'glass', edge: 'propEdge', ribs: 3 });
    circle(m, 'fieldRing', [0.6, 0.38, 0.44], 0.24);
    circle(m, 'fieldRing', [0.6, 0.38, 0.54], 0.15);
    glow(m, [0.6, 0.38, 0.56], 0.2, palette.bpLine);
    box(m, [0.12, 0.5, 0], [0.28, 0.72, 0.2], PROP); // capacitors
    box(m, [0.32, 0.56, 0], [0.46, 0.72, 0.14], PROP);
  },
};

// Module ids with a drawing of their own, for tests.
export const DRAWN = Object.keys(DRAWINGS);

// Fittings from the interior template: machinery, crates, lockers,
// consoles and hatches, each in its tile.
function fromTemplate(m, def) {
  const rows = interiorRows(def, 0);
  const [w] = footprint(def, 0);
  const t = w / rows[0].length;
  rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
    const [x, y] = [tx * t, ty * t];
    const inset = (f, height, style = PROP) => box(m, [x + t * f, y + t * f, 0], [x + t * (1 - f), y + t * (1 - f), height], style);
    if (ch === '#') inset(0.12, 0.22);
    else if (ch === 'h') inset(0.2, 0.14);
    else if (ch === 'H') inset(0.12, 0.34);
    else if (ch === 'c') inset(0.18, 0.16, GLASS);
    else if (ch === 'a') polyline(m, 'floorDash', closed([[x + t * 0.08, y + t * 0.08, 0.005], [x + t * 0.92, y + t * 0.08, 0.005], [x + t * 0.92, y + t * 0.92, 0.005], [x + t * 0.08, y + t * 0.92, 0.005]]));
  }));
}
