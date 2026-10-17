// What happens at a sector's nodes (ROADMAP §4.7): events, from
// data/events.json. A node of a kind that holds events (a derelict, a
// distress call, a trader, a hazard) is given one as its sector is rolled
// (gen/sector.js). It opens when the ship gets there and holds every jump
// until a choice is made (travel.js openEvent). From M28 the colony's
// places within reach hold events of their own kinds too (expeditions.js),
// which only the squad there can be hurt by.
//
// A choice can need credits, supplies, parts on hand or, from M33c, a free
// berth (a companion signing on); from M36, someone of a job or with a
// trait: anyone aboard on the run, someone in the squad at a place. The
// first such in the crew's order takes it (takerOf), and a wound that falls
// on one falls on them while they have more than 1. Its outcomes each
// have a chance in 100, shown as they are rolled: one roll from 0 to 99
// picks the outcome whose share of the hundred it falls in, in the order
// written. An outcome's effects:
//   credits, supplies, heat   added: supplies up to what the holds take
//                             (in act 3, food up to the colony's stores),
//                             heat from 0 to HEAT_MAX
//   materials                 the colony's (M28), added up to its stores
//   wound { hp, all }         hit points off one crew member, picked by a
//                             roll from those with more than 1, or off
//                             everyone (all); never the last one. At a
//                             place, only the squad there
//   part                      a part of that type, on hand
//   drop                      a part on hand from the drop table named
//                             (data/events.json drops)
//   sell                      that many parts on hand sold, the dearest
//                             first, at what the shop pays (economy.js)
//   standing { [side]: by }   the crew's standing with each side moved
//                             (standing.js, M33); only on the run
//   joins                     a companion signs on (companions.js, M33c),
//                             in a free berth; only on the run, and only
//                             by a choice that needs a berth
//   wreck                     that many of the ship's working parts a
//                             volley could hit (approach.js AIM_TAGS)
//                             wrecked, each by a roll, as a volley wrecks
//                             them; then the crew gets one reactor and one
//                             engine going (encounter.js juryRig), as after
//                             an approach (M36). Only on the run: nothing
//                             repairs a wreck at the colony
//   repair                    that many of the ship's wrecks repaired, the
//                             dearest to repair first (M36)
//   ambush                    a fight (M36): on the run the preset named
//                             comes out firing (encounter.js openAmbush);
//                             at a hulk the scavengers were waiting
//                             (expeditions.js)
// The run keeps the nodes whose events are settled and the last one
// settled, until the next jump (travel.js). The flags count the events
// settled, and the campaign keeps each one's id (eventsMet, M36), so a
// sector or a place draws it again only once its kind has no others left
// (gen/sector.js, expeditions.js). From M33b a choice can move a quest on
// (quests.js atEvent): at a quest's node it can do the quest's step or end
// the quest, and the choice a side's chain starts at starts it; the result
// says so (quest).
// Pure: every roll is the campaign's.
import { int } from '../core/rng.js';
import { AIM_TAGS } from './approach.js';
import { storesOf } from './colony.js';
import { freeBerths, joinCompanion } from './companions.js';
import { pickWeighted } from './drops.js';
import { sellPriceOf } from './economy.js';
import { juryRig, openAmbush, wrecksOn } from './encounter.js';
import { withHeat } from './heat.js';
import { tally } from './flags.js';
import { WRECKS } from './mapFromShip.js';
import { hasTag } from './modules.js';
import { atEvent } from './quests.js';
import { wrecksToRepair } from './repair.js';
import { moveStanding } from './standing.js';
import { openEvent, supplyCapacity } from './travel.js';

export const EFFECTS = ['credits', 'supplies', 'heat', 'materials', 'wound', 'part', 'drop', 'sell', 'standing', 'joins', 'wreck', 'repair', 'ambush'];
export const NEEDS = ['credits', 'supplies', 'parts', 'berth', 'job', 'trait'];
// The tags of the parts an event can wreck: those a volley can hit.
const WRECKABLE = [...new Set(Object.values(AIM_TAGS).flat())];
const MAX_MET = 500;
const MAX_SEED = 0xffffffff;

// The parts on hand, counted.
export function partsOnHand(campaign) {
  return Object.values(campaign.parts).reduce((sum, count) => sum + count, 0);
}

// Who takes a choice that needs someone (M36): the first in the crew's
// order of the job, with the trait, among the ids in `among` (a trip's
// squad) or the whole crew; null for a choice that needs no one, or when
// no one fits.
export function takerOf(campaign, choice, among = null) {
  const { job, trait } = choice.needs ?? {};
  if (!job && !trait) return null;
  const going = among && new Set(among);
  return campaign.crew.find((member) => (!going || going.has(member.id)) && (!job || member.job === job) && (!trait || member.traits.includes(trait))) ?? null;
}

// Why a choice can't be made now, or null if it can. A berth is one the
// ship has room for and nobody sleeps in (companions.js freeBerths). One
// that needs someone (M36) needs them aboard, or in the squad (among).
export function choiceProblem(campaign, choice, rules, { among = null } = {}) {
  const needs = choice.needs ?? {};
  if (needs.credits && campaign.credits < needs.credits) return `Needs ${needs.credits} credits.`;
  if (needs.supplies && campaign.supplies < needs.supplies) return `Needs ${needs.supplies} supplies.`;
  if (needs.parts && partsOnHand(campaign) < needs.parts) return needs.parts === 1 ? 'Needs a part on hand.' : `Needs ${needs.parts} parts on hand.`;
  if (needs.berth && freeBerths(campaign, rules) < needs.berth) return 'Needs a free berth.';
  if ((needs.job || needs.trait) && !takerOf(campaign, choice, among)) return `Needs ${whoNeeded(needs, rules)}${among ? ' in the squad' : ' aboard'}.`;
  return null;
}

// Who a choice needs, in words: "an Engineer", "someone with the Patient
// trait", "a Medic with the Careful trait".
export function whoNeeded(needs, rules) {
  const job = needs.job && (rules.jobs.get(needs.job)?.name ?? needs.job);
  const trait = needs.trait && (rules.traits.get(needs.trait)?.name ?? needs.trait);
  const withTrait = trait ? ` with the ${trait} trait` : '';
  return job ? `${/^[AEIOU]/i.test(job) ? 'an' : 'a'} ${job}${withTrait}` : `someone${withTrait}`;
}

// The campaign with event `id` counted as met (M36).
export function metEvent(campaign, id) {
  const met = campaign.eventsMet ?? [];
  return met.includes(id) ? campaign : { ...campaign, eventsMet: [...met, id].slice(-MAX_MET) };
}

// The outcome a roll from 0 to 99 falls in: its index in outcomes.
export function outcomeFor(outcomes, roll) {
  let left = roll;
  for (let i = 0; i < outcomes.length - 1; i++) {
    if (left < outcomes[i].chance) return i;
    left -= outcomes[i].chance;
  }
  return outcomes.length - 1;
}

// Makes choice `id` at the event open at the ship's node: rolls its
// outcome, if it has more than one, and has its effects, then what it does
// to the quests (M33b). Returns { ok: true, campaign, result } or { ok:
// false, error }. result is what the run keeps (travel.js): { node, event,
// choice, outcome, roll, changes }, taker (the crew member who took a
// choice that needs someone, M36), and quest (questShape.js isQuestNote)
// when a quest moved. A trap (ambush, M36) opens its approach at the node,
// its ship's seed the campaign's next roll.
export function chooseEvent(campaign, rules, id) {
  const open = openEvent(campaign, rules);
  if (!open) return { ok: false, error: 'There is nothing to decide here.' };
  const choice = open.event.choices.find((entry) => entry.id === id);
  if (!choice) return { ok: false, error: 'There is no such choice.' };
  const why = choiceProblem(campaign, choice, rules);
  if (why) return { ok: false, error: why };
  let rng = campaign.rng;
  let roll = null;
  if (choice.outcomes.length > 1) {
    const rolled = int(rng, 0, 99);
    roll = rolled.value;
    rng = rolled.state;
  }
  const outcome = roll === null ? 0 : outcomeFor(choice.outcomes, roll);
  const { effects } = choice.outcomes[outcome];
  const taker = takerOf(campaign, choice);
  const done = applyEffects({ ...campaign, rng }, rules, effects, { taker: taker?.id ?? null });
  const { run } = campaign;
  const quested = atEvent(done.campaign, rules, run.sector.nodes[run.at], open.event.id, choice.id);
  const result = { node: run.at, event: open.event.id, choice: choice.id, outcome, roll, changes: done.changes, ...(taker ? { taker: taker.id } : {}), ...(quested.note ? { quest: quested.note } : {}) };
  const settled = metEvent({ ...quested.campaign, flags: tally(quested.campaign.flags, { events: 1 }), run: { ...run, done: [...run.done, run.at], result } }, open.event.id);
  if (!effects.ambush) return { ok: true, result, campaign: settled };
  const seed = int(settled.rng, 0, MAX_SEED);
  const trap = { event: open.event.id, choice: choice.id, outcome };
  return { ok: true, result, campaign: openAmbush({ ...settled, rng: seed.state }, rules, effects.ambush, seed.value, trap) };
}

// An outcome's effects on the campaign: { campaign, changes }. changes say
// what they came to: { credits, supplies, heat, materials } as added,
// wounds [{ id, hp }] as lost, parts [type] as gained, sold [{ part,
// credits }], standing as moved (standing.js moveStanding's changes), and
// joined, the companion who signed on, if one did (M33c). From M36, only
// where the effect is there: wrecked [{ uid, type, wreck }] (those that
// stay wrecked), rigged [uid] (got going again: encounter.js juryRig),
// repaired [{ uid, type }], and ambush (the effect's, as written).
// among: the ids a wound can fall on (a trip's squad), or null for the
// whole crew. taker: who took the choice (takerOf), or null: a wound on one
// falls on them while they have more than 1.
export function applyEffects(campaign, rules, effects, { among = null, taker = null } = {}) {
  let next = { ...campaign };
  const changes = { credits: 0, supplies: 0, heat: 0, materials: 0, wounds: [], parts: [], sold: [], standing: [] };
  // What the holds take: in act 3, the colony's stores (colony.js).
  const room = () => (next.colony ? storesOf(next, rules).total : supplyCapacity(next.ship, rules, next.crew));
  if (effects.credits) {
    const credits = Math.max(0, next.credits + effects.credits);
    changes.credits += credits - next.credits;
    next.credits = credits;
  }
  if (effects.supplies) {
    // On the run the holds' room is what it was; at the colony a find never
    // costs food the stores were already over by.
    const cap = next.colony ? Math.max(room(), next.supplies) : room();
    const supplies = Math.max(0, Math.min(cap, next.supplies + effects.supplies));
    changes.supplies = supplies - next.supplies;
    next.supplies = supplies;
  }
  if (effects.materials && next.colony) {
    const had = next.colony.materials;
    const materials = Math.max(0, Math.min(Math.max(room(), had), had + effects.materials));
    changes.materials = materials - had;
    next.colony = { ...next.colony, materials };
  }
  if (effects.heat) {
    const heat = withHeat(next.heat, effects.heat);
    changes.heat = heat - next.heat;
    next.heat = heat;
  }
  if (effects.wound) {
    const { hp, all } = effects.wound;
    const going = among && new Set(among);
    const able = next.crew.filter((member) => member.hp > 1 && (!going || going.has(member.id)));
    const took = able.find((member) => member.id === taker);
    let hurt = all ? able : took ? [took] : [];
    if (!all && !took && able.length) {
      const picked = int(next.rng, 0, able.length - 1);
      next.rng = picked.state;
      hurt = [able[picked.value]];
    }
    const ids = new Set(hurt.map((member) => member.id));
    next.crew = next.crew.map((member) => {
      if (!ids.has(member.id)) return member;
      const after = Math.max(1, member.hp - hp);
      changes.wounds.push({ id: member.id, hp: member.hp - after });
      return { ...member, hp: after };
    });
  }
  const gain = (type) => {
    next.parts = { ...next.parts, [type]: (next.parts[type] ?? 0) + 1 };
    changes.parts.push(type);
  };
  if (effects.part) gain(effects.part);
  if (effects.drop) {
    const picked = pickWeighted(next.rng, rules.eventDrops[effects.drop]);
    next.rng = picked.state;
    gain(picked.value);
  }
  for (let n = 0; n < (effects.sell ?? 0); n++) {
    const dearest = Object.keys(next.parts)
      .filter((type) => next.parts[type] > 0)
      .sort((a, b) => (sellPriceOf(b, rules) ?? 0) - (sellPriceOf(a, rules) ?? 0) || a.localeCompare(b))[0];
    if (!dearest) break;
    const credits = sellPriceOf(dearest, rules) ?? 0;
    const left = next.parts[dearest] - 1;
    const { [dearest]: _, ...rest } = next.parts;
    next.parts = left > 0 ? { ...rest, [dearest]: left } : rest;
    next.credits += credits;
    changes.credits += credits;
    changes.sold.push({ part: dearest, credits });
  }
  if (effects.standing) {
    const moved = moveStanding(next, rules, effects.standing);
    next = moved.campaign;
    changes.standing = moved.changes;
  }
  if (effects.joins) {
    const signed = joinCompanion(next, rules, effects.joins);
    next = signed.campaign;
    if (signed.joined) changes.joined = effects.joins;
  }
  if (effects.wreck) {
    const wrecked = wreckParts(next, rules, effects.wreck);
    next = wrecked.campaign;
    changes.wrecked = wrecked.wrecked;
    changes.rigged = wrecked.rigged;
  }
  if (effects.repair) {
    const fixed = wrecksToRepair(next, rules)
      .sort((a, b) => b.price - a.price || a.uid - b.uid)
      .slice(0, effects.repair);
    const wrecks = { ...next.wrecks };
    for (const wreck of fixed) delete wrecks[wreck.uid];
    next.wrecks = wrecks;
    changes.repaired = fixed.map(({ uid, type }) => ({ uid, type }));
  }
  if (effects.ambush) changes.ambush = effects.ambush;
  return { campaign: next, changes };
}

// `count` of the ship's working parts a volley could hit, wrecked one at a
// time by a roll, each with a wreck by a roll, as a volley wrecks them;
// then the crew gets one reactor and one engine going. Returns { campaign,
// wrecked [{ uid, type, wreck }] (those that stay wrecked), rigged [uid] }.
function wreckParts(campaign, rules, count) {
  let { rng } = campaign;
  const wrecks = { ...wrecksOn(campaign.ship, campaign.wrecks) };
  const fresh = [];
  for (let n = 0; n < count; n++) {
    const working = campaign.ship.modules.filter((module) => !(module.uid in wrecks) && rules.modules.has(module.type) && WRECKABLE.some((tag) => hasTag(rules.modules.get(module.type), tag)));
    if (!working.length) break;
    const at = int(rng, 0, working.length - 1);
    const kind = int(at.state, 0, WRECKS.length - 1);
    rng = kind.state;
    const module = working[at.value];
    wrecks[module.uid] = WRECKS[kind.value];
    fresh.push(module);
  }
  const kept = juryRig(campaign.ship, wrecks, rules);
  const wrecked = fresh.filter((module) => module.uid in kept.wrecked).map((module) => ({ uid: module.uid, type: module.type, wreck: kept.wrecked[module.uid] }));
  return { campaign: { ...campaign, rng, wrecks: kept.wrecked }, wrecked, rigged: kept.patched };
}
