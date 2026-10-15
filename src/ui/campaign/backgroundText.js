// Text for picking a background (background.js, M30): every background to
// pick from, and the one picked in full. rules are the content tables
// (src/sim/defs.js). Pure.
import { newCampaign, partsNeeded } from '../../sim/campaign.js';
import { partsText } from './hubText.js';

// What the screen shows, picked being the id of the background picked:
//   cards   [{ id, name, pursuer, picked }]: every background, in
//           data/backgrounds.json's order, with who is after it
//   name, blurb   the one picked
//   facts   [[label, value]]: who is after it and on what terms, its
//           district, and its start: the crew, credits, the parts on hand,
//           what the ship has fitted, and what it still needs to fly (the
//           flight checklist's parts, campaign.js partsNeeded, less those
//           on hand)
//   hint    what Next does
export function backgroundText(rules, picked) {
  const background = rules.backgrounds.get(picked);
  const { pursuer, start } = background;
  const district = rules.districts.get(background.district);
  const campaign = newCampaign(rules, 0, { background: picked });
  const missing = {};
  for (const [type, count] of Object.entries(partsNeeded(campaign, rules))) {
    const left = count - (start.parts[type] ?? 0);
    if (left > 0) missing[type] = left;
  }
  return {
    cards: [...rules.backgrounds.values()].map((each) => ({ id: each.id, name: each.name, pursuer: `After you: ${each.pursuer.name}`, picked: each.id === picked })),
    name: background.name,
    blurb: background.blurb,
    facts: [
      ['After you', `${pursuer.name}. ${pursuer.blurb} ${termsText(pursuer)}`],
      ['Home', district ? `${district.name}. ${district.blurb}` : background.district],
      ['Crew', countsText(start.crew.map((id) => rules.jobs.get(id)?.name ?? id))],
      ['Credits', start.credits.toLocaleString('en')],
      ['On hand', partsText(start.parts, rules)],
      ['Fitted', countsText(campaign.ship.modules.map(({ type }) => rules.modules.get(type)?.name ?? type))],
      ['To find', partsText(missing, rules)],
    ],
    hint: `${background.name}. Tap Next to make your captain.`,
  };
}

// The pursuer's terms: what a payment buys at the hangar, or none.
function termsText({ payment }) {
  return payment ? `Takes payments: ${payment.credits} credits for ${payment.heat} heat off.` : 'Takes no payments.';
}

// "Marine ×2, Medic": the names in the order they first come, counted.
function countsText(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ');
}
