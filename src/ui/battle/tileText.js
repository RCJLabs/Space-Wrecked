// What is on a battle map tile, for its card: the room and what stands on
// the tile, what is on its edges, and any wreck. doors: a battle's open
// doors (battle.doors), if any; fires: the fires a weapon set (M37,
// battle.fires), if any.
import { cellAt } from '../../sim/grid.js';
import { edgeKey, wallAt } from '../../sim/mapFromShip.js';

export const WRECK_TEXT = { fire: 'on fire', vacuum: 'open to vacuum', rubble: 'full of rubble' };
const SIDE_NAMES = { n: 'north', e: 'east', s: 'south', w: 'west' };
const EDGE_TEXT = { wall: 'wall', hull: 'hull', door: 'door', hatch: 'hatch' };
// A tile in no room: the hull, space, the hangar's deck, a site's rock or
// ground.
const TILE_TITLES = { hull: 'Hull', space: 'Space', deck: 'Hangar deck', rock: 'Rock' };

// The name of the room a uid stands for, as its module is called.
export function roomName(map, uid, defs) {
  const type = map.rooms.find((room) => room.uid === uid)?.type;
  return defs.modules.get(type)?.name ?? type;
}

// { title, lines } for tile (x, y). On a job's site, an area walls close
// off is no room: the tile is called what it is.
export function tileText(map, x, y, defs, doors = [], fires = []) {
  const uid = cellAt(map.roomAt, x, y);
  const kind = cellAt(map.tiles, x, y);
  const room = uid !== null && map.rooms.some((r) => r.uid === uid);
  const title = room ? roomName(map, uid, defs) : TILE_TITLES[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
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
  const fire = fires.find(({ at }) => at[0] === x && at[1] === y);
  if (fire) lines.push(`Burning through round ${fire.until}: ${defs.balance.fireDamage} to anyone at the start of their turn here.`);
  return { title, lines };
}
