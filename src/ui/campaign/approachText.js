// Words for the approach screen (approach.js): the two ships, the other
// ship's order for the round, every order the player can give with its
// odds, what the last round came to, and how it ended, with the boarding
// fight it ended in, if any (boardingText.js). The pursuer's hunters (M24,
// src/sim/hunt.js) say whose they are, and what facing them did to heat. A
// side's patrol (M33) says its words as it waves the ship through or opens
// fire, and the end says what striking a side's ship cost with it
// (standingText.js). A trap sprung at an event (M36) says so, and the
// event's words for it, its ship having fired first. The rules are
// src/sim/approach.js's, played by src/sim/encounter.js. rules are the
// content tables (src/sim/defs.js).
import { AIMS, choicesFor, closeChance, FACED, fleeChance, sideStats, torpedoRounds } from '../../sim/approach.js';
import { approachIntent, approachState } from '../../sim/encounter.js';
import { pursuerOf } from '../../sim/heat.js';
import { shipName } from '../../sim/identity.js';
import { boardingStakes } from './boardingText.js';
import { actTitle, heatText } from './hubText.js';
import { changeLines, patrolWords } from './standingText.js';

// What each kind of module is called, aimed at.
const AIM_NAMES = { weapons: 'guns', engines: 'engines', shields: 'shields', reactor: 'reactor' };
const WRECK_WORDS = { fire: 'on fire', vacuum: 'open to vacuum', rubble: 'full of rubble' };

// The approach going on, as the screen shows it, or null with none:
//   act, where, round   "Act 2 · The run", "Hostile ship · Pirate cutter"
//                       ("The hunters · Con-Reg repo tug", "A trap ·
//                       Pirate cutter"), "Round 1 of 3"
//   heat                the hangar's meter (hubText.js heatText)
//   you, them           { name, stats: [[label, value]], wrecked }: wrecked
//                       { [uid]: wreck }, for the boards
//   intent              the other ship's order: { text, short } (null once
//                       it is over)
//   orders              [{ key, order, label, small, ok, why, ask, text,
//                       targets? }]: the four kinds to fire at, evade, flee
//                       and close; a fire order's targets are the uids it
//                       would hit, the first first (M38b)
//   last                the last round, as lines, or []; before round 1,
//                       a patrol's opening volley (M33), or a trap's (M36)
//   lastHead            what last is: "Last round", or "They opened fire"
//   outcome             null while it goes on, else { title, lines, board
//                       ('you' or 'them': the ship that is boarded, or
//                       null), boarding (the fight that is due:
//                       boardingText.js boardingStakes, or null) }
//   hint                { tone, text }
export function approachText(campaign, rules) {
  const state = approachState(campaign, rules);
  if (!state) return null;
  const { approach } = campaign.run;
  const intent = approachIntent(campaign, rules);
  const theirName = shortName(approach.enemy.name);
  const outcome = approach.outcome ? outcomeText(approach, campaign, rules) : null;
  return {
    act: actTitle(campaign.act, rules),
    where: `${approach.hunt ? 'The hunters' : approach.ambush ? 'A trap' : 'Hostile ship'} · ${approach.enemy.name}`,
    round: outcome ? 'Over' : `Round ${approach.round} of ${rules.balance.approachRounds}`,
    heat: heatText(campaign, rules),
    you: sideText(shipName(campaign, rules), state.you, rules),
    them: sideText(`The ${theirName}`, state.them, rules),
    intent: intent ? intentText(intent, state, theirName, rules) : null,
    orders: intent ? ordersText(state, intent, theirName, rules) : [],
    last: approach.last ? roundLines(approach.last, state, theirName, rules) : [],
    lastHead: approach.last?.order === null ? 'They opened fire' : 'Last round',
    outcome,
    hint: hintFor(approach, outcome, campaign, rules),
  };
}

// A side's name, numbers and wrecks. Point defense shows only on a ship
// that has some: what it takes off the other ship's hit chance, as evasion
// does. The crew's edge (M32: a marine's gunnery, a pilot's evasion, both
// counted in the odds shown) shows only on a side whose crew has one.
function sideText(name, side, rules) {
  const stats = sideStats(side, rules);
  const edge = side.edge ?? {};
  const crew = [edge.gunnery ? `guns +${edge.gunnery}` : null, edge.evasion ? `evasion +${edge.evasion}` : null].filter(Boolean);
  const count = (tag) => {
    const all = side.ship.modules.filter((module) => rules.modules.get(module.type)?.tags.includes(tag));
    const working = all.filter((module) => !(module.uid in side.wrecked));
    return { all: all.length, text: `${working.length} of ${all.length}` };
  };
  const turrets = count('pointdefense');
  // M39: torpedo bays among the guns, and a grapple, on a ship that has them.
  const bays = count('torpedo');
  const claws = count('grapple');
  return {
    name,
    stats: [
      ['Guns', count('weapon').text],
      ...(bays.all ? [['Torpedo bays', bays.text]] : []),
      ...(turrets.all ? [['Point defense', stats.intercept ? String(stats.intercept) : 'out']] : []),
      ...(claws.all ? [['Grapple', stats.grapple ? `+${stats.grapple}` : 'out']] : []),
      ['Shields', stats.shields ? `${stats.shields} a round` : 'none'],
      ['Engines', count('engine').text],
      ['Reactor', count('reactor').text],
      ['Evasion', String(stats.evasion)],
      ...(crew.length ? [['Crew', crew.join(' · ')]] : []),
    ],
    wrecked: side.wrecked,
  };
}

// Each gun's damage a hit, in words: "15", or "30, 15 and 15", biggest
// first.
export function damageText(damages) {
  const sorted = [...damages].sort((a, b) => b - a);
  if (sorted.every((damage) => damage === sorted[0])) return String(sorted[0] ?? 0);
  return `${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`;
}

// The other ship's order, as the player reads it before giving theirs, with
// the odds it rolls at.
function intentText(intent, state, theirName, rules) {
  const they = `The ${theirName}`;
  const theirs = sideStats(state.them, rules, state.round ?? null);
  const yours = sideStats(state.you, rules);
  if (intent.kind === 'fire') {
    const choices = choicesFor(state, intent, rules);
    const evade = choices.find((c) => c.order.kind === 'evade');
    const guns = `${theirs.guns} gun${theirs.guns === 1 ? '' : 's'}`;
    return {
      short: `Fires at your ${AIM_NAMES[intent.at]}`,
      text: `${they} fires at your ${AIM_NAMES[intent.at]}: ${guns}, ${evade.was}% each (${evade.chance}% if you evade), ${damageText(theirs.damages)} damage a hit.${torpedoWords(theirs, 'your', rules)}`,
    };
  }
  if (intent.kind === 'close') {
    const claw = theirs.grapple ? ` Their grapple adds ${theirs.grapple}.` : '';
    return { short: 'Closes to board', text: `${they} closes to board: ${closeChance(theirs, yours, rules)}% to grapple on, after the volleys.${claw} Getting away, or disabling it, stops it.` };
  }
  if (intent.kind === 'flee') {
    const held = yours.grapple ? ` Your grapple holds it: ${yours.grapple} less.` : '';
    return { short: 'Runs', text: `${they} is running: ${fleeChance(theirs, yours, rules)}% to get away, before anyone fires.${held}` };
  }
  return { short: 'Evades', text: `${they} is evading: your guns hit less.` };
}

// Every order, with its odds: the first tap shows `text`, the second gives
// it.
function ordersText(state, intent, theirName, rules) {
  const choices = choicesFor(state, intent, rules);
  // M39: what the ships' torpedo bays and grapples do, as the odds count them.
  const yours = sideStats(state.you, rules, state.round ?? null);
  const theirs = sideStats(state.them, rules);
  const out = [];
  for (const choice of choices) {
    const { order } = choice;
    if (order.kind === 'fire') {
      const name = AIM_NAMES[order.at];
      const guns = `${choice.guns} gun${choice.guns === 1 ? '' : 's'}`;
      const torpedo = (choice.through ?? []).some(Boolean);
      const shields = choice.shields ? `, their shields soak up ${choice.shields} a round${torpedo ? ' but not a torpedo' : ''}` : '';
      // Wrecking the last reactor rolls for the ship blowing apart.
      const blow = order.at === 'reactor' && choice.targets.length === 1 ? ` If their last reactor is wrecked, the ${theirName} blows apart ${rules.balance.blowChance}% of the time, leaving only scrap.` : '';
      out.push({
        key: `fire-${order.at}`,
        order,
        label: capital(name),
        small: choice.ok ? `${choice.chance}% × ${choice.guns}` : '–',
        ok: choice.ok,
        why: choice.why,
        ask: `${capital(name)}?`,
        text: `Fire at their ${name}: your ${guns}, ${choice.chance}% each to hit, ${damageText(choice.damages)} damage a hit${shields}.${torpedoWords(yours, 'their', rules, false)}${blow} Tap again to fire.`,
        // The parts it would hit, the first first: marked on her hull as
        // it is armed (M38b).
        targets: choice.targets.map((target) => target.uid),
      });
    } else if (order.kind === 'evade') {
      const against = choice.chance === null ? 'Their guns are quiet this round.' : `Their guns hit ${choice.chance}% instead of ${choice.was}%.`;
      out.push({ key: 'evade', order, label: 'Evade', small: choice.chance === null ? '' : `${choice.chance}%`, ok: true, why: null, ask: 'Evade?', text: `Evade: you don't fire. ${against} Tap again to evade.` });
    } else if (order.kind === 'flee') {
      const held = theirs.grapple ? ` Their grapple holds you: ${theirs.grapple} less.` : '';
      out.push({ key: 'flee', order, label: 'Flee', small: choice.ok ? `${choice.chance}%` : '–', ok: choice.ok, why: choice.why, ask: 'Flee?', text: `Flee: ${choice.chance}% to get away before anyone fires.${held} Tap again to run.` });
    } else {
      const claw = yours.grapple ? ` Your grapple adds ${yours.grapple}.` : '';
      out.push({ key: 'close', order, label: 'Board', small: choice.ok ? `${choice.chance}%` : '–', ok: choice.ok, why: choice.why, ask: 'Board?', text: `Close to board the ${theirName}: ${choice.chance}% to grapple on, after the volleys, then a fight with her crew aboard her.${claw} Tap again to close.` });
    }
  }
  return out;
}

// A side's torpedo bays this round (M39), in words, or '': those firing
// pass `whose` shields; those holding fire say when they fire. stats is
// sideStats for the round. shields: whether to say the torpedoes pass them
// (the order's own words say it already).
function torpedoWords(stats, whose, rules, shields = true) {
  const firing = stats.through.filter(Boolean).length;
  const holding = stats.armed - stats.guns;
  const rounds = torpedoRounds(rules);
  const when = rounds.length > 1 ? `rounds ${rounds.slice(0, -1).join(', ')} and ${rounds.at(-1)}` : `round ${rounds[0]}`;
  if (firing) return shields ? ` ${firing === 1 ? 'A torpedo' : `${firing} torpedoes`} among them, through ${whose} shields.` : '';
  if (holding > 0) return ` ${holding === 1 ? 'A torpedo bay holds' : `${holding} torpedo bays hold`} fire this round: they fire in ${when}.`;
  return '';
}

// What the last round came to, a line an event.
function roundLines({ events }, state, theirName, rules) {
  const nameOf = (side, uid) => rules.modules.get(side.ship.modules.find((module) => module.uid === uid)?.type)?.name ?? 'part';
  return events.map((event) => {
    if (event.kind === 'flee') {
      const who = event.side === 'you' ? 'You try to get away' : `The ${theirName} tries to run`;
      return `${who}, ${event.chance}%: rolled ${event.roll}, ${event.ok ? 'away' : 'no'}.`;
    }
    if (event.kind === 'close') {
      const who = event.side === 'you' ? 'You close to board' : `The ${theirName} closes to board`;
      return `${who}, ${event.chance}%: rolled ${event.roll}, ${event.ok ? 'grappled on' : 'no'}.`;
    }
    if (event.kind === 'blow') return `Her reactor goes, ${event.chance}% to blow: rolled ${event.roll}, ${event.ok ? 'she blows apart' : 'she holds'}.`;
    const ours = event.side === 'you';
    const target = ours ? state.them : state.you;
    const hits = event.shots.filter((shot) => shot.hit);
    const who = ours ? `Your ${event.shots.length === 1 ? 'gun' : `${event.shots.length} guns`}` : `Their ${event.shots.length === 1 ? 'gun' : `${event.shots.length} guns`}`;
    const rolls = event.shots.map((shot) => `${shot.roll} ${shot.hit ? 'hit' : 'miss'}`).join(', ');
    const harm = hits
      .map((shot) => {
        const part = `${ours ? 'their' : 'your'} ${nameOf(target, shot.module)}`;
        if (!shot.module) return shot.absorbed ? `shields take ${shot.absorbed}` : 'nothing left to hit';
        const soaked = shot.absorbed ? ` (shields take ${shot.absorbed})` : shot.torpedo ? ' (a torpedo, through the shields)' : '';
        return shot.wreck ? `${part} wrecked, ${WRECK_WORDS[shot.wreck]}${soaked}` : `${part} takes ${shot.damage}${soaked}`;
      })
      .join('; ');
    return `${who} at ${ours ? 'their' : 'your'} ${AIM_NAMES[event.at]}, ${event.chance}%: ${rolls}.${harm ? ` ${capital(harm)}.` : ''}`;
  });
}

// How it ended, and what it came to.
function outcomeText(approach, campaign, rules) {
  const { kind, how, changes } = approach.outcome;
  const name = shortName(approach.enemy.name);
  const partName = (type) => rules.modules.get(type)?.name ?? type;
  const lines = [];
  let title;
  let board = null;
  const stakes = boardingStakes(campaign, rules);
  if (kind === 'waved') title = `The ${name} waves you through.`;
  else if (kind === 'escaped') title = 'You got away.';
  else if (kind === 'fled') title = `The ${name} ran.`;
  else if (kind === 'parted') title = `The ${name} breaks off, and the ships part.`;
  else if (kind === 'adrift') title = 'Both ships drift, dead. The crews patch up and part.';
  else if (kind === 'destroyed') title = `The ${name} blows apart.`;
  else if (kind === 'boarded') {
    title = how === 'closed' ? `You grapple onto the ${name}.` : `The ${name} is dead in space.`;
    board = 'them';
  } else {
    title = how === 'closed' ? `The ${name} grapples on and boards you.` : `Dead in space: the ${name} boards you.`;
    board = 'you';
  }
  if (kind === 'waved') lines.push(patrolWords(approach, rules) ?? 'Nobody wants a fight today.');
  if (stakes) lines.push(...stakes.lines);
  const found = changes.parts.map((type) => `${article(partName(type))} ${partName(type)}`);
  if (found.length) lines.push(`Stripped: ${found.join(', ')}.`);
  if (changes.credits > 0) lines.push(`Scrap: ${changes.credits} credits.`);
  if (changes.lost?.part) lines.push(`They take the ${partName(changes.lost.part)} you had on hand.`);
  if (changes.lost?.credits) lines.push(`They take ${changes.lost.credits} credits.`);
  if (approach.hunt && FACED.includes(kind)) lines.push(`Heat −${-changes.heat}, to ${campaign.heat}: ${pursuerOf(campaign, rules)?.run?.faced ?? 'they lose the trail.'}`);
  else if (changes.heat) lines.push(`The shooting was heard: heat +${changes.heat}.`);
  if (approach.hunt && !FACED.includes(kind)) lines.push(`Still on your trail: heat ${campaign.heat}.`);
  const wrecked = Object.keys(campaign.wrecks).map((uid) => partName(campaign.ship.modules.find((module) => module.uid === Number(uid))?.type));
  if (changes.patched.length) lines.push(`The crew gets ${changes.patched.map((uid) => `the ${partName(campaign.ship.modules.find((module) => module.uid === uid)?.type).toLowerCase()}`).join(' and ')} going again.`);
  if (wrecked.length) lines.push(`Wrecked aboard until a station repairs it: ${wrecked.join(', ')}.`);
  lines.push(...changeLines(changes.standing, rules));
  return { title, lines, board, boarding: stakes };
}

// What to do now: once it is over, carry on or fight; before the first
// order, a trap's words (M36) or a patrol's that opened fire (M33), or how
// it opens; and nothing more between rounds.
function hintFor(approach, outcome, campaign, rules) {
  if (outcome) return outcomeHint(outcome);
  if (approach.ambush && (!approach.last || approach.last.order === null)) return trapHint(approach, rules);
  if (approach.last?.order === null) return patrolHint(approach, rules);
  // Past the first round the column shows what happened; a short line
  // still says what's next (M43).
  return approach.last ? { tone: 'info', text: 'Next round: tap an order to see its odds.' } : openingHint(approach, campaign, rules);
}

// A side's patrol that opened fire before the first round (M33): its words,
// and how orders are given.
function patrolHint(approach, rules) {
  return { tone: 'bad', text: `${patrolWords(approach, rules) ?? 'They opened fire.'} Tap an order to see its odds; tap it again to give it.` };
}

// A trap sprung at an event (M36): the words of the outcome that sprang
// it, and how orders are given.
function trapHint(approach, rules) {
  const { event, choice, outcome } = approach.ambush;
  const said = rules.events.get(event)?.choices.find((entry) => entry.id === choice)?.outcomes[outcome]?.text;
  return { tone: 'bad', text: `${said ?? 'It was a trap.'} Tap an order to see its odds; tap it again to give it.` };
}

// What to do as it opens: the hunters, whose they are and what facing
// them buys; anyone else, how orders are given.
function openingHint(approach, campaign, rules) {
  const how = 'Tap an order to see its odds; tap it again to give it.';
  if (!approach.hunt) return { tone: 'info', text: how };
  const name = pursuerOf(campaign, rules)?.name ?? 'The pursuer';
  return { tone: 'warn', text: `${name}'s hunters were waiting. Facing them buys quiet; getting away doesn't. ${how}` };
}

// What to do once it is over: carry on, or fight the boarding it ended in.
function outcomeHint(outcome) {
  if (!outcome.boarding) return { tone: 'info', text: 'Carry on to the chart.' };
  return outcome.boarding.leave ? { tone: 'warn', text: 'Board her, or leave her.' } : { tone: 'bad', text: 'They are coming aboard: fight them off.' };
}

// "Pirate cutter" -> "cutter": the ship as the words call it after the
// first time.
function shortName(name) {
  return name.split(' ').at(-1).toLowerCase();
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

// The order kinds, for the screen's buttons.
export const ORDER_KEYS = [...AIMS.map((aim) => `fire-${aim}`), 'evade', 'flee', 'close'];
