// The ship seen from outside: a solid hull raised from the outline in its
// style (hullShape.js: the shoulder and side bands, the noses), plated per
// module, with each module's roof fittings, glowing nozzles, gun barrels,
// docking collars and running lights on the hull's skin, shaped to match
// the style. Pure: ship data in, { faces, glows, exhausts } out (solid.js
// faces, mesh.js glows; exhausts are where the engines' flames come out:
// [{ at, dir }]), in the manufacturer's skin. This is how the ship looks
// anywhere but the builder.
import { footprint, interiorRows } from '../sim/modules.js';
import { hullBands, hullShape, nearestSide, noseSurfaces, sidePoint, styleOf } from './hullShape.js';
import { normalOf, placeFaces, plate, solidBox, solidCylinder, solidTube } from './solid.js';

export const HULL = 0.8; // the hull's height
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const NOZZLE_Z = HULL / 2;

// input: { ship, defs, hull: traceHull(ship, defs), skin }
export function exteriorScene({ ship, defs, hull, skin }) {
  const faces = [];
  const glows = [];
  const exhausts = [];
  if (!hull.cells.length) return { faces, glows, exhausts };
  const style = styleOf(defs, ship);
  const shape = hullShape(hull, style);
  const round = style.corners === 'round';
  const curve = style.smooth ? 'fill' : skin.edge;
  const edge = { edge: skin.edge };
  const wallTop = style.profile[style.profile.length - 2][1] * HULL;

  // The shoulder and the side, with the livery band along the side.
  for (const { pts, outward, wall } of hullBands(shape, HULL)) {
    const middle = [0, 1].map((k) => pts.reduce((sum, p) => sum + p[k], 0) / 4);
    const inside = [middle[0] - outward[0] * 2, middle[1] - outward[1] * 2, HULL * 0.3];
    const normal = normalOf(pts, inside);
    faces.push({ pts, normal, color: skin.hull, edge: curve });
    if (!wall) continue;
    const [z0, z1] = style.stripe.map((h) => h * HULL);
    const [ox, oy] = [outward[0] * 0.006, outward[1] * 0.006];
    const band = (p, z) => [p[0] + ox, p[1] + oy, z];
    // Sorted as the side it's painted on, a hair nearer, so it always
    // follows its own side and nothing else.
    const sortAt = [middle[0] + outward[0] * 0.01, middle[1] + outward[1] * 0.01, (pts[0][2] + pts[3][2]) / 2];
    faces.push({ pts: [band(pts[3], z0), band(pts[2], z0), band(pts[2], z1), band(pts[3], z1)], normal, color: skin.livery, sortAt });
  }
  // The roof: a plate per module in one of the skin's tints, and plain hull
  // over pockets and fairings. A plated hull frames each with a seam.
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const [w, h] = footprint(def, module.rot);
    plate(faces, [module.x, module.y], [module.x + w, module.y + h], HULL, skin.plates[module.uid % skin.plates.length], { edge: skin.seam });
    if (style.roof === 'panels') seams(faces, [module.x, module.y], [module.x + w, module.y + h], skin.seam);
  }
  for (const [x, y] of hull.pockets) plate(faces, [x, y], [x + 1, y + 1], HULL, skin.hull, { edge: skin.seam });
  for (const tri of hull.fairings) faces.push({ pts: tri.map(([x, y]) => [x, y, HULL]), normal: [0, 0, 1], color: skin.hull, edge: skin.seam });

  for (const nose of shape.noses) noseFaces(faces, nose, skin, curve);

  // Each module's fittings on the roof.
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const local = [];
    const lights = [];
    (ROOFS[def.id] ?? fromTemplate)(local, skin, lights, def, round);
    faces.push(...placeFaces(local, def, module));
    for (const g of lights) glows.push({ ...g, at: placeFaces([{ pts: [g.at], normal: [0, 0, 1] }], def, module)[0].pts[0] });
  }

  // What sticks out of the hull, set on its skin: a nozzle in a housing,
  // round or eight-sided as the hull's corners are.
  const sides = round ? 12 : 8;
  for (const { x, y, side } of hull.nozzles) {
    const [dx, dy] = STEP[side];
    const [sx, sy] = sidePoint(shape, [x + 0.5, y + 0.5], [dx, dy]);
    solidTube(faces, [sx - dx * 0.04, sy - dy * 0.04, NOZZLE_Z], [dx, dy], 0.16, 0.34, 0.34, skin.dark, { segments: sides });
    const start = [sx + dx * 0.1, sy + dy * 0.1, NOZZLE_Z];
    solidTube(faces, start, [dx, dy], 0.42, 0.2, 0.31, skin.dark, { endColor: skin.flame, glowing: true });
    glows.push({ at: [start[0] + dx * 0.78, start[1] + dy * 0.78, NOZZLE_Z], r: 0.6, color: skin.flame });
    exhausts.push({ at: [start[0] + dx * 0.42, start[1] + dy * 0.42, NOZZLE_Z], dir: [dx, dy] });
  }
  for (const { x, y, side } of hull.barrels) {
    const [dx, dy] = STEP[side];
    for (const off of [-0.12, 0.12]) {
      const [cx, cy] = [x + 0.5 - dy * off, y + 0.5 + dx * off];
      solidTube(faces, [cx + dx * 0.36, cy + dy * 0.36, HULL + 0.14], [dx, dy], 0.8, 0.05, 0.05, skin.metalHi, { segments: 6 });
    }
  }
  // A docking collar at each hatch, out from the side below the shoulder.
  const collarR = Math.min(0.17, wallTop / 2 - 0.02);
  for (const { x, y, side } of hull.collars) {
    const [dx, dy] = STEP[side];
    const [sx, sy] = sidePoint(shape, [x + 0.5, y + 0.5], [dx, dy]);
    const z = Math.max(collarR + 0.03, wallTop / 2);
    solidTube(faces, [sx - dx * 0.06, sy - dy * 0.06, z], [dx, dy], 0.26, collarR + 0.06, collarR + 0.06, skin.dark, { segments: sides });
    solidTube(faces, [sx + dx * 0.2, sy + dy * 0.2, z], [dx, dy], 0.05, collarR, collarR, skin.livery, { endColor: skin.dark, segments: sides });
  }
  // Running lights at the stern's corners, on the side.
  const stern = Math.min(...hull.cells.map(([cx]) => cx));
  const ys = hull.cells.filter(([cx]) => cx === stern).map(([, cy]) => cy);
  const m = style.margin;
  for (const [y, color] of [[Math.min(...ys) - m, skin.port], [Math.max(...ys) + 1 + m, skin.starboard]]) {
    const [lx, ly] = nearestSide(shape, [stern - m, y]);
    glows.push({ at: [lx, ly, wallTop + 0.03], r: 0.3, color });
  }
  return { faces, glows, exhausts };
}

// A plated roof's seams: a dark frame inset in each module's plate.
function seams(faces, [x0, y0], [x1, y1], color) {
  const [i, t, z] = [0.07, 0.035, HULL + 0.002];
  const strips = [
    [[x0 + i, y0 + i], [x1 - i, y0 + i + t]],
    [[x0 + i, y1 - i - t], [x1 - i, y1 - i]],
    [[x0 + i, y0 + i], [x0 + i + t, y1 - i]],
    [[x1 - i - t, y0 + i], [x1 - i, y1 - i]],
  ];
  for (const [a, b] of strips) plate(faces, a, b, z, color);
}

// A nose (hullShape.js): its surface, a blunt one's flat front in the dark
// metal, and a forward window across the top of its first stretch.
function noseFaces(faces, nose, skin, curve) {
  for (const { pts, axis, front } of noseSurfaces(nose, HULL)) {
    faces.push({ pts, normal: normalOf(pts, axis), color: front ? skin.dark : skin.hull, edge: front ? skin.edge : curve });
  }
  if (nose.rings.length < 2) return;
  const [first, second] = [nose.rings[0], nose.rings[1]].map((ring) => ring.map(([x, y, h]) => [x, y, h * HULL]));
  // The section's top: from its last point (one side's top) to its first.
  const [a, b] = [first[first.length - 1], first[0]];
  const [c, d] = [second[0], second[second.length - 1]];
  const lerp = (p, q, t) => p.map((v, k) => v + (q[k] - v) * t);
  const pane = [lerp(a, b, 0.25), lerp(a, b, 0.75), lerp(d, c, 0.72), lerp(d, c, 0.28)];
  const lift = pane.map(([x, y, z], k) => [x + (k < 2 ? 0.05 : -0.04), y, z + 0.012]);
  faces.push({ pts: lift, normal: normalOf([a, b, c], [a[0] - 1, (a[1] + b[1]) / 2, 0]), color: skin.glassLo, edge: skin.edge, bias: -0.04 });
}

// Roof fittings by module id, in the module's unrotated frame (props.js
// explains the frame): (faces, skin, glows, def, round) => void, round when
// the hull's corners are. Heights start at the roof, HULL.
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
  // The turret: round on a rounded hull, eight-sided on a cut one.
  weapon(f, k, glows, def, round) {
    solidCylinder(f, [0.5, 0.58, Z], 0.34, 0.08, k.metal, { edge: k.edge });
    solidCylinder(f, [0.5, 0.58, Z + 0.08], 0.22, 0.16, k.domeLo, { top: k.domeHi, edge: k.edge, segments: round ? 14 : 8 });
    for (const x of [0.41, 0.59]) solidTube(f, [x, 0.4, Z + 0.17], [0, -1], 0.44, 0.05, 0.05, k.metalHi, { segments: 6 });
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
