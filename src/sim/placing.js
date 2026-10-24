// Placing the crew before a raid (M50): a raid's fight opens with the crew
// where deployment put them (raid.js, colonyMap.js raidStarts) and
// battle.setup set, { zone }, the keys ("x,y") of the tiles any of them may
// be put on instead: tiles anyone can stand on, clear of hazards, at least
// balance.placeClear steps' walk from every raider. While it is set, on the
// crew's first turn, each placing costs nothing; Ready ends it, and so does
// any other order (battle.js act). Pure.
//
// Actions:
//   { type: 'place', unit, to: [x, y] }   one of the crew to a free tile of
//                                         the zone
//   { type: 'ready' }                     placing over; the fight begins
import { stepsFrom } from './moves.js';
import { hazardAt, walkable } from './terrain.js';

// The zone for a battle as it starts: every tile anyone can stand on,
// clear of hazards, at least `clear` steps' walk from every enemy, and the
// tiles the crew stand on already. Keys sorted top to bottom, then left to
// right.
export function placingZone(battle, rules, clear = rules.balance.placeClear) {
  const enemies = battle.units.filter((u) => u.side === 'enemy' && u.status === 'active').map((u) => [u.x, u.y]);
  const near = stepsFrom({ ...battle, units: [] }, enemies, rules);
  const zone = [];
  for (let y = 0; y < battle.map.height; y++) {
    for (let x = 0; x < battle.map.width; x++) {
      const key = `${x},${y}`;
      const crewHere = battle.units.some((u) => u.side === 'crew' && u.x === x && u.y === y && !isFixed(u, rules));
      const open = walkable(battle, x, y, rules) && !hazardAt(battle, x, y) && (near.get(key) ?? Infinity) >= clear;
      if (crewHere || open) zone.push(key);
    }
  }
  return zone;
}

// The battle with placing begun: setup { zone }. A battle with no enemy
// standing, or no zone, is left as it is.
export function withPlacing(battle, rules) {
  const zone = placingZone(battle, rules);
  return zone.length ? { ...battle, setup: { zone } } : battle;
}

// True while the crew can still be placed.
export function placing(battle) {
  return Boolean(battle.setup) && battle.side === 'crew' && !battle.winner;
}

// The tiles a unit could be put on now: free tiles of the zone, as
// "x,y" keys. Empty when it can't be placed.
export function placesFor(battle, unit, rules) {
  if (!placing(battle) || !canPlace(unit, rules)) return [];
  const held = new Set(battle.units.filter((u) => u.status !== 'dead').map((u) => `${u.x},${u.y}`));
  return battle.setup.zone.filter((key) => !held.has(key));
}

// Carries out a place or a ready: { ok: true, battle, events } or { ok:
// false, error }.
export function placeAction(battle, action, rules) {
  if (!placing(battle)) return { ok: false, error: 'The fight has begun: no more placing.' };
  if (action.type === 'ready') {
    const { setup, ...begun } = battle;
    return { ok: true, battle: begun, events: [{ type: 'ready' }] };
  }
  const unit = battle.units.find((u) => u.id === action.unit);
  if (!unit || !canPlace(unit, rules)) return { ok: false, error: `${unit?.name ?? 'That one'} can't be placed.` };
  const [x, y] = action.to ?? [];
  if (!placesFor(battle, unit, rules).includes(`${x},${y}`)) return { ok: false, error: `${unit.name} can't stand there.` };
  const units = battle.units.map((u) => (u.id === unit.id ? { ...u, x, y } : u));
  return { ok: true, battle: { ...battle, units }, events: [{ type: 'place', unit: unit.id, from: [unit.x, unit.y], to: [x, y] }] };
}

// One of the crew who can be moved about: standing, not a machine (a
// turret or a colony's gun stays where it is built).
function canPlace(unit, rules) {
  return unit.side === 'crew' && unit.status === 'active' && !isFixed(unit, rules);
}

function isFixed(unit, rules) {
  return Boolean(rules.machines?.has(unit.kind));
}
