// Quests (M33b, ROADMAP §7): work that runs past one job, from
// data/quests.json. A background's thread starts with its campaign
// (questShape.js startingQuests); a side's chain starts at a choice of an
// event on the run (the Fleet's, lending its tender a hand); from M33c a
// companion's loyalty quest starts as they sign on (companions.js), and
// done, they are loyal. Each step is done in its own act:
//   act 1, a job: a contract of the quest's own, offered at the hangar
//     above the board's three while the step is open (questJobs). Its
//     client, site, pay and fight's seed are rolled from the campaign's seed,
//     the quest and the jobs done and lost so far, so the offer holds until
//     a job is done or lost, and no roll of the campaign's moves;
//   the run, an event: the quest's own, put on a node of each sector the
//     ship enters while the step is open (placeQuests), on the charts and
//     named for it. A done choice does the step, a cold one ends the quest,
//     and any other leaves it for the next sector (atEvent);
//   the colony, a place: the quest's own, within reach beside the others
//     until the step is done (questPlaces), her ship held by a party: a
//     fight aboard her, as at a derelict the scavengers hold (heldBy).
// A step not done in its act ends its quest (goCold): act 1's at the launch,
// the run's as the ship leaves the last sector. A step done has its effects
// (a job's step: heat, credits, standing); the last done, the quest is done
// and its pay-off is had (stepDone): heat, the pursuer's side's standing
// raised to a level, and for a thread the pursuer easing off: its raids
// find the colony at easedOdds percent of the odds (raids.js, eased).
//
// campaign.quests: { [id]: { step, state } }: step the index of the step
// open, or the last one reached once the quest is over; state 'open',
// 'done' or 'cold'. A quest the campaign lacks hasn't started. Pure.
import { int, seedFrom } from '../core/rng.js';
import { atColony, atHangar } from './acts.js';
import { makeLoyal } from './companions.js';
import { PAY_STEP } from './economy.js';
import { withHeat } from './heat.js';
import { floorOf, moveStanding, pursuerSide, standingWith } from './standing.js';
import { MAX_PLACES } from './tripShape.js';

const MAX_SEED = 0xffffffff;
// The kinds of node a quest's event never goes on, besides the way in, the
// jump point and a hostile ship's.
const KEEP = ['station', 'nebula', 'shipyard'];

// The quest by id, or null.
export function questOf(rules, id) {
  return rules.quests?.get(id) ?? null;
}

// The step open in quest id: { quest, step, index }, or null when it isn't
// open (not started, done or gone cold) or the content has no such step.
export function openStep(campaign, rules, id) {
  const at = campaign.quests?.[id];
  const quest = questOf(rules, id);
  if (!quest || at?.state !== 'open') return null;
  const step = quest.steps[at.step];
  return step ? { quest, step, index: at.step } : null;
}

// Every step open in act `act`, in the quests' order: [{ quest, step,
// index }].
export function openSteps(campaign, rules, act) {
  return [...(rules.quests?.keys() ?? [])].map((id) => openStep(campaign, rules, id)).filter((open) => open?.step.act === act);
}

// The campaign's background's thread, or null.
export function threadOf(campaign, rules) {
  return [...(rules.quests?.values() ?? [])].find((quest) => quest.background === campaign.background) ?? null;
}

// True once the background's thread is done and its pay-off eases the
// pursuer off.
export function eased(campaign, rules) {
  const thread = threadOf(campaign, rules);
  return Boolean(thread?.payoff?.eased) && campaign.quests?.[thread.id]?.state === 'done';
}

// The jobs the open act 1 steps offer at the hangar, above the board's:
// [{ contract, client, site, twist: null, seed, credits, part: null,
// quest }], each as a job on the board is (contracts.js).
export function questJobs(campaign, rules) {
  if (!atHangar(campaign, rules)) return [];
  const tries = (campaign.flags?.jobsDone ?? 0) + (campaign.flags?.jobsFailed ?? 0);
  return openSteps(campaign, rules, 1).flatMap(({ quest, step }) => {
    const contract = rules.contracts.jobs.get(step.job);
    if (!contract) return [];
    let rng = seedFrom(`${campaign.seed}:${quest.id}:${tries}`);
    const roll = (min, max) => {
      const r = int(rng, min, max);
      rng = r.state;
      return r.value;
    };
    const client = contract.clients[roll(0, contract.clients.length - 1)];
    const site = contract.sites[roll(0, contract.sites.length - 1)];
    const credits = PAY_STEP * roll(contract.credits[0] / PAY_STEP, contract.credits[1] / PAY_STEP);
    return [{ contract: contract.id, client, site, twist: null, seed: roll(0, MAX_SEED), credits, part: null, quest: quest.id }];
  });
}

// The quest moved on past its open step: the step's effects, then the next
// step open, or past the last the quest done and its pay-off had. Returns
// { campaign, note }: note (questShape.js isQuestNote) says what came of
// it, or is null with no step open.
export function stepDone(campaign, rules, id) {
  const open = openStep(campaign, rules, id);
  if (!open) return { campaign, note: null };
  const { quest, step, index } = open;
  const last = index === quest.steps.length - 1;
  const changes = { credits: 0, heat: 0, standing: [] };
  let next = campaign;
  const apply = (effects = {}) => {
    if (effects.credits) {
      const credits = Math.max(0, next.credits + effects.credits);
      changes.credits += credits - next.credits;
      next = { ...next, credits };
    }
    if (effects.heat) {
      const heat = withHeat(next.heat, effects.heat);
      changes.heat += heat - next.heat;
      next = { ...next, heat };
    }
    if (effects.standing) {
      const moved = moveStanding(next, rules, effects.standing);
      next = moved.campaign;
      changes.standing.push(...moved.changes);
    }
  };
  apply(step.effects);
  // A companion's loyalty quest done, they are loyal (M33c).
  if (last && quest.companion) next = makeLoyal(next, quest.companion);
  if (last && quest.payoff) {
    const { payoff } = quest;
    apply({ heat: payoff.heat });
    // The pursuer's side raised to the pay-off's level, if it is lower.
    const side = payoff.standing && pursuerSide(next, rules);
    const by = side ? floorOf(payoff.standing, rules) - standingWith(next, side) : 0;
    if (by > 0) apply({ standing: { [side]: by } });
  }
  next = { ...next, quests: { ...next.quests, [id]: last ? { step: index, state: 'done' } : { step: index + 1, state: 'open' } } };
  return { campaign: next, note: { quest: id, did: last ? 'finished' : 'done', step: index, changes } };
}

// The quest gone cold where it stands. { campaign, note }.
export function endCold(campaign, id) {
  const at = campaign.quests?.[id];
  if (at?.state !== 'open') return { campaign, note: null };
  return { campaign: { ...campaign, quests: { ...campaign.quests, [id]: { ...at, state: 'cold' } } }, note: { quest: id, did: 'cold', step: at.step, changes: { credits: 0, heat: 0, standing: [] } } };
}

// The quests whose open step is in act `act`, which go cold as it ends
// (Launch's first tap and the last jump point's plan say so): the quests.
export function coldAt(campaign, rules, act) {
  return openSteps(campaign, rules, act).map(({ quest }) => quest);
}

// The campaign with every quest open in act `act` gone cold: { campaign,
// cold (their ids) }.
export function goCold(campaign, rules, act) {
  const cold = coldAt(campaign, rules, act).map((quest) => quest.id);
  let next = campaign;
  for (const id of cold) next = endCold(next, id).campaign;
  return { campaign: next, cold };
}

// The sector with each open run step's event put on one of its nodes: one of
// the event's kind if any, else empty space, else any node that holds
// events; never the way in, the jump point, a station, a nebula, a hostile
// ship's node or another quest's. Each is picked by a roll from the
// campaign's seed, the quest and the sector's place in the run, so no roll
// of the campaign's moves. The node takes the event's kind, the event, the
// quest and the event's title for its name, so the chart can show it from
// afar. The system past the charts gets none.
export function placeQuests(sector, campaign, rules) {
  if (sector.system) return sector;
  let { nodes } = sector;
  for (const { quest, step } of openSteps(campaign, rules, 2)) {
    const event = rules.events.get(step.event);
    if (!event) continue;
    const free = nodes.filter((node) => node.id !== sector.start && node.id !== sector.exit && !KEEP.includes(node.type) && !node.hostile && !node.quest);
    const pool = [free.filter((node) => node.type === event.kind), free.filter((node) => node.type === 'empty'), free.filter((node) => rules.nodeTypes.get(node.type)?.events)].find((list) => list.length);
    if (!pool) continue;
    const at = pool[int(seedFrom(`${campaign.seed}:${quest.id}:${sector.index}`), 0, pool.length - 1).value].id;
    nodes = nodes.map((node) => (node.id === at ? { ...node, type: event.kind, event: event.id, quest: quest.id, name: event.title } : node));
  }
  return nodes === sector.nodes ? sector : { ...sector, nodes };
}

// What a choice made at an event (events.js chooseEvent, the choice's id)
// does to the quests: at a quest's node whose step is open, a done choice
// does the step and a cold one ends the quest; and a side's chain starts at
// its start's choice, if it hasn't started. Returns { campaign, note }, note
// null when nothing moved.
export function atEvent(campaign, rules, node, eventId, choice) {
  const open = node?.quest ? openStep(campaign, rules, node.quest) : null;
  if (open && open.step.act === 2 && open.step.event === eventId) {
    if (open.step.done.includes(choice)) return stepDone(campaign, rules, open.quest.id);
    if ((open.step.cold ?? []).includes(choice)) return endCold(campaign, open.quest.id);
  }
  const starts = [...(rules.quests?.values() ?? [])].find((quest) => quest.start?.event === eventId && quest.start.choice === choice && !campaign.quests?.[quest.id]);
  if (starts) {
    return { campaign: { ...campaign, quests: { ...campaign.quests, [starts.id]: { step: 0, state: 'open' } } }, note: { quest: starts.id, did: 'started', step: 0, changes: { credits: 0, heat: 0, standing: [] } } };
  }
  return { campaign, note: null };
}

// The open colony steps' places within reach: [{ kind, name, days, event:
// null, held: true, seed, quest }], her ship's seed from the campaign's and
// the quest's, the same until the step is done.
export function questPlaces(campaign, rules) {
  return openSteps(campaign, rules, 3).map(({ quest, step }) => {
    const { kind, name, days } = step.place;
    return { kind, name, days, event: null, held: true, seed: int(seedFrom(`${campaign.seed}:${quest.id}:place`), 0, MAX_SEED).value, quest: quest.id };
  });
}

// The colony's list with each open step's place on it, after the others,
// while the list has room: for a list just rolled, and one rolled before
// the step opened (a save from before quests). Else the campaign as it is.
export function withQuestPlaces(campaign, rules) {
  if (!atColony(campaign, rules) || campaign.colony.trip) return campaign;
  const { places } = campaign.colony;
  const missing = questPlaces(campaign, rules).filter((place) => !places.some((listed) => listed.quest === place.quest));
  const room = Math.max(0, MAX_PLACES - places.length);
  return missing.length && room ? { ...campaign, colony: { ...campaign.colony, places: [...places, ...missing.slice(0, room)] } } : campaign;
}

// Who holds a quest's place: { ship, party, salvage, materials }, its
// colony step's; null for any other place.
export function heldBy(place, rules) {
  const step = place?.quest ? questOf(rules, place.quest)?.steps.find((entry) => entry.act === 3) : null;
  if (!step?.place) return null;
  const { ship, party, salvage, materials } = step.place;
  return { ship, party, salvage, materials };
}
