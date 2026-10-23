// Doors as tactics (M45): closing, locking and forcing a door in a fight.
// Pure: each takes the battle's draft (battle.js) and the acting unit, and
// returns an error in words, or null once done.
//
//   close   1 action: the open door on that side of the unit's tile shuts.
//           Walking through it opens it again, as any closed door.
//   lock    1 action: the door on that side shuts if it was open and
//           locks. No one walks or sees through a locked door. battle.locks
//           holds { key, side }: the door's edge key (mapFromShip.js
//           edgeKey) and the side that locked it, whose Open door
//           (battle.js open) unlocks it, 1 action.
//   force   a whole turn (balance.actionPoints): the other side breaks a
//           lock from beside it. The door is broken, battle.broken: it
//           stays open for the rest of the fight, and can't be closed,
//           locked or welded again, so a lock can't be shut in an enemy's
//           face turn after turn.
// A welded door (orders.js) can be neither locked nor forced until the
// weld gives way. The AI never closes or locks a door; it forces those in
// its way (press.js, ai.js forceAction).
import { SIDES } from './grid.js';
import { edgeKey, wallAt } from './mapFromShip.js';
import { stepsFrom } from './moves.js';
import { brokenAt, lockAt, weldedAt } from './terrain.js';

export const DOOR_ACTIONS = ['close', 'lock', 'force'];

export function doorAction(battle, unit, action, events, rules) {
  const { side } = action;
  if (!SIDES.includes(side) || wallAt(battle.map, unit.x, unit.y, side) !== 'door') return `There's no door on that side of ${unit.name}.`;
  const key = edgeKey(unit.x, unit.y, side);
  if (brokenAt(battle, unit.x, unit.y, side)) return 'That door was forced: it stays open.';
  if (weldedAt(battle, unit.x, unit.y, side)) return 'That door is welded shut.';
  const lock = lockAt(battle, unit.x, unit.y, side);
  const at = [unit.x, unit.y];
  switch (action.type) {
    case 'close':
      if (!battle.doors.includes(key)) return 'That door is shut already.';
      unit.ap -= 1;
      battle.doors = battle.doors.filter((k) => k !== key);
      events.push({ type: 'close', unit: unit.id, at, side });
      return null;
    case 'lock':
      if (lock) return 'That door is locked already.';
      unit.ap -= 1;
      battle.doors = battle.doors.filter((k) => k !== key);
      battle.locks = [...(battle.locks ?? []), { key, side: unit.side }];
      events.push({ type: 'lock', unit: unit.id, at, side });
      return null;
    case 'force': {
      if (!lock) return "That door isn't locked.";
      if (lock.side === unit.side) return `${unit.name}'s side locked it: Open door unlocks it.`;
      const turn = rules.balance.actionPoints;
      if (unit.ap < turn) return `Forcing a lock takes ${unit.name}'s whole turn.`;
      unit.ap = 0;
      unlock(battle, key);
      battle.doors = [...battle.doors, key].sort();
      battle.broken = [...(battle.broken ?? []), key].sort();
      events.push({ type: 'force', unit: unit.id, at, side });
      return null;
    }
    default:
      return `Unknown action "${action.type}".`;
  }
}

// Open door on a lock of the unit's own side: unlocked and open, 1 action
// (battle.js open). Returns an error, or null once done.
export function unlockDoor(battle, unit, side, events) {
  const lock = lockAt(battle, unit.x, unit.y, side);
  if (lock.side !== unit.side) return 'That door is locked: forcing it takes a whole turn.';
  const key = lock.key;
  unit.ap -= 1;
  unlock(battle, key);
  battle.doors = [...battle.doors, key].sort();
  events.push({ type: 'unlock', unit: unit.id, at: [unit.x, unit.y], side });
  return null;
}

function unlock(battle, key) {
  battle.locks = battle.locks.filter((lock) => lock.key !== key);
}

// The sides of the unit's tile with a door it could close: open, and not
// broken.
export function closable(battle, unit) {
  return SIDES.filter((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && battle.doors.includes(edgeKey(unit.x, unit.y, side)) && !brokenAt(battle, unit.x, unit.y, side));
}

// The sides of the unit's tile with a door it could lock: not locked,
// welded or broken.
export function lockable(battle, unit) {
  return SIDES.filter((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && !lockAt(battle, unit.x, unit.y, side) && !weldedAt(battle, unit.x, unit.y, side) && !brokenAt(battle, unit.x, unit.y, side));
}

// The sides of the unit's tile with a door its own side locked, which Open
// door unlocks.
export function ownLocks(battle, unit) {
  return SIDES.filter((side) => lockAt(battle, unit.x, unit.y, side)?.side === unit.side && !weldedAt(battle, unit.x, unit.y, side));
}

// The AI's force (M45): a unit with its whole turn left, beside a door the
// other side locked that leads it nearer to `goals` ([x, y] tiles; the
// other side's people standing, unless given), forces it. The action, or
// null.
export function forceAction(battle, unit, rules, goals = null) {
  if (unit.ap < rules.balance.actionPoints) return null;
  const sides = SIDES.filter((side) => {
    const lock = lockAt(battle, unit.x, unit.y, side);
    return lock && lock.side !== unit.side && !weldedAt(battle, unit.x, unit.y, side);
  });
  if (!sides.length) return null;
  const to = goals ?? battle.units.filter((u) => u.side !== unit.side && u.status === 'active').map((u) => [u.x, u.y]);
  if (!to.length) return null;
  const away = stepsFrom(battle, to, rules);
  const here = away.get(`${unit.x},${unit.y}`) ?? Infinity;
  const nearer = sides.find((side) => {
    const [dx, dy] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[side];
    return (away.get(`${unit.x + dx},${unit.y + dy}`) ?? Infinity) < here;
  });
  return nearer ? { type: 'force', unit: unit.id, side: nearer } : null;
}
