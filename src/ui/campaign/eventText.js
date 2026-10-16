// Text for an event at a node (src/sim/events.js): the event as it opens,
// each choice with its odds and what each of its outcomes does, and what
// happened once a choice is made, standing with the sides included (M33,
// standingText.js), and what it did to a quest (M33b, questText.js). From
// M33c a chain's step can offer a companion a berth: who they are, and who
// signed on (companionText.js). rules are the content tables
// (src/sim/defs.js).
import { companionOf } from '../../sim/companions.js';
import { sellPriceOf } from '../../sim/economy.js';
import { choiceProblem } from '../../sim/events.js';
import { openEvent } from '../../sim/travel.js';
import { berthSaid, companionCard, feedSaid, joinedLines, joinsSaid, offeredBy } from './companionText.js';
import { choiceQuestSaid, questNoteLines } from './questText.js';
import { changeLines, sideCalled } from './standingText.js';

// The event open where the ship is, or null:
//   where     "Derelict · Old Beacon": the node's kind and name
//   title, text
//   companion who a choice would sign on (M33c, companionText.js
//             companionCard), or null
//   choices   [{ id, label, ok, why, odds, berth, outcomes, ask }]: odds is
//             the chances in short ("70% · 30%", or '' for a sure thing),
//             berth what a choice needing one takes ("Takes a berth · 1
//             free", or ''), outcomes [{ chance, says }] what each does, ask
//             what the first tap says: the odds in full, what it does to a
//             quest (M33b), what the crew eats with a companion signing on
//             (M33c) and "tap again"
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
      const why = choiceProblem(campaign, choice, rules);
      const outcomes = choice.outcomes.map((outcome) => ({ chance: outcome.chance, says: effectsText(outcome.effects, campaign, rules) }));
      const sure = outcomes.length === 1;
      const odds = sure ? '' : outcomes.map((outcome) => `${outcome.chance}%`).join(' · ');
      const told = sure ? `${capital(outcomes[0].says)}.` : outcomes.map((outcome) => `${outcome.chance}%: ${outcome.says}.`).join(' ');
      const quest = choiceQuestSaid(campaign, rules, node, event.id, choice.id);
      const berth = choice.needs?.berth ? berthSaid(campaign, rules) : '';
      const joins = choice.outcomes.find((outcome) => outcome.effects.joins)?.effects.joins;
      const feed = joins ? feedSaid(joins, campaign, rules) : '';
      return { id: choice.id, label: choice.label, ok: !why, why, odds, berth, outcomes, ask: `${choice.label}: ${told}${quest ? ` ${quest}` : ''}${feed ? ` ${feed}` : ''} Tap again to choose.` };
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

// "Derelict · Old Beacon".
function whereText(node, rules) {
  const kind = rules.nodeTypes.get(node.type)?.name ?? node.type;
  return `${kind} · ${node.name}`;
}

// An outcome's effects in words, for the odds: "+10 credits, a salvaged
// part, the union +1". Nothing is "nothing". At the colony (M28) supplies
// are food, and an event can bring materials.
export function effectsText(effects, campaign, rules) {
  const said = [];
  if (effects.credits) said.push(`${signed(effects.credits)} credits`);
  if (effects.supplies) said.push(`${signed(effects.supplies)} ${suppliesWord(campaign)}`);
  if (effects.materials) said.push(`${signed(effects.materials)} materials`);
  if (effects.heat) said.push(`heat ${signed(effects.heat)}`);
  if (effects.wound) said.push(`${effects.wound.all ? 'everyone' : 'someone'} hurt (${effects.wound.hp} hit points)`);
  if (effects.part) said.push(aPart(effects.part, rules));
  if (effects.drop) said.push('a salvaged part');
  if (effects.sell) {
    const dearest = dearestOnHand(campaign, rules);
    said.push(dearest ? `your ${partName(dearest, rules)} sold for ${sellPriceOf(dearest, rules)} credits` : 'a part sold');
  }
  for (const [side, by] of Object.entries(effects.standing ?? {})) said.push(`${sideCalled(side, rules)} ${signed(by)}`);
  if (effects.joins) said.push(joinsSaid(effects.joins, rules));
  return said.length ? said.join(', ') : 'nothing';
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
  if (changes.parts.length) said.push(`Found: ${changes.parts.map((part) => aPart(part, rules)).join(', ')}.`);
  for (const sale of changes.sold) said.push(`Sold: the ${partName(sale.part, rules)}, for ${sale.credits} credits.`);
  for (const wound of changes.wounds) {
    const name = campaign.crew.find((member) => member.id === wound.id)?.name ?? 'Someone';
    said.push(`${name} hurt (${wound.hp} hit point${wound.hp === 1 ? '' : 's'}).`);
  }
  said.push(...changeLines(changes.standing, rules));
  return said.length ? said.join(' ') : 'Nothing changes.';
}

// What supplies are called: food at the colony.
function suppliesWord(campaign) {
  return campaign.colony ? 'food' : 'supplies';
}

function dearestOnHand(campaign, rules) {
  return Object.keys(campaign.parts).sort((a, b) => (sellPriceOf(b, rules) ?? 0) - (sellPriceOf(a, rules) ?? 0) || a.localeCompare(b))[0] ?? null;
}

function partName(type, rules) {
  return rules.modules.get(type)?.name ?? type;
}

// "an Armory", "a Corridor".
function aPart(type, rules) {
  const name = partName(type, rules);
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function signed(n) {
  return n < 0 ? `−${-n}` : `+${n}`;
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
