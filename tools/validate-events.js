// What happens at a sector's nodes (data/events.json), for
// validate-campaign.js: each event's kind and words, its choices and what
// they need, their outcomes, whose chances add up to 100, and the effects
// (src/sim/events.js): only the ones the sim knows, with parts and drop
// tables that exist. An outcome never takes more credits, supplies or
// parts than its choice needs, so a choice that can be made can be paid,
// and every event has a choice that needs nothing, since an open event
// holds every jump. From M28 an event can be of a kind of place within
// reach of the colony (data/expeditions.json): it does and needs only what
// a place can (expeditions.js PLACE_EFFECTS, PLACE_NEEDS), and only such
// an event brings materials. From M33 an event on the run can move the
// crew's standing with the sides (data/factions.json); one at the colony
// can't, as act 3 doesn't move it.
import { EFFECTS, NEEDS } from '../src/sim/events.js';
import { PLACE_EFFECTS, PLACE_NEEDS } from '../src/sim/expeditions.js';
import { isId, isIntIn, isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['drops', 'events'];
const EVENT_KEYS = ['id', 'kind', 'title', 'text', 'choices'];
const CHOICE_KEYS = ['id', 'label', 'needs', 'outcomes'];
const OUTCOME_KEYS = ['chance', 'text', 'effects'];
const MAX_TITLE = 24;
const MAX_LABEL = 24;
const MAX_TEXT = 240;
const MAX_OUTCOME_TEXT = 160;
const MAX_CHOICES = 4;
const MAX_OUTCOMES = 4;
const MAX_AMOUNT = 999;
const MAX_WOUND = 20;
const MAX_SELL = 5;
// What an outcome moves a side's standing by, at most, either way.
const MAX_STANDING = 10;

// kinds: the node kinds that hold events (data/sectors.json, events: true).
// moduleIds: the parts. places: the kinds of place (validate-expeditions.js).
// sides: the sides' ids (validate-factions.js). Returns the kinds the
// events cover, as a Set.
export function checkEvents(file, kinds, moduleIds, fail, places = new Set(), sides = new Set()) {
  const where = 'events.json';
  const covered = new Set();
  if (!isObject(file)) {
    fail(where, 'must be an object');
    return covered;
  }
  knownKeys(file, FILE_KEYS, where, fail);
  const drops = isObject(file.drops) ? file.drops : {};
  if (!isObject(file.drops)) fail(where, 'drops must be an object of drop tables');
  for (const [id, table] of Object.entries(drops)) {
    const at = `${where} drops.${id}`;
    if (!isId(id)) fail(at, 'must be named like an id');
    if (!isObject(table) || !Object.keys(table).length) fail(at, 'must be an object of parts and weights');
    else for (const [part, weight] of Object.entries(table)) {
      if (!moduleIds.has(part)) fail(at, `"${part}" is not a part`);
      if (!isIntIn(weight, 1, 100)) fail(at, `${part}'s weight must be a whole number from 1 to 100`);
    }
  }

  const events = listOf(file, 'events', where, fail);
  uniqueIds(events, where, fail);
  events.forEach((event, i) => {
    const at = `${where} event ${event?.id ?? `#${i}`}`;
    if (!isObject(event)) return;
    knownKeys(event, EVENT_KEYS, at, fail);
    const atPlace = places.has(event.kind);
    if (!kinds.has(event.kind) && !atPlace) fail(at, `kind must be a node kind that holds events or a kind of place (${[...kinds, ...places].join(', ')})`);
    else covered.add(event.kind);
    if (!isText(event.title) || event.title.length > MAX_TITLE) fail(at, `title must be a non-empty string of up to ${MAX_TITLE} letters`);
    if (!isText(event.text) || event.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
    if (!Array.isArray(event.choices) || event.choices.length < 1 || event.choices.length > MAX_CHOICES) {
      fail(at, `choices must be a list of 1 to ${MAX_CHOICES}`);
      return;
    }
    uniqueIds(event.choices, at, fail);
    event.choices.forEach((choice, c) => checkChoice(choice, `${at} choice ${choice?.id ?? `#${c}`}`, { drops, moduleIds, sides }, fail, atPlace));
    // An open event holds every jump: one choice must always be there to make.
    if (!event.choices.some((choice) => isObject(choice) && (choice.needs === undefined || (isObject(choice.needs) && !Object.keys(choice.needs).length)))) {
      fail(at, 'needs a choice that needs nothing, so the ship is never stuck at it');
    }
  });
  return covered;
}

function checkChoice(choice, at, known, fail, atPlace) {
  if (!isObject(choice)) return;
  knownKeys(choice, CHOICE_KEYS, at, fail);
  if (!isText(choice.label) || choice.label.length > MAX_LABEL) fail(at, `label must be a non-empty string of up to ${MAX_LABEL} letters`);
  const needs = choice.needs ?? {};
  if (choice.needs !== undefined && !isObject(choice.needs)) fail(at, 'needs must be an object');
  else {
    knownKeys(needs, atPlace ? PLACE_NEEDS : NEEDS, `${at} needs`, fail);
    for (const [key, value] of Object.entries(needs)) if (!isIntIn(value, 1, MAX_AMOUNT)) fail(`${at} needs`, `${key} must be a whole number from 1 to ${MAX_AMOUNT}`);
  }
  if (!Array.isArray(choice.outcomes) || choice.outcomes.length < 1 || choice.outcomes.length > MAX_OUTCOMES) {
    fail(at, `outcomes must be a list of 1 to ${MAX_OUTCOMES}`);
    return;
  }
  let total = 0;
  choice.outcomes.forEach((outcome, o) => {
    const where = `${at} outcome ${o + 1}`;
    if (!isObject(outcome)) {
      fail(where, 'must be an object');
      return;
    }
    knownKeys(outcome, OUTCOME_KEYS, where, fail);
    if (!isIntIn(outcome.chance, 1, 100)) fail(where, 'chance must be a whole number from 1 to 100');
    else total += outcome.chance;
    if (!isText(outcome.text) || outcome.text.length > MAX_OUTCOME_TEXT) fail(where, `text must be a non-empty string of up to ${MAX_OUTCOME_TEXT} letters`);
    if (!isObject(outcome.effects)) fail(where, 'effects must be an object (empty for none)');
    else checkEffects(outcome.effects, needs, `${where} effects`, known, fail, atPlace);
  });
  if (total !== 100) fail(at, `outcome chances must add up to 100, not ${total}`);
}

function checkEffects(effects, needs, at, { drops, moduleIds, sides }, fail, atPlace) {
  knownKeys(effects, atPlace ? PLACE_EFFECTS : EFFECTS.filter((key) => key !== 'materials'), at, fail);
  for (const key of ['credits', 'supplies', 'heat', 'materials']) {
    if (effects[key] !== undefined && (!isIntIn(effects[key], -MAX_AMOUNT, MAX_AMOUNT) || effects[key] === 0)) fail(at, `${key} must be a whole number other than 0, from ${-MAX_AMOUNT} to ${MAX_AMOUNT}`);
  }
  // What an outcome takes, its choice must need.
  for (const key of ['credits', 'supplies']) {
    if (effects[key] < 0 && (needs[key] ?? 0) < -effects[key]) fail(at, `takes ${-effects[key]} ${key}, so the choice must need at least that many`);
  }
  if (effects.wound !== undefined) {
    const { wound } = effects;
    if (!isObject(wound) || !isIntIn(wound.hp, 1, MAX_WOUND) || (wound.all !== undefined && typeof wound.all !== 'boolean')) {
      fail(at, `wound must be { hp: 1 to ${MAX_WOUND}, all: true or false }`);
    } else knownKeys(wound, ['hp', 'all'], `${at} wound`, fail);
  }
  if (effects.part !== undefined && !moduleIds.has(effects.part)) fail(at, `part "${effects.part}" is not a part`);
  if (effects.drop !== undefined && !(effects.drop in drops)) fail(at, `drop "${effects.drop}" is not a drop table in drops`);
  if (effects.sell !== undefined) {
    if (!isIntIn(effects.sell, 1, MAX_SELL)) fail(at, `sell must be a whole number from 1 to ${MAX_SELL}`);
    else if ((needs.parts ?? 0) < effects.sell) fail(at, `sells ${effects.sell}, so the choice must need at least that many parts`);
  }
  if (effects.standing !== undefined) {
    if (!isObject(effects.standing) || !Object.keys(effects.standing).length) fail(at, 'standing must be an object of sides, each with what it moves by');
    else {
      for (const [side, by] of Object.entries(effects.standing)) {
        if (!sides.has(side)) fail(`${at} standing`, `unknown side "${side}" (factions.json)`);
        if (!isIntIn(by, -MAX_STANDING, MAX_STANDING) || by === 0) fail(`${at} standing`, `${side} must be a whole number other than 0, from ${-MAX_STANDING} to ${MAX_STANDING}`);
      }
    }
  }
}
