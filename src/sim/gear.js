// What a won fight can leave the crew (ROADMAP §4.3, M37): one of the
// fallen enemies' weapons, at gearChance (data/balance.json), shown where
// the fight's stakes are. The roll is the fight's own, from its seed, so no
// other roll moves, and the fight's end can say what it left before it is
// put away. Pure.
import { int, percent, seedFrom } from '../core/rng.js';
import { isMachine } from './battle.js';

// The weapon (its id) that `fight` leaves, its battle as given, or null:
// none unless the crew won, and one of the enemies who fell, picked by the
// roll's own state.
export function gearWon(fight, battle, rules) {
  if (!fight || battle?.winner !== 'crew') return null;
  // A turret's gun (M39) is bolted to its ship: it never comes away.
  const fallen = battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'dead' && !isMachine(unit, rules));
  if (!fallen.length) return null;
  const roll = percent(seedFrom(`gear ${fight.seed}`), rules.balance.gearChance ?? 0);
  return roll.value ? fallen[int(roll.state, 0, fallen.length - 1).value].weapon : null;
}
