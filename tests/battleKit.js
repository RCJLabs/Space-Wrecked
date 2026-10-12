// Shared pieces for the battle tests (not a test file itself): the real
// content data, small maps built by hand, and the example ship's map.
import { readFileSync } from 'node:fs';
import { buildShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { createGrid, step } from '../src/sim/grid.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { parseMap } from '../tools/battle-map.js';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

export const rules = indexDefs(readData());

// A map drawn in tools/battle-map.js's text format, in a template literal
// (its opening newline is dropped).
export function drawn(text, options) {
  return parseMap(text.replace(/^\n/, ''), rules.tiles, options);
}

// An open room of floor, width × height, with nothing in it.
export function openMap(width, height) {
  const grid = (fill) => createGrid(width, height, fill);
  return { width, height, tilesPerCell: 1, origin: [0, 0], tiles: grid('floor'), roomAt: grid(1), hazards: grid(null), walls: { n: grid(null), w: grid(null) }, rooms: [], hatches: [] };
}

// Changes a hand-built map in place: the tile at (x, y)...
export function put(map, x, y, name) {
  map.tiles.cells[y * map.width + x] = name;
  if (name === 'space' || name === 'hull') map.roomAt.cells[y * map.width + x] = null;
  return map;
}

// ...what stands on a side of it...
export function wall(map, x, y, side, kind = 'wall') {
  const [ex, ey, key] = side === 's' ? [x, y + 1, 'n'] : side === 'e' ? [x + 1, y, 'w'] : [x, y, side];
  map.walls[key].cells[ey * map.width + ex] = kind;
  return map;
}

// ...and a wreck on it.
export function wreck(map, x, y, hazard) {
  map.hazards.cells[y * map.width + x] = hazard;
  return map;
}

// Just enough of a battle for sight and cover: the map and its open doors.
export function field(map, doors = []) {
  return { map, doors, units: [] };
}

// The example ship (tests/fixtures/example-ship.json) as a battle map.
export function exampleMap() {
  const ship = buildShip(rules, 'starter', JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8')).placements).ship;
  return mapFromShip(ship, rules);
}

// The taps and buttons that give a battle action as an order on the Fight
// screen (fight.js): choose the unit, then tap twice, or press the button.
export function ordersOf(action) {
  const pick = { type: 'fight/select', unit: action.unit };
  const tap = (x, y) => ({ type: 'fight/tap', x, y });
  switch (action.type) {
    case 'move':
      return [pick, tap(...action.to), tap(...action.to)];
    case 'shoot':
      return [pick, { type: 'fight/aim', target: action.target }, { type: 'fight/aim', target: action.target }];
    case 'end':
      return [{ type: 'fight/end' }];
    default:
      return [pick, { type: `fight/${action.type}` }];
  }
}

export { step };
