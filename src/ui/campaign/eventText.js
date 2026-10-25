// Text for an event at a node (src/sim/events.js): the event as it opens,
// each choice with its odds and what each of its outcomes does, and what
// happened once a choice is made, standing with the sides included (M33,
// standingText.js), and what it did to a quest (M33b, questText.js). From
// M33c a chain's step can offer a companion a berth: who they are, and who
// signed on (companionText.js). From M36 a choice that needs a job or a
// trait names who would take it, or says who it needs; and an outcome can
// spring a trap, wreck parts aboard or repair them; from M37, put a weapon
// on hand. rules are the content tables (src/sim/defs.js).
import { companionOf } from '../../sim/companions.js';
import { sellPriceOf } from '../../sim/economy.js';
import { choiceProblem, takerOf } from '../../sim/events.js';
import { wrecksToRepair } from '../../sim/repair.js';
import { openEvent } from '../../sim/travel.js';
import { aWeapon } from './armsText.js';
import { berthSaid, companionCard, feedSaid, joinedLines, joinsSaid, offeredBy } from './companionText.js';
import { choiceQuestSaid, questNoteLines } from './questText.js';
import { changeLines, sideCalled } from './standingText.js';

// The event open where the ship is, or null:
//   where     "Derelict · Old Beacon": the node's kind and name
//   title, text
//   companion who a choice would sign on (M33c, companionText.js
//             companionCard), or null
//   choices   [{ id, label, ok, why, odds, berth, taker, outcomes, ask }]:
//             odds is the chances in short ("70% · 30%", or '' for a sure
//             thing), berth what a choice needing one takes ("Takes a berth
//             · 1 free", or ''), taker who would take a choice needing a job
//             or a trait (M36: their name, or ''; with no one, why says who
//             it needs), outcomes [{ chance, says }] what each does, ask
//             what the first tap says: who takes it, the odds in full, what
//             it does to a quest (M33b), what the crew eats with a companion
//             signing on (M33c) and "tap again"
export function eventText(campaign, rules) {
  const open = openEvent(campaign, rules);
  if (!open) return null;
  const { node, event } = open;
  return {
    where: whereText(node, rules),
    title: event.title,
    text: event.text,
    companion: offeredBy(event, campaign, rules),
    choices: event.choices.map((choice) => {
      const said = choiceSaid(choice, campaign, rules);
      const quest = choiceQuestSaid(campaign, rules, node, event.id, choice.id);
      const berth = choice.needs?.berth ? berthSaid(campaign, rules) : '';
      const joins = choice.outcomes.find((outcome) => outcome.effects.joins)?.effects.joins;
      const feed = joins ? feedSaid(joins, campaign, rules) : '';
      return { ...said, berth, ask: `${said.ask}${quest ? ` ${quest}` : ''}${feed ? ` ${feed}` : ''} Tap again to choose.` };
    }),
  };
}

// What happened at the event settled last (the run's result), or null:
//   where, title ("Dead hauler: Strip it"), text (the outcome's words),
//   roll ("Rolled 24: the 70% came up", or '' for a sure thing), changes
//   (what it came to, in words), quest (what it did to a quest, M33b, and
//   who signed on with the quest it opened, M33c, or ''), companion (who
//   signed on, companionText.js companionCard, or null)
export function resultText(campaign, rules) {
  const result = campaign.run?.result;
  if (!result) return null;
  const event = rules.events.get(result.event);
  const choice = event?.choices.find((entry) => entry.id === result.choice);
  const outcome = choice?.outcomes[result.outcome];
  const joined = companionOf(rules, result.changes.joined);
  return {
    where: whereText(campaign.run.sector.nodes[result.node], rules),
    title: event && choice ? `${event.title}: ${choice.label}` : 'Done',
    text: outcome?.text ?? '',
    roll: result.roll === null || !outcome ? '' : `Rolled ${result.roll}: the ${outcome.chance}% came up.`,
    changes: changesText(result.changes, campaign, rules),
    quest: [...questNoteLines(result.quest, rules, campaign), ...(joined ? joinedLines(joined.id, rules) : [])].join(' '),
    companion: joined ? companionCard(joined, campaign, rules) : null,
  };
}

// A choice as the event card and the colony's trip panel show it (M36:
// both): { id, label, ok, why, odds, taker, outcomes, ask }, the ask
// without its "tap again". among: who could take it (the squad, at a
// place), or null for the whole crew.
export function choiceSaid(choice, campaign, rules, among = null) {
  const why = choiceProblem(campaign, choice, rules, { among });
  const taker = takerOf(campaign, choice, among);
  const outcomes = choice.outcomes.map((outcome) => ({ chance: outcome.chance, says: effectsText(outcome.effects, campaign, rules, taker) }));
  const sure = outcomes.length === 1;
  const odds = sure ? '' : outcomes.map((outcome) => `${outcome.chance}%`).join(' · ');
  const told = sure ? `${capital(outcomes[0].says)}.` : outcomes.map((outcome) => `${outcome.chance}%: ${outcome.says}.`).join(' ');
  const who = taker && !why ? ` ${taker.name} takes it.` : '';
  return { id: choice.id, label: choice.label, ok: !why, why, odds, taker: taker && !why ? taker.name : '', outcomes, ask: `${choice.label}:${who} ${told}` };
}

// "Derelict · Old Beacon".
function whereText(node, rules) {
  const kind = rules.nodeTypes.get(node.type)?.name ?? node.type;
  return `${kind} · ${node.name}`;
}

// An outcome's effects in words, for the odds: "+10 credits, a salvaged
// part, the union +1". Nothing is "nothing". At the colony (M28) supplies
// are food, and an event can bring materials. From M36 a wound falls on
// whoever takes the choice (taker, a crew member, or null), while they can
// take it; and a trap, parts wrecked and parts repaired say so, a repair
// naming the dearest wrecks aboard.
export function effectsText(effects, campaign, rules, taker = null) {
  const said = [];
  if (effects.credits) said.push(`${signed(effects.credits)} credits`);
  if (effects.supplies) said.push(`${signed(effects.supplies)} ${suppliesWord(campaign)}`);
  if (effects.materials) said.push(`${signed(effects.materials)} materials`);
  if (effects.heat) said.push(`heat ${signed(effects.heat)}`);
  if (effects.wound) said.push(`${effects.wound.all ? 'everyone' : taker?.hp > 1 ? taker.name : 'someone'} hurt (${effects.wound.hp} hit points)`);
  if (effects.part) said.push(aPart(effects.part, rules));
  if (effects.arms) said.push(aWeapon(effects.arms, rules));
  if (effects.drop) said.push('a salvaged part');
  if (effects.sell) {
    const dearest = dearestOnHand(campaign, rules);
    said.push(dearest ? `your ${partName(dearest, rules)} sold for ${sellPriceOf(dearest, rules)} credits` : 'a part sold');
  }
  for (const [side, by] of Object.entries(effects.standing ?? {})) said.push(`${sideCalled(side, rules)} ${signed(by)}`);
  if (effects.joins) said.push(joinsSaid(effects.joins, rules));
  if (effects.wreck) said.push(effects.wreck === 1 ? 'a part aboard wrecked' : `${effects.wreck} parts aboard wrecked`);
  if (effects.repair) {
    const mended = wrecksToRepair(campaign, rules).sort((a, b) => b.price - a.price || a.uid - b.uid).slice(0, effects.repair);
    said.push(mended.length ? `${listed(mended.map((wreck) => `the ${partName(wreck.type, rules)}`))} repaired` : 'a repair, with nothing wrecked');
  }
  if (effects.ambush) said.push(trapSaid(effects.ambush, rules));
  if (effects.settlers) said.push(settlersSaid(effects.settlers, campaign));
  return said.length ? said.join(', ') : 'nothing';
}

// Survivors (M54), as the odds say it: "2 survivors to settle at
// Copperhill" on a voyage, else "2 survivors to set down".
function settlersSaid(count, campaign) {
  const who = `${count} survivor${count === 1 ? '' : 's'}`;
  return campaign.colony?.voyage?.home ? `${who} to settle at ${campaign.colony.world.name}` : `${who} to set down`;
}

// What came of survivors (M54, events.js changes.settlers): settled at the
// colony flown from, or set down at the next station.
function settledSaid({ came, settled, home }, campaign) {
  const world = campaign.colony?.world?.name ?? 'the colony';
  if (!home) return `${came === 1 ? 'The survivor is' : 'The survivors are'} set down at the next station.`;
  if (settled === came) return `${came === 1 ? 'The survivor settles' : `All ${came} settle`} at ${world}: ${settled === 1 ? 'a citizen' : `${settled} citizens`} more.`;
  if (settled) return `${settled} of the ${came} settle at ${world}, all its beds and air allow; the rest are set down at the next station.`;
  return `${world} has no bed and air free for them: they are set down at the next station.`;
}

// A trap (M36), as the odds say it: on the run, the ship that fires first;
// at a place, the fight for her.
function trapSaid(ambush, rules) {
  if (ambush === true) return 'a trap: a fight for her';
  const name = rules.ships.get(ambush)?.name ?? ambush;
  return `a trap: ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}, firing first`;
}

// What a result's changes came to, in words: "+10 credits. Found: an
// Armory. Kim hurt (3 hit points). The union +1: neutral, 1." Nothing is
// "Nothing changes."
export function changesText(changes, campaign, rules) {
  const said = [];
  const moved = [];
  if (changes.credits) moved.push(`${signed(changes.credits)} credits`);
  if (changes.supplies) moved.push(`${signed(changes.supplies)} ${suppliesWord(campaign)}`);
  if (changes.materials) moved.push(`${signed(changes.materials)} materials`);
  if (changes.heat) moved.push(`heat ${signed(changes.heat)}`);
  if (moved.length) said.push(`${capital(moved.join(', '))}.`);
  const found = [...changes.parts.map((part) => aPart(part, rules)), ...(changes.arms ?? []).map((id) => aWeapon(id, rules))];
  if (found.length) said.push(`Found: ${found.join(', ')}.`);
  for (const sale of changes.sold) said.push(`Sold: the ${partName(sale.part, rules)}, for ${sale.credits} credits.`);
  for (const wound of changes.wounds) {
    const name = campaign.crew.find((member) => member.id === wound.id)?.name ?? 'Someone';
    said.push(`${name} hurt (${wound.hp} hit point${wound.hp === 1 ? '' : 's'}).`);
  }
  said.push(...changeLines(changes.standing, rules));
  // What it did to the ship (M36): parts wrecked, those the crew got going
  // again, parts repaired, and a trap sprung.
  const named = (uid) => partName(campaign.ship.modules.find((module) => module.uid === uid)?.type, rules) ?? 'part';
  if (changes.wrecked?.length) said.push(`Wrecked: ${listed(changes.wrecked.map((wreck) => `the ${partName(wreck.type, rules)} (${WRECK_WORDS[wreck.wreck] ?? 'out'})`))}.`);
  if (changes.rigged?.length) said.push(`The crew gets ${listed(changes.rigged.map((uid) => `the ${named(uid).toLowerCase()}`))} going again.`);
  if (changes.repaired?.length) said.push(`Repaired: ${listed(changes.repaired.map((fixed) => `the ${partName(fixed.type, rules)}`))}.`);
  if (changes.ambush === true) said.push('A trap: they hold her now.');
  else if (changes.ambush) said.push(`A trap: ${aPart(changes.ambush, rules, rules.ships)} fired first.`);
  if (changes.settlers) said.push(settledSaid(changes.settlers, campaign));
  return said.length ? said.join(' ') : 'Nothing changes.';
}

// How a wrecked part is wrecked (mapFromShip.js WRECKS), as approachText.js
// says it.
const WRECK_WORDS = { fire: 'on fire', vacuum: 'open to vacuum', rubble: 'full of rubble' };

// What supplies are called: food at the colony, and supplies aboard, on
// the run and on a voyage from it (M38d).
function suppliesWord(campaign) {
  return campaign.colony && !campaign.colony.voyage ? 'food' : 'supplies';
}

function dearestOnHand(campaign, rules) {
  return Object.keys(campaign.parts).sort((a, b) => (sellPriceOf(b, rules) ?? 0) - (sellPriceOf(a, rules) ?? 0) || a.localeCompare(b))[0] ?? null;
}

function partName(type, rules) {
  return rules.modules.get(type)?.name ?? type;
}

// "an Armory", "a Corridor"; from another table (a ship preset's), its
// name the same way.
function aPart(type, rules, table = rules.modules) {
  const name = table.get(type)?.name ?? type;
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function signed(n) {
  return n < 0 ? `−${-n}` : `+${n}`;
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
