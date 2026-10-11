// The ship seen from outside: a solid hull raised from the outline
// (hull.js), plated per module, with each module's roof fittings, the nose,
// glowing nozzles, gun barrels, docking collars and running lights. Pure:
// ship data in, { faces, glows } out (solid.js faces, mesh.js glows), in the
// manufacturer's skin. This is how the ship looks anywhere but the builder.
import { footprint, interiorRows } from '../sim/modules.js';
import { normalOf, placeFaces, plate, solidBox, solidCylinder, solidTube } from './solid.js';

export const HULL = 0.45; // the hull's height
const STRIPE = [0.17, 0.24]; // the livery band along the sides
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
    const [ox, oy] = [normal[0] * 0.004, normal[1] * 0.004];
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
    solidTube(faces, start, [dx, dy], 0.42, 0.16, 0.27, skin.dark, { endColor: skin.flame, glowing: true });
    glows.push({ at: [start[0] + dx * 0.75, start[1] + dy * 0.75, HULL / 2], r: 0.55, color: skin.flame });
  }
  for (const { x, y, side } of hull.barrels) {
    const [dx, dy] = STEP[side];
    for (const off of [-0.09, 0.09]) {
      const [cx, cy] = [x + 0.5 - dy * off, y + 0.5 + dx * off];
      solidTube(faces, [cx + dx * 0.36, cy + dy * 0.36, HULL + 0.1], [dx, dy], 0.72, 0.035, 0.035, skin.metalHi, { segments: 6 });
    }
  }
  for (const { x, y, side } of hull.collars) {
    const [dx, dy] = STEP[side];
    const [cx, cy] = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5];
    const a = [cx - Math.abs(dy) * 0.24 + Math.min(0, dx * 0.18), cy - Math.abs(dx) * 0.24 + Math.min(0, dy * 0.18)];
    const b = [cx + Math.abs(dy) * 0.24 + Math.max(0, dx * 0.18), cy + Math.abs(dx) * 0.24 + Math.max(0, dy * 0.18)];
    solidBox(faces, [...a, 0.06], [...b, HULL - 0.06], skin.dark, edge);
    solidBox(faces, [a[0] + 0.02, a[1] + 0.02, HULL - 0.06], [b[0] - 0.02, b[1] - 0.02, HULL - 0.03], skin.livery);
  }
  for (const light of hull.lights) {
    glows.push({ at: [light.x, light.y, HULL + 0.02], r: 0.22, color: skin[light.side] });
  }
  return { faces, glows };
}

// A nose: a wedge from the front of the hull to a point.
function noseFaces(faces, { x, y0, y1, length }, skin) {
  const mid = (y0 + y1) / 2;
  const tip = [x + length, mid, HULL * 0.42];
  const inside = [x - 0.2, mid, HULL / 2];
  const [tl, tr, br, bl] = [[x, y0, HULL], [x, y1, HULL], [x, y1, 0], [x, y0, 0]];
  for (const [pts, color] of [[[tl, tr, tip], skin.hull], [[tl, bl, tip], skin.hull], [[tr, br, tip], skin.hull], [[bl, br, tip], skin.hull]]) {
    faces.push({ pts, normal: normalOf(pts, inside), color, edge: skin.edge });
  }
  // A forward window on the top.
  const w = (y1 - y0) * 0.18;
  const pane = [[x + 0.04, mid - w, HULL - 0.005], [x + length * 0.42, mid - w * 0.45, HULL * 0.79], [x + length * 0.42, mid + w * 0.45, HULL * 0.79], [x + 0.04, mid + w, HULL - 0.005]];
  faces.push({ pts: pane.map(([px, py, pz]) => [px, py, pz + 0.006]), normal: normalOf([tl, tr, tip], inside), color: skin.glassLo, edge: skin.edge, bias: -0.02 });
}

// Roof fittings by module id, in the module's unrotated frame (props.js
// explains the frame): (faces, skin, glows, def) => void. Heights start at
// the roof, HULL.
const Z = HULL;
const ROOFS = {
  bridge(f, k) {
    const base = [[0.14, 0.06], [1.86, 0.06], [1.86, 0.56], [0.14, 0.56]].map(([x, y]) => [x, y, Z]);
    const top = [[0.34, 0.15], [1.66, 0.15], [1.66, 0.4], [0.34, 0.4]].map(([x, y]) => [x, y, Z + 0.13]);
    const inside = [1, 0.3, Z];
    f.push({ pts: top, normal: [0, 0, 1], color: k.glassHi, edge: k.edge });
    for (let i = 0; i < 4; i++) {
      const pts = [base[i], base[(i + 1) % 4], top[(i + 1) % 4], top[i]];
      f.push({ pts, normal: normalOf(pts, inside), color: k.glassLo, edge: k.edge });
    }
    solidBox(f, [0.7, 0.68, Z], [1.3, 0.88, Z + 0.03], k.dark, { edge: k.edge });
  },
  reactor(f, k, glows) {
    for (const [x, y] of [[0.33, 0.33], [1.67, 0.33], [1.67, 1.67], [0.33, 1.67]]) solidBox(f, [x - 0.18, y - 0.18, Z], [x + 0.18, y + 0.18, Z + 0.05], k.dark, { edge: k.edge });
    solidCylinder(f, [1, 1, Z], 0.55, 0.06, k.metal, { edge: k.edge });
    solidCylinder(f, [1, 1, Z + 0.06], 0.42, 0.12, k.domeHi, { top: k.domeLo, edge: k.edge });
    solidCylinder(f, [1, 1, Z + 0.18], 0.17, 0.02, k.glow, { top: k.glowCore, emissive: true });
    glows.push({ at: [1, 1, Z + 0.22], r: 0.6, color: k.glow });
  },
  engine(f, k) {
    solidBox(f, [0.1, 0.12, Z], [1.15, 0.88, Z + 0.06], k.dark, { edge: k.edge });
    for (const x of [0.25, 0.42, 0.59, 0.76, 0.93]) solidBox(f, [x - 0.03, 0.18, Z + 0.06], [x + 0.03, 0.82, Z + 0.09], k.metal);
    solidBox(f, [1.25, 0.32, Z], [1.6, 0.68, Z + 0.1], k.metal, { edge: k.edge });
    solidBox(f, [1.7, 0.12, Z], [1.82, 0.88, Z + 0.02], k.hazard);
  },
  corridor(f, k) {
    solidBox(f, [0.32, 0.4, Z], [0.68, 0.6, Z + 0.04], k.dark, { edge: k.edge });
  },
  airlock(f, k) {
    solidCylinder(f, [0.5, 0.5, Z], 0.32, 0.02, k.livery);
    solidCylinder(f, [0.5, 0.5, Z + 0.02], 0.26, 0.03, k.dark, { edge: k.edge });
    solidCylinder(f, [0.5, 0.5, Z + 0.05], 0.18, 0.03, k.metalHi, { edge: k.edge });
  },
  quarters(f, k) {
    for (const x of [0.2, 0.47, 0.74, 1.01, 1.28, 1.55, 1.82]) solidBox(f, [x - 0.07, 0.1, Z], [x + 0.07, 0.2, Z + 0.015], k.livery, { emissive: true });
    solidBox(f, [0.6, 0.52, Z], [1.4, 0.84, Z + 0.04], k.dark, { edge: k.edge });
  },
  lifesupport(f, k) {
    solidBox(f, [0.16, 0.12, Z], [0.84, 0.52, Z + 0.06], k.dark, { edge: k.edge });
    for (const y of [0.22, 0.32, 0.42]) solidBox(f, [0.24, y - 0.02, Z + 0.06], [0.76, y + 0.02, Z + 0.08], k.metal);
    for (const x of [0.32, 0.68]) solidCylinder(f, [x, 0.74, Z], 0.12, 0.1, k.domeLo, { top: k.domeHi, edge: k.edge });
  },
  weapon(f, k) {
    solidCylinder(f, [0.5, 0.58, Z], 0.32, 0.05, k.metal, { edge: k.edge });
    solidBox(f, [0.33, 0.38, Z + 0.05], [0.67, 0.76, Z + 0.17], k.domeLo, { edge: k.edge });
    for (const x of [0.41, 0.59]) solidTube(f, [x, 0.38, Z + 0.1], [0, -1], 0.38, 0.035, 0.035, k.metalHi, { segments: 6 });
  },
  cargo(f, k) {
    solidBox(f, [0.28, 0.28, Z], [1.72, 1.72, Z + 0.02], k.dark, { edge: k.edge });
    for (const [x0, x1] of [[0.34, 0.98], [1.02, 1.66]]) {
      solidBox(f, [x0, 0.34, Z + 0.02], [x1, 1.66, Z + 0.06], k.metal, { edge: k.edge });
      for (const y of [0.62, 0.9, 1.18, 1.46]) solidBox(f, [x0 + 0.06, y - 0.025, Z + 0.06], [x1 - 0.06, y + 0.025, Z + 0.08], k.dark);
    }
    solidBox(f, [0.28, 0.12, Z], [1.72, 0.22, Z + 0.02], k.hazard);
    solidBox(f, [0.28, 1.78, Z], [1.72, 1.88, Z + 0.02], k.hazard);
  },
  medbay(f, k) {
    solidCylinder(f, [0.5, 0.5, Z], 0.32, 0.02, k.soft, { edge: k.edge });
    solidBox(f, [0.44, 0.28, Z + 0.02], [0.56, 0.72, Z + 0.04], k.medical);
    solidBox(f, [0.28, 0.44, Z + 0.02], [0.72, 0.56, Z + 0.04], k.medical);
    solidBox(f, [1.2, 0.24, Z], [1.82, 0.76, Z + 0.05], k.dark, { edge: k.edge });
    for (const x of [1.36, 1.51, 1.66]) solidBox(f, [x - 0.025, 0.32, Z + 0.05], [x + 0.025, 0.68, Z + 0.07], k.metal);
  },
  armory(f, k) {
    solidBox(f, [0.16, 0.16, Z], [0.84, 0.84, Z + 0.06], k.metal, { edge: k.edge });
    solidBox(f, [0.3, 0.3, Z + 0.06], [0.7, 0.7, Z + 0.08], k.dark, { edge: k.edge });
    for (const [x, y] of [[0.24, 0.24], [0.76, 0.24], [0.76, 0.76], [0.24, 0.76]]) solidCylinder(f, [x, y, Z + 0.06], 0.035, 0.02, k.rivet, { segments: 6 });
  },
  shield(f, k, glows) {
    solidCylinder(f, [0.5, 0.5, Z], 0.34, 0.04, k.dark, { edge: k.edge });
    solidCylinder(f, [0.5, 0.5, Z + 0.04], 0.24, 0.1, k.domeLo, { top: k.domeHi, edge: k.edge });
    solidCylinder(f, [0.5, 0.5, Z + 0.14], 0.11, 0.02, k.shield, { emissive: true });
    glows.push({ at: [0.5, 0.5, Z + 0.18], r: 0.5, color: k.shield });
  },
};

// Roof fittings from the interior template: machinery under raised plates,
// consoles as lit panels.
function fromTemplate(f, k, glows, def) {
  const rows = interiorRows(def, 0);
  const t = def.size[0] / rows[0].length;
  rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
    const [x, y] = [tx * t, ty * t];
    if (ch === '#') solidBox(f, [x + t * 0.15, y + t * 0.15, Z], [x + t * 0.85, y + t * 0.85, Z + 0.06], k.metal, { edge: k.edge });
    else if (ch === 'c') solidBox(f, [x + t * 0.3, y + t * 0.3, Z], [x + t * 0.7, y + t * 0.7, Z + 0.015], k.livery, { emissive: true });
  }));
}
