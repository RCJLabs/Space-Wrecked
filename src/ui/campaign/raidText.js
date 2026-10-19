// Text for raids on the colony (src/sim/raids.js, M29): the day's odds of
// the pursuer finding it, the lander coming and down, the colony's
// defenses, Defend's first tap, the landing's report, the raid fight's
// line under the round, and how a raid ended. From M38e at any colony: a
// lander down at another names it, and its own heat is what a raid there
// sets. From M38f its citizens fight beside the crew as colonists, and a
// raid where the ship isn't is fought out without it. rules are the
// content tables (src/sim/defs.js).
import { heatAt, thereAt } from '../../sim/colonies.js';
import { colonyBy } from '../../sim/edges.js';
import { pursuerOf, runLevel } from '../../sim/heat.js';
import { colonistsOf, colonyPursuer, defendersOf, defensesOf, downAt, fallenColonists, foundOdds, landingPlan, raidCampaign, raidIn, raidTake } from '../../sim/raids.js';
import { gearLine } from './armsText.js';
import { byJob } from './crewJobText.js';
import { easedSaid } from './questText.js';

const LANES = ['near the lanes', 'off the lanes', 'far from the lanes'];

// The raids' line for the colony screen's needs: { label, value, ok,
// state, line }. state: 'down' (the lander is down), 'coming' (found, the
// lander on its way), 'odds' (it may find the colony today) or 'quiet'
// (it can't, heat under rumorHeat); line: the pursuer's words for it. Of
// the campaign's colony (another's through colonies.js thereAt), by its
// own heat (M38e).
export function raidStatus(campaign, rules) {
  const words = colonyPursuer(campaign, rules);
  const days = raidIn(campaign);
  if (days === 0) return { label: 'Raid', value: 'Lander down: defend', ok: false, state: 'down', line: words?.landing ?? '' };
  if (days !== null) return { label: 'Raid', value: `Lander in ${days} day${days === 1 ? '' : 's'}`, ok: false, state: 'coming', line: words?.found ?? '' };
  const odds = foundOdds(campaign, rules);
  const where = LANES[(campaign.colony.world.lanes ?? 2) - 1] ?? '';
  const line = words?.levels[runLevel(heatAt(campaign, campaign.colony), rules)] ?? '';
  if (!odds) return { label: 'Found', value: `No odds under heat ${rules.balance.rumorHeat}`, ok: true, state: 'quiet', line };
  // Once the background's thread is done (M33b), the odds are halved, and
  // the line says why.
  const eased = easedSaid(campaign, rules);
  return { label: 'Found', value: `${odds}% a day · ${where}${eased ? ' · halved' : ''}`, ok: true, state: 'odds', line: eased ? `${line} ${eased.charAt(0).toUpperCase()}${eased.slice(1)}.` : line };
}

// The colony's defenses for its needs: { label, value, ok }: what fires
// at a lander and what the defenders gain ("3 shots at a lander · +1
// armor · +10 aim"), or null with none and no raid coming.
export function defenseRow(campaign, rules) {
  const { shots, armor, aim } = defensesOf(campaign, rules);
  const coming = raidIn(campaign) !== null;
  if (!shots && !armor && !aim) return coming ? { label: 'Defense', value: 'None: nothing fires at a lander', ok: false } : null;
  const said = [shots ? `${shots} shot${shots === 1 ? '' : 's'} at a lander` : 'Nothing fires at a lander', ...(armor ? [`+${armor} armor`] : []), ...(aim ? [`+${aim} aim`] : [])];
  return { label: 'Defense', value: said.join(' · '), ok: true };
}

// What the hint says of a raid, while one is coming or down, or null.
// A lander down at another colony (M38e) comes first, and says where.
export function raidHint(campaign, rules) {
  const at = downAt(campaign);
  if (at && at !== campaign.colony) {
    const there = thereAt(campaign, at.id);
    const fight = there.crew.length ? `then whoever is at ${at.world.name} fights the rest` : `nobody is at ${at.world.name} to fight the rest`;
    return { text: `${pursuerName(campaign, rules)}'s lander is down at ${at.world.name}: nothing passes until it is faced. Tap Defend: its guns fire as it comes down, ${fight}.`, tone: 'bad' };
  }
  const status = raidStatus(campaign, rules);
  if (status.state === 'down') {
    const colonists = colonistsOf(campaign, rules);
    const fight = defendersOf(campaign).length ? `then whoever is home${colonists ? ` and ${colonistCount(colonists)}` : ''} fights the rest` : colonists ? `then ${colonistCount(colonists)} fight the rest` : 'nobody is home to fight the rest';
    return { text: `${status.line} Tap Defend: the guns fire as it comes down, ${fight}.`, tone: 'bad' };
  }
  if (status.state !== 'coming') return null;
  const days = raidIn(campaign);
  // Away, it is fought out without the ship on the day it lands (M38f).
  const away = campaign.colony.trip || campaign.colony.voyage ? ' The ship is away: home before then, the whole crew meets it; else whoever is home fights it without the ship.' : '';
  return { text: `${status.line} It lands in ${days} day${days === 1 ? '' : 's'}: set down guns, a shield and an armory from the hold.${away}`, tone: 'warn' };
}

// "1 colonist", "3 colonists" (M38f).
function colonistCount(n) {
  return `${n} colonist${n === 1 ? '' : 's'}`;
}

// Defend, for the button: { ok, ask (what its first tap says), why }. At
// another colony (M38e) its guns and whoever is there, by name.
export function defendText(campaign, rules) {
  const plan = landingPlan(campaign, rules);
  if (!plan.ok) return { ok: false, ask: null, why: plan.error };
  const other = plan.colony !== campaign.colony.id ? thereAt(campaign, plan.colony) : null;
  const there = other ?? campaign;
  const spotter = plan.hit > rules.balance.landingHit ? colonyBy(defendersOf(there), rules, 'landing') : null;
  const place = other ? other.colony.world.name : null;
  const guns = plan.guns.length
    ? `${capital(listed(plan.guns.map((gun) => `the ${lowerFirst(gun.name)}${gun.shots > 1 ? ` (${gun.shots} shots)` : ''}`)))}${place ? ` at ${place}` : ''} fire${plan.guns.length === 1 ? 's' : ''} at the lander as it comes down, ${plan.hit}% a shot${spotter ? ` with ${byJob(spotter, rules)} calling them` : ''}, each hit a raider fewer.`
    : `Nothing at ${place ?? 'the colony'} fires at the lander.`;
  const party = countedNames(plan.raiders.map((id) => rules.enemies.get(id)?.name ?? id));
  // Its citizens stand beside the crew as colonists (M38f).
  const colonists = plan.citizens ? colonistCount(plan.citizens) : null;
  const who = plan.defenders.length ? `${plan.defenders.length} at ${place ?? 'home'}${colonists ? ` and ${colonists}` : ''}` : colonists ? `${colonists} at ${place ?? 'home'}` : null;
  const fight = who
    ? `${who} fight whoever lands of ${plan.raiders.length} (${party})`
    : `Nobody is ${place ? `at ${place}` : 'home'}: whoever lands of ${plan.raiders.length} (${party}) takes what they like`;
  const kit = [...(plan.armor ? [`the shield gives +${plan.armor} armor`] : []), ...(plan.aim ? [`the armory +${plan.aim} aim`] : [])];
  const gear = plan.defenders.length ? gearLine(rules) : null;
  const lost = colonists ? ' A colonist who falls is lost to the colony.' : '';
  return { ok: true, ask: `${guns} ${fight}${kit.length && who ? `; ${kit.join(' and ')}` : ''}.${gear ? ` ${gear}` : ''}${lost} Tap again to defend.`, why: null };
}

// What facing the raid came to (raids.js faceRaid's result), for the hint:
// { text, tone }. before: the campaign as it faced the raid. The heat is
// the colony's faced (M38e).
export function landingReport(result, before, rules) {
  const { shots, hits, landed } = result.landing;
  const other = result.colony !== undefined && result.colony !== before.colony.id ? thereAt(before, result.colony) : null;
  const there = other ?? before;
  const heat = heatAfter(heatAt(there, there.colony), rules);
  const fired = shots.length ? `${shots.length} shot${shots.length === 1 ? '' : 's'} at the lander, ${hits} hit${hits === 1 ? '' : 's'}.` : 'Nothing fired at the lander.';
  if (result.fight) return { text: `${fired} ${landed.length} raider${landed.length === 1 ? '' : 's'} land${landed.length === 1 ? 's' : ''}${other ? ` at ${other.colony.world.name}` : ''}: hold them off.`, tone: 'warn' };
  if (result.won) return { text: `${fired} Every raider stopped before they landed${other ? ` at ${other.colony.world.name}` : ''}: the raid is beaten. ${heat}`, tone: 'good' };
  return { text: `${fired} Nobody ${other ? `at ${other.colony.world.name}` : 'home'} to stop ${landed.length}: they took ${takenText(result.taken, rules)}. ${heat}`, tone: 'bad' };
}

// The raid fight's line under the round: { title, progress, done,
// deadline }: the raiders left, and how many the guns stopped as the
// lander came down. fight: the campaign's (raids.js faceRaid's).
export function colonyRaidObjective(battle, fight, rules) {
  const left = battle.units.filter((unit) => unit.side === 'enemy' && unit.status === 'active').length;
  const stopped = stoppedOf(battle, fight, rules);
  return { title: 'Raid', progress: `${left} raider${left === 1 ? '' : 's'} left${stopped ? ` · ${stopped} stopped landing` : ''}`, done: false, deadline: null };
}

// The landing's report as the raid fight opens, for its first hint: {
// tone, text }: the shots, the hits and the raiders who landed. campaign:
// as the fight stands (the colony's guns are as they fired).
export function landingNotice(battle, fight, campaign, rules) {
  const landed = battle.units.filter((unit) => unit.side === 'enemy').length;
  const hits = stoppedOf(battle, fight, rules);
  const shots = Math.max(hits, defensesOf(raidCampaign(campaign), rules).shots);
  const fired = shots ? `${shots} shot${shots === 1 ? '' : 's'} at the lander, ${hits} hit${hits === 1 ? '' : 's'}.` : 'Nothing fired at the lander.';
  return { tone: 'warn', text: `${fired} ${landed} raider${landed === 1 ? '' : 's'} landed: hold them off.` };
}

// How many of the party the guns stopped: those of the pursuer's raiders
// who never landed.
function stoppedOf(battle, fight, rules) {
  const party = rules.encounters.get(fight?.encounter)?.enemies.length ?? 0;
  return Math.max(0, party - battle.units.filter((unit) => unit.side === 'enemy').length);
}

// How a raid on the colony ended, for the fight's end panel: { tone,
// title, text }. campaign is as it stands before the crew goes home
// (raids.js endColonyRaid). At another colony (M38e) its stores and heat;
// from M38f the colonists who fell, lost to it.
export function colonyRaidOutcome(battle, campaign, rules) {
  const there = raidCampaign(campaign);
  const heat = heatAfter(heatAt(there, there.colony), rules);
  const fell = fallenColonists(battle);
  const lost = fell ? ` ${fell === 1 ? 'A colonist' : `${fell} colonists`} fell, lost to the colony: ${Math.max(0, (there.colony.citizens ?? 0) - fell)} citizen${(there.colony.citizens ?? 0) - fell === 1 ? '' : 's'} left.` : '';
  if (battle.winner === 'crew') return { tone: fell ? 'warn' : 'good', title: 'Raid beaten', text: `${colonyPursuer(campaign, rules)?.faced ?? 'They pull back to their lander.'}${lost} ${heat}` };
  return { tone: 'bad', title: 'Raid lost', text: `They took ${takenText(raidTake(there, rules), rules)}.${lost} ${heat}` };
}

// What a lost raid took, in words: "12 food, 15 materials and the Shield
// generator", or "nothing, there was nothing to take".
export function takenText(taken, rules) {
  const said = [
    ...(taken?.food ? [`${taken.food} food`] : []),
    ...(taken?.materials ? [`${taken.materials} materials`] : []),
    ...(taken?.part ? [`the ${rules.modules.get(taken.part)?.name ?? taken.part}`] : []),
  ];
  return said.length ? listed(said) : 'nothing: there was nothing to take';
}

// The pursuer's name, for words that name it.
export function pursuerName(campaign, rules) {
  return pursuerOf(campaign, rules)?.name ?? 'The pursuer';
}

// What a raid over does to heat: "Heat falls to 40.", or under that
// already, "Heat stays at 31.".
function heatAfter(heat, rules) {
  const { heatAfterRaid } = rules.balance;
  return heat > heatAfterRaid ? `Heat falls to ${heatAfterRaid}.` : `Heat stays at ${heat}.`;
}

// "Recovery agent ×2, Hired heavy": names in order of first showing,
// counted.
function countedNames(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}

// "a, b and c".
function listed(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
