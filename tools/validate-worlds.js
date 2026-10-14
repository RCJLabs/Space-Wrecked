// The worlds past the charts (data/worlds.json, M25), for
// validate-campaign.js: how many worlds a system has and its words, the
// words for how far a world lies from the lanes (one line for each of 1 to
// LANES, nearest first), the kinds of world, each with the ranges its act 3
// numbers roll in (gen/system.js), and the names a system and its worlds
// draw on. A system's worlds are of different kinds and names, so there are
// at least as many of each as a system has worlds. The worlds stand on the
// "world" kind of node (sectors.json).
import { LANES, MAX_RATING, RATINGS } from '../src/sim/gen/system.js';
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { isIntIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['system', 'lanes', 'kinds', 'names'];
const SYSTEM_KEYS = ['worlds', 'text'];
const KIND_KEYS = ['id', 'name', 'weight', ...RATINGS, 'text'];
const NAME_LISTS = ['systems', 'worlds'];
const MAX_WORLDS = 5;
const MAX_TEXT = 200;

// sectors: sectors.json, for the kind of node the worlds stand on.
export function checkWorlds(file, sectors, fail) {
  const where = 'worlds.json';
  if (!isObject(file)) {
    fail(where, 'must be an object');
    return;
  }
  knownKeys(file, FILE_KEYS, where, fail);
  const system = isObject(file.system) ? file.system : {};
  if (!isObject(file.system)) fail(where, 'system must be an object');
  else knownKeys(system, SYSTEM_KEYS, `${where} system`, fail);
  if (!isIntIn(system.worlds, 2, MAX_WORLDS)) fail(`${where} system`, `worlds must be a whole number from 2 to ${MAX_WORLDS}`);
  if (!isText(system.text) || system.text.length > MAX_TEXT) fail(`${where} system`, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
  if (!Array.isArray(file.lanes) || file.lanes.length !== LANES || !file.lanes.every((line) => isText(line) && line.length <= MAX_TEXT)) {
    fail(where, `lanes must be ${LANES} lines of up to ${MAX_TEXT} letters, the nearest first`);
  }

  const kinds = listOf(file, 'kinds', where, fail);
  uniqueIds(kinds, where, fail);
  kinds.forEach((kind, i) => {
    const at = `${where} kind ${kind.id ?? `#${i}`}`;
    knownKeys(kind, KIND_KEYS, at, fail);
    if (!isText(kind.name) || kind.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!isText(kind.text) || kind.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
    if (!isIntIn(kind.weight, 1, 100)) fail(at, 'weight must be a whole number from 1 to 100');
    for (const rating of RATINGS) if (!isRange(kind[rating], 0, MAX_RATING)) fail(at, `${rating} must be [least, most], from 0 to ${MAX_RATING}`);
  });
  const worlds = Number.isInteger(system.worlds) ? system.worlds : 0;
  if (kinds.length < worlds) fail(where, `needs ${worlds} kinds of world, one for each world in a system; has ${kinds.length}`);

  const names = isObject(file.names) ? file.names : {};
  if (!isObject(file.names)) fail(where, 'names must be an object of name lists');
  else knownKeys(names, NAME_LISTS, `${where} names`, fail);
  for (const list of NAME_LISTS) {
    const values = names[list];
    if (!Array.isArray(values) || !values.length || !values.every((name) => isText(name) && name.length <= MAX_NAME)) {
      fail(`${where} names.${list}`, `must be a list of names of up to ${MAX_NAME} letters`);
    } else if (new Set(values).size !== values.length) {
      fail(`${where} names.${list}`, 'has a name twice');
    }
  }
  if (Array.isArray(names.worlds) && names.worlds.length < worlds) fail(`${where} names.worlds`, `needs ${worlds} names, one for each world in a system; has ${names.worlds.length}`);

  if (!(sectors?.nodes ?? []).some((node) => node?.id === 'world')) fail('sectors.json', 'the "world" node kind is missing: the worlds past the charts stand on it');
}
