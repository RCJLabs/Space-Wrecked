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
// and its words. From M28 a build may give instead (a solar array's power,
// a shelter's beds and air): what it gives, each a whole number other than
// 0 (power below 0 is what it needs), and at least one of them. A build
// makes or gives, never both, and gives power only if it makes none. From
// M38f the colonist a citizen fights a raid as (raids.js): an id of its
// own, a name, its numbers, a weapon that exists, and a look
// (src/render/figures/looks.js).
import { BUILD_GIVES, MAKES, RESOURCES } from '../src/sim/colony.js';
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { lookProblems } from '../src/render/figures/looks.js';
import { COLONY_EFFECTS } from '../src/sim/edges.js';
import { isId, isIntIn, isObject, isText, knownKeys, listOf } from './checks.js';

const FILE_KEYS = ['site', 'aboard', 'text', 'materials', 'citizen', 'gun', 'builds', 'buildings'];
// The colonist (M38f): its keys and the range of each number.
const CITIZEN_KEYS = ['id', 'name', 'hp', 'aim', 'defense', 'mobility', 'armor', 'weapon', 'look'];
const CITIZEN_NUMBERS = { hp: [1, 20], aim: [0, 100], defense: [0, 50], mobility: [1, 8], armor: [0, 5] };
const SITE_KEYS = ['width', 'height', 'gap'];
// shots (M29): how many times a defense fires at a raid's lander as it
// comes down (src/sim/raids.js).
// effects and makes (M39): what a given part does at the colony besides its
// numbers, a colony effect as a job's (src/sim/edges.js) or what it makes a
// day, as a farm does.
const BUILDING_KEYS = ['part', 'name', 'shots', 'effects', 'makes', 'text'];
const MAX_SHOTS = 4;
const BUILD_KEYS = ['id', 'name', 'size', 'cost', 'makes', 'from', 'least', 'gives', 'text'];
const MAX_TEXT = 200;
const SITE = { width: [8, 40], height: [6, 30], gap: [0, 2] };
// What a colony starts with, a build's cost, its size each way, the least
// it makes a day, and the most it gives of each.
const MAX_MATERIALS = 200;
const MAX_COST = 100;
const MAX_SIZE = 4;
const MAX_LEAST = 9;
const MAX_GIVES = 20;

// modules: data/modules.json's list; weapons, data/weapons.json's.
export function checkColony(file, modules, fail, weapons = []) {
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
  checkCitizen(file.citizen, new Set((Array.isArray(weapons) ? weapons : []).map((w) => w?.id)), `${where} citizen`, fail);
  if (file.gun !== undefined) checkGun(file.gun, new Set((Array.isArray(weapons) ? weapons : []).map((w) => w?.id)), `${where} gun`, fail);
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
    if ((build.makes === undefined) === (build.gives === undefined)) fail(at, 'must have makes or gives, not both');
    else if (build.makes !== undefined) checkMakes(build, at, fail);
    else {
      if (build.from !== undefined || build.least !== undefined) fail(at, 'from and least are for a build that makes');
      checkGives(build.gives, at, fail);
    }
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
    if (building.shots !== undefined && !isIntIn(building.shots, 1, MAX_SHOTS)) fail(at, `shots must be a whole number from 1 to ${MAX_SHOTS}, or left out for a building that doesn't fire`);
    if (building.effects !== undefined) checkBuildingEffects(building.effects, at, fail);
    if (building.makes !== undefined) {
      if (!isObject(building.makes) || !Object.keys(building.makes).length) fail(at, `makes must be { ${MAKES.join(' | ')}: a day }`);
      else for (const [what, n] of Object.entries(building.makes)) if (!MAKES.includes(what) || !isIntIn(n, 1, MAX_LEAST)) fail(at, `makes: ${what} must be one of ${MAKES.join(', ')}, from 1 to ${MAX_LEAST} a day`);
    }
  });
}

// A given part's colony effects (M39): each a job's colony effect, within
// its range.
function checkBuildingEffects(effects, at, fail) {
  if (!isObject(effects) || !Object.keys(effects).length) {
    fail(at, `effects must be an object of ${Object.keys(COLONY_EFFECTS).join(', ')}`);
    return;
  }
  for (const [key, n] of Object.entries(effects)) {
    const range = COLONY_EFFECTS[key];
    if (!range) fail(at, `effects: unknown effect "${key}"`);
    else if (!isIntIn(n, range[0], range[1])) fail(at, `effects: ${key} must be a whole number from ${range[0]} to ${range[1]}`);
  }
}

// The colonist a citizen fights a raid as (M38f): its id, name, numbers,
// a weapon of weapons (ids), and its look.
function checkCitizen(citizen, weapons, at, fail) {
  if (!isObject(citizen)) {
    fail(at, 'must be an object: the colonist a citizen fights a raid as');
    return;
  }
  knownKeys(citizen, CITIZEN_KEYS, at, fail);
  if (!isId(citizen.id)) fail(at, 'id must be lowercase letters, digits and dashes');
  if (!isText(citizen.name) || citizen.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
  for (const [key, [min, max]] of Object.entries(CITIZEN_NUMBERS)) {
    if (!isIntIn(citizen[key], min, max)) fail(at, `${key} must be a whole number from ${min} to ${max}`);
  }
  if (!weapons.has(citizen.weapon)) fail(at, `weapon: unknown weapon "${citizen.weapon}"`);
  for (const problem of lookProblems(citizen.look)) fail(at, problem);
}

// What each of the colony's powered guns fights a raid as (M50): a
// machine, as a ship's security turret is (M39), with no moves, a weapon of
// weapons (ids) and a machine's look.
function checkGun(gun, weapons, at, fail) {
  if (!isObject(gun)) {
    fail(at, 'must be an object: the machine each powered gun fights a raid as');
    return;
  }
  knownKeys(gun, CITIZEN_KEYS, at, fail);
  if (!isId(gun.id)) fail(at, 'id must be lowercase letters, digits and dashes');
  if (!isText(gun.name) || gun.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
  for (const [key, [min, max]] of Object.entries({ ...CITIZEN_NUMBERS, mobility: [0, 0] })) {
    if (!isIntIn(gun[key], min, max)) fail(at, `${key} must be a whole number from ${min} to ${max}`);
  }
  if (!weapons.has(gun.weapon)) fail(at, `weapon: unknown weapon "${gun.weapon}"`);
  if (gun.look?.machine === undefined) fail(at, "look must be a machine's: { machine }");
  for (const problem of lookProblems(gun.look)) fail(at, problem);
}

// A build that makes: what, from which of the world's numbers, and the
// least it makes a day.
function checkMakes(build, at, fail) {
  if (!MAKES.includes(build.makes)) fail(at, `makes must be one of ${MAKES.join(', ')}`);
  if (!Array.isArray(build.from) || !build.from.length || !build.from.every((rating) => RESOURCES.includes(rating)) || new Set(build.from).size !== build.from.length) {
    fail(at, `from must be a list of the world's numbers it makes from: ${RESOURCES.join(', ')}, each once`);
  }
  if (!isIntIn(build.least, 0, MAX_LEAST)) fail(at, `least must be a whole number from 0 to ${MAX_LEAST}`);
}

// A build that gives (M28): some of BUILD_GIVES, each a whole number other
// than 0, and something besides power needed.
function checkGives(gives, at, fail) {
  if (!isObject(gives) || !Object.keys(gives).length) {
    fail(at, `gives must be an object of ${BUILD_GIVES.join(', ')}`);
    return;
  }
  knownKeys(gives, BUILD_GIVES, `${at} gives`, fail);
  for (const [key, value] of Object.entries(gives)) {
    const least = key === 'power' ? -MAX_GIVES : 1;
    if (!isIntIn(value, least, MAX_GIVES) || value === 0) fail(`${at} gives`, `${key} must be a whole number from ${least} to ${MAX_GIVES}, not 0`);
  }
  if (!Object.entries(gives).some(([key, value]) => key !== 'power' || value > 0)) fail(at, 'gives must give something: power above 0, beds, air or storage');
}

// Whether the part fits on the grid, either way round.
function fits(part, site) {
  const [w, h] = Array.isArray(part.size) ? part.size : [1, 1];
  const [W, H] = [site.width ?? 0, site.height ?? 0];
  return (w <= W && h <= H) || (h <= W && w <= H);
}
