// The places within reach of the colony (data/expeditions.json, M28), for
// validate-campaign.js: how many the list holds and its words; the kinds of
// place, each with an id that no kind of sector node has (so the run's
// events and the places' never mix), a name, a weight, the days it lies
// away, its words, and either names of its own or the system's other
// worlds (worlds: true, never more than one such kind); and for a derelict
// the scavengers may hold: how often, her ship (a preset), their party (an
// encounter), how many of her parts a win strips and the materials it
// brings. A kind of names has at least as many as the list holds, so a
// list of one kind never runs out. Returns the kinds' ids, for the events
// (validate-events.js).
import { MAX_AWAY, MAX_PLACES } from '../src/sim/tripShape.js';
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { isIntIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['places', 'text', 'kinds', 'names'];
const KIND_KEYS = ['id', 'name', 'weight', 'days', 'held', 'worlds', 'text'];
const HELD_KEYS = ['chance', 'ship', 'party', 'salvage', 'materials'];
const MAX_TEXT = 200;
const MAX_SALVAGE = 4;
const MAX_MATERIALS = 99;
const MAX_NAMES = 60;

// ids: { presets (ship presets by id), encounters (id -> enemy list) };
// nodeKinds: the kinds of sector node (data/sectors.json). Returns the
// place kinds' ids, as a Set.
export function checkExpeditions(file, nodeKinds, ids, fail) {
  const where = 'expeditions.json';
  const kinds = new Set();
  if (!isObject(file)) {
    fail(where, 'must be an object');
    return kinds;
  }
  knownKeys(file, FILE_KEYS, where, fail);
  if (!isIntIn(file.places, 1, MAX_PLACES)) fail(where, `places must be a whole number from 1 to ${MAX_PLACES}`);
  if (!isText(file.text) || file.text.length > MAX_TEXT) fail(where, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
  const places = Number.isInteger(file.places) ? file.places : 0;
  const names = isObject(file.names) ? file.names : {};
  if (!isObject(file.names)) fail(where, 'names must be an object of name lists, by kind');

  const list = listOf(file, 'kinds', where, fail);
  if (!list.length) fail(where, 'needs a kind of place at least');
  uniqueIds(list, where, fail);
  list.forEach((kind, i) => {
    const at = `${where} kind ${kind.id ?? `#${i}`}`;
    knownKeys(kind, KIND_KEYS, at, fail);
    if (nodeKinds.has(kind.id)) fail(at, `id: "${kind.id}" is a kind of sector node's; a place needs a kind of its own`);
    if (typeof kind.id === 'string') kinds.add(kind.id);
    if (!isText(kind.name) || kind.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!isIntIn(kind.weight, 1, 100)) fail(at, 'weight must be a whole number from 1 to 100');
    if (!isRange(kind.days, 1, MAX_AWAY)) fail(at, `days must be [least, most], from 1 to ${MAX_AWAY}`);
    if (!isText(kind.text) || kind.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
    if (kind.worlds !== undefined && kind.worlds !== true) fail(at, 'worlds must be true, or left out');
    if (kind.held !== undefined) checkHeld(kind.held, `${at} held`, ids, fail);
    if (kind.worlds) {
      if (kind.id in names) fail(at, "takes its names from the system's worlds, so names has none for it");
    } else {
      const own = names[kind.id];
      if (!Array.isArray(own) || own.length < places || own.length > MAX_NAMES || !own.every((name) => isText(name) && name.length <= MAX_NAME)) {
        fail(`${where} names.${kind.id}`, `must be a list of ${places} to ${MAX_NAMES} names of up to ${MAX_NAME} letters`);
      } else if (new Set(own).size !== own.length) fail(`${where} names.${kind.id}`, 'has a name twice');
    }
  });
  if (list.filter((kind) => kind.worlds).length > 1) fail(where, "only one kind of place takes the system's worlds");
  for (const id of Object.keys(names)) if (!kinds.has(id)) fail(`${where} names.${id}`, 'is for no kind of place');
  return kinds;
}

// A derelict the scavengers may hold: how often in 100, her ship's preset,
// their party, and what a win brings.
function checkHeld(held, at, ids, fail) {
  if (!isObject(held)) {
    fail(at, 'must be an object');
    return;
  }
  knownKeys(held, HELD_KEYS, at, fail);
  if (!isIntIn(held.chance, 1, 100)) fail(at, 'chance must be a whole number from 1 to 100');
  if (!ids.presets?.has(held.ship)) fail(at, `ship: unknown ship preset "${held.ship}"`);
  if (!ids.encounters?.has(held.party)) fail(at, `party: unknown encounter "${held.party}"`);
  if (!isIntIn(held.salvage, 0, MAX_SALVAGE)) fail(at, `salvage must be a whole number from 0 to ${MAX_SALVAGE}`);
  if (!isRange(held.materials, 0, MAX_MATERIALS)) fail(at, `materials must be [least, most], from 0 to ${MAX_MATERIALS}`);
}
