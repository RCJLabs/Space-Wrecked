// Traits (ROADMAP §4.5, data/traits.json): what a character is besides
// their job. Each adds to their numbers in a fight: { hp, aim, defense,
// mobility, armor }, any of them, up or down. The captain has two, chosen
// when a campaign starts (campaign.js). Pure.

// The numbers a trait can move, as a battle unit has them (battle.js).
export const TRAIT_STATS = ['hp', 'aim', 'defense', 'mobility', 'armor'];

// What a list of traits adds up to: { hp, aim, defense, mobility, armor },
// each a whole number, 0 for none. Unknown traits add nothing.
export function traitBonus(ids, rules) {
  const bonus = Object.fromEntries(TRAIT_STATS.map((key) => [key, 0]));
  for (const id of ids ?? []) {
    const effects = rules.traits?.get(id)?.effects ?? {};
    for (const key of TRAIT_STATS) bonus[key] += effects[key] ?? 0;
  }
  return bonus;
}
