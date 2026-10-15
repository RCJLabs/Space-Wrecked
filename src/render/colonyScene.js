// The colony seen from above (M26): the world's ground in its kind's colors
// (palette.js grounds), the colony's grid cleared on it, each building on
// its slab as the part it was (its roof fittings, exterior.js), its lights
// on while it has power and off while it is dark, and the ship landed off
// the grid's west edge, nose toward it, as it looks from outside. From M27
// the farms and mines stand there too (colonyBuilds.js); a building being
// placed or moved stands where it would go as a ghost, on a plate marking
// whether it can; and a building looked at is framed.
// Pure: colony cells, z up. Returns { ground, faces, glows, box, picks }:
// ground is what lies flat on the ground, drawn first and in its order
// (everything stands on it); faces and glows the rest (solid.js, mesh.js);
// box what the camera keeps in view: the ship, and the grid as far as the
// buildings reach and ROOM columns on (SHOWN at least), or with whole the
// grid alone, all of it, its cells drawn; picks each building's box, for a
// tap to find it ({ uid, box: [x0, y0, z0, x1, y1, z1] }, pick.js pickBox).
import { footprint } from '../sim/modules.js';
import { siteDef } from '../sim/colony.js';
import { BUILD_TALL, buildModel } from './colonyBuilds.js';
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
const TALL = Math.max(HULL + 0.45, BUILD_TALL);
// Columns of the grid in view past the buildings, and the least in view.
const ROOM = 3;
const SHOWN = 8;
// A ghost's see-through, and the frame round a building looked at.
const GHOST = 0.55;
const FRAME = 0.12;
// The grid's lines while placing: half their width, and how faint.
const LINE = 0.025;
const LINE_ALPHA = 0.16;
// How strongly the empty pad shows while the ship is away (M28).
const PAD = 0.55;

// input: { ship, hull (hull.js traceHull), buildings: [{ uid, type, x, y,
// rot, powered }], site: { width, height }, kind (the world's), defs, skin
// (the ship's maker's, painted with the ship's paint and trim here), mark:
// null or { uids (the ship's parts a refusal is about, or the one being
// given), ghost ({ type, x, y, rot, ok }: a building where it would stand,
// ok when it can, or null), selected (the uid of the building looked at,
// or null) }, whole (true: the view keeps the whole grid, and only it),
// away (true while the ship is out on a trip, M28: its pad stands empty) }.
export function colonyScene({ ship, hull, buildings, site, kind, defs, skin: base, mark = null, whole = false, away = false }) {
  const colors = groundFor(kind);
  const ground = [];
  const faces = [];
  const glows = [];
  const picks = [];
  const skin = paintSkin(base, ship.paint, ship.trim);
  plate(ground, [-0.5, -0.5], [site.width + 0.5, site.height + 0.5], 0, colors.cleared);
  // Placing, the grid's cells drawn faintly on it, so a tap can be aimed.
  if (whole) {
    for (let i = 0; i <= site.width; i++) plate(ground, [i - LINE, 0], [i + LINE, site.height], 0, palette.ink, { alpha: LINE_ALPHA });
    for (let j = 0; j <= site.height; j++) plate(ground, [0, j - LINE], [site.width, j + LINE], 0, palette.ink, { alpha: LINE_ALPHA });
  }

  // The ship, landed beside the grid; while it is away, the scorched pad
  // it stands on, so the view keeps its place.
  const at = landedAt(hull, site);
  const box = { x0: -0.5, y0: -0.5, x1: SHOWN, y1: site.height + 0.5 };
  if (hull.cells.length) {
    const [x0, y0, x1, y1] = hullBounds(hull);
    if (away) {
      plate(ground, [x0 + at[0], y0 + at[1]], [x1 + at[0], y1 + at[1]], 0, colors.slab, { edge: skin.edge, alpha: PAD });
    } else {
      const outside = exteriorScene({ ship, defs, hull, skin: base });
      for (const face of outside.faces) faces.push(moved(face, at));
      for (const glow of outside.glows) glows.push({ ...glow, at: shifted(glow.at, at) });
    }
    Object.assign(box, { x0: Math.min(box.x0, x0 + at[0]), y0: Math.min(box.y0, y0 + at[1]), y1: Math.max(box.y1, y1 + at[1]) });
  }

  // Each building on its slab: a part's walls and roof in the ship's
  // plates, its fittings on top in its maker's colors; a farm's fields or a
  // mine's headframe. A dark one's lights are out.
  const round = styleOf(defs, ship).corners === 'round';
  for (const building of buildings) {
    const def = siteDef(building.type, defs);
    if (!def) continue;
    const [w, h] = footprint(def, building.rot);
    const [x, y] = [building.x, building.y];
    plate(ground, [x - SLAB, y - SLAB], [x + w + SLAB, y + h + SLAB], 0, colors.slab, { edge: skin.edge });
    box.x1 = Math.max(box.x1, x + w + ROOM);
    const model = standing(building, { defs, skin, round, lit: building.powered });
    faces.push(...model.faces);
    glows.push(...model.glows);
    picks.push({ uid: building.uid, box: [x, y, 0, x + w, y + h, model.tall] });
    if (building.uid === mark?.selected) frame(ground, x - SLAB, y - SLAB, x + w + SLAB, y + h + SLAB, palette.accent);
  }

  // Parts being given, or refused: a glow over each on the ship.
  for (const uid of away ? [] : mark?.uids ?? []) {
    const module = ship.modules.find((m) => m.uid === uid);
    const def = module && defs.modules.get(module.type);
    if (!def) continue;
    const [w, h] = footprint(def, module.rot);
    glows.push({ at: [module.x + w / 2 + at[0], module.y + h / 2 + at[1], HULL + 0.5], r: Math.max(w, h) * 0.9, color: palette.accent });
  }
  // A building where it would stand: a see-through ghost on a plate, the
  // accent's where it can stand and the warning's where it can't.
  const ghost = mark?.ghost;
  const ghostDef = ghost && siteDef(ghost.type, defs);
  if (ghostDef) {
    const [w, h] = footprint(ghostDef, ghost.rot);
    const color = ghost.ok ? palette.accent : palette.bad;
    plate(ground, [ghost.x - SLAB, ghost.y - SLAB], [ghost.x + w + SLAB, ghost.y + h + SLAB], 0, color, { edge: skin.edge, alpha: GHOST });
    const model = standing({ ...ghost, uid: 0 }, { defs, skin, round, lit: false });
    for (const { emissive, ...face } of model.faces) faces.push({ ...face, alpha: GHOST });
    glows.push({ at: [ghost.x + w / 2, ghost.y + h / 2, 0.3], r: Math.max(w, h) * 0.8, color });
    box.x1 = Math.max(box.x1, ghost.x + w + 1);
  }
  box.x1 = Math.min(box.x1, site.width + 0.5);
  // Placing, the whole grid, edge to edge: its cells as big as they fit.
  const shown = whole ? { x0: -0.5, y0: -0.5, x1: site.width + 0.5, y1: site.height + 0.5 } : { x0: box.x0 - MARGIN, y0: box.y0 - MARGIN, x1: box.x1 + MARGIN, y1: box.y1 + MARGIN };
  return { ground, faces, glows, box: { ...shown, z1: TALL }, picks };
}

// What stands on a building's slab: { faces, glows, tall (its height) }. A
// part's walls and roof with its fittings; a farm's or a mine's model.
function standing(building, { defs, skin, round, lit }) {
  const build = defs.colony?.builds?.get(building.type);
  if (build) return { ...buildModel(build, building, { extra: { edge: skin.edge }, lit }), tall: BUILD_TALL };
  const def = defs.modules.get(building.type);
  const [w, h] = footprint(def, building.rot);
  const [x, y] = [building.x, building.y];
  const faces = [];
  solidBox(faces, [x, y, 0], [x + w, y + h, HULL], skin.plates[building.uid % skin.plates.length], { edge: skin.edge });
  const fittings = roofFittings(def, building, { ...skin, ...fittingsOf(def.manufacturer) }, { defs, round });
  if (lit) return { faces: [...faces, ...fittings.faces], glows: fittings.glows, tall: HULL + 0.45 };
  for (const { emissive, ...face } of fittings.faces) faces.push(face);
  return { faces, glows: [], tall: HULL + 0.45 };
}

// A frame lying on the ground round [x0, y0] to [x1, y1].
function frame(out, x0, y0, x1, y1, color) {
  plate(out, [x0 - FRAME, y0 - FRAME], [x1 + FRAME, y0], 0, color);
  plate(out, [x0 - FRAME, y1], [x1 + FRAME, y1 + FRAME], 0, color);
  plate(out, [x0 - FRAME, y0], [x0, y1], 0, color);
  plate(out, [x1, y0], [x1 + FRAME, y1], 0, color);
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
