// Words for weapons (M37): a weapon's name in a sentence, what it is and
// what it does, as the crew card, the shop, a station's rack, an event and
// the fight's end show it; and the swaps the crew card offers
// (src/sim/loadout.js). rules are the content tables (src/sim/defs.js).
import { KIND_NAMES, sparesFor, swapProblem, weaponOf } from '../../sim/loadout.js';

// The weapon's name as a sentence has it: "riot gun".
export function weaponWord(id, rules) {
  return (rules.weapons.get(id)?.name ?? id).toLowerCase();
}

// "a sawn-off", "an autogun".
export function aWeapon(id, rules) {
  const word = weaponWord(id, rules);
  return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}

// What a weapon is: "Heavy weapon", "Long gun".
export function kindName(weapon) {
  const name = KIND_NAMES[weapon?.kind]?.[0] ?? 'weapon';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// A weapon's numbers and rules, a line each: its kind, damage and clip
// ("Heavy weapon · damage 3–5, +2 on a crit · 4 shots"), its aim at each
// range ("Aim +15 close, −5 mid, −25 long · crit 10%"), and what its rules
// do (rulesLine), if any.
export function weaponFacts(id, rules) {
  const weapon = rules.weapons.get(id);
  if (!weapon) return [];
  const { close, mid, long } = weapon.accuracy;
  const extra = weapon.critDamage ? `, +${weapon.critDamage} on a crit` : '';
  const lines = [
    `${kindName(weapon)} · damage ${weapon.damage[0]}–${weapon.damage[1]}${extra} · ${weapon.clip} shot${weapon.clip === 1 ? '' : 's'}`,
    `Aim ${signed(close)} close, ${signed(mid)} mid, ${signed(long)} long · crit ${weapon.crit}%`,
  ];
  const said = rulesLine(weapon);
  return said ? [...lines, said] : lines;
}

// What a weapon's rules do (src/sim/weapons.js), in a line, or '' for none:
// "Fires bursts of 2, each −15 to hit. Pierces 1 armor. Reaches 1 tile. A
// hit stuns. A hit sets the tile burning for 3 rounds."
export function rulesLine(weapon) {
  const said = [];
  if (weapon.burst) said.push(`Fires bursts of ${weapon.burst.shots}, each ${signed(weapon.burst.aim)} to hit.`);
  if (weapon.pierce) said.push(`Pierces ${weapon.pierce} armor.`);
  if (weapon.reach) said.push(`Reaches ${weapon.reach} tile${weapon.reach === 1 ? '' : 's'}.`);
  if (weapon.stun) said.push('A hit stuns: the target loses its next turn.');
  if (weapon.burn) said.push(`A hit sets the tile burning for ${weapon.burn} rounds.`);
  return said.join(' ');
}

// The spares on hand, in a line: "On hand: a riot gun and 2 autoguns.", or
// "No spare weapons on hand."
export function sparesLine(campaign, rules) {
  const held = Object.entries(campaign.arms ?? {}).filter(([, count]) => count > 0);
  if (!held.length) return 'No spare weapons on hand.';
  const each = held.map(([id, count]) => (count === 1 ? aWeapon(id, rules) : `${count} ${weaponWord(id, rules)}s`));
  return `On hand: ${listed(each)}.`;
}

// What a crew member carries, and the spares they could take, for the crew
// card: { name, line, swaps: [{ key, label, ask, ok, text, why }] }: name
// "Rifle", line what it is ("Rifle · long gun · damage 3–5 · 4 shots"), and
// a swap for each spare of a kind their job carries, keyed
// 'arm:<id>:<weapon>'; a recruit (swaps false) has none.
export function carriedText(campaign, rules, member, { swaps: offer = true } = {}) {
  const id = weaponOf(member, rules);
  const now = rules.weapons.get(id);
  const swaps = !offer ? [] : sparesFor(campaign, rules, member).map(({ id: spare, weapon }) => {
    const why = swapProblem(campaign, rules, member.id, spare);
    return {
      key: `arm:${member.id}:${spare}`,
      label: weapon.name,
      ask: 'Swap?',
      ok: !why,
      text: `Give ${member.name} the ${weaponWord(spare, rules)}: ${lowered(weaponFacts(spare, rules)[0])}. ${rulesLine(weapon)}${rulesLine(weapon) ? ' ' : ''}The ${weaponWord(id, rules)} goes on hand. Tap again to swap.`,
      why,
    };
  });
  return { name: now?.name ?? id ?? 'Nothing', line: now ? `${now.name} · ${lowered(weaponFacts(id, rules)[0])}` : 'No weapon', swaps };
}

// "Heavy weapon · …" as the middle of a sentence has it.
function lowered(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// What a won fight can leave the crew (gear.js), where the fight's stakes
// show: "Win: 30% to pick up one of their weapons.", or null at none.
export function gearLine(rules) {
  const chance = rules.balance.gearChance ?? 0;
  return chance ? `Win: ${chance}% to pick up one of their weapons.` : null;
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function signed(n) {
  return n < 0 ? `−${-n}` : `+${n}`;
}
