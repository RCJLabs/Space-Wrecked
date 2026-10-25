// Text for neighbours at the colony (M54, src/sim/neighbours.js): what a
// building gains from the buildings by it, for its row and its details,
// and what a ghost would gain and give where it stands. rules are the
// content tables (src/sim/defs.js).
import { colonyStats } from '../../sim/colony.js';
import { ghostNeighbours } from '../../sim/neighbours.js';

// What one gain is: "+1 materials", "stores +10".
export function gainText(gain) {
  if (gain.storage) return `stores +${gain.storage}`;
  return Object.entries(gain.makes ?? {}).map(([what, n]) => `+${n} ${what}`).join(', ');
}

// What a building gains from its neighbours, for its row: "+1 materials by
// the machine shop", or '' with none. building: colonyStats's; names(uid):
// a building's name.
export function nearLine(building, names) {
  return (building.near ?? []).map((gain) => `${gainText(gain)} by the ${lowerFirst(names(gain.by))}`).join(', ');
}

// A building's name by its uid, from colonyStats's buildings.
export function namesOf(stats) {
  const names = new Map(stats.buildings.map((b) => [b.uid, b.name]));
  return (uid) => names.get(uid) ?? 'building';
}

// What a ghost would gain and give where it stands, for its line: " By the
// machine shop: +1 materials. The storehouse by it: stores +10.", or ''.
// ghost: { uid (one being moved, or null), type, x, y, rot }.
export function ghostNearText(campaign, rules, ghost) {
  const stats = colonyStats(campaign, rules);
  const lit = new Set(stats.buildings.filter((b) => b.powered).map((b) => b.uid));
  const { gains, gives } = ghostNeighbours(campaign.colony.buildings, ghost, rules, (uid) => lit.has(uid));
  const names = namesOf(stats);
  const said = [
    ...gains.map((gain) => `By the ${lowerFirst(names(gain.by))}: ${gainText(gain)}.`),
    ...gives.map(({ uid, gain }) => `The ${lowerFirst(names(uid))} by it: ${gainText(gain)}.`),
  ];
  return said.length ? ` ${said.join(' ')}` : '';
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
