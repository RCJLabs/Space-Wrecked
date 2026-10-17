// The test players' weapons (M37): what each crew member carries into the
// fight ahead, the best of their job's kinds on hand; whether a weapon
// would be worth buying or taking; and how good each weapon is, kind of
// fight by kind of fight, from the weapons' table (node tools/sim.js
// --weapons: the whole squad carrying each, aboard ships and on act 1's job
// sites). A crew member whose job's order needs a weapon (the
// xenobiologist's dart gun, for Sedate) keeps it. Pure.
import { carries, sparesFor, swapWeapon, weaponOf } from '../src/sim/loadout.js';

// The crew's wins in the weapons' table, M37 (600 fights each), in a fight
// aboard a ship (boardings, a held place, the hangar raid) and on the
// ground (act 1's jobs, a raid on the colony). A weapon not in the table
// counts as none.
export const WINS = {
  ship: { riotgun: 86.5, shotgun: 78, torch: 69.2, rivetgun: 61.3, autogun: 56.8, machinepistol: 50.2, sawnoff: 50, baton: 38, railrifle: 37.5, marksman: 35.8, rifle: 31, longrifle: 22.2, carbine: 20, pistol: 10.8, dartgun: 3.5 },
  ground: { riotgun: 82.7, torch: 81.7, shotgun: 79.5, rivetgun: 78.2, railrifle: 72.7, autogun: 72, marksman: 72, machinepistol: 66.2, rifle: 65, sawnoff: 65, longrifle: 63, baton: 60.8, carbine: 58, pistol: 53, dartgun: 37.8 },
};
export const SETTINGS = Object.keys(WINS);
// A weapon is worth buying or taking (upgradeOf) only this many points of
// the table better than what someone who could carry it has: buying the
// smaller steps up (a marksman's rifle for the marine's rifle aboard, 5
// points for 100 credits) spent the purse the voyage keeps the hunters off
// with, and fewer voyages crossed fed (PROGRESS.md, M37).
export const GAIN = 20;

// How good weapon `id` is for `setting`.
function winsOf(setting, id) {
  return WINS[setting][id] ?? 0;
}

// Whether a crew member keeps the weapon they have: their job's order needs
// it.
function keepsOwn(member, rules) {
  return Boolean(rules.jobs.get(member.job)?.order?.weapon);
}

// The campaign with each crew member carrying the best weapon on hand of
// their job's kinds for `setting` ('ship' or 'ground'): those whose jobs
// carry the fewest kinds pick first, so a medic has the best sidearm before
// a marine, who can carry anything, takes the best of the rest. What they
// put down goes on hand for the next.
export function armFor(campaign, rules, setting) {
  if (!SETTINGS.includes(setting)) throw new Error(`No setting "${setting}": one of ${SETTINGS.join(', ')}.`);
  const kinds = (member) => rules.jobs.get(member.job)?.arms?.length ?? 0;
  let armed = campaign;
  for (const member of [...campaign.crew].sort((a, b) => kinds(a) - kinds(b))) {
    if (keepsOwn(member, rules)) continue;
    const now = weaponOf(member, rules);
    const [best] = sparesFor(armed, rules, member)
      .map((spare) => spare.id)
      .sort((a, b) => winsOf(setting, b) - winsOf(setting, a));
    if (best && winsOf(setting, best) > winsOf(setting, now)) armed = swapWeapon(armed, rules, member.id, best).campaign;
  }
  return armed;
}

// Whether weapon `id` would be GAIN points better for `setting` than
// anything someone whose job carries it has: what they carry and every
// spare they could take.
export function upgradeOf(campaign, rules, id, setting) {
  const weapon = rules.weapons.get(id);
  if (!weapon) return false;
  return campaign.crew.some((member) => {
    if (keepsOwn(member, rules) || !carries(rules.jobs.get(member.job), weapon)) return false;
    const held = [weaponOf(member, rules), ...sparesFor(campaign, rules, member).map((spare) => spare.id)];
    return held.every((other) => winsOf(setting, id) - winsOf(setting, other) >= GAIN);
  });
}
