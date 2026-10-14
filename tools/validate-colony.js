// The colony (data/colony.json, M26), for validate-campaign.js: the size of
// the colony's grid and the path left round each building; the tags of the
// parts that stay aboard the ship (never buildings); the colony's words;
// and the building each useful part becomes: its name and words. What a
// building gives is its part's own numbers (data/modules.json), so it names
// a part that exists, a base part (each maker's version of it is the same
// building), none twice, none that stays aboard, and one that fits on the
// grid.
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { isIntIn, isObject, isText, knownKeys, listOf } from './checks.js';

const FILE_KEYS = ['site', 'aboard', 'text', 'buildings'];
const SITE_KEYS = ['width', 'height', 'gap'];
const BUILDING_KEYS = ['part', 'name', 'text'];
const MAX_TEXT = 200;
const SITE = { width: [8, 40], height: [6, 30], gap: [0, 2] };

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

  const buildings = listOf(file, 'buildings', where, fail);
  if (!buildings.length) fail(where, 'needs a building at least');
  const seen = new Set();
  const names = new Set();
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
