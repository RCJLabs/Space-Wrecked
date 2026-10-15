// Text for raids on the colony (src/sim/raids.js, M29): the day's odds of
// the pursuer finding it, the lander coming and down, the colony's
// defenses, Defend's first tap, the landing's report, the raid fight's
// line under the round, and how a raid ended. rules are the content tables
// (src/sim/defs.js).
import { pursuerOf, runLevel } from '../../sim/heat.js';
import { colonyPursuer, defendersOf, defensesOf, foundOdds, landingPlan, raidDown, raidIn, raidTake } from '../../sim/raids.js';

const LANES = ['near the lanes', 'off the lanes', 'far from the lanes'];

// The raids' line for the colony screen's needs: { label, value, ok,
// state, line }. state: 'down' (the lander is down), 'coming' (found, the
// lander on its way), 'odds' (it may find the colony today) or 'quiet'
// (it can't, heat under rumorHeat); line: the pursuer's words for it.
export function raidStatus(campaign, rules) {
  const words = colonyPursuer(campaign, rules);
  if (raidDown(campaign)) return { label: 'Raid', value: 'Lander down: defend', ok: false, state: 'down', line: words?.landing ?? '' };
  const days = raidIn(campaign);
  if (days !== null) return { label: 'Raid', value: `Lander in ${days} day${days === 1 ? '' : 's'}`, ok: false, state: 'coming', line: words?.found ?? '' };
  const odds = foundOdds(campaign, rules);
  const where = LANES[(campaign.colony.world.lanes ?? 2) - 1] ?? '';
  const line = words?.levels[runLevel(campaign.heat, rules)] ?? '';
  if (!odds) return { label: 'Found', value: `No odds under heat ${rules.balance.rumorHeat}`, ok: true, state: 'quiet', line };
  return { label: 'Found', value: `${odds}% a day · ${where}`, ok: true, state: 'odds', line };
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
export function raidHint(campaign, rules) {
  const status = raidStatus(campaign, rules);
  if (status.state === 'down') {
    const fight = defendersOf(campaign).length ? 'then whoever is home fights the rest' : 'nobody is home to fight the rest';
    return { text: `${status.line} Tap Defend: the guns fire as it comes down, ${fight}.`, tone: 'bad' };
  }
  if (status.state !== 'coming') return null;
  const days = raidIn(campaign);
  const away = campaign.colony.trip ? ' The ship is away: whoever is home will fight.' : '';
  return { text: `${status.line} It lands in ${days} day${days === 1 ? '' : 's'}: set down guns, a shield and an armory from the hold.${away}`, tone: 'warn' };
}

// Defend, for the button: { ok, ask (what its first tap says), why }.
export function defendText(campaign, rules) {
  const plan = landingPlan(campaign, rules);
  if (!plan.ok) return { ok: false, ask: null, why: plan.error };
  const guns = plan.guns.length
    ? `${capital(listed(plan.guns.map((gun) => `the ${lowerFirst(gun.name)}${gun.shots > 1 ? ` (${gun.shots} shots)` : ''}`)))} fire${plan.guns.length === 1 ? 's' : ''} at the lander as it comes down, ${plan.hit}% a shot, each hit a raider fewer.`
    : 'Nothing at the colony fires at the lander.';
  const party = countedNames(plan.raiders.map((id) => rules.enemies.get(id)?.name ?? id));
  const fight = plan.defenders.length
    ? `${plan.defenders.length} at home fight whoever lands of ${plan.raiders.length} (${party})`
    : `Nobody is home: whoever lands of ${plan.raiders.length} (${party}) takes what they like`;
  const kit = [...(plan.armor ? [`the shield gives +${plan.armor} armor`] : []), ...(plan.aim ? [`the armory +${plan.aim} aim`] : [])];
  return { ok: true, ask: `${guns} ${fight}${kit.length && plan.defenders.length ? `; ${kit.join(' and ')}` : ''}. Tap again to defend.`, why: null };
}

// What facing the raid came to (raids.js faceRaid's result), for the hint:
// { text, tone }. before: the campaign as it faced the raid.
export function landingReport(result, before, rules) {
  const { shots, hits, landed } = result.landing;
  const fired = shots.length ? `${shots.length} shot${shots.length === 1 ? '' : 's'} at the lander, ${hits} hit${hits === 1 ? '' : 's'}.` : 'Nothing fired at the lander.';
  if (result.fight) return { text: `${fired} ${landed.length} raider${landed.length === 1 ? '' : 's'} land${landed.length === 1 ? 's' : ''}: hold them off.`, tone: 'warn' };
  if (result.won) return { text: `${fired} Every raider stopped before they landed: the raid is beaten. ${heatAfter(before.heat, rules)}`, tone: 'good' };
  return { text: `${fired} Nobody home to stop ${landed.length}: they took ${takenText(result.taken, rules)}. ${heatAfter(before.heat, rules)}`, tone: 'bad' };
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
  const shots = Math.max(hits, defensesOf(campaign, rules).shots);
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
// (raids.js endColonyRaid).
export function colonyRaidOutcome(battle, campaign, rules) {
  const heat = heatAfter(campaign.heat, rules);
  if (battle.winner === 'crew') return { tone: 'good', title: 'Raid beaten', text: `${colonyPursuer(campaign, rules)?.faced ?? 'They pull back to their lander.'} ${heat}` };
  return { tone: 'bad', title: 'Raid lost', text: `They took ${takenText(raidTake(campaign, rules), rules)}. ${heat}` };
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
