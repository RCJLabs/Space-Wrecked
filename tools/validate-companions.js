// The companions (data/companions.json, M33c, src/sim/companions.js), for
// validate-data.js: each one's id, name, side (one companion a side), job,
// two traits, the fights they have stood, their face (looks.js) and past;
// their chain, a side's chain of their own side (data/quests.json) whose
// step on the run has a choice that does the step and signs them on, and
// no other event signing them on; their loyalty quest, a quest of their
// own; and their talent: words for it, and their job's order numbers,
// each as sharp as rank 2's or sharper and one of them sharper.
import { isLook } from '../src/sim/looks.js';
import { ORDER_KINDS } from '../src/sim/orders.js';
import { jobAtRank } from '../src/sim/ranks.js';
import { isIntIn, isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['text', 'companions'];
const COMPANION_KEYS = ['id', 'name', 'side', 'job', 'traits', 'fights', 'look', 'past', 'chain', 'loyalty', 'talent'];
const TALENT_KEYS = ['name', 'order'];
const TRAITS = 2;
const MAX_NAME = 24;
const MAX_TALENT_NAME = 24;
const MAX_TEXT = 240;
const MAX_FIGHTS = 99;
// The most uses an order has (validate-data.js MAX_USES).
const MAX_USES = 9;
// An order's keys that are its words, not its numbers.
const ORDER_WORDS = ['type', 'name'];

// data: the content files; ids: { sides (the sides' ids), jobIds, traitIds }.
export function checkCompanions(data, { sides, jobIds, traitIds }, fail) {
  const where = 'companions.json';
  const file = data.companions;
  if (!isObject(file)) {
    fail(where, 'must be { text, companions }');
    return;
  }
  knownKeys(file, FILE_KEYS, where, fail);
  if (!isText(file.text) || file.text.length > MAX_TEXT) fail(where, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
  const companions = listOf(file, 'companions', where, fail);
  uniqueIds(companions, where, fail);
  const list = (value) => (Array.isArray(value) ? value.filter(isObject) : []);
  const quests = new Map(list(data.quests?.quests).map((quest) => [quest.id, quest]));
  const events = new Map(list(data.events?.events).map((event) => [event.id, event]));
  const jobs = new Map(list(data.jobs?.jobs).map((job) => [job.id, job]));
  const bySide = new Map();

  companions.forEach((companion, i) => {
    const at = `${where} companion ${companion?.id ?? `#${i}`}`;
    if (!isObject(companion)) return;
    knownKeys(companion, COMPANION_KEYS, at, fail);
    if (!isText(companion.name) || companion.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!sides.has(companion.side)) fail(at, `side: unknown side "${companion.side}" (factions.json)`);
    else if (bySide.has(companion.side)) fail(at, `${companion.side} has a companion already (${bySide.get(companion.side)}): one a side`);
    else bySide.set(companion.side, companion.id);
    if (!jobIds.has(companion.job)) fail(at, `job: unknown job "${companion.job}" (jobs.json)`);
    if (!Array.isArray(companion.traits) || companion.traits.length !== TRAITS || new Set(companion.traits).size !== TRAITS) fail(at, `traits must be ${TRAITS} different traits`);
    else for (const trait of companion.traits) if (!traitIds.has(trait)) fail(at, `traits: unknown trait "${trait}" (traits.json)`);
    if (!isIntIn(companion.fights, 0, MAX_FIGHTS)) fail(at, `fights must be a whole number from 0 to ${MAX_FIGHTS}`);
    if (!isLook(companion.look)) fail(at, "look must be a face's every layer, each a choice looks.js draws");
    if (!isText(companion.past) || companion.past.length > MAX_TEXT) fail(at, `past must be a non-empty string of up to ${MAX_TEXT} letters`);
    checkChain(companion, at, { quests, events }, fail);
    const loyalty = quests.get(companion.loyalty);
    if (!loyalty) fail(at, `loyalty: unknown quest "${companion.loyalty}" (quests.json)`);
    else if (loyalty.companion !== companion.id) fail(at, `loyalty: quest "${loyalty.id}" must be marked companion: "${companion.id}"`);
    checkTalent(companion.talent, `${at} talent`, jobs.get(companion.job), fail);
  });

  // Nobody signs on but through their own chain's step.
  const known = new Map(companions.filter(isObject).map((companion) => [companion.id, companion]));
  for (const event of events.values()) {
    for (const choice of list(event.choices)) {
      for (const outcome of list(choice.outcomes)) {
        const id = outcome?.effects?.joins;
        if (id === undefined) continue;
        const steps = quests.get(known.get(id)?.chain)?.steps;
        const step = (Array.isArray(steps) ? steps : []).find((entry) => entry?.act === 2);
        if (step?.event !== event.id) fail(`events.json event ${event.id} choice ${choice.id}`, `signs on ${id}, who signs on only at their chain's step`);
      }
    }
  }
}

// Their chain: a side's chain of their side, whose step on the run has a
// choice that does it and signs them on.
function checkChain(companion, at, { quests, events }, fail) {
  const chain = quests.get(companion.chain);
  if (!chain) {
    fail(at, `chain: unknown quest "${companion.chain}" (quests.json)`);
    return;
  }
  if (chain.side !== companion.side) fail(at, `chain: "${chain.id}" must be a side's chain of ${companion.side}`);
  const step = (Array.isArray(chain.steps) ? chain.steps : []).find((entry) => entry?.act === 2);
  const event = step && events.get(step.event);
  if (!event) {
    fail(at, `chain: "${chain.id}" needs a step on the run, where they sign on`);
    return;
  }
  const signs = (Array.isArray(event.choices) ? event.choices : []).filter((choice) => Array.isArray(choice?.outcomes) && choice.outcomes.some((outcome) => outcome?.effects?.joins === companion.id));
  if (signs.length !== 1) fail(at, `chain: "${event.id}" must have one choice that signs ${companion.id} on`);
  else if (!(step.done ?? []).includes(signs[0].id)) fail(at, `chain: "${event.id}"'s choice "${signs[0].id}" signs them on, so it must do the step (done)`);
}

// Their talent: its words, and their job's order numbers, each as sharp as
// rank 2's or sharper, one of them sharper (further from 0, the same way),
// and each within its order's range (orders.js ORDER_KINDS).
function checkTalent(talent, at, job, fail) {
  if (!isObject(talent)) {
    fail(at, `must be { ${TALENT_KEYS.join(', ')} }`);
    return;
  }
  knownKeys(talent, TALENT_KEYS, at, fail);
  if (!isText(talent.name) || talent.name.length > MAX_TALENT_NAME) fail(at, `name must be a non-empty string of up to ${MAX_TALENT_NAME} letters`);
  const below = job?.order ? jobAtRank(job, 2).order : null;
  if (!below) return;
  if (!isObject(talent.order) || !Object.keys(talent.order).length) {
    fail(at, 'order must be an object of the order numbers it sharpens');
    return;
  }
  const numbers = Object.keys(below).filter((key) => !ORDER_WORDS.includes(key));
  knownKeys(talent.order, numbers, `${at} order`, fail);
  const ranges = { uses: [1, MAX_USES], ...(ORDER_KINDS[below.type]?.fields ?? {}) };
  let sharper = false;
  for (const [key, value] of Object.entries(talent.order)) {
    if (!numbers.includes(key)) continue;
    const [min, max] = ranges[key] ?? [-Infinity, Infinity];
    if (!isIntIn(value, min, max)) {
      fail(`${at} order`, `${key} must be a whole number from ${min} to ${max}`);
      continue;
    }
    const was = below[key];
    if (value * was < 0 || Math.abs(value) < Math.abs(was)) fail(`${at} order`, `${key} must be as sharp as rank 2's (${was}) or sharper`);
    if (Math.abs(value) > Math.abs(was)) sharper = true;
  }
  if (!sharper) fail(`${at} order`, "must sharpen one of rank 2's numbers");
}
