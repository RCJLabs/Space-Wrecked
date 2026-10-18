// Cheats for the ?dev=1 menu (src/ui/dev/cheats.js): each a campaign in and
// a campaign out, kept within what a save holds (campaign.js
// campaignProblems), so a cheat never breaks a save, and only ever reached
// through that menu. God mode is not one: it is a switch on the rules, never
// saved (god.js). Pure.
//
// A cheat is { kind, by? }:
//   credits { by }   credits added, or taken (to 0 at most)
//   heat { by }      the pursuer's heat moved, within 0 and its most
//   heal             every crew member back to their most hit points
//   rank             every crew member on to their job's next rank: the
//                    fights it asks for (ranks.js)
//   parts            the parts the ship's checks still ask for and the
//                    crew doesn't have on hand (campaign.js partsNeeded),
//                    put on hand
//   fill             on the run, the holds full of supplies; at the
//                    colony, its food (the run's supplies) and materials
//                    each up to its stores (colony.js storesOf)
//   standing { by }  the standing with every side moved
//   quest            each quest's step open in this act done, its effects
//                    and pay-off had (quests.js stepDone); at the colony, a
//                    quest's place it leaves behind comes off the list
//   win              the fight on won: every enemy left in it dies
// None but credits, heat, parts, fill and standing is played in a fight:
// its crew's hit points and fights are the battle's until it ends, and its
// end does a quest's step of its own.
//
// cheat(campaign, rules, { kind, by }) returns { ok: true, campaign } or
// { ok: false, error }.
import { MAX_MATERIALS, MAX_SUPPLIES, maxHp, partsNeeded } from './campaign.js';
import { storesOf } from './colony.js';
import { withHeat } from './heat.js';
import { openStep, openSteps, stepDone } from './quests.js';
import { nextRankAt } from './ranks.js';
import { moveStanding } from './standing.js';
import { supplyCapacity } from './travel.js';

export const CHEATS = ['credits', 'heat', 'heal', 'rank', 'parts', 'fill', 'standing', 'quest', 'win'];
// The cheats that change the crew or a quest, which wait for a fight to end.
const NOT_IN_FIGHT = ['heal', 'rank', 'quest'];

export function cheat(campaign, rules, { kind, by } = {}) {
  if (!CHEATS.includes(kind)) return refuse('That cheat is unknown.');
  if (['credits', 'heat', 'standing'].includes(kind) && !(Number.isInteger(by) && by !== 0)) return refuse('A cheat that moves a number needs a whole number to move it by.');
  if (NOT_IN_FIGHT.includes(kind) && campaign.fight) return refuse('Not in a fight: win it first.');
  switch (kind) {
    case 'credits':
      return moved(campaign, { credits: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, campaign.credits + by)) }, 'credits', by > 0 ? 'Credits are at their most.' : 'There are no credits to take.');
    case 'heat':
      return moved(campaign, { heat: withHeat(campaign.heat, by) }, 'heat', by > 0 ? 'Heat is at its most.' : 'Heat is at 0.');
    case 'heal':
      return heal(campaign, rules);
    case 'rank':
      return rankUp(campaign, rules);
    case 'parts':
      return addParts(campaign, rules);
    case 'fill':
      return fill(campaign, rules);
    case 'standing':
      return standing(campaign, rules, by);
    case 'quest':
      return doSteps(campaign, rules);
    default:
      return win(campaign);
  }
}

function heal(campaign, rules) {
  const crew = campaign.crew.map((member) => {
    const most = maxHp(member, rules);
    return member.hp < most ? { ...member, hp: most } : member;
  });
  return changed(campaign, crew) ? { ok: true, campaign: { ...campaign, crew } } : refuse('Everyone is at full health.');
}

function rankUp(campaign, rules) {
  const crew = campaign.crew.map((member) => {
    const at = nextRankAt(member, rules);
    return at === null ? member : { ...member, fights: Math.max(member.fights ?? 0, at) };
  });
  return changed(campaign, crew) ? { ok: true, campaign: { ...campaign, crew } } : refuse("Everyone is at their job's last rank.");
}

function addParts(campaign, rules) {
  const parts = { ...campaign.parts };
  let added = 0;
  for (const [type, count] of Object.entries(partsNeeded(campaign, rules))) {
    const short = count - (parts[type] ?? 0);
    if (short <= 0) continue;
    parts[type] = count;
    added += short;
  }
  if (added) return { ok: true, campaign: { ...campaign, parts } };
  return refuse('The ship has, or has on hand, every part its checks ask for.');
}

function fill(campaign, rules) {
  // At the colony its stores; on the run, and on a voyage from it (M38d),
  // the ship's holds.
  if (campaign.colony && !campaign.colony.voyage) {
    const { total } = storesOf(campaign, rules);
    const supplies = Math.min(MAX_SUPPLIES, Math.max(campaign.supplies, total));
    const materials = Math.min(MAX_MATERIALS, Math.max(campaign.colony.materials, total));
    if (supplies === campaign.supplies && materials === campaign.colony.materials) return refuse('The stores are full.');
    return { ok: true, campaign: { ...campaign, supplies, colony: { ...campaign.colony, materials } } };
  }
  if (!campaign.run) return refuse(campaign.act === 1 ? 'The holds fill as the run begins.' : "The run hasn't begun.");
  const most = Math.min(MAX_SUPPLIES, supplyCapacity(campaign.ship, rules, campaign.crew));
  return campaign.supplies < most ? { ok: true, campaign: { ...campaign, supplies: most } } : refuse('The holds are full.');
}

function standing(campaign, rules, by) {
  const { campaign: next, changes } = moveStanding(campaign, rules, Object.fromEntries([...rules.factions.sides.keys()].map((side) => [side, by])));
  if (changes.some((change) => change.to !== change.from)) return { ok: true, campaign: next };
  return refuse(by > 0 ? 'Every side is at its best.' : 'Every side is at its worst.');
}

function doSteps(campaign, rules) {
  const open = openSteps(campaign, rules, campaign.act);
  if (!open.length) return refuse('No quest has a step open in this act.');
  let next = campaign;
  for (const { quest } of open) next = stepDone(next, rules, quest.id).campaign;
  const { colony } = next;
  if (colony && !colony.trip) {
    const places = colony.places.filter((place) => !place.quest || openStep(next, rules, place.quest));
    if (places.length !== colony.places.length) next = { ...next, colony: { ...colony, places } };
  }
  return { ok: true, campaign: next };
}

// Every enemy still in the fight dies, and the crew wins it: the end of the
// fight (its Continue) does the rest, as for any win.
function win(campaign) {
  const fight = campaign.fight;
  if (!fight) return refuse('No fight is on.');
  if (fight.battle.winner) return refuse('The fight is over.');
  const events = [];
  const units = fight.battle.units.map((unit) => {
    if (unit.side !== 'enemy' || unit.status === 'dead') return unit;
    events.push({ type: 'dead', unit: unit.id });
    return { ...unit, hp: 0, ap: 0, overwatch: false, status: 'dead' };
  });
  events.push({ type: 'over', winner: 'crew' });
  const battle = { ...fight.battle, units, winner: 'crew' };
  return { ok: true, campaign: { ...campaign, fight: { ...fight, battle, log: [...fight.log, ...events] } } };
}

// A number moved: { [key]: value } laid over the campaign, or why not when
// it stays where it was.
function moved(campaign, change, key, why) {
  return change[key] === campaign[key] ? refuse(why) : { ok: true, campaign: { ...campaign, ...change } };
}

function changed(campaign, crew) {
  return crew.some((member, i) => member !== campaign.crew[i]);
}

function refuse(error) {
  return { ok: false, error };
}
