// The odds of a shot, worked out exactly and part by part, so the number a
// player is shown is the number rolled against (ROADMAP §4.3, Law 4):
//   hit  = aim + the weapon at this range − cover − defense − overwatch
//          + forgiving odds, kept within 0 to 100
//   crit = the weapon's crit chance + the flanking bonus, within 0 to 100
// Range is the straight-line distance between tile middles: close up to
// balance.closeRange tiles, mid up to midRange, long beyond.
import { coverFrom } from './cover.js';

// 'close', 'mid' or 'long' between two tiles, [x, y].
export function rangeBand(from, to, balance) {
  const d2 = (to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2;
  if (d2 <= balance.closeRange ** 2) return 'close';
  if (d2 <= balance.midRange ** 2) return 'mid';
  return 'long';
}

// The odds of `shooter` hitting `target` (units: { side, x, y, aim,
// defense, weapon, suppressed?, mark? }), as { hit, hitParts, crit,
// critParts, band, cover, flanked }. Each part is { why, value } in
// percentage points: why is 'aim', 'weapon' (with band), 'cover' (with
// cover), 'defense', 'overwatch', 'suppressed' (the shooter is, orders.js),
// 'marked' (the target is), 'forgiving' or 'flanked'. The parts add up to
// the chance before it is kept within 0 to 100.
export function shotOdds(battle, shooter, target, rules, { overwatch = false } = {}) {
  const { balance } = rules;
  const weapon = rules.weapons.get(shooter.weapon);
  const [from, at] = [[shooter.x, shooter.y], [target.x, target.y]];
  const band = rangeBand(from, at, balance);
  const { cover, flanked } = coverFrom(battle, at, from, rules);
  const hitParts = [{ why: 'aim', value: shooter.aim }, { why: 'weapon', band, value: weapon.accuracy[band] }];
  if (cover) hitParts.push({ why: 'cover', cover, value: -(cover === 'full' ? balance.fullCover : balance.halfCover) });
  if (target.defense) hitParts.push({ why: 'defense', value: -target.defense });
  if (overwatch) hitParts.push({ why: 'overwatch', value: -balance.overwatchPenalty });
  if (shooter.suppressed) hitParts.push({ why: 'suppressed', value: shooter.suppressed.aim });
  if (target.mark && target.side !== shooter.side) hitParts.push({ why: 'marked', value: target.mark.aim });
  const forgiving = forgivingBonus(battle, shooter.side, balance);
  if (forgiving) hitParts.push({ why: 'forgiving', value: forgiving });
  const critParts = [{ why: 'weapon', value: weapon.crit }];
  if (flanked) critParts.push({ why: 'flanked', value: balance.flankCrit });
  return { hit: total(hitParts), hitParts, crit: total(critParts), critParts, band, cover, flanked };
}

// The forgiving-odds bonus on a side's next shot: with the setting on, the
// crew's shots gain balance.forgivingStep for each miss in a row, up to
// forgivingMax. Enemies never get it.
export function forgivingBonus(battle, side, balance) {
  if (!battle.options?.forgiving || side !== 'crew') return 0;
  return Math.min(battle.misses.crew * balance.forgivingStep, balance.forgivingMax);
}

function total(parts) {
  return Math.max(0, Math.min(100, parts.reduce((sum, part) => sum + part.value, 0)));
}
