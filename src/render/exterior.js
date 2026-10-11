// The ship seen from outside: a solid hull raised from the outline
// (hull.js), plated per module, with each module's roof fittings, the nose,
// glowing nozzles, gun barrels, docking collars and running lights. Pure:
// ship data in, { faces, glows } out (solid.js faces, mesh.js glows), in the
// manufacturer's skin. This is how the ship looks anywhere but the builder.
import { footprint, interiorRows } from '../sim/modules.js';
import { normalOf, placeFaces, plate, solidBox, solidCylinder, solidTube } from './solid.js';

export const HULL = 0.8; // the hull's height
const STRIPE = [0.3, 0.42]; // the livery band along the sides
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// input: { ship, defs, hull: traceHull(ship, defs), skin }
export function exteriorScene({ ship, defs, hull, skin }) {
  const faces = [];
  const glows = [];
  const edge = { edge: skin.edge };

  // The hull's sides, with the livery band along them.
  for (const { a, b, normal } of hull.edges) {
    const n = [normal[0], normal[1], 0];
    faces.push({ pts: [[...a, 0], [...b, 0], [...b, HULL], [...a, HULL]], normal: n, color: skin.hull, ...edge });
    const [ox, oy] = [normal[0] * 0.006, normal[1] * 0.006];
    const band = (p, z) => [p[0] + ox, p[1] + oy, z];
    // Sorted as the wall it's painted on, a hair nearer, so it always
    // follows its own wall and nothing else.
    const sortAt = [(a[0] + b[0]) / 2 + normal[0] * 0.01, (a[1] + b[1]) / 2 + normal[1] * 0.01, HULL / 2];
    faces.push({ pts: [band(a, STRIPE[0]), band(b, STRIPE[0]), band(b, STRIPE[1]), band(a, STRIPE[1])], normal: n, color: skin.livery, sortAt });
  }
  // The roof: a plate per module in one of the skin's tints, and plain hull
  // over pockets and fairings.
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const [w, h] = footprint(def, module.rot);
    plate(faces, [module.x, module.y], [module.x + w, module.y + h], HULL, skin.plates[module.uid % skin.plates.length], { edge: skin.seam });
  }
  for (const [x, y] of hull.pockets) plate(faces, [x, y], [x + 1, y + 1], HULL, skin.hull, { edge: skin.seam });
  for (const tri of hull.fairings) faces.push({ pts: tri.map(([x, y]) => [x, y, HULL]), normal: [0, 0, 1], color: skin.hull, edge: skin.seam });

  for (const nose of hull.noses) noseFaces(faces, nose, skin);

  // Each module's fittings on the roof.
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const local = [];
    const lights = [];
    (ROOFS[def.id] ?? fromTemplate)(local, skin, lights, def);
    faces.push(...placeFaces(local, def, module));
    for (const g of lights) glows.push({ ...g, at: placeFaces([{ pts: [g.at], normal: [0, 0, 1] }], def, module)[0].pts[0] });
  }

  // What sticks out of the hull.
  for (const { x, y, side } of hull.nozzles) {
    const [dx, dy] = STEP[side];
    const start = [x + 0.5 + dx * 0.48, y + 0.5 + dy * 0.48, HULL / 2];
    solidTube(faces, start, [dx, dy], 0.5, 0.2, 0.33, skin.dark, { endColor: skin.flame, glowing: true });
    glows.push({ at: [start[0] + dx * 0.85, start[1] + dy * 0.85, HULL / 2], r: 0.6, color: skin.flame });
  }
  for (const { x, y, side } of hull.barrels) {
    const [dx, dy] = STEP[side];
    for (const off of [-0.12, 0.12]) {
      const [cx, cy] = [x + 0.5 - dy * off, y + 0.5 + dx * off];
      solidTube(faces, [cx + dx * 0.36, cy + dy * 0.36, HULL + 0.14], [dx, dy], 0.8, 0.05, 0.05, skin.metalHi, { segments: 6 });
    }
  }
  for (const { x, y, side } of hull.collars) {
    const [dx, dy] = STEP[side];
    const [cx, cy] = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5];
    const a = [cx - Math.abs(dy) * 0.32 + Math.min(0, dx * 0.24), cy - Math.abs(dx) * 0.32 + Math.min(0, dy * 0.24)];
    const b = [cx + Math.abs(dy) * 0.32 + Math.max(0, dx * 0.24), cy + Math.abs(dx) * 0.32 + Math.max(0, dy * 0.24)];
    solidBox(faces, [...a, 0.1], [...b, HULL - 0.1], skin.dark, edge);
    solidBox(faces, [a[0] + 0.03, a[1] + 0.03, HULL - 0.1], [b[0] - 0.03, b[1] - 0.03, HULL - 0.05], skin.livery);
  }
  for (const light of hull.lights) {
    glows.push({ at: [light.x, light.y, HULL + 0.03], r: 0.3, color: skin[light.side] });
  }
  return { faces, glows };
}

// A nose: a wedge from the front of the hull to a point.
function noseFaces(faces, { x, y0, y1, length }, skin) {
  const mid = (y0 + y1) / 2;
  const tip = [x + length, mid, HULL * 0.42];
  const inside = [x - 0.4, mid, HULL / 2];
  const [tl, tr, br, bl] = [[x, y0, HULL], [x, y1, HULL], [x, y1, 0], [x, y0, 0]];
  for (const [pts, color] of [[[tl, tr, tip], skin.hull], [[tl, bl, tip], skin.hull], [[tr, br, tip], skin.hull], [[bl, br, tip], skin.hull]]) {
    faces.push({ pts, normal: normalOf(pts, inside), color, edge: skin.edge });
  }
  // A forward window on the top.
  const w = (y1 - y0) * 0.18;
  const pane = [[x + 0.06, mid - w, HULL - 0.008], [x + length * 0.42, mid - w * 0.45, HULL * 0.79], [x + length * 0.42, mid + w * 0.45, HULL * 0.79], [x + 0.06, mid + w, HULL - 0.008]];
  faces.push({ pts: pane.map(([px, py, pz]) => [px, py, pz + 0.01]), normal: normalOf([tl, tr, tip], inside), color: skin.glassLo, edge: skin.edge, bias: -0.04 });
}

// Roof fittings by module id, in the module's unrotated frame (props.js
// explains the frame): (faces, skin, glows, def) => void. Heights start at
// the roof, HULL.
const Z = HULL;
const ROOFS = {
  bridge(f, k) {
    const base = [[0.2, 0.1], [2.8, 0.1], [2.8, 0.95], [0.2, 0.95]].map(([x, y]) => [x, y, Z]);
    const top = [[0.5, 0.24], [2.5, 0.24], [2.5, 0.7], [0.5, 0.7]].map(([x, y]) => [x, y, Z + 0.22]);
    const inside = [1.5, 0.5, Z];
    f.push({ pts: top, normal: [0, 0, 1], color: k.glassHi, edge: k.edge });
    for (let i = 0; i < 4; i++) {
      const pts = [base[i], base[(i + 1) % 4], top[(i + 1) % 4], top[i]];
      f.push({ pts, normal: normalOf(pts, inside), color: k.glassLo, edge: k.edge });
    }
    solidBox(f, [1.05, 1.2, Z], [1.95, 1.65, Z + 0.05], k.dark, { edge: k.edge });
  },
  reactor(f, k, glows) {
    for (const [x, y] of [[0.5, 0.5], [2.5, 0.5], [2.5, 2.5], [0.5, 2.5]]) solidBox(f, [x - 0.27, y - 0.27, Z], [x + 0.27, y + 0.27, Z + 0.08], k.dark, { edge: k.edge });
    solidCylinder(f, [1.5, 1.5, Z], 0.82, 0.1, k.metal, { edge: k.edge });
    solidCylinder(f, [1.5, 1.5, Z + 0.1], 0.63, 0.2, k.domeHi, { top: k.domeLo, edge: k.edge });
    solidCylinder(f, [1.5, 1.5, Z + 0.3], 0.26, 0.03, k.glow, { top: k.glowCore, emissive: true });
    glows.push({ at: [1.5, 1.5, Z + 0.36], r: 0.9, color: k.glow });
  },
  engine(f, k) {
    solidBox(f, [0.12, 0.2, Z], [1.15, 1.8, Z + 0.1], k.dark, { edge: k.edge });
    for (const x of [0.28, 0.48, 0.68, 0.88]) solidBox(f, [x - 0.04, 0.3, Z + 0.1], [x + 0.04, 1.7, Z + 0.15], k.metal);
    solidBox(f, [1.28, 0.6, Z], [1.62, 1.4, Z + 0.16], k.metal, { edge: k.edge });
    solidBox(f, [1.72, 0.2, Z], [1.84, 1.8, Z + 0.03], k.hazard);
  },
  corridor(f, k) {
    solidBox(f, [0.32, 0.4, Z], [0.68, 0.6, Z + 0.06], k.dark, { edge: k.edge });
  },
  airlock(f, k) {
    solidCylinder(f, [1, 0.5, Z], 0.38, 0.03, k.livery);
    solidCylinder(f, [1, 0.5, Z + 0.03], 0.3, 0.05, k.dark, { edge: k.edge });
    solidCylinder(f, [1, 0.5, Z + 0.08], 0.2, 0.05, k.metalHi, { edge: k.edge });
  },
  quarters(f, k) {
    for (const x of [0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.7]) solidBox(f, [x - 0.1, 0.14, Z], [x + 0.1, 0.3, Z + 0.025], k.livery, { emissive: true });
    solidBox(f, [0.9, 1.0, Z], [2.1, 1.7, Z + 0.06], k.dark, { edge: k.edge });
  },
  lifesupport(f, k) {
    solidBox(f, [0.14, 0.14, Z], [1.05, 0.86, Z + 0.1], k.dark, { edge: k.edge });
    for (const y of [0.32, 0.5, 0.68]) solidBox(f, [0.24, y - 0.035, Z + 0.1], [0.95, y + 0.035, Z + 0.13], k.metal);
    for (const x of [1.35, 1.7]) solidCylinder(f, [x, 0.5, Z], 0.15, 0.16, k.domeLo, { top: k.domeHi, edge: k.edge });
  },
  weapon(f, k) {
    solidCylinder(f, [0.5, 0.58, Z], 0.34, 0.08, k.metal, { edge: k.edge });
    solidBox(f, [0.32, 0.38, Z + 0.08], [0.68, 0.78, Z + 0.26], k.domeLo, { edge: k.edge });
    for (const x of [0.41, 0.59]) solidTube(f, [x, 0.38, Z + 0.17], [0, -1], 0.42, 0.05, 0.05, k.metalHi, { segments: 6 });
  },
  cargo(f, k) {
    solidBox(f, [0.42, 0.42, Z], [2.58, 2.58, Z + 0.03], k.dark, { edge: k.edge });
    for (const [x0, x1] of [[0.5, 1.46], [1.54, 2.5]]) {
      solidBox(f, [x0, 0.5, Z + 0.03], [x1, 2.5, Z + 0.1], k.metal, { edge: k.edge });
      for (const y of [0.92, 1.34, 1.76, 2.18]) solidBox(f, [x0 + 0.09, y - 0.04, Z + 0.1], [x1 - 0.09, y + 0.04, Z + 0.13], k.dark);
    }
    solidBox(f, [0.42, 0.16, Z], [2.58, 0.32, Z + 0.03], k.hazard);
    solidBox(f, [0.42, 2.68, Z], [2.58, 2.84, Z + 0.03], k.hazard);
  },
  medbay(f, k) {
    solidCylinder(f, [0.75, 0.75, Z], 0.5, 0.03, k.soft, { edge: k.edge });
    solidBox(f, [0.66, 0.4, Z + 0.03], [0.84, 1.1, Z + 0.06], k.medical);
    solidBox(f, [0.4, 0.66, Z + 0.03], [1.1, 0.84, Z + 0.06], k.medical);
    solidBox(f, [1.75, 0.35, Z], [2.75, 1.25, Z + 0.08], k.dark, { edge: k.edge });
    for (const x of [2, 2.25, 2.5]) solidBox(f, [x - 0.04, 0.48, Z + 0.08], [x + 0.04, 1.12, Z + 0.11], k.metal);
  },
  armory(f, k) {
    solidBox(f, [0.16, 0.14, Z], [1.84, 0.86, Z + 0.1], k.metal, { edge: k.edge });
    solidBox(f, [0.4, 0.3, Z + 0.1], [1.6, 0.7, Z + 0.13], k.dark, { edge: k.edge });
    for (const [x, y] of [[0.26, 0.24], [1.74, 0.24], [1.74, 0.76], [0.26, 0.76]]) solidCylinder(f, [x, y, Z + 0.1], 0.05, 0.03, k.rivet, { segments: 6 });
  },
  shield(f, k, glows) {
    solidCylinder(f, [1, 0.5, Z], 0.38, 0.06, k.dark, { edge: k.edge });
    solidCylinder(f, [1, 0.5, Z + 0.06], 0.28, 0.16, k.domeLo, { top: k.domeHi, edge: k.edge });
    solidCylinder(f, [1, 0.5, Z + 0.22], 0.12, 0.03, k.shield, { emissive: true });
    glows.push({ at: [1, 0.5, Z + 0.28], r: 0.7, color: k.shield });
  },
};

// Roof fittings from the interior template: machinery under raised plates,
// consoles as lit panels.
function fromTemplate(f, k, glows, def) {
  const rows = interiorRows(def, 0);
  const t = def.size[0] / rows[0].length;
  rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
    const [x, y] = [tx * t, ty * t];
    if (ch === '#') solidBox(f, [x + t * 0.15, y + t * 0.15, Z], [x + t * 0.85, y + t * 0.85, Z + 0.1], k.metal, { edge: k.edge });
    else if (ch === 'c') solidBox(f, [x + t * 0.3, y + t * 0.3, Z], [x + t * 0.7, y + t * 0.7, Z + 0.025], k.livery, { emissive: true });
  }));
}
