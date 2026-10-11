// The 3D fittings in each kind of room: the reactor's core, the engine's
// turbine, bunks, tanks, the gun turret. Each drawing is a model (mesh.js)
// in the module's own unrotated frame, size[0] × size[1] cells with the
// origin at the top left, at the scale of the room walls (shipScene.js WALL):
// the bridge's front, the gun's muzzle and the quarters' windows face north,
// the engine's exhaust faces west.
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
    box(m, [0.25, 0.2, 0], [2.75, 0.6, 0.32], PROP); // console bank along the front
    for (const x of [0.75, 1.5, 2.25]) rect(m, [x - 0.24, 0.29], [x + 0.24, 0.47], 0.321, { fill: 'glass' });
    for (const x of [0.95, 2.05]) cylinder(m, [x, 1.05, 0], 0.17, 0.22, CAN); // crew seats
    cylinder(m, [1.5, 1.32, 0], 0.21, 0.3, CAN); // the captain's chair
  },
  reactor(m) {
    cylinder(m, [1.5, 1.5, 0], 0.82, 0.62, { ...CAN, ribs: 8 }); // housing
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const d = Math.SQRT1_2;
      polyline(m, 'propEdge', [[1.5 + dx * 0.82 * d, 1.5 + dy * 0.82 * d, 0.54], [1.5 + dx * 1.22 * d, 1.5 + dy * 1.22 * d, 0]]);
    }
    cylinder(m, [1.5, 1.5, 0], 0.36, 1.1, CORE); // the core
    glow(m, [1.5, 1.5, 1.14], 0.62, palette.bpGlow);
  },
  engine(m) {
    cylinder(m, [0.2, 1, 0.4], 0.38, 1.25, { ...CAN, axis: 'x' }); // turbine
    cylinder(m, [0.34, 1, 0.4], 0.17, 0.03, { axis: 'x', ends: 'coreFace', edge: 'coreEdge' });
    for (const y of [0.72, 1.28]) polyline(m, 'propFine', [[1.45, y, 0.2], [1.66, y, 0.2]]); // fuel lines
    box(m, [1.66, 0.55, 0], [1.86, 1.45, 0.36], PROP); // valve block
  },
  corridor(m) {
    for (const y of [0.35, 0.65]) polyline(m, 'floorMark', [[0.18, y, 0.005], [0.82, y, 0.005]]);
  },
  airlock(m) {
    rect(m, [0.16, 0.16], [1.84, 0.84], 0.005, { edge: 'floorDash' }); // keep clear
    cylinder(m, [1, 0.5, 0], 0.27, 0.04, CAN); // the hatch
    polyline(m, 'propFine', [[0.86, 0.36, 0.041], [1.14, 0.64, 0.041]]);
    polyline(m, 'propFine', [[0.86, 0.64, 0.041], [1.14, 0.36, 0.041]]);
  },
  quarters(m) {
    for (const y of [0.16, 1.1]) {
      box(m, [0.12, y, 0], [1.2, y + 0.72, 0.17], PROP); // bunk
      box(m, [0.12, y, 0.4], [1.2, y + 0.72, 0.46], PROP); // and the one above
    }
    cylinder(m, [1.9, 0.95, 0], 0.26, 0.26, CAN); // table
    box(m, [2.6, 0.2, 0], [2.86, 1.8, 0.62], PROP); // lockers
  },
  lifesupport(m) {
    for (const y of [0.3, 0.7]) cylinder(m, [0.38, y, 0], 0.17, 0.56, { fill: null, ends: 'glass', edge: 'propEdge' }); // oxygen
    box(m, [0.85, 0.16, 0], [1.84, 0.84, 0.26], PROP); // scrubber
    circle(m, 'propFine', [1.34, 0.5, 0.261], 0.24);
  },
  weapon(m) {
    cylinder(m, [0.5, 0.58, 0], 0.32, 0.22, CAN); // turret ring
    box(m, [0.35, 0.4, 0.22], [0.65, 0.74, 0.4], PROP); // breech
    for (const x of [0.43, 0.57]) box(m, [x - 0.035, 0, 0.28], [x + 0.035, 0.4, 0.34], { fill: null, top: null, edge: 'propEdge' });
  },
  cargo(m) {
    for (const [x, y] of [[0.45, 0.45], [2.55, 0.45], [0.45, 2.55], [2.55, 2.55]]) box(m, [x - 0.27, y - 0.27, 0], [x + 0.27, y + 0.27, 0.5], PROP);
    box(m, [2.33, 0.23, 0.5], [2.77, 0.67, 0.86], PROP); // stacked
    box(m, [0.95, 0.95, 0], [2.05, 2.05, 0.04], { fill: null, top: 'propFace', edge: 'propFine' }); // cargo lift
    for (const y of [1.62, 1.38]) polyline(m, 'floorMark', [[1.28, y + 0.12, 0.041], [1.5, y - 0.12, 0.041], [1.72, y + 0.12, 0.041]]);
  },
  medbay(m) {
    box(m, [0.18, 0.2, 0], [1.35, 0.8, 0.26], PROP); // treatment bed
    box(m, [0.22, 0.26, 0.26], [0.48, 0.74, 0.32], PROP);
    box(m, [1.65, 0.16, 0], [2.25, 0.5, 0.4], PROP); // console
    rect(m, [1.72, 0.22], [2.18, 0.38], 0.401, { fill: 'glass' });
    rect(m, [2.32, 1.04], [2.5, 1.56], 0.005, { fill: 'glass', edge: 'propFine' }); // the cross
    rect(m, [2.15, 1.21], [2.67, 1.39], 0.005, { fill: 'glass', edge: 'propFine' });
  },
  armory(m) {
    box(m, [0.14, 0.14, 0], [1, 0.62, 0.66], PROP); // weapon rack
    for (const x of [0.32, 0.5, 0.68, 0.86]) polyline(m, 'propFine', [[x, 0.62, 0.1], [x, 0.62, 0.56]]);
    box(m, [1.18, 0.3, 0], [1.84, 0.8, 0.28], PROP); // ammunition
  },
  shield(m) {
    cylinder(m, [1.3, 0.5, 0], 0.28, 0.2, CAN); // emitter base
    cylinder(m, [1.3, 0.5, 0.2], 0.08, 0.68, { fill: null, ends: 'glass', edge: 'propEdge', ribs: 3 });
    circle(m, 'fieldRing', [1.3, 0.5, 0.74], 0.4);
    circle(m, 'fieldRing', [1.3, 0.5, 0.9], 0.25);
    glow(m, [1.3, 0.5, 0.92], 0.34, palette.bpLine);
    box(m, [0.14, 0.18, 0], [0.42, 0.82, 0.32], PROP); // capacitors
    box(m, [0.52, 0.28, 0], [0.76, 0.82, 0.24], PROP);
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
    if (ch === '#') inset(0.12, 0.4);
    else if (ch === 'h') inset(0.2, 0.24);
    else if (ch === 'H') inset(0.12, 0.6);
    else if (ch === 'c') inset(0.18, 0.28, GLASS);
    else if (ch === 'a') polyline(m, 'floorDash', closed([[x + t * 0.08, y + t * 0.08, 0.005], [x + t * 0.92, y + t * 0.08, 0.005], [x + t * 0.92, y + t * 0.92, 0.005], [x + t * 0.08, y + t * 0.92, 0.005]]));
  }));
}
