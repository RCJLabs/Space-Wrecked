// What happens at a sector's nodes (ROADMAP §4.7): events, from
// data/events.json. A node of a kind that holds events (a derelict, a
// distress call, a trader, a hazard) is given one as its sector is rolled
// (gen/sector.js). It opens when the ship gets there and holds every jump
// until a choice is made (travel.js openEvent).
//
// A choice can need credits, supplies or parts on hand. Its outcomes each
// have a chance in 100, shown as they are rolled: one roll from 0 to 99
// picks the outcome whose share of the hundred it falls in, in the order
// written. An outcome's effects:
//   credits, supplies, heat   added: supplies up to what the holds take,
//                             heat from 0 to HEAT_MAX
//   wound { hp, all }         hit points off one crew member, picked by a
//                             roll from those with more than 1, or off
//                             everyone (all); never the last one
//   part                      a part of that type, on hand
//   drop                      a part on hand from the drop table named
//                             (data/events.json drops)
//   sell                      that many parts on hand sold, the dearest
//                             first, at what the shop pays (economy.js)
// The run keeps the nodes whose events are settled and the last one
// settled, until the next jump (travel.js). The flags count the events
// settled. Pure: every roll is the campaign's.
import { int } from '../core/rng.js';
import { pickWeighted } from './drops.js';
import { sellPriceOf } from './economy.js';
import { withHeat } from './heat.js';
import { tally } from './flags.js';
import { openEvent, supplyCapacity } from './travel.js';

export const EFFECTS = ['credits', 'supplies', 'heat', 'wound', 'part', 'drop', 'sell'];
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
// what they came to: { credits, supplies, heat } as added, wounds [{ id,
// hp }] as lost, parts [type] as gained, sold [{ part, credits }].
export function applyEffects(campaign, rules, effects) {
  let next = { ...campaign };
  const changes = { credits: 0, supplies: 0, heat: 0, wounds: [], parts: [], sold: [] };
  if (effects.credits) {
    const credits = Math.max(0, next.credits + effects.credits);
    changes.credits += credits - next.credits;
    next.credits = credits;
  }
  if (effects.supplies) {
    const supplies = Math.max(0, Math.min(supplyCapacity(next.ship, rules), next.supplies + effects.supplies));
    changes.supplies = supplies - next.supplies;
    next.supplies = supplies;
  }
  if (effects.heat) {
    const heat = withHeat(next.heat, effects.heat);
    changes.heat = heat - next.heat;
    next.heat = heat;
  }
  if (effects.wound) {
    const { hp, all } = effects.wound;
    const able = next.crew.filter((member) => member.hp > 1);
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
  return { campaign: next, changes };
}
