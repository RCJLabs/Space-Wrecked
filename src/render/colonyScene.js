// The colony seen from above (M26): the world's ground in its kind's colors
// (palette.js grounds), the colony's grid cleared on it, each building on
// its slab as the part it was (its roof fittings, exterior.js), its lights
// on while it has power and off while it is dark, and the ship landed off
// the grid's west edge, nose toward it, as it looks from outside. A part
// being given shows where it is on the ship and where it would stand.
// Pure: colony cells, z up. Returns { ground, faces, glows, box }: ground
// is what lies flat on the ground, drawn first and in its order
// (everything stands on it); faces and glows the rest (solid.js, mesh.js);
// box what the camera keeps in view: the ship, and the grid as far as the
// buildings reach and ROOM columns on (SHOWN at least).
import { footprint } from '../sim/modules.js';
import { exteriorScene, HULL, roofFittings } from './exterior.js';
import { OVERHANG } from './hull.js';
import { styleOf } from './hullShape.js';
import { fittingsOf, groundFor, paintSkin, palette } from './palette.js';
import { plate, solidBox } from './solid.js';

// Cells of open ground between the ship's nose and the grid.
export const GAP = 2;
// Cells of land in view round the ship and the grid.
const MARGIN = 1;
// How far a building's slab reaches past its walls.
const SLAB = 0.22;
// The tallest thing standing: a building's roof and what is on it.
const TALL = HULL + 0.45;
// Columns of the grid in view past the buildings, and the least in view.
const ROOM = 3;
const SHOWN = 8;

// input: { ship, hull (hull.js traceHull), buildings: [{ uid, type, x, y,
// rot, powered }], site: { width, height }, kind (the world's), defs, skin
// (the ship's maker's, painted with the ship's paint and trim here), mark:
// null or { uids (the ship's parts being given, or that a refusal is
// about), spot ({ type, x, y, rot }: where the part would stand, or null) } }.
export function colonyScene({ ship, hull, buildings, site, kind, defs, skin: base, mark = null }) {
  const colors = groundFor(kind);
  const ground = [];
  const faces = [];
  const glows = [];
  const skin = paintSkin(base, ship.paint, ship.trim);
  plate(ground, [-0.5, -0.5], [site.width + 0.5, site.height + 0.5], 0, colors.cleared);

  // The ship, landed beside the grid.
  const at = landedAt(hull, site);
  const box = { x0: -0.5, y0: -0.5, x1: SHOWN, y1: site.height + 0.5 };
  if (hull.cells.length) {
    const outside = exteriorScene({ ship, defs, hull, skin: base });
    for (const face of outside.faces) faces.push(moved(face, at));
    for (const glow of outside.glows) glows.push({ ...glow, at: shifted(glow.at, at) });
    const [x0, y0, x1, y1] = hullBounds(hull);
    Object.assign(box, { x0: Math.min(box.x0, x0 + at[0]), y0: Math.min(box.y0, y0 + at[1]), y1: Math.max(box.y1, y1 + at[1]) });
  }

  // Each building on its slab: walls and roof in the ship's plates, its
  // part's fittings on top in its maker's colors. A dark one's lights are
  // out.
  const round = styleOf(defs, ship).corners === 'round';
  for (const building of buildings) {
    const def = defs.modules.get(building.type);
    if (!def) continue;
    const [w, h] = footprint(def, building.rot);
    const [x, y] = [building.x, building.y];
    plate(ground, [x - SLAB, y - SLAB], [x + w + SLAB, y + h + SLAB], 0, colors.slab, { edge: skin.edge });
    box.x1 = Math.max(box.x1, x + w + ROOM);
    solidBox(faces, [x, y, 0], [x + w, y + h, HULL], skin.plates[building.uid % skin.plates.length], { edge: skin.edge });
    const fittings = roofFittings(def, building, { ...skin, ...fittingsOf(def.manufacturer) }, { defs, round });
    if (building.powered) {
      faces.push(...fittings.faces);
      glows.push(...fittings.glows);
    } else {
      for (const { emissive, ...face } of fittings.faces) faces.push(face);
    }
  }

  // Parts being given, or refused: a glow over each on the ship; and
  // where one would stand, marked out on the ground.
  for (const uid of mark?.uids ?? []) {
    const module = ship.modules.find((m) => m.uid === uid);
    const def = module && defs.modules.get(module.type);
    if (!def) continue;
    const [w, h] = footprint(def, module.rot);
    glows.push({ at: [module.x + w / 2 + at[0], module.y + h / 2 + at[1], HULL + 0.5], r: Math.max(w, h) * 0.9, color: palette.accent });
  }
  const spot = mark?.spot;
  const spotDef = spot && defs.modules.get(spot.type);
  if (spotDef) {
    const [w, h] = footprint(spotDef, spot.rot);
    plate(ground, [spot.x - SLAB, spot.y - SLAB], [spot.x + w + SLAB, spot.y + h + SLAB], 0, palette.accent, { edge: skin.edge });
    glows.push({ at: [spot.x + w / 2, spot.y + h / 2, 0.3], r: Math.max(w, h) * 0.8, color: palette.accent });
    box.x1 = Math.max(box.x1, spot.x + w + 1);
  }
  box.x1 = Math.min(box.x1, site.width + 0.5);
  return { ground, faces, glows, box: { x0: box.x0 - MARGIN, y0: box.y0 - MARGIN, x1: box.x1 + MARGIN, y1: box.y1 + MARGIN, z1: TALL } };
}

// Where the ship is moved to stand: its nose GAP cells off the grid's west
// edge, its middle level with the grid's. [dx, dy] in cells.
export function landedAt(hull, site) {
  if (!hull.cells.length) return [0, 0];
  const [, y0, x1, y1] = hullBounds(hull);
  return [-GAP - x1, Math.round(site.height / 2 - (y0 + y1) / 2)];
}

// The hull's cells and what overhangs them: [x0, y0, x1, y1].
function hullBounds(hull) {
  const xs = hull.cells.map(([x]) => x);
  const ys = hull.cells.map(([, y]) => y);
  return [Math.min(...xs) - OVERHANG.left, Math.min(...ys) - OVERHANG.top, Math.max(...xs) + 1 + OVERHANG.right, Math.max(...ys) + 1 + OVERHANG.bottom];
}

function moved(face, by) {
  const next = { ...face, pts: face.pts.map((p) => shifted(p, by)) };
  if (face.sortAt) next.sortAt = shifted(face.sortAt, by);
  return next;
}

function shifted([x, y, z], [dx, dy]) {
  return [x + dx, y + dy, z];
}
