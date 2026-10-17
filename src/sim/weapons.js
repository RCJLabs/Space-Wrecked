// What a weapon does in a fight beyond its numbers (ROADMAP §4.3, M37), each
// from its data in data/weapons.json, so a new weapon needs no engine edit:
//   burst  { shots, aim }  a shot is a burst of `shots` at the target, each
//                          rolled on its own at the same odds, `aim` (below
//                          0) a part of them (odds.js). It stops when the
//                          target drops, and overwatch fires one shot
//                          without the part.
//   pierce n               n of the target's armor doesn't count against
//                          the damage
//   reach  n               no shot past n tiles, by a side or a corner, on
//                          overwatch too
//   stun   true            a hit puts the target to sleep (orders.js) through
//                          its side's next turn; hit in its own turn, it
//                          loses the rest of that one
//   burn   n               a hit sets the target's tile burning for n rounds,
//                          this one counted (battle.js), unless the tile has
//                          a hazard already
// And its kind (`kind`), for who can carry it (loadout.js): a sidearm, a
// long gun or a heavy weapon. Pure.

export const WEAPON_KINDS = ['sidearm', 'long', 'heavy'];

// True if a shot from `from` can reach `to` with the weapon: always with no
// reach, else within `reach` tiles by a side or a corner.
export function withinReach(weapon, [ax, ay], [bx, by]) {
  return !weapon.reach || Math.max(Math.abs(bx - ax), Math.abs(by - ay)) <= weapon.reach;
}

// The armor that counts against the weapon's hits: the target's, less what
// the weapon pierces, never below 0.
export function armorAgainst(armor, weapon) {
  return weapon.pierce && armor > 0 ? Math.max(0, armor - weapon.pierce) : armor;
}

// How many shots one shot is: a burst's, or one on overwatch.
export function shotsOf(weapon, overwatch = false) {
  return overwatch || !weapon.burst ? 1 : weapon.burst.shots;
}

// Why `unit` can't reach `target` with the weapon, in words.
export function outOfReach(unit, target, weapon) {
  return `${target.name} is out of reach: the ${weapon.name.toLowerCase()} reaches ${weapon.reach} tile${weapon.reach === 1 ? '' : 's'}.`;
}
