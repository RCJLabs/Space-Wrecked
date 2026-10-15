// The colony (data/colony.json, M26), for validate-campaign.js: the size of
// the colony's grid and the path left round each building; the tags of the
// parts that stay aboard the ship (never buildings); the colony's words;
// and the building each useful part becomes: its name and words. What a
// building gives is its part's own numbers (data/modules.json), so it names
// a part that exists, a base part (each maker's version of it is the same
// building), none twice, none that stays aboard, and one that fits on the
// grid. From M27: the materials a colony starts with, and what it builds
// from them (the farms and mines): each with an id no part has, a name no
// other building has, a size that fits on the grid, its cost, what it
// makes and from which of the world's numbers, the least it makes a day,
// and its words.
import { MAKES, RESOURCES } from '../src/sim/colony.js';
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { isId, isIntIn, isObject, isText, knownKeys, listOf } from './checks.js';

const FILE_KEYS = ['site', 'aboard', 'text', 'materials', 'builds', 'buildings'];
const SITE_KEYS = ['width', 'height', 'gap'];
const BUILDING_KEYS = ['part', 'name', 'text'];
const BUILD_KEYS = ['id', 'name', 'size', 'cost', 'makes', 'from', 'least', 'text'];
const MAX_TEXT = 200;
const SITE = { width: [8, 40], height: [6, 30], gap: [0, 2] };
// What a colony starts with, a build's cost, its size each way, and the
// least it makes a day.
const MAX_MATERIALS = 200;
const MAX_COST = 100;
const MAX_SIZE = 4;
const MAX_LEAST = 9;

// modules: data/modules.json's list.
export function checkColony(file, modules, fail) {
  const where = 'colony.json';
  if (!isObject(file)) {
    fail(where, 'must be an object');
    return;
  }
  knownKeys(file, FILE_KEYS, where, fail);
  const site = isObject(file.site) ? file.site : {};
  if (!isObject(file.site)) fail(where, 'site must be an object');
  else knownKeys(site, SITE_KEYS, `${where} site`, fail);
  for (const [key, [min, max]] of Object.entries(SITE)) {
    if (!isIntIn(site[key], min, max)) fail(`${where} site`, `${key} must be a whole number from ${min} to ${max}`);
  }
  if (!isText(file.text) || file.text.length > MAX_TEXT) fail(where, `text must be a non-empty string of up to ${MAX_TEXT} letters`);

  const parts = new Map((Array.isArray(modules) ? modules : []).filter((m) => typeof m?.id === 'string').map((m) => [m.id, m]));
  const tags = new Set([...parts.values()].flatMap((m) => (Array.isArray(m.tags) ? m.tags : [])));
  const aboard = Array.isArray(file.aboard) ? file.aboard : [];
  if (!Array.isArray(file.aboard) || !aboard.length || !aboard.every((tag) => typeof tag === 'string' && tags.has(tag))) {
    fail(where, 'aboard must be a list of the tags of parts that stay aboard, each a tag some part has');
  }

  if (!isIntIn(file.materials, 0, MAX_MATERIALS)) fail(where, `materials must be a whole number from 0 to ${MAX_MATERIALS}`);
  const builds = listOf(file, 'builds', where, fail);
  if (!builds.length) fail(where, 'needs a build at least');
  const ids = new Set();
  const names = new Set();
  builds.forEach((build, i) => {
    const at = `${where} build ${build?.id ?? `#${i}`}`;
    knownKeys(build, BUILD_KEYS, at, fail);
    if (!isId(build.id)) fail(at, 'id must be lowercase letters, digits and dashes');
    else if (ids.has(build.id)) fail(at, 'id used twice');
    else if (parts.has(build.id)) fail(at, `id: "${build.id}" is a part's: a build needs an id of its own`);
    ids.add(build.id);
    if (!isText(build.name) || build.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    else if (names.has(build.name)) fail(at, 'name used twice');
    names.add(build.name);
    const size = Array.isArray(build.size) && build.size.length === 2 && build.size.every((n) => isIntIn(n, 1, MAX_SIZE)) ? build.size : null;
    if (!size) fail(at, `size must be [width, height], each from 1 to ${MAX_SIZE}`);
    else if (!fits({ size }, site)) fail(at, "size: doesn't fit on the colony's grid");
    if (!isIntIn(build.cost, 1, MAX_COST)) fail(at, `cost must be a whole number from 1 to ${MAX_COST}`);
    if (!MAKES.includes(build.makes)) fail(at, `makes must be one of ${MAKES.join(', ')}`);
    if (!Array.isArray(build.from) || !build.from.length || !build.from.every((rating) => RESOURCES.includes(rating)) || new Set(build.from).size !== build.from.length) {
      fail(at, `from must be a list of the world's numbers it makes from: ${RESOURCES.join(', ')}, each once`);
    }
    if (!isIntIn(build.least, 0, MAX_LEAST)) fail(at, `least must be a whole number from 0 to ${MAX_LEAST}`);
    if (!isText(build.text) || build.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
  });

  const buildings = listOf(file, 'buildings', where, fail);
  if (!buildings.length) fail(where, 'needs a building at least');
  const seen = new Set();
  buildings.forEach((building, i) => {
    const at = `${where} building ${building?.part ?? `#${i}`}`;
    if (!isObject(building)) {
      fail(at, 'must be an object');
      return;
    }
    knownKeys(building, BUILDING_KEYS, at, fail);
    const part = parts.get(building.part);
    if (!part) fail(at, `part: unknown part "${building.part}"`);
    else if (part.base !== undefined) fail(at, `part: "${building.part}" is a maker's version of ${part.base}: name the base part`);
    else if ((part.tags ?? []).some((tag) => aboard.includes(tag))) fail(at, 'part: stays aboard (aboard), so it is never a building');
    else if (!fits(part, site)) fail(at, "part: doesn't fit on the colony's grid");
    if (seen.has(building.part)) fail(at, 'part named twice');
    seen.add(building.part);
    if (!isText(building.name) || building.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    else if (names.has(building.name)) fail(at, 'name used twice');
    names.add(building.name);
    if (!isText(building.text) || building.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
  });
}

// Whether the part fits on the grid, either way round.
function fits(part, site) {
  const [w, h] = Array.isArray(part.size) ? part.size : [1, 1];
  const [W, H] = [site.width ?? 0, site.height ?? 0];
  return (w <= W && h <= H) || (h <= W && w <= H);
}
