// The ship seen from outside: a solid hull raised from the outline in its
// style (hullShape.js: the shoulder and side bands, the noses), plated per
// module, with each module's roof fittings, glowing nozzles, gun barrels,
// docking collars and running lights on the hull's skin, shaped to match
// the style. Pure: ship data in, { faces, glows, exhausts } out (solid.js
// faces, mesh.js glows; exhausts are where the engines' flames come out,
// in their maker's color: [{ at, dir, flame }]), in the manufacturer's
// skin: the hull in the ship's paint and trim, each part's fittings in its
// own maker's (M23g). This is how the ship looks anywhere but the builder.
import { footprint, interiorRows, placedCells } from '../sim/modules.js';
import { hullBands, hullShape, nearestSide, noseSurfaces, sidePoint, styleOf } from './hullShape.js';
import { fittingsOf, paintSkin } from './palette.js';
import { pieceScene } from './pieces.js';
import { normalOf, placeFaces, plate, solidBox, solidCylinder, solidTube } from './solid.js';

export const HULL = 0.8; // the hull's height
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const NOZZLE_Z = HULL / 2;

// input: { ship, defs, hull: traceHull(ship, defs), skin }. The skin is
// the hull's; each part's fittings are its maker's (palette.js fittingsOf),
// and the ship's paint and trim go over them all.
export function exteriorScene({ ship, defs, hull, skin: base }) {
  const faces = [];
  const glows = [];
  const exhausts = [];
  if (!hull.cells.length) return { faces, glows, exhausts };
  const skin = paintSkin(base, ship.paint, ship.trim);
  const style = styleOf(defs, ship);
  const shape = hullShape(hull, style);
  const round = style.corners === 'round';
  const curve = style.smooth ? 'fill' : skin.edge;
  const edge = { edge: skin.edge };
  const wallTop = style.profile[style.profile.length - 2][1] * HULL;

  // The shoulder and the side, with the livery band along the side. A
  // plated shoulder's steps are outlined; the upright side is not (its
  // corners show by their light), which spares the frame a stroke a piece.
  for (const { pts, outward, wall } of hullBands(shape, HULL)) {
    const middle = [0, 1].map((k) => pts.reduce((sum, p) => sum + p[k], 0) / 4);
    const inside = [middle[0] - outward[0] * 2, middle[1] - outward[1] * 2, HULL * 0.3];
    const normal = normalOf(pts, inside);
    faces.push({ pts, normal, color: skin.hull, edge: wall ? 'fill' : curve });
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
  // Wedges and curves, and any gap they shut in: plain hull.
  for (const pts of [...(hull.sculpt ?? []).map((piece) => piece.region), ...shape.holes]) {
    faces.push({ pts: pts.map(([x, y]) => [x, y, HULL]), normal: [0, 0, 1], color: skin.hull, edge: skin.seam });
  }

  for (const nose of shape.noses) noseFaces(faces, nose, skin, curve);

  // Each module's fittings on the roof, in its maker's colors, over its
  // maker's mark. A maker's version has its base part's fittings.
  const kits = new Map();
  const kitOf = (maker) => {
    if (!kits.has(maker)) kits.set(maker, { ...skin, ...fittingsOf(maker) });
    return kits.get(maker);
  };
  const makerAt = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    for (const [x, y] of placedCells(def, module)) makerAt.set(`${x},${y}`, def.manufacturer);
    const fittings = roofFittings(def, module, kitOf(def.manufacturer), { defs, round });
    faces.push(...fittings.faces);
    glows.push(...fittings.glows);
  }
  // The kit of the part whose cell (x, y) is: a heavy gun's barrel stands
  // between two of its cells.
  const kitAt = (x, y) => kitOf(makerAt.get(`${Math.floor(x)},${Math.floor(y)}`));

  // What sticks out of the hull, set on its skin: a nozzle in a housing,
  // round or eight-sided as the hull's corners are.
  const sides = round ? 12 : 8;
  for (const { x, y, side } of hull.nozzles) {
    const skin = kitAt(x, y);
    const [dx, dy] = STEP[side];
    const [sx, sy] = sidePoint(shape, [x + 0.5, y + 0.5], [dx, dy]);
    solidTube(faces, [sx - dx * 0.04, sy - dy * 0.04, NOZZLE_Z], [dx, dy], 0.16, 0.34, 0.34, skin.dark, { segments: sides });
    const start = [sx + dx * 0.1, sy + dy * 0.1, NOZZLE_Z];
    solidTube(faces, start, [dx, dy], 0.42, 0.2, 0.31, skin.dark, { endColor: skin.flame, glowing: true });
    glows.push({ at: [start[0] + dx * 0.78, start[1] + dy * 0.78, NOZZLE_Z], r: 0.6, color: skin.flame });
    exhausts.push({ at: [start[0] + dx * 0.42, start[1] + dy * 0.42, NOZZLE_Z], dir: [dx, dy], flame: skin.flame });
  }
  for (const { x, y, side, heavy } of hull.barrels) {
    const skin = kitAt(x, y);
    const [dx, dy] = STEP[side];
    if (heavy) {
      solidTube(faces, [x + 0.5 + dx * 0.36, y + 0.5 + dy * 0.36, HULL + 0.18], [dx, dy], 1, 0.09, 0.08, skin.metalHi, { segments: sides });
      continue;
    }
    for (const off of [-0.12, 0.12]) {
      const [cx, cy] = [x + 0.5 - dy * off, y + 0.5 + dx * off];
      solidTube(faces, [cx + dx * 0.36, cy + dy * 0.36, HULL + 0.14], [dx, dy], 0.8, 0.05, 0.05, skin.metalHi, { segments: 6 });
    }
  }
  // A docking collar at each hatch, out from the side below the shoulder.
  const collarR = Math.min(0.17, wallTop / 2 - 0.02);
  for (const { x, y, side } of hull.collars) {
    const skin = kitAt(x, y);
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
  // The styling pieces that stand on the hull's side (pieces.js).
  for (const placement of ship.styling ?? []) {
    const def = defs.styling?.get(placement.type);
    if (!def || def.shape) continue;
    const piece = pieceScene({ def, placement, shape, wallTop, skin });
    faces.push(...piece.faces);
    glows.push(...piece.glows);
  }
  return { faces, glows, exhausts };
}

// A part's fittings on its roof (at HULL), where placement puts it, in
// kit's colors (its maker's over the ship's skin) over its maker's mark:
// { faces, glows }. round when the hull's corners are. The ship wears them,
// and so does each building at the colony (colonyScene.js, M26).
export function roofFittings(def, placement, kit, { defs, round = true }) {
  const local = [];
  const lights = [];
  MARKS[defs.manufacturers?.get(def.manufacturer)?.mark]?.(local, kit, def);
  (ROOFS[def.base ?? def.id] ?? fromTemplate)(local, kit, lights, def, round);
  const glows = lights.map((g) => ({ ...g, at: placeFaces([{ pts: [g.at], normal: [0, 0, 1] }], def, placement)[0].pts[0] }));
  return { faces: placeFaces(local, def, placement), glows };
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
  // M23e's variants, each told apart from the part it varies.
  lightengine(f, k) {
    solidBox(f, [0.12, 0.24, Z], [1.02, 0.76, Z + 0.08], k.dark, { edge: k.edge });
    for (const x of [0.32, 0.56, 0.8]) solidBox(f, [x - 0.04, 0.32, Z + 0.08], [x + 0.04, 0.68, Z + 0.12], k.metal);
    solidBox(f, [1.3, 0.34, Z], [1.56, 0.66, Z + 0.12], k.metal, { edge: k.edge });
    solidBox(f, [1.78, 0.24, Z], [1.88, 0.76, Z + 0.03], k.hazard);
  },
  heavyengine(f, k) {
    solidBox(f, [0.12, 0.14, Z], [1.86, 1.86, Z + 0.14], k.dark, { edge: k.edge });
    for (const y of [0.56, 1.44]) {
      for (const x of [0.36, 0.66, 0.96, 1.26, 1.56]) solidBox(f, [x - 0.05, y - 0.3, Z + 0.14], [x + 0.05, y + 0.3, Z + 0.2], k.metal);
    }
    solidBox(f, [1.98, 0.34, Z], [2.42, 1.66, Z + 0.2], k.metal, { edge: k.edge });
    solidBox(f, [2.72, 0.14, Z], [2.86, 1.86, Z + 0.03], k.hazard);
  },
  smallreactor(f, k, glows) {
    solidBox(f, [0.2, 0.14, Z], [0.78, 0.36, Z + 0.06], k.dark, { edge: k.edge });
    solidCylinder(f, [1.38, 1.38, Z], 0.5, 0.08, k.metal, { edge: k.edge });
    solidCylinder(f, [1.38, 1.38, Z + 0.08], 0.36, 0.16, k.domeHi, { top: k.domeLo, edge: k.edge });
    solidCylinder(f, [1.38, 1.38, Z + 0.24], 0.15, 0.03, k.glow, { top: k.glowCore, emissive: true });
    glows.push({ at: [1.38, 1.38, Z + 0.3], r: 0.6, color: k.glow });
  },
  // A small turret with three barrels, round on a rounded hull.
  pointdefense(f, k, glows, def, round) {
    solidCylinder(f, [0.5, 0.62, Z], 0.26, 0.06, k.metal, { edge: k.edge });
    solidCylinder(f, [0.5, 0.62, Z + 0.06], 0.16, 0.12, k.domeLo, { top: k.domeHi, edge: k.edge, segments: round ? 12 : 8 });
    for (const x of [0.4, 0.5, 0.6]) solidTube(f, [x, 0.48, Z + 0.12], [0, -1], 0.86, 0.032, 0.032, k.metalHi, { segments: 6 });
    solidCylinder(f, [0.5, 0.62, Z + 0.18], 0.06, 0.02, k.livery, { emissive: true });
  },
  // The cannon's turret: one heavy barrel, a shell hopper and the loader's
  // hatch.
  cannon(f, k, glows, def, round) {
    solidBox(f, [0.14, 0.2, Z], [0.6, 0.82, Z + 0.12], k.dark, { edge: k.edge });
    for (const y of [0.36, 0.51, 0.66]) solidBox(f, [0.2, y - 0.03, Z + 0.12], [0.54, y + 0.03, Z + 0.14], k.metal);
    solidCylinder(f, [1, 0.62, Z], 0.4, 0.1, k.metal, { edge: k.edge });
    solidCylinder(f, [1, 0.62, Z + 0.1], 0.28, 0.22, k.domeLo, { top: k.domeHi, edge: k.edge, segments: round ? 14 : 8 });
    solidTube(f, [1, 0.36, Z + 0.22], [0, -1], 0.5, 0.08, 0.07, k.metalHi, { segments: round ? 10 : 8 });
    solidBox(f, [1.5, 0.34, Z], [1.84, 0.7, Z + 0.06], k.dark, { edge: k.edge });
  },
  shieldarray(f, k, glows) {
    for (const x of [0.27, 0.55]) solidBox(f, [x - 0.11, 1.3, Z], [x + 0.11, 1.86, Z + 0.12], k.dark, { edge: k.edge });
    solidCylinder(f, [1.28, 1.22, Z], 0.52, 0.06, k.dark, { edge: k.edge });
    solidCylinder(f, [1.28, 1.22, Z + 0.06], 0.4, 0.22, k.domeLo, { top: k.domeHi, edge: k.edge });
    solidCylinder(f, [1.28, 1.22, Z + 0.28], 0.18, 0.03, k.shield, { emissive: true });
    glows.push({ at: [1.28, 1.22, Z + 0.36], r: 1.1, color: k.shield });
  },
  bunks(f, k) {
    for (const y of [0.3, 0.7, 1.3, 1.7]) solidBox(f, [1.74, y - 0.1, Z], [1.9, y + 0.1, Z + 0.025], k.livery, { emissive: true });
    solidBox(f, [0.16, 0.66, Z], [0.64, 1.34, Z + 0.06], k.dark, { edge: k.edge });
    solidCylinder(f, [0.4, 1, Z + 0.06], 0.17, 0.1, k.domeLo, { top: k.domeHi, edge: k.edge });
  },
  surgery(f, k) {
    solidCylinder(f, [0.5, 1.12, Z], 0.4, 0.03, k.soft, { edge: k.edge });
    solidBox(f, [0.43, 0.84, Z + 0.03], [0.57, 1.4, Z + 0.06], k.medical);
    solidBox(f, [0.22, 1.05, Z + 0.03], [0.78, 1.19, Z + 0.06], k.medical);
    // A skylight over the operating table.
    solidBox(f, [1.16, 0.2, Z], [1.86, 0.82, Z + 0.05], k.dark, { edge: k.edge });
    solidBox(f, [1.24, 0.28, Z + 0.05], [1.78, 0.74, Z + 0.09], k.glassLo, { top: k.glassHi, edge: k.edge });
  },
  largehold(f, k) {
    for (const [x0, x1] of [[0.48, 1.96], [2.04, 3.52]]) {
      solidBox(f, [x0, 0.48, Z], [x1, 2.52, Z + 0.08], k.metal, { edge: k.edge });
      for (const y of [0.9, 1.3, 1.7, 2.1]) solidBox(f, [x0 + 0.1, y - 0.04, Z + 0.08], [x1 - 0.1, y + 0.04, Z + 0.11], k.dark);
    }
    solidBox(f, [0.48, 0.16, Z], [3.52, 0.32, Z + 0.03], k.hazard);
    solidBox(f, [0.48, 2.68, Z], [3.52, 2.84, Z + 0.03], k.hazard);
  },
};

// Module ids with roof fittings of their own, for tests.
export const ROOFED = Object.keys(ROOFS);

// A maker's mark on its parts' roofs (M23g; data/manufacturers.json names
// one), in the part's unrotated frame, under its fittings:
// (faces, kit, def) => void.
const MARK_Z = HULL + 0.004;
const MARKS = {
  // Hazard chevrons across the part's far end: a dark band, orange slants.
  chevrons(f, k, def) {
    const [w, h] = def.size;
    const [x0, x1, y0, y1] = [0.08, w - 0.08, h - 0.17, h - 0.07];
    const n = Math.max(2, Math.round(w * 2));
    const step = (x1 - x0) / n;
    f.push({ pts: [[x0, y0, MARK_Z], [x1, y0, MARK_Z], [x1, y1, MARK_Z], [x0, y1, MARK_Z]], normal: [0, 0, 1], color: k.markDark });
    for (let i = 0; i < n; i++) {
      const a = x0 + step * i;
      const pts = [[a, y1], [a + step * 0.5, y1], [Math.min(x1, a + step), y0], [a + step * 0.5, y0]];
      f.push({ pts: pts.map(([x, y]) => [x, y, MARK_Z + 0.002]), normal: [0, 0, 1], color: k.mark });
    }
  },
  // Two thin stripes down the part's near edge (Kestrel, M31).
  stripes(f, k, def) {
    const h = def.size[1];
    for (const x of [0.07, 0.17]) quad(f, x, 0.07, x + 0.05, h - 0.07, k.mark);
  },
  // Bare patches of unpainted metal, one in each far corner (Scrapline,
  // M31).
  patches(f, k, def) {
    const [w, h] = def.size;
    quad(f, 0.08, 0.08, 0.08 + Math.min(0.5, w * 0.3), 0.08 + Math.min(0.42, h * 0.3), k.mark);
    quad(f, w - 0.08 - Math.min(0.36, w * 0.22), h - 0.08 - Math.min(0.3, h * 0.25), w - 0.08, h - 0.08, k.markDark);
  },
};

// A flat patch of a mark on the roof, from (x0, y0) to (x1, y1).
function quad(f, x0, y0, x1, y1, color) {
  f.push({ pts: [[x0, y0, MARK_Z], [x1, y0, MARK_Z], [x1, y1, MARK_Z], [x0, y1, MARK_Z]], normal: [0, 0, 1], color });
}
export const MARKED = Object.keys(MARKS);

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
