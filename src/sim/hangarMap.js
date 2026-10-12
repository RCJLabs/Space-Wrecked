// The hangar as a battle map, for a raid (raid.js): the ship's own map
// (mapFromShip.js, still the only way a ship becomes a battle map) standing
// on the hangar's deck. The space around the ship becomes deck, PAD cells
// more of it are laid around that, and each airlock's hatch becomes a door
// onto the deck: in a hangar an airlock is just a door. The hangar's doors
// are at the ship's stern, the map's west edge, where raiders come in.
// Pure: the same ship always gives the same map.
//
// The map has mapFromShip.js's shape, with 'deck' tiles in no room, no
// hatches, no space around it (margin 0), and hangar: true.
import { cellAt, createGrid, SIDES, step } from './grid.js';
import { mapFromShip, wallAt } from './mapFromShip.js';

export const PAD = 2; // cells of deck beyond the ship map's own margin

export function hangarMap(ship, defs) {
  const inner = mapFromShip(ship, defs);
  if (!inner) return null;
  const p = PAD * defs.tilesPerCell;
  const [width, height] = [inner.width + 2 * p, inner.height + 2 * p];
  const grid = (fill) => createGrid(width, height, fill);
  const tiles = grid('deck');
  const roomAt = grid(null);
  const hazards = grid(null);
  const walls = { n: grid(null), w: grid(null) };
  for (let y = 0; y < inner.height; y++) {
    for (let x = 0; x < inner.width; x++) {
      const k = (y + p) * width + x + p;
      const tile = cellAt(inner.tiles, x, y);
      tiles.cells[k] = tile === 'space' ? 'deck' : tile;
      roomAt.cells[k] = cellAt(inner.roomAt, x, y);
      hazards.cells[k] = cellAt(inner.hazards, x, y);
      for (const side of ['n', 'w']) {
        const edge = cellAt(inner.walls[side], x, y);
        walls[side].cells[k] = edge === 'hatch' ? 'door' : edge;
      }
    }
  }
  return {
    width,
    height,
    tilesPerCell: inner.tilesPerCell,
    origin: [inner.origin[0] - PAD, inner.origin[1] - PAD],
    tiles,
    roomAt,
    hazards,
    walls,
    rooms: inner.rooms.map((room) => ({ ...room, x: room.x + p, y: room.y + p })),
    hatches: [],
    margin: 0,
    hangar: true,
  };
}

// How many ways in the ship has from the deck: doors between a room and
// the deck, one for each airlock.
export function waysIn(map) {
  let ways = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (cellAt(map.roomAt, x, y) === null) continue;
      for (const side of SIDES) {
        const [nx, ny] = step(x, y, side);
        if (wallAt(map, x, y, side) === 'door' && cellAt(map.tiles, nx, ny) === 'deck') ways += 1;
      }
    }
  }
  return ways;
}

// The deck tiles inside the hangar's doors, where raiders start: the
// westmost columns of the deck, nearest the middle row first.
export function hangarDoors(map) {
  const deep = PAD * map.tilesPerCell;
  const middle = (map.height - 1) / 2;
  const spots = [];
  for (let x = 0; x < deep; x++) {
    for (let y = 0; y < map.height; y++) if (cellAt(map.tiles, x, y) === 'deck') spots.push([x, y]);
  }
  return spots.sort((a, b) => a[0] - b[0] || Math.abs(a[1] - middle) - Math.abs(b[1] - middle) || a[1] - b[1]);
}
