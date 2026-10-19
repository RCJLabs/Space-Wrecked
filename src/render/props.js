// The 3D fittings in each kind of room: the reactor's core, the engine's
// turbine, bunks, tanks, the gun turret. Each drawing is a model (mesh.js)
// in the module's own unrotated frame, size[0] × size[1] cells with the
// origin at the top left, at the scale of the room walls (shipScene.js WALL):
// the bridge's front, the gun's muzzle and the quarters' windows face north,
// the engine's exhaust faces west.
// placeModel turns and moves it onto the ship. A module type without a
// drawing here gets one from its interior template, so new content draws
// without an engine edit; a maker's version (M23g) has its base part's.
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
  const draw = DRAWINGS[def.base ?? def.id];
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
  // M23e's variants, each told apart from the part it varies.
  lightengine(m) {
    cylinder(m, [0.14, 0.5, 0.3], 0.26, 0.92, { ...CAN, axis: 'x' }); // the slim turbine
    cylinder(m, [0.24, 0.5, 0.3], 0.11, 0.03, { axis: 'x', ends: 'coreFace', edge: 'coreEdge' });
    polyline(m, 'propFine', [[1.06, 0.5, 0.2], [1.38, 0.5, 0.2]]); // fuel line
    box(m, [1.38, 0.36, 0], [1.6, 0.64, 0.28], PROP); // valve
  },
  heavyengine(m) {
    for (const y of [0.56, 1.44]) {
      cylinder(m, [0.16, y, 0.42], 0.38, 1.66, { ...CAN, axis: 'x', ribs: 6 }); // twin turbines
      cylinder(m, [0.3, y, 0.42], 0.18, 0.03, { axis: 'x', ends: 'coreFace', edge: 'coreEdge' });
    }
    box(m, [1.9, 0.32, 0], [2.12, 1.68, 0.56], PROP); // manifold
    for (const y of [0.64, 1, 1.36]) polyline(m, 'propFine', [[2.12, y, 0.22], [2.38, y, 0.22]]); // fuel lines
    box(m, [2.38, 0.56, 0], [2.82, 1.44, 0.4], PROP); // valve block
  },
  smallreactor(m) {
    cylinder(m, [1.38, 1.38, 0], 0.48, 0.44, { ...CAN, ribs: 6 }); // housing
    for (const [dx, dy] of [[1, -1], [-1, 1]]) {
      const d = Math.SQRT1_2;
      polyline(m, 'propEdge', [[1.38 + dx * 0.48 * d, 1.38 + dy * 0.48 * d, 0.38], [1.38 + dx * 0.62 * d, 1.38 + dy * 0.62 * d, 0]]);
    }
    cylinder(m, [1.38, 1.38, 0], 0.2, 0.78, CORE); // the core
    glow(m, [1.38, 1.38, 0.82], 0.42, palette.bpGlow);
    box(m, [0.18, 0.12, 0], [0.8, 0.34, 0.36], PROP); // its control panel
    rect(m, [0.24, 0.17], [0.74, 0.29], 0.361, { fill: 'glass' });
  },
  pointdefense(m) {
    cylinder(m, [0.5, 0.62, 0], 0.24, 0.18, CAN); // turret ring
    cylinder(m, [0.5, 0.62, 0.18], 0.14, 0.1, { fill: null, ends: 'glass', edge: 'propEdge' }); // the tracking eye
    for (const x of [0.38, 0.5, 0.62]) box(m, [x - 0.025, 0.08, 0.22], [x + 0.025, 0.46, 0.26], { fill: null, top: null, edge: 'propEdge' }); // three barrels
  },
  cannon(m) {
    box(m, [0.12, 0.18, 0], [0.6, 0.84, 0.52], PROP); // shell hopper
    polyline(m, 'propFine', [[0.6, 0.5, 0.3], [0.72, 0.56, 0.3]]); // the feed
    cylinder(m, [1, 0.62, 0], 0.34, 0.24, { ...CAN, ribs: 6 }); // turret ring
    box(m, [0.84, 0.36, 0.24], [1.16, 0.78, 0.5], PROP); // breech
    box(m, [0.93, 0.02, 0.32], [1.07, 0.36, 0.44], { fill: null, top: null, edge: 'propEdge' }); // the one heavy barrel
    box(m, [1.48, 0.3, 0], [1.86, 0.72, 0.38], PROP); // the loader's console
    rect(m, [1.54, 0.36], [1.8, 0.52], 0.381, { fill: 'glass' });
  },
  shieldarray(m) {
    cylinder(m, [1.28, 1.22, 0], 0.42, 0.24, { ...CAN, ribs: 6 }); // emitter base
    cylinder(m, [1.28, 1.22, 0.24], 0.1, 0.72, { fill: null, ends: 'glass', edge: 'propEdge', ribs: 3 });
    for (const [z, r] of [[0.84, 0.62], [1, 0.44], [1.14, 0.26]]) circle(m, 'fieldRing', [1.28, 1.22, z], r);
    glow(m, [1.28, 1.22, 1.14], 0.5, palette.bpLine);
    box(m, [0.16, 1.28, 0], [0.38, 1.86, 0.4], PROP); // capacitor bank
    box(m, [0.44, 1.38, 0], [0.66, 1.86, 0.32], PROP);
  },
  bunks(m) {
    for (const y of [0.16, 1.12]) {
      box(m, [1.12, y, 0], [1.88, y + 0.72, 0.17], PROP); // bunk
      box(m, [1.12, y, 0.4], [1.88, y + 0.72, 0.46], PROP); // and the one above
    }
    box(m, [0.16, 0.66, 0], [0.64, 1.34, 0.42], PROP); // its own air: a scrubber
    circle(m, 'propFine', [0.4, 1, 0.421], 0.18);
  },
  surgery(m) {
    box(m, [1.18, 0.22, 0], [1.84, 0.8, 0.3], PROP); // the operating table
    polyline(m, 'propEdge', [[1.9, 0.92, 0], [1.9, 0.92, 0.7], [1.66, 0.64, 0.7], [1.6, 0.56, 0.56]]); // the surgeon's arm
    glow(m, [1.51, 0.51, 0.62], 0.22, palette.bpGlow);
    box(m, [1.22, 1.26, 0], [1.82, 1.72, 0.4], PROP); // console
    rect(m, [1.3, 1.34], [1.74, 1.48], 0.401, { fill: 'glass' });
    rect(m, [0.4, 0.84], [0.6, 1.4], 0.005, { fill: 'glass', edge: 'propFine' }); // the cross
    rect(m, [0.22, 1.02], [0.78, 1.22], 0.005, { fill: 'glass', edge: 'propFine' });
  },
  largehold(m) {
    for (const [x, y] of [[0.52, 0.52], [3.48, 0.52], [0.52, 2.48], [3.48, 2.48]]) box(m, [x - 0.32, y - 0.32, 0], [x + 0.32, y + 0.32, 0.56], PROP);
    for (const [x, y] of [[3.48, 0.52], [0.52, 2.48]]) box(m, [x - 0.24, y - 0.24, 0.56], [x + 0.24, y + 0.24, 0.92], PROP); // stacked
    box(m, [1.3, 0.8, 0], [2.7, 2.2, 0.04], { fill: null, top: 'propFace', edge: 'propFine' }); // cargo lift
    for (const y of [1.62, 1.38]) polyline(m, 'floorMark', [[1.72, y + 0.14, 0.041], [2, y - 0.14, 0.041], [2.28, y + 0.14, 0.041]]);
    for (const y of [0.18, 2.82]) polyline(m, 'floorMark', [[1, y, 0.005], [3, y, 0.005]]); // the gantry's rails
  },
  // M39's: five doing a crew job's ship effect, five with rules of their
  // own, and nine versions of parts already there, each told apart.
  scanner(m) {
    box(m, [0.2, 0.12, 0], [1.8, 0.42, 0.3], PROP); // the sensor desk along the front
    cylinder(m, [1, 0.27, 0.3], 0.13, 0.02, { fill: null, ends: 'glass', edge: 'propEdge' }); // its scope
    circle(m, 'fieldRing', [1, 0.27, 0.33], 0.09);
    for (const x of [0.5, 1.5]) rect(m, [x - 0.18, 0.18], [x + 0.18, 0.32], 0.301, { fill: 'glass' });
    cylinder(m, [1, 0.72, 0], 0.13, 0.2, CAN); // the operator's seat
  },
  firecontrol(m) {
    box(m, [1.16, 0.14, 0], [1.86, 0.86, 0.34], PROP); // the director's console
    rect(m, [1.24, 0.24], [1.78, 0.5], 0.341, { fill: 'glass' });
    polyline(m, 'propFine', [[1.51, 0.26, 0.345], [1.51, 0.48, 0.345]]); // the crosshairs on its screen
    polyline(m, 'propFine', [[1.27, 0.37, 0.345], [1.75, 0.37, 0.345]]);
    cylinder(m, [0.7, 0.5, 0], 0.15, 0.22, CAN); // the gunnery officer's seat
  },
  ecm(m) {
    box(m, [1.16, 0.18, 0], [1.84, 0.82, 0.44], PROP); // the jammer's cabinet
    for (const y of [0.32, 0.5, 0.68]) polyline(m, 'propFine', [[1.2, y, 0.3], [1.8, y, 0.3]]);
    for (const x of [1.32, 1.5, 1.68]) polyline(m, 'propEdge', [[x, 0.5, 0.44], [x, 0.5, 0.66]]); // its aerial stubs
    glow(m, [1.5, 0.5, 0.68], 0.22, palette.bpLine);
    box(m, [0.2, 0.62, 0], [0.62, 0.86, 0.12], PROP); // a cable tray
  },
  workshop(m) {
    box(m, [0.14, 0.14, 0], [0.86, 0.86, 0.4], PROP); // the lathe
    cylinder(m, [0.5, 0.5, 0.4], 0.12, 0.2, { ...CAN, axis: 'x' });
    box(m, [2.18, 0.2, 0], [2.82, 0.8, 0.26], PROP); // the workbench
    for (const x of [2.34, 2.5, 2.66]) polyline(m, 'propFine', [[x, 0.3, 0.27], [x, 0.7, 0.27]]); // tools on it
    box(m, [0.18, 1.18, 0], [0.82, 1.82, 0.3], PROP); // the parts register
    rect(m, [0.26, 1.28], [0.74, 1.46], 0.301, { fill: 'glass' });
    rect(m, [1.2, 1.2], [2.8, 1.8], 0.005, { edge: 'floorDash' }); // the welding bay
  },
  surveylab(m) {
    box(m, [0.16, 0.16, 0], [0.84, 0.84, 0.32], PROP); // the analyser
    rect(m, [0.24, 0.24], [0.76, 0.46], 0.321, { fill: 'glass' });
    box(m, [0.2, 1.2, 0], [0.8, 1.8, 0.24], PROP); // the sample bench
    for (const y of [1.35, 1.65]) cylinder(m, [0.5, y, 0.24], 0.09, 0.14, { fill: null, ends: 'glass', edge: 'propEdge' }); // specimen jars
    cylinder(m, [1.4, 1, 0], 0.15, 0.22, CAN); // a stool
  },
  torpedobay(m) {
    box(m, [0.12, 0.14, 0], [0.88, 1.86, 0.12], PROP); // the torpedo rack
    for (const x of [0.32, 0.68]) cylinder(m, [x, 0.3, 0.26], 0.13, 1.4, { ...CAN, axis: 'y' }); // two torpedoes on it
    box(m, [1.2, 0.16, 0], [1.84, 0.8, 0.34], PROP); // the launch console
    rect(m, [1.28, 0.24], [1.76, 0.42], 0.341, { fill: 'glass' });
    polyline(m, 'floorMark', [[1.5, 1.86, 0.005], [1.5, 1.12, 0.005]]); // the loading track
  },
  grapple(m) {
    cylinder(m, [0.18, 0.5, 0.3], 0.26, 0.64, { ...CAN, axis: 'x', ribs: 8 }); // the cable drum
    box(m, [1.14, 0.18, 0], [1.86, 0.82, 0.5], PROP); // the winch motor
    polyline(m, 'propEdge', [[0.5, 0.24, 0.5], [0.5, 0.06, 0.6]]); // the cable out to the claw
  },
  baffles(m) {
    for (const x0 of [0.12, 2.12]) {
      box(m, [x0, 0.16, 0], [x0 + 0.76, 0.84, 0.3], PROP); // a damping panel
      for (const x of [0.22, 0.4, 0.58]) polyline(m, 'propFine', [[x0 + x, 0.2, 0.31], [x0 + x, 0.8, 0.31]]); // its fins
    }
    rect(m, [1.12, 0.14], [1.88, 0.86], 0.005, { edge: 'floorDash' }); // the quiet deck
  },
  turret(m) {
    box(m, [1.12, 0.12, 0], [1.88, 0.88, 0.62], PROP); // the armored mount
    cylinder(m, [1.5, 0.5, 0.62], 0.22, 0.06, CAN); // its sensor eye
    glow(m, [1.5, 0.5, 0.7], 0.2, palette.bpGlow);
    rect(m, [0.14, 0.14], [0.86, 0.86], 0.005, { edge: 'floorDash' }); // where the gun stands
  },
  hydroponics(m) {
    for (const x0 of [0.14, 2.14]) {
      for (const y0 of [0.14, 1.14]) {
        box(m, [x0, y0, 0], [x0 + 0.72, y0 + 0.72, 0.22], PROP); // a grow bed
        for (const [dx, dy] of [[0.2, 0.2], [0.52, 0.2], [0.2, 0.52], [0.52, 0.52]]) cylinder(m, [x0 + dx, y0 + dy, 0.22], 0.08, 0.12, { fill: null, ends: 'glass', edge: 'propFine' }); // plants
      }
    }
    for (const x of [0.5, 2.5]) glow(m, [x, 1, 0.6], 0.3, palette.bpGlow); // the grow lights
    polyline(m, 'floorMark', [[1.5, 0.2, 0.005], [1.5, 1.8, 0.005]]);
  },
  railgun(m) {
    for (const x0 of [0.12, 2.12]) box(m, [x0, 0.16, 0], [x0 + 0.76, 0.84, 0.46], PROP); // capacitor banks
    for (const x of [0.3, 0.5, 0.7, 2.3, 2.5, 2.7]) polyline(m, 'propFine', [[x, 0.2, 0.47], [x, 0.8, 0.47]]);
    box(m, [1.18, 0.4, 0], [1.82, 0.84, 0.3], PROP); // the gunner's console
    rect(m, [1.26, 0.48], [1.74, 0.62], 0.301, { fill: 'glass' });
    box(m, [0.9, 0.04, 0.34], [2.1, 0.2, 0.46], { fill: null, top: null, edge: 'propEdge' }); // the rails' breech
  },
  flak(m) {
    for (const x of [0.5, 1.5]) {
      cylinder(m, [x, 0.6, 0], 0.26, 0.2, CAN); // a turret ring
      for (const dx of [-0.08, 0.08]) box(m, [x + dx - 0.025, 0.1, 0.24], [x + dx + 0.025, 0.42, 0.28], { fill: null, top: null, edge: 'propEdge' }); // its barrels
    }
    box(m, [0.84, 0.66, 0], [1.16, 0.9, 0.3], PROP); // the shared magazine
  },
  largereactor(m) {
    cylinder(m, [2, 1.5, 0], 1.18, 0.62, { ...CAN, ribs: 10 }); // housing
    for (const x of [1.5, 2.5]) {
      cylinder(m, [x, 1.5, 0], 0.32, 1.2, CORE); // twin cores
      glow(m, [x, 1.5, 1.24], 0.58, palette.bpGlow);
    }
    for (const [x, y] of [[0.3, 0.3], [3.7, 0.3], [3.7, 2.7], [0.3, 2.7]]) polyline(m, 'propEdge', [[x, y, 0], [2 + (x - 2) * 0.62, 1.5 + (y - 1.5) * 0.62, 0.54]]); // struts
  },
  thruster(m) {
    cylinder(m, [0.12, 0.5, 0.3], 0.24, 0.56, { ...CAN, axis: 'x' }); // the nozzle housing
    cylinder(m, [0.2, 0.5, 0.3], 0.1, 0.03, { axis: 'x', ends: 'coreFace', edge: 'coreEdge' });
    box(m, [0.7, 0.32, 0], [0.88, 0.68, 0.28], PROP); // its valve
  },
  cockpit(m) {
    box(m, [0.14, 0.12, 0], [1.2, 0.5, 0.3], PROP); // the flight console along the front
    rect(m, [0.24, 0.2], [1.1, 0.36], 0.301, { fill: 'glass' });
    cylinder(m, [0.68, 0.72, 0], 0.16, 0.24, CAN); // the pilot's seat
    box(m, [1.5, 0.66, 0], [1.86, 0.88, 0.14], PROP); // a kit locker
  },
  dormitory(m) {
    for (const x0 of [0.12, 1.12, 3.12]) {
      box(m, [x0, 0.12, 0], [x0 + 0.76, 0.86, 0.17], PROP); // a bunk
      box(m, [x0, 0.12, 0.4], [x0 + 0.76, 0.86, 0.46], PROP); // and the one above
    }
    box(m, [2.18, 0.14, 0], [2.82, 0.5, 0.62], PROP); // lockers
    for (const x of [1.2, 2.8]) cylinder(m, [x, 1.5, 0], 0.24, 0.24, CAN); // tables
  },
  airrecycler(m) {
    for (const y of [0.5, 1.5]) {
      box(m, [0.12, y - 0.38, 0], [0.88, y + 0.38, 0.62], PROP); // a scrubber tower
      circle(m, 'propFine', [0.5, y, 0.621], 0.26); // its fan
    }
    for (const y of [0.5, 1.5]) polyline(m, 'propFine', [[0.88, y, 0.3], [1.3, y, 0.3]]); // ducts
    box(m, [1.3, 0.3, 0], [1.6, 1.7, 0.34], PROP); // the manifold
  },
  cargopod(m) {
    box(m, [0.14, 0.14, 0], [0.86, 0.86, 0.42], PROP); // a crate
    box(m, [0.24, 0.24, 0.42], [0.76, 0.76, 0.7], PROP); // another on it
    rect(m, [1.14, 0.14], [1.86, 0.86], 0.005, { edge: 'floorDash' }); // the loading space
  },
  emitter(m) {
    cylinder(m, [0.5, 0.56, 0], 0.26, 0.14, CAN); // the emitter's base
    cylinder(m, [0.5, 0.56, 0.14], 0.06, 0.5, { fill: null, ends: 'glass', edge: 'propEdge', ribs: 3 });
    circle(m, 'fieldRing', [0.5, 0.56, 0.6], 0.3);
    glow(m, [0.5, 0.56, 0.66], 0.26, palette.bpLine);
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
