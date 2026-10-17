// Words for boarding fights (src/sim/encounter.js, M22): what one at stake
// says on the approach screen before it begins, the line under the round
// while it is on, and the end panel's words once it is won or lost. From
// M28 a boarding can be at a place the squatters hold, on a trip from the
// colony (src/sim/expeditions.js): her name is the place's, and her salvage
// brings materials. rules are the content tables (src/sim/defs.js).
import { boardingDue } from '../../sim/encounter.js';
import { raidLoss } from '../../sim/raid.js';
import { gearLine } from './armsText.js';

// The boarding that is due, as the approach screen offers it, or null:
//   dir      'them' (the crew boards her) or 'you' (she boards the player)
//   lines    her crew, and what winning and losing come to (since M37,
//            the chance a win leaves one of their weapons)
//   begin    { label, ask, text }: the button that starts the fight
//   leave    { label, ask, text }: leaving her instead, or null when she
//            is the one boarding
export function boardingStakes(campaign, rules) {
  const due = boardingDue(campaign, rules);
  if (!due) return null;
  const name = shortName(campaign.run.approach.enemy.name);
  const crew = partyText(due.party, rules);
  const [min, max] = due.preset.scrap ?? [0, 0];
  if (due.dir === 'them') {
    const parts = due.preset.salvage ?? 0;
    return {
      dir: 'them',
      lines: [
        `Her crew: ${crew}.`,
        `Win aboard her: strip ${parts} part${parts === 1 ? '' : 's'} off her, and her scrap, ${min} to ${max} credits.`,
        ...[gearLine(rules)].filter(Boolean),
        'Lose: the crew is beaten back to your ship, hurt.',
      ],
      begin: { label: 'Board her', ask: 'Board her?', text: `Board the ${name}: your crew against hers, aboard her. Tap again to board.` },
      leave: { label: 'Leave her', ask: 'Leave her?', text: `Leave the ${name} as she is: no fight, and nothing from her. Tap again to leave.` },
    };
  }
  const loss = raidLoss(campaign, rules);
  const taken = loss?.part ? `they take the ${partName(loss.part, rules)} you have on hand` : loss?.credits ? `they take ${loss.credits} credits` : 'they find nothing worth taking';
  return {
    dir: 'you',
    lines: [`Her boarders: ${crew}.`, `Throw them off: their gear is worth ${min} to ${max} credits.`, ...[gearLine(rules)].filter(Boolean), `Lose: ${taken}.`],
    begin: { label: 'Fight them off', ask: 'Fight?', text: 'Fight them off, aboard your own ship.' },
    leave: null,
  };
}

// The line under the round in a boarding fight: { title, progress, done,
// deadline }.
export function boardingObjective(battle, campaign) {
  const left = battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'active').length;
  const place = placeOf(campaign);
  if (place) return { title: `Aboard ${place.name}`, progress: `${left} squatter${left === 1 ? '' : 's'} left`, done: false, deadline: null };
  const name = shortName(campaign.run?.approach?.enemy.name ?? 'ship');
  if (campaign.fight?.boarding?.dir === 'them') return { title: `Aboard the ${name}`, progress: `${left} of hers left`, done: false, deadline: null };
  return { title: 'Boarders', progress: `${left} left`, done: false, deadline: null };
}

// How a boarding fight ended, for the end panel: { tone, title, text }.
// campaign is as it stands before the crew carries on (encounter.js
// endBoarding).
export function boardingOutcome(battle, campaign, rules) {
  const { dir, salvage } = campaign.fight.boarding;
  const place = placeOf(campaign);
  if (place) {
    if (battle.winner !== 'crew') return { tone: 'bad', title: 'Beaten back', text: 'The squad falls back to the ship, hurt. Nothing taken.' };
    const parts = salvage.parts.map((type) => `${article(partName(type, rules))} ${partName(type, rules)}`);
    return { tone: 'good', title: `${place.name} is yours`, text: `${parts.length ? `Stripped: ${parts.join(', ')}. ` : ''}Materials: ${salvage.materials ?? 0}, as far as the stores take them.` };
  }
  const name = shortName(campaign.run?.approach?.enemy.name ?? 'ship');
  const scrap = `Scrap: ${salvage.credits} credits.`;
  if (battle.winner === 'crew') {
    if (dir === 'you') return { tone: 'good', title: 'Boarders thrown off', text: `Their gear: ${salvage.credits} credits of scrap.` };
    const parts = salvage.parts.map((type) => `${article(partName(type, rules))} ${partName(type, rules)}`);
    return { tone: 'good', title: `The ${name} is yours`, text: `${parts.length ? `Stripped: ${parts.join(', ')}. ` : ''}${scrap}` };
  }
  if (dir === 'them') return { tone: 'bad', title: 'Beaten back', text: 'The crew falls back to your ship, hurt. Nothing taken.' };
  const loss = raidLoss(campaign, rules);
  const took = loss?.part ? `They took the ${partName(loss.part, rules)}.` : loss?.credits ? `They took ${loss.credits} credits.` : 'There was nothing to take.';
  return { tone: 'bad', title: 'Overrun', text: took };
}

// "Pirate ×3, Pirate brute": the party's names in order of first showing,
// counted.
function partyText(party, rules) {
  const counts = new Map();
  for (const id of party) {
    const name = rules.enemies.get(id)?.name ?? id;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}

function partName(type, rules) {
  return rules.modules.get(type)?.name ?? type;
}

// The place a boarding on a trip is at (M28), or null for the run's.
function placeOf(campaign) {
  return campaign.fight?.boarding && campaign.colony?.trip ? campaign.colony.trip.place : null;
}

// "Pirate cutter" -> "cutter".
function shortName(name) {
  return name.split(' ').at(-1).toLowerCase();
}

function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}
