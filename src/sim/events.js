// What happens at a sector's nodes (ROADMAP §4.7): events, from
// data/events.json. A node of a kind that holds events (a derelict, a
// distress call, a trader, a hazard) is given one as its sector is rolled
// (gen/sector.js). It opens when the ship gets there and holds every jump
// until a choice is made (travel.js openEvent). From M28 the colony's
// places within reach hold events of their own kinds too (expeditions.js),
// which only the squad there can be hurt by.
//
// A choice can need credits, supplies or parts on hand. Its outcomes each
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
// The run keeps the nodes whose events are settled and the last one
// settled, until the next jump (travel.js). The flags count the events
// settled. Pure: every roll is the campaign's.
import { int } from '../core/rng.js';
import { storesOf } from './colony.js';
import { pickWeighted } from './drops.js';
import { sellPriceOf } from './economy.js';
import { withHeat } from './heat.js';
import { tally } from './flags.js';
import { moveStanding } from './standing.js';
import { openEvent, supplyCapacity } from './travel.js';

export const EFFECTS = ['credits', 'supplies', 'heat', 'materials', 'wound', 'part', 'drop', 'sell', 'standing'];
export const NEEDS = ['credits', 'supplies', 'parts'];

// The parts on hand, counted.
export function partsOnHand(campaign) {
  return Object.values(campaign.parts).reduce((sum, count) => sum + count, 0);
}

// Why a choice can't be made now, or null if it can.
export function choiceProblem(campaign, choice) {
  const needs = choice.needs ?? {};
  if (needs.credits && campaign.credits < needs.credits) return `Needs ${needs.credits} credits.`;
  if (needs.supplies && campaign.supplies < needs.supplies) return `Needs ${needs.supplies} supplies.`;
  if (needs.parts && partsOnHand(campaign) < needs.parts) return needs.parts === 1 ? 'Needs a part on hand.' : `Needs ${needs.parts} parts on hand.`;
  return null;
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
// outcome, if it has more than one, and has its effects. Returns { ok:
// true, campaign, result } or { ok: false, error }. result is what the run
// keeps (travel.js): { node, event, choice, outcome, roll, changes }.
export function chooseEvent(campaign, rules, id) {
  const open = openEvent(campaign, rules);
  if (!open) return { ok: false, error: 'There is nothing to decide here.' };
  const choice = open.event.choices.find((entry) => entry.id === id);
  if (!choice) return { ok: false, error: 'There is no such choice.' };
  const why = choiceProblem(campaign, choice);
  if (why) return { ok: false, error: why };
  let rng = campaign.rng;
  let roll = null;
  if (choice.outcomes.length > 1) {
    const rolled = int(rng, 0, 99);
    roll = rolled.value;
    rng = rolled.state;
  }
  const outcome = roll === null ? 0 : outcomeFor(choice.outcomes, roll);
  const done = applyEffects({ ...campaign, rng }, rules, choice.outcomes[outcome].effects);
  const { run } = campaign;
  const result = { node: run.at, event: open.event.id, choice: choice.id, outcome, roll, changes: done.changes };
  return {
    ok: true,
    result,
    campaign: { ...done.campaign, flags: tally(done.campaign.flags, { events: 1 }), run: { ...run, done: [...run.done, run.at], result } },
  };
}

// An outcome's effects on the campaign: { campaign, changes }. changes say
// what they came to: { credits, supplies, heat, materials } as added,
// wounds [{ id, hp }] as lost, parts [type] as gained, sold [{ part,
// credits }], standing as moved (standing.js moveStanding's changes).
// among: the ids a wound can fall on (a trip's squad), or null for the
// whole crew.
export function applyEffects(campaign, rules, effects, { among = null } = {}) {
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
    let hurt = all ? able : [];
    if (!all && able.length) {
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
  return { campaign: next, changes };
}
