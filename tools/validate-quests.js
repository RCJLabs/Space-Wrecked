// The quests (data/quests.json, M33b, src/sim/quests.js), for
// validate-data.js: each quest's id, name and words; whose it is, a
// background's thread (starting with its campaign, one a background) or a
// side's chain (starting at a choice of an event on the run); its steps in
// the order of their acts, each done in its act: act 1 a job (a contract of
// the quest's own, in its background's district), the run an event of the
// quest's own (of a node kind that holds events) with the choices that do
// the step and any that end the quest, and the colony a place (a kind of
// place, a name, the days away, her ship and the party holding her, what a
// win strips and brings); and the pay-off once the last step is done: heat,
// the pursuer's side's standing raised to a level, and whether the pursuer
// eases off. Every job and event marked for a quest is a step of it, so
// none sits in a board's rotation or a sector's pool unasked. From M33c a
// quest can be a companion's loyalty quest (data/companions.json,
// validate-companions.js): it starts as they sign on, its steps are at the
// colony, and its pay-off is words alone, as their loyalty is the rest.
import { LEVELS } from '../src/sim/standing.js';
import { MAX_AWAY } from '../src/sim/tripShape.js';
import { MAX_PLACE_NAME } from '../src/sim/runShape.js';
import { isIntIn, isListIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['text', 'quests'];
const QUEST_KEYS = ['id', 'name', 'blurb', 'background', 'side', 'companion', 'start', 'steps', 'payoff'];
const START_KEYS = ['event', 'choice'];
const STEP_KEYS = {
  1: ['act', 'job', 'next', 'said', 'effects'],
  2: ['act', 'event', 'done', 'cold', 'next'],
  3: ['act', 'place', 'event', 'next'],
};
const PLACE_KEYS = ['kind', 'name', 'days', 'ship', 'party', 'salvage', 'materials', 'text'];
const PAYOFF_KEYS = ['heat', 'standing', 'eased', 'said'];
// What a job's step adds when it is done: credits, heat and standing.
const STEP_EFFECTS = ['credits', 'heat', 'standing'];
const MAX_STEPS = 6;
const MAX_NAME = 32;
const MAX_TEXT = 200;
const MAX_NEXT = 120;
const MAX_AMOUNT = 999;
const MAX_STANDING = 10;
const MAX_SALVAGE = 4;
const MAX_MATERIALS = 99;
const MAX_HEAT = 100;

// data: the content files; ids: { sides (the sides' ids), presets (ship
// presets by id), encounters (encounter id -> enemy list) }.
export function checkQuests(data, { sides, presets, encounters }, fail) {
  const where = 'quests.json';
  const file = data.quests;
  if (!isObject(file)) {
    fail(where, 'must be { text, quests }');
    return;
  }
  knownKeys(file, FILE_KEYS, where, fail);
  if (!isText(file.text) || file.text.length > MAX_TEXT) fail(where, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
  const quests = listOf(file, 'quests', where, fail);
  uniqueIds(quests, where, fail);

  const backgrounds = new Map((data.backgrounds?.backgrounds ?? []).map((b) => [b?.id, b]));
  const districts = new Map((data.districts?.districts ?? []).map((d) => [d?.id, d]));
  const jobs = new Map((data.contracts?.jobs ?? []).map((job) => [job?.id, job]));
  const events = new Map((data.events?.events ?? []).map((event) => [event?.id, event]));
  const holding = new Set((data.sectors?.nodes ?? []).filter((kind) => kind?.events === true).map((kind) => kind.id));
  const placeKinds = new Set((data.expeditions?.kinds ?? []).map((kind) => kind?.id));
  const companions = new Map((data.companions?.companions ?? []).map((companion) => [companion?.id, companion]));
  // The jobs and events each quest's steps name, to check against what the
  // content marks for a quest.
  const named = { jobs: new Map(), events: new Map() };
  const threads = new Set();

  quests.forEach((quest, i) => {
    const at = `${where} quest ${quest.id ?? `#${i}`}`;
    knownKeys(quest, QUEST_KEYS, at, fail);
    if (!isText(quest.name) || quest.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!isText(quest.blurb) || quest.blurb.length > MAX_TEXT) fail(at, `blurb must be a non-empty string of up to ${MAX_TEXT} letters`);
    // Whose: a background's, a side's or a companion's, one of the three.
    const thread = quest.background !== undefined;
    const loyalty = quest.companion !== undefined;
    if ([thread, quest.side !== undefined, loyalty].filter(Boolean).length !== 1) {
      fail(at, "is a background's thread (background), a side's chain (side) or a companion's loyalty quest (companion), one of the three");
    }
    const background = thread ? backgrounds.get(quest.background) : null;
    if (thread) {
      if (!background) fail(at, `background: unknown background "${quest.background}"`);
      else if (threads.has(quest.background)) fail(at, `${quest.background} has a thread already: one a background`);
      threads.add(quest.background);
      if (quest.start !== undefined) fail(at, 'a thread starts with its campaign: no start');
    } else if (loyalty) {
      const companion = companions.get(quest.companion);
      if (!companion) fail(at, `companion: unknown companion "${quest.companion}" (companions.json)`);
      else if (companion.loyalty !== quest.id) fail(at, `${quest.companion}'s loyalty quest is "${companion.loyalty}", not this one`);
      if (quest.start !== undefined) fail(at, 'a loyalty quest starts as its companion signs on: no start');
    } else if (quest.side !== undefined) {
      if (!sides.has(quest.side)) fail(at, `side: unknown side "${quest.side}" (factions.json)`);
      if (!isObject(quest.start)) fail(at, "a side's chain needs its start: { event, choice }");
      else {
        knownKeys(quest.start, START_KEYS, `${at} start`, fail);
        const event = events.get(quest.start.event);
        if (!event) fail(`${at} start`, `unknown event "${quest.start.event}"`);
        else if (event.quest !== undefined) fail(`${at} start`, "can't start at a quest's own event");
        else if (!holding.has(event.kind)) fail(`${at} start`, `"${event.id}" isn't an event on the run`);
        else if (!(event.choices ?? []).some((choice) => choice?.id === quest.start.choice)) fail(`${at} start`, `"${event.id}" has no choice "${quest.start.choice}"`);
      }
    }
    // The steps, in the order of their acts.
    if (!isListIn(quest.steps, 1, MAX_STEPS)) {
      fail(at, `steps must be a list of 1 to ${MAX_STEPS}`);
      return;
    }
    // A loyalty quest's steps are at the colony, where the companion is
    // loyal by the end.
    let last = thread ? 1 : loyalty ? 3 : 2;
    quest.steps.forEach((step, s) => {
      const here = `${at} step ${s + 1}`;
      if (!isObject(step)) {
        fail(here, 'must be an object');
        return;
      }
      if (!isIntIn(step.act, 1, 3)) {
        fail(here, 'act must be 1, 2 or 3');
        return;
      }
      if (step.act < last) fail(here, thread ? 'steps go in the order of their acts' : loyalty ? "a loyalty quest's steps are at the colony" : "a side's chain starts on the run: its steps are on the run or at the colony, in that order");
      last = Math.max(last, step.act);
      knownKeys(step, STEP_KEYS[step.act], here, fail);
      if (!isText(step.next) || step.next.length > MAX_NEXT) fail(here, `next must be a non-empty string of up to ${MAX_NEXT} letters`);
      if (step.act === 1) checkJobStep(step, here, { quest, background, districts, jobs, sides }, fail);
      if (step.act === 2) checkEventStep(step, here, { quest, events, holding }, fail);
      // At the colony, a place held, or (M61) a colony event: the next day's
      // there, any choice doing the step.
      if (step.act === 3 && step.event !== undefined) checkColonyStep(step, here, { quest, events }, fail);
      else if (step.act === 3) checkPlaceStep(step.place, `${here} place`, { placeKinds, presets, encounters }, fail);
      if (step.act === 3 && typeof step.event === 'string') named.events.set(step.event, quest.id);
      if (step.act === 1 && typeof step.job === 'string') named.jobs.set(step.job, quest.id);
      if (step.act === 2 && typeof step.event === 'string') named.events.set(step.event, quest.id);
    });
    if (quest.payoff !== undefined) checkPayoff(quest.payoff, `${at} payoff`, thread, fail);
    if (loyalty && quest.payoff !== undefined && Object.keys(quest.payoff).some((key) => key !== 'said')) fail(`${at} payoff`, "a loyalty quest's pay-off is the companion's loyalty, and its words: said alone");
  });

  // Everything marked for a quest is one of its steps.
  for (const [kind, list] of [['job', jobs], ['event', events]]) {
    for (const item of list.values()) {
      if (item?.quest === undefined) continue;
      const by = named[`${kind}s`].get(item.id);
      if (by !== item.quest) fail(`${kind === 'job' ? 'contracts' : 'events'}.json ${kind} ${item.id}`, `quest "${item.quest}" must be a quest one of whose steps names it`);
    }
  }
}

// Act 1: a job of the quest's own, in the background's district, and what
// doing it adds besides the job's pay.
function checkJobStep(step, at, { quest, background, districts, jobs, sides }, fail) {
  const job = jobs.get(step.job);
  if (!job) fail(at, `job: unknown job "${step.job}" (contracts.json)`);
  else {
    if (job.quest !== quest.id) fail(at, `job "${job.id}" must be marked quest: "${quest.id}"`);
    if (job.once !== undefined || job.drops !== undefined) fail(at, `job "${job.id}" is a quest's: no once and no drops`);
    const home = districts.get(background?.district);
    const sites = new Set((home?.sites ?? []).map((site) => site?.id));
    if (home && Array.isArray(job.sites) && !job.sites.every((id) => sites.has(id))) fail(at, `job "${job.id}" must be in ${home.id}, its background's district`);
  }
  if (!isText(step.said) || step.said.length > MAX_TEXT) fail(at, `said must be a non-empty string of up to ${MAX_TEXT} letters`);
  if (step.effects !== undefined) {
    if (!isObject(step.effects)) fail(at, 'effects must be an object');
    else {
      knownKeys(step.effects, STEP_EFFECTS, `${at} effects`, fail);
      for (const key of ['credits', 'heat']) {
        if (step.effects[key] !== undefined && (!isIntIn(step.effects[key], -MAX_AMOUNT, MAX_AMOUNT) || step.effects[key] === 0)) fail(`${at} effects`, `${key} must be a whole number other than 0`);
      }
      if (step.effects.credits < 0) fail(`${at} effects`, "credits can only be given: a job's step never takes what the crew may not have");
      if (step.effects.standing !== undefined) {
        if (!isObject(step.effects.standing)) fail(`${at} effects`, 'standing must be an object of sides');
        else {
          for (const [side, by] of Object.entries(step.effects.standing)) {
            if (!sides.has(side)) fail(`${at} effects standing`, `unknown side "${side}"`);
            if (!isIntIn(by, -MAX_STANDING, MAX_STANDING) || by === 0) fail(`${at} effects standing`, `${side} must be a whole number other than 0`);
          }
        }
      }
    }
  }
}

// The colony (M61): an event of the quest's own, of the colony's kind; any
// choice does the step, and it has no place.
function checkColonyStep(step, at, { quest, events }, fail) {
  if (step.place !== undefined) fail(at, 'a colony step is a place or an event, not both');
  const event = events.get(step.event);
  if (!event) {
    fail(at, `event: unknown event "${step.event}" (events.json)`);
    return;
  }
  if (event.quest !== quest.id) fail(at, `event "${event.id}" must be marked quest: "${quest.id}"`);
  if (event.kind !== 'colony') fail(at, `event "${event.id}" must be of kind colony`);
}

// The run: an event of the quest's own, of a kind the sectors' nodes hold,
// whose done choices do the step and cold ones end the quest; another
// choice leaves it for the next sector.
function checkEventStep(step, at, { quest, events, holding }, fail) {
  const event = events.get(step.event);
  if (!event) {
    fail(at, `event: unknown event "${step.event}" (events.json)`);
    return;
  }
  if (event.quest !== quest.id) fail(at, `event "${event.id}" must be marked quest: "${quest.id}"`);
  if (!holding.has(event.kind)) fail(at, `event "${event.id}" must be of a node kind that holds events (${[...holding].join(', ')})`);
  const choices = new Set((event.choices ?? []).map((choice) => choice?.id));
  const done = Array.isArray(step.done) ? step.done : [];
  const cold = step.cold === undefined ? [] : Array.isArray(step.cold) ? step.cold : null;
  if (!isListIn(step.done, 1, choices.size)) fail(at, 'done must list the choices that do the step, at least one');
  if (cold === null) fail(at, 'cold must list the choices that end the quest');
  for (const id of [...done, ...(cold ?? [])]) if (!choices.has(id)) fail(at, `"${event.id}" has no choice "${id}"`);
  if ((cold ?? []).some((id) => done.includes(id))) fail(at, 'a choice is done or cold, not both');
  const leave = (event.choices ?? []).filter((choice) => !done.includes(choice?.id) && !(cold ?? []).includes(choice?.id));
  if (!leave.some((choice) => choice?.needs === undefined)) fail(at, `"${event.id}" needs a choice that leaves it for the next sector and needs nothing`);
}

// The colony: a place of the quest's own, her ship held by a party.
function checkPlaceStep(place, at, { placeKinds, presets, encounters }, fail) {
  if (!isObject(place)) {
    fail(at, `must be { ${PLACE_KEYS.join(', ')} }`);
    return;
  }
  knownKeys(place, PLACE_KEYS, at, fail);
  if (!placeKinds.has(place.kind)) fail(at, `kind must be a kind of place (expeditions.json): ${[...placeKinds].join(', ')}`);
  if (!isText(place.name) || place.name.length > MAX_PLACE_NAME) fail(at, `name must be a non-empty string of up to ${MAX_PLACE_NAME} letters`);
  if (!isIntIn(place.days, 1, MAX_AWAY)) fail(at, `days must be a whole number from 1 to ${MAX_AWAY}`);
  if (!presets.has(place.ship)) fail(at, `ship: unknown ship preset "${place.ship}"`);
  if (!encounters.has(place.party)) fail(at, `party: unknown encounter "${place.party}"`);
  if (!isIntIn(place.salvage, 0, MAX_SALVAGE)) fail(at, `salvage must be a whole number from 0 to ${MAX_SALVAGE}`);
  if (!isRange(place.materials, 0, MAX_MATERIALS)) fail(at, `materials must be [least, most], from 0 to ${MAX_MATERIALS}`);
  if (!isText(place.text) || place.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
}

// What the last step done brings: heat, the pursuer's side raised to a
// level, the pursuer easing off (a thread's alone), and the words for it.
function checkPayoff(payoff, at, thread, fail) {
  if (!isObject(payoff)) {
    fail(at, 'must be an object');
    return;
  }
  knownKeys(payoff, PAYOFF_KEYS, at, fail);
  if (payoff.heat !== undefined && (!isIntIn(payoff.heat, -MAX_HEAT, MAX_HEAT) || payoff.heat === 0)) fail(at, `heat must be a whole number other than 0, from ${-MAX_HEAT} to ${MAX_HEAT}`);
  if (payoff.standing !== undefined && !LEVELS.slice(1).includes(payoff.standing)) fail(at, `standing must be a level to raise the pursuer's side to: ${LEVELS.slice(1).join(', ')}`);
  if (payoff.eased !== undefined && typeof payoff.eased !== 'boolean') fail(at, 'eased must be true or false');
  if (!thread && (payoff.standing !== undefined || payoff.eased)) fail(at, "standing and eased are the pursuer's: a thread's pay-off alone");
  if (!isText(payoff.said) || payoff.said.length > MAX_TEXT) fail(at, `said must be a non-empty string of up to ${MAX_TEXT} letters`);
}
