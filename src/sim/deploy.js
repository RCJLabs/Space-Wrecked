// Where a boarding fight's units start on a ship's battle map: the squad on
// the bridge, and the boarders at the hatches they come in by. Each side
// takes the tiles nearest its start by walking distance (through doors),
// ties going to the tile higher up the map, then the one further left. Pure:
// the same map and lists always give the same places.
import { hasTag } from './modules.js';
import { stepsFrom } from './moves.js';
import { tileRule, walkable } from './terrain.js';

// crew: job ids; enemies: enemy ids (data/jobs.json, data/enemies.json).
// held: the tiles someone stands on already, [[x, y]] (a ship's turrets,
// machinesOn). Returns { ok: true, units: [{ kind, x, y }] }, crew first,
// ready for createBattle, or { ok: false, error } saying what the ship
// needs.
export function deploy(map, crew, enemies, rules, held = []) {
  const field = { map, doors: [], units: [] };
  if (!map.hatches.length) return { ok: false, error: 'Boarders need a way in: put an airlock on the hull.' };
  const hatches = map.hatches.map(({ x, y }) => [x, y]);
  const fromHatch = stepsFrom(field, hatches, rules);

  // The squad starts on the bridge; a ship without one, as far from the
  // hatches as it goes.
  const bridge = [];
  for (const room of map.rooms) {
    if (!hasTag(rules.modules.get(room.type), 'bridge')) continue;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) if (walkable(field, x, y, rules)) bridge.push([x, y]);
    }
  }
  const furthest = Math.max(...fromHatch.values());
  const start = bridge.length ? bridge : [...fromHatch].filter(([, steps]) => steps === furthest).map(([key]) => key.split(',').map(Number));

  const taken = new Set(held.map(([x, y]) => `${x},${y}`));
  const place = (kinds, away) => {
    const spots = nearestFirst(away).filter((key) => !taken.has(key)).slice(0, kinds.length);
    spots.forEach((key) => taken.add(key));
    return spots.map((key, i) => {
      const [x, y] = key.split(',').map(Number);
      return { kind: kinds[i], x, y };
    });
  };
  const squad = place(crew, stepsFrom(field, start, rules));
  const boarders = place(enemies, fromHatch);
  if (squad.length < crew.length || boarders.length < enemies.length) {
    return { ok: false, error: `There isn't room on board for ${crew.length} crew and ${enemies.length} boarders.` };
  }
  return { ok: true, units: [...squad, ...boarders] };
}

// The machines a ship's map holds (M39): each working part with a `unit`
// (data/modules.json, the security turret) fights from its mount, for
// `side`, its ship's owner's: its room's first tile of full cover, top to
// bottom then left to right, so it stands in no one's way (a unit there
// sees and is seen as from any tile: sight.js), or with none its first
// floor tile. A wrecked one doesn't. Named by their kind, numbered when
// there are two or more of it. [{ kind, x, y, side, name }], in build
// order, ready for createBattle after everyone else.
export function machinesOn(map, rules, side) {
  const field = { map, doors: [], units: [] };
  const found = map.rooms.flatMap((room) => {
    const unit = room.wreck ? null : rules.modules.get(room.type)?.unit;
    const at = unit && (mountOf(field, room, rules) ?? floorOf(field, room, rules));
    return at ? [{ kind: unit.id, x: at[0], y: at[1], side, name: unit.name }] : [];
  });
  return found.map((machine) => {
    const same = found.filter((other) => other.kind === machine.kind);
    return same.length > 1 ? { ...machine, name: `${machine.name} ${same.indexOf(machine) + 1}` } : machine;
  });
}

// A room's first tile of full cover, or null.
export function mountOf(field, room, rules) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (field.map.roomAt.cells[y * field.map.width + x] === room.uid && tileRule(field, x, y, rules).cover === 'full') return [x, y];
    }
  }
  return null;
}

// A room's first tile a unit can stand on, or null.
function floorOf(field, room, rules) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) if (walkable(field, x, y, rules)) return [x, y];
  }
  return null;
}

// The keys of a steps map, nearest first, then top to bottom, then left to
// right.
function nearestFirst(away) {
  return [...away.entries()]
    .map(([key, steps]) => ({ key, steps, at: key.split(',').map(Number) }))
    .sort((a, b) => a.steps - b.steps || a.at[1] - b.at[1] || a.at[0] - b.at[0])
    .map(({ key }) => key);
}
