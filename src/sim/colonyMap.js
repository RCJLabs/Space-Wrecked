// The colony as a battle map, for a raid (M29, raids.js): the colony's own
// grid (data/colony.json site), a tile a cell, as open ground. Each
// building is a block of cover where it stands: fields half cover, which a
// shot crosses, and everything else full cover (machinery), which blocks
// shots and sight. Nobody walks through a building. The landed ship's pad
// is off the west edge, where the crew comes out; the raiders' lander
// comes down off the east edge. Pure: the same buildings always give the
// same map.
//
// The map has mapFromShip.js's shape, with no space around it (margin 0)
// and site 'colony', so the fight draws it on the ground, as a job's site
// (src/ui/fight/view.js).
import { buildOf, siteDef } from './colony.js';
import { cellAt, createGrid } from './grid.js';
import { footprint } from './modules.js';
import { walkable } from './terrain.js';

export const COLONY_SITE = 'colony';
// How far in from its edge each side starts, in columns: the crew by the
// landed ship (west), the raiders where their lander set down (east).
export const START_COLUMNS = 3;

// The colony's grid as a battle map, or null without a grid to stand on.
export function colonyMap(colony, rules) {
  const site = rules.colony?.site;
  if (!site) return null;
  const { width, height } = site;
  const tiles = createGrid(width, height, 'floor');
  for (const building of colony.buildings) {
    const def = siteDef(building.type, rules);
    if (!def) continue;
    const [w, h] = footprint(def, building.rot);
    const tile = buildOf(building.type, rules)?.makes === 'food' ? 'half cover' : 'machinery';
    for (let y = building.y; y < building.y + h; y++) {
      for (let x = building.x; x < building.x + w; x++) if (x >= 0 && y >= 0 && x < width && y < height) tiles.cells[y * width + x] = tile;
    }
  }
  return {
    width,
    height,
    tilesPerCell: 1,
    origin: [0, 0],
    tiles,
    roomAt: createGrid(width, height, 1),
    hazards: createGrid(width, height, null),
    walls: { n: createGrid(width, height, null), w: createGrid(width, height, null) },
    rooms: [],
    hatches: [],
    margin: 0,
    site: COLONY_SITE,
  };
}

// Where a raid's sides start on the colony's map: the crew on open ground
// in the START_COLUMNS nearest the west edge, the raiders in those nearest
// the east, each side the rows nearest the middle first, then the column
// nearest its edge, then the row higher up. { crew, raiders }, each a list
// of [x, y], or null without room for both.
export function raidStarts(map, crew, raiders, rules) {
  const field = { map, doors: [], units: [] };
  const band = (columns) => {
    const spots = [];
    for (const x of columns) {
      for (let y = 0; y < map.height; y++) if (cellAt(map.tiles, x, y) === 'floor' && walkable(field, x, y, rules)) spots.push([x, y]);
    }
    const middle = (map.height - 1) / 2;
    return spots.sort((a, b) => Math.abs(a[1] - middle) - Math.abs(b[1] - middle) || columns.indexOf(a[0]) - columns.indexOf(b[0]) || a[1] - b[1]);
  };
  const columns = (from, step) => Array.from({ length: Math.min(START_COLUMNS, map.width) }, (_, i) => from + i * step);
  const west = band(columns(0, 1)).slice(0, crew);
  const east = band(columns(map.width - 1, -1)).slice(0, raiders);
  return west.length < crew || east.length < raiders ? null : { crew: west, raiders: east };
}
