// Rearranging between jumps (M46): anywhere on the run away from a station
// or a shipyard (in act 2, or on a voyage from the colony), with nothing
// holding the ship (an event to decide, a hostile ship), its parts move and
// turn and its look can change, but none comes off and none goes on: that
// is still a refit's, at a port (campaign.js refitShip). A move that leaves
// the joins failing keeps the ship from jumping until it's fixed
// (travel.js failingCheck).
import { atPort } from './acts.js';
import { isShipData } from './builder.js';
import { holdOf, onTheRun } from './travel.js';

// True where the ship's parts can be rearranged.
export function canRearrange(campaign, rules) {
  return Boolean(rules) && Boolean(campaign?.run) && onTheRun(campaign, rules) && !atPort(campaign, rules) && !holdOf(campaign, rules);
}

// The campaign with its ship rearranged: the same parts, each the same
// uid and type, on the same frame, wherever they now stand; otherwise the
// campaign as it was.
export function rearrangeShip(campaign, ship, rules) {
  if (!canRearrange(campaign, rules) || ship === campaign.ship || !isShipData(ship) || ship.frame !== campaign.ship.frame) return campaign;
  const before = new Map(campaign.ship.modules.map((module) => [module.uid, module.type]));
  const same = ship.modules.length === before.size && ship.modules.every((module) => before.get(module.uid) === module.type);
  return same ? { ...campaign, ship } : campaign;
}
