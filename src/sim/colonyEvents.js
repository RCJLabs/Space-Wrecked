// The colony's events (M61): a day at the colony, the ship landed and no
// trip out, may bring one, of the kind 'colony' in data/events.json, at
// balance.colonyEventChance in 100, drawn fresh-first as every kind is
// (eventPool.js), a background's own only on its campaign. A companion's
// loyalty quest whose open step is a colony event (quests.js) brings its
// own instead, the next day, ahead of any rolled. The next day waits until
// it is decided (days.js dayPlan).
//
// colony.event: { id, quest } (quest null for one rolled), or null.
// colony.eventResult: what came of the last one decided, { event, choice,
// outcome, roll, changes, taker?, quest? (the step's note) }, until the
// next day passes, or null.
//
// Its choices need and do what the colony can (COLONY_NEEDS,
// COLONY_EFFECTS): food (the run's supplies, kept to the stores),
// materials, a wound to someone at home, parts and weapons on hand. Pure.
import { int } from '../core/rng.js';
import { atColony } from './acts.js';
import { eventsOf, freshest } from './eventPool.js';
import { applyEffects, choiceProblem, metEvent, outcomeFor, takerOf } from './events.js';
import { openSteps, stepDone, withQuestPlaces } from './quests.js';
import { tally } from './flags.js';

export const COLONY_EFFECTS = ['supplies', 'materials', 'wound', 'part', 'drop', 'arms'];
export const COLONY_NEEDS = ['supplies', 'parts', 'job', 'trait'];

// The event open at the colony the ship is landed at: { event (its
// definition), quest (the quest it is a step of, or null) }, or null.
export function colonyEventHere(campaign, rules) {
  const open = campaign.colony?.event;
  if (!open || !atColony(campaign, rules)) return null;
  const event = rules.events.get(open.id);
  return event ? { event, quest: open.quest ?? null } : null;
}

// The day's event, once a day has passed with the ship at home: the first
// open companion's colony step's event, else, at the day's chance, one of
// the kind's, by a roll of the campaign's. The campaign as it is when one
// is open already, or the ship is away.
export function dayEvent(campaign, rules) {
  const { colony } = campaign;
  if (!colony || colony.event || colony.trip || colony.voyage) return campaign;
  const step = openSteps(campaign, rules, 3).find(({ step: s }) => s.event && rules.events.has(s.event));
  if (step) return { ...campaign, colony: { ...colony, event: { id: step.step.event, quest: step.quest.id } } };
  const chance = rules.balance.colonyEventChance ?? 0;
  if (chance <= 0) return campaign;
  const ids = freshest(eventsOf(rules, 'colony', campaign.background), campaign.eventsMet ?? []);
  if (!ids.length) return campaign;
  const rolled = int(campaign.rng, 0, 99);
  if (rolled.value >= chance) return { ...campaign, rng: rolled.state };
  const picked = int(rolled.state, 0, ids.length - 1);
  return { ...campaign, rng: picked.state, colony: { ...colony, event: { id: ids[picked.value], quest: null } } };
}

// Makes choice id at the colony's open event: rolls its outcome if it has
// more than one (0 to 99, as on the run) and has its effects, a wound only
// on those at home. At a companion's step, any choice does the step
// (quests.js stepDone), and the place after it joins a list already
// rolled. Returns { ok: true, campaign, result, note (the
// quest's, or null) } or { ok: false, error }.
export function chooseAtColony(campaign, rules, id) {
  const here = colonyEventHere(campaign, rules);
  if (!here) return { ok: false, error: 'There is nothing to decide here.' };
  const choice = here.event.choices.find((entry) => entry.id === id);
  if (!choice) return { ok: false, error: 'There is no such choice.' };
  const among = campaign.crew.map((member) => member.id);
  const why = choiceProblem(campaign, choice, rules, { among });
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
  const taker = takerOf(campaign, choice, among);
  const done = applyEffects({ ...campaign, rng }, rules, effects, { among, taker: taker?.id ?? null });
  const result = { event: here.event.id, choice: choice.id, outcome, roll, changes: done.changes, ...(taker ? { taker: taker.id } : {}) };
  const met = metEvent(done.campaign, here.event.id);
  // Its materials counted both ways, as the stores' other comings and goings are.
  const flags = tally(met.flags, { colonyEvents: 1, eventMaterialsGot: done.changes.materials, eventMaterialsLost: -done.changes.materials });
  let next = { ...met, flags };
  let note = null;
  if (here.quest) {
    ({ campaign: next, note } = stepDone(next, rules, here.quest));
    // The place after the beat goes on a list already rolled.
    if (next.colony.places.length) next = withQuestPlaces(next, rules);
  }
  const kept = note ? { ...result, quest: note } : result;
  next = { ...next, colony: { ...next.colony, event: null, eventResult: kept } };
  return { ok: true, campaign: next, result: kept, note };
}
