// A ship's layout as a battle map: the only way a ship becomes a boarding
// map (ROADMAP §4.3). Each cell becomes tilesPerCell × tilesPerCell tiles:
// its room's interior template (data/modules.json) where a room stands, and
// space or hull around it. Walls stand on the edges between tiles: room
// walls, the hull, doorways where rooms join and hatches where airlocks
// open onto space, all as the builder joins them (builder.js joins()). A
// room can be wrecked: on fire, open to vacuum or full of rubble.
//
// Pure and deterministic: the same ship always gives the same map, and so
// does the same ship anywhere in the yard (only origin changes).
//
// A map is plain data, with grids from grid.js:
//   width, height  in tiles
//   tilesPerCell
//   origin         [x, y]: the yard cell under tile (0, 0)
//   tiles          grid of tile names: 'space', 'hull' (a notch or gap the
//                  hull fills: builder.js spaceTest()), or a name from the
//                  tiles legend in data/modules.json ('floor', 'half cover',
//                  'full cover', 'machinery', 'console', 'airlock')
//   roomAt         grid of the uid of the room each tile is in, or null
//   hazards        grid of the wreck of each tile's room: null, 'fire',
//                  'vacuum' or 'rubble'
//   walls          { n, w }: grids of what stands on each tile's north and
//                  west edge (wallAt reads any side): null for nothing,
//                  'wall' between rooms, 'hull' between a room and space or
//                  hull, 'door' where two rooms join, 'hatch' where an
//                  airlock opens onto space
//   rooms          [{ uid, type, x, y, w, h, wreck }] in build order: each
//                  room's tiles as a box, and its wreck or null
//   hatches        [{ uid, x, y, side }]: the tile inside each hatch, and the
//                  side it opens onto space
import { joins, occupancy, spaceTest } from './builder.js';
import { cellAt, createGrid, inBounds, step } from './grid.js';
import { footprint, hasTag, interiorRows, isRotation } from './modules.js';

export const MARGIN = 1; // cells of space around the ship
export const WRECKS = ['fire', 'vacuum', 'rubble'];

// wrecked: { [uid]: 'fire' | 'vacuum' | 'rubble' }. A flag for a room the
// ship doesn't have, or one that isn't a wreck, is left out. An empty ship
// has no map: null.
export function mapFromShip(ship, defs, { wrecked = {} } = {}) {
  const t = defs.tilesPerCell;
  const owners = occupancy(ship, defs);
  const placed = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (def && isRotation(module.rot)) placed.set(module.uid, { module, def, rows: interiorRows(def, module.rot).map((row) => [...row]) });
  }
  const taken = [];
  for (let y = 0; y < owners.height; y++) {
    for (let x = 0; x < owners.width; x++) if (cellAt(owners, x, y) !== null) taken.push([x, y]);
  }
  if (!taken.length) return null;

  // The ship's cells and a margin of space around them, in cells.
  const ox = Math.min(...taken.map(([x]) => x)) - MARGIN;
  const oy = Math.min(...taken.map(([, y]) => y)) - MARGIN;
  const cw = Math.max(...taken.map(([x]) => x)) + 1 + MARGIN - ox;
  const ch = Math.max(...taken.map(([, y]) => y)) + 1 + MARGIN - oy;
  const [width, height] = [cw * t, ch * t];

  // Tiles and rooms, a cell's worth at a time.
  const tiles = createGrid(width, height, null);
  const roomAt = createGrid(width, height, null);
  const isSpace = spaceTest(ship, defs);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const [x, y] = [ox + cx, oy + cy];
      const uid = cellAt(owners, x, y) ?? null;
      const room = uid === null ? null : placed.get(uid);
      const outside = isSpace(x, y) ? 'space' : 'hull';
      for (let j = 0; j < t; j++) {
        for (let i = 0; i < t; i++) {
          const k = (cy * t + j) * width + cx * t + i;
          if (!room) {
            tiles.cells[k] = outside;
            continue;
          }
          const char = room.rows[(y - room.module.y) * t + j][(x - room.module.x) * t + i];
          tiles.cells[k] = defs.tiles[char] ?? 'floor';
          roomAt.cells[k] = uid;
        }
      }
    }
  }

  // Doorways and hatches, on the middle tile edge of the cell edge the
  // builder put them on.
  const gaps = new Map();
  const hatches = [];
  for (const { uid, x, y, side, kind } of joins(ship, defs).openings) {
    if (kind === 'open') continue; // corridors side by side: no wall to cut
    const [tx, ty] = edgeTile(x - ox, y - oy, side, t);
    gaps.set(edgeKey(tx, ty, side), kind);
    if (kind === 'hatch') hatches.push({ uid, x: tx, y: ty, side });
  }

  // What stands on each tile's north and west edge.
  const corridor = (uid) => hasTag(placed.get(uid).def, 'corridor');
  const walls = { n: createGrid(width, height, null), w: createGrid(width, height, null) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const side of ['n', 'w']) {
        const [nx, ny] = step(x, y, side);
        if (!inBounds(tiles, nx, ny)) continue;
        const a = cellAt(roomAt, x, y);
        const b = cellAt(roomAt, nx, ny);
        if (a === b || (a !== null && b !== null && corridor(a) && corridor(b))) continue;
        const gap = gaps.get(edgeKey(x, y, side));
        walls[side].cells[y * width + x] = a !== null && b !== null ? (gap === 'door' ? 'door' : 'wall') : gap === 'hatch' ? 'hatch' : 'hull';
      }
    }
  }

  // Wrecked rooms.
  const wrecks = new Map();
  for (const [key, wreck] of Object.entries(wrecked)) {
    if (placed.has(Number(key)) && WRECKS.includes(wreck)) wrecks.set(Number(key), wreck);
  }
  const hazards = { ...roomAt, cells: roomAt.cells.map((uid) => (uid === null ? null : wrecks.get(uid) ?? null)) };
  const onMap = new Set(roomAt.cells);
  const rooms = ship.modules
    .filter((module) => placed.has(module.uid) && onMap.has(module.uid))
    .map(({ uid, type, x, y, rot }) => {
      const [w, h] = footprint(placed.get(uid).def, rot);
      return { uid, type, x: (x - ox) * t, y: (y - oy) * t, w: w * t, h: h * t, wreck: wrecks.get(uid) ?? null };
    });

  return { width, height, tilesPerCell: t, origin: [ox, oy], tiles, roomAt, hazards, walls, rooms, hatches };
}

// The wreck after this one, cycling: none, each of WRECKS, then none.
export function nextWreck(wreck) {
  const i = WRECKS.indexOf(wreck);
  return i === WRECKS.length - 1 ? null : WRECKS[i + 1];
}

// What stands on the given side of tile (x, y): null, 'wall', 'hull',
// 'door' or 'hatch'. Nothing stands on the map's own edge.
export function wallAt(map, x, y, side) {
  if (side === 'n' || side === 'w') return cellAt(map.walls[side], x, y) ?? null;
  const [nx, ny] = step(x, y, side);
  return cellAt(map.walls[side === 's' ? 'n' : 'w'], nx, ny) ?? null;
}

// The tile of cell (cx, cy) at the middle of its given side (the left or
// upper of two middle tiles).
function edgeTile(cx, cy, side, t) {
  const mid = Math.floor((t - 1) / 2);
  if (side === 'n') return [cx * t + mid, cy * t];
  if (side === 's') return [cx * t + mid, cy * t + t - 1];
  if (side === 'w') return [cx * t, cy * t + mid];
  return [cx * t + t - 1, cy * t + mid];
}

// One key per tile edge, whichever of its two tiles names it.
function edgeKey(x, y, side) {
  if (side === 's') return `${x},${y + 1},n`;
  if (side === 'e') return `${x + 1},${y},w`;
  return `${x},${y},${side}`;
}
