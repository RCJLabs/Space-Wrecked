// What a side plays for in a battle's objective (M38, objectives.js), for
// the AI (ai.js): in every mission but a clear-out, the enemy plays to it.
// Pure, with no random numbers. playFor(battle, unit) gives:
//   guard    the tiles a unit keeps by when it won't shoot, or null: an
//            enemy guards what the crew came for (the crates not yet picked
//            up, the terminal, the far gate, the targets not yet blown, the
//            captive while held); the crew holds the way in on a defense
//   push     the tiles every plan counts the steps to, or null: on a
//            defense, the way in the enemy pushes for
//   prizes   the ids of the units a shot at counts more against (ai.js
//            WEIGHTS.prize): the crate carriers and the ward
//   charges  the tiles of the charges set (a sabotage): an enemy beside one
//            pulls it, and every unit keeps clear of one about to blow
// A battle with no objective, or one done, plays for nothing: the AI fights
// as it always has (boardings, raids, clear-outs).
import { objectiveDone } from './objectives.js';
import { inReach } from './terrain.js';

const NOTHING = { guard: null, push: null, prizes: new Set(), charges: [] };

export function playFor(battle, unit) {
  const { objective } = battle;
  if (!objective || objectiveDone(objective)) return NOTHING;
  const left = (list, done) => list.filter(([x, y]) => !done.some(([dx, dy]) => dx === x && dy === y));
  const charges = objective.type === 'sabotage' ? objective.charges.map((charge) => charge.at) : [];
  if (unit.side === 'crew') {
    return objective.type === 'defend' ? { ...NOTHING, guard: objective.line } : { ...NOTHING, charges };
  }
  const carriers = battle.units.filter((u) => u.side !== unit.side && u.carrying).map((u) => u.id);
  const ward = battle.units.find((u) => u.id === objective.ward);
  const prizes = new Set([...carriers, ...(ward ? [ward.id] : [])]);
  switch (objective.type) {
    case 'grab':
      return { ...NOTHING, guard: orNull(left(objective.crates, objective.taken)) };
    case 'hack':
      return { ...NOTHING, guard: [objective.at] };
    case 'extract':
      return { ...NOTHING, guard: orNull(left(objective.crates, objective.taken)), prizes };
    case 'escort':
      return { ...NOTHING, guard: objective.exits, prizes };
    case 'rescue':
      return { ...NOTHING, guard: ward?.status === 'held' ? [[ward.x, ward.y]] : null, prizes };
    case 'sabotage':
      return { ...NOTHING, guard: orNull(left(objective.targets, objective.blown)), charges };
    case 'defend':
      return { ...NOTHING, push: objective.line };
    default:
      return NOTHING;
  }
}

// The charges among `charges` whose blast would reach a unit standing at
// (x, y), in a battle with its doors as given (terrain.js inReach).
export function blastsAt(field, x, y, charges) {
  return charges.filter((at) => inReach(field, [x, y], at));
}

function orNull(list) {
  return list.length ? list : null;
}
