// What is on a battle map tile, for its card: the room and what stands on
// the tile, what is on its edges, and any wreck. doors: a battle's open
// doors (battle.doors), if any.
import { cellAt } from '../../sim/grid.js';
import { edgeKey, wallAt } from '../../sim/mapFromShip.js';

export const WRECK_TEXT = { fire: 'on fire', vacuum: 'open to vacuum', rubble: 'full of rubble' };
const SIDE_NAMES = { n: 'north', e: 'east', s: 'south', w: 'west' };
const EDGE_TEXT = { wall: 'wall', hull: 'hull', door: 'door', hatch: 'hatch' };

// The name of the room a uid stands for, as its module is called.
export function roomName(map, uid, defs) {
  const type = map.rooms.find((room) => room.uid === uid)?.type;
  return defs.modules.get(type)?.name ?? type;
}

// { title, lines } for tile (x, y).
export function tileText(map, x, y, defs, doors = []) {
  const uid = cellAt(map.roomAt, x, y);
  const kind = cellAt(map.tiles, x, y);
  const title = uid === null ? (kind === 'hull' ? 'Hull' : 'Space') : roomName(map, uid, defs);
  const lines = [`Tile (${x}, ${y}): ${kind}.`];
  if (uid !== null) {
    const edges = Object.entries(SIDE_NAMES)
      .map(([side, name]) => {
        const edge = wallAt(map, x, y, side);
        const open = edge === 'door' && doors.includes(edgeKey(x, y, side));
        return edge && `${open ? 'open door' : EDGE_TEXT[edge]} to the ${name}`;
      })
      .filter(Boolean);
    lines.push(edges.length ? `Edges: ${edges.join(', ')}.` : 'Open on every side.');
    const wreck = cellAt(map.hazards, x, y);
    if (wreck) lines.push(`Wrecked: ${WRECK_TEXT[wreck]}.`);
  }
  return { title, lines };
}
