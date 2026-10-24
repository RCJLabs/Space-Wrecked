// The sides (data/factions.json, M33, src/sim/standing.js), for
// validate-data.js: each side's id, name, words and color (one of
// src/render/palette.js sideColors), and the words of its patrols where its
// ships can be met at a sector's nodes (the Fleet's corvettes), which wave
// a friend through and fire on an enemy; the stations that belong to a
// side, each by a name the sectors give stations (data/sectors.json); and
// the side each ship preset is on (data/ships.json). Since M37, what the
// racks at each side's stations sell (`arms`), and at stations of nobody's
// (the file's `arms`): weapons by weight, enough for a rack (rackSize).
// Since M37b, the makers each side's shipyards lean to (`yard`): each
// maker's parts weigh that much in a yard's stock, other makers' 1; and the
// shipyards that belong to a side, by a name the sectors give shipyards.
// Returns the sides' ids, for the other files that name them.
import { sideColors } from '../src/render/palette.js';
import { isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['sides', 'stations', 'arms'];
const SIDE_KEYS = ['id', 'name', 'blurb', 'color', 'emblem', 'patrol', 'arms', 'yard'];
const PATROL_KEYS = ['waved', 'fired'];
const MAX_NAME = 24;
const MAX_BLURB = 160;
const MAX_PATROL = 200;

// presets: the ship presets by id (data/ships.json).
export function checkFactions(data, presets, fail) {
  const where = 'factions.json';
  const file = data.factions;
  if (!isObject(file)) {
    fail(where, 'must be { sides, stations }');
    return new Set();
  }
  knownKeys(file, FILE_KEYS, where, fail);
  const sides = listOf(file, 'sides', where, fail);
  const ids = uniqueIds(sides, where, fail);
  if (!sides.length) fail(where, 'needs at least one side');
  // The sides whose ships the sectors' nodes can hold.
  const atNodes = new Set();
  for (const kind of data.sectors?.nodes ?? []) {
    for (const entry of Array.isArray(kind?.ships) ? kind.ships : []) {
      const side = presets.get(entry?.ship)?.side;
      if (side !== undefined) atNodes.add(side);
    }
  }
  const weaponIds = new Set((data.weapons?.weapons ?? []).map((weapon) => weapon.id));
  const emblemIds = new Set((data.styling?.emblems ?? []).map((emblem) => emblem?.id));
  const makers = data.manufacturers?.manufacturers;
  const makerIds = new Set(Array.isArray(makers) ? makers.map((maker) => maker?.id) : []);
  const rack = data.balance?.rackSize ?? 0;
  checkArms(file.arms, `${where} arms`, weaponIds, rack, fail);
  sides.forEach((side, i) => {
    const at = `${where} side ${side.id ?? `#${i}`}`;
    knownKeys(side, SIDE_KEYS, at, fail);
    if (side.arms !== undefined) checkArms(side.arms, `${at} arms`, weaponIds, rack, fail);
    if (side.yard !== undefined) checkLean(side.yard, `${at} yard`, makerIds, fail);
    if (!isText(side.name) || side.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!isText(side.blurb) || side.blurb.length > MAX_BLURB) fail(at, `blurb must be a non-empty string of up to ${MAX_BLURB} letters`);
    if (typeof side.color !== 'string' || !Object.hasOwn(sideColors, side.color)) fail(at, `color must be one of src/render/palette.js sideColors (${Object.keys(sideColors).join(', ')})`);
    // Its ships' emblem (M52), one of styling.json's.
    if (side.emblem !== undefined && !emblemIds.has(side.emblem)) fail(at, 'emblem must be one of the emblems in styling.json');
    if (side.patrol === undefined) {
      if (atNodes.has(side.id)) fail(at, "its ships are met at the sectors' nodes, so it needs its patrols' words: { waved, fired }");
    } else if (!isObject(side.patrol)) {
      fail(at, 'patrol must be { waved, fired }');
    } else {
      knownKeys(side.patrol, PATROL_KEYS, `${at} patrol`, fail);
      for (const key of PATROL_KEYS) {
        const text = side.patrol[key];
        if (!isText(text) || text.length > MAX_PATROL) fail(`${at} patrol`, `${key} must be a non-empty string of up to ${MAX_PATROL} letters`);
      }
    }
  });
  const names = new Set([...(data.sectors?.names?.stations ?? []), ...(data.sectors?.names?.shipyards ?? [])]);
  if (!isObject(file.stations)) {
    fail(where, 'stations must be an object of station and shipyard names, each with its side');
  } else {
    for (const [name, side] of Object.entries(file.stations)) {
      if (!names.has(name)) fail(`${where} stations`, `"${name}" isn't a station's or a shipyard's name in sectors.json`);
      if (!ids.has(side)) fail(`${where} stations`, `${name}: unknown side "${side}"`);
    }
  }
  for (const ship of presets.values()) {
    if (ship.side !== undefined && !ids.has(ship.side)) fail(`ships.json ${ship.id}`, `side: unknown side "${ship.side}" (factions.json)`);
  }
  return ids;
}

// A side's shipyards' lean (M37b): { [maker id]: weight }, weights 1 to
// 100, at least one maker.
function checkLean(table, where, makerIds, fail) {
  if (!isObject(table) || !Object.keys(table).length) {
    fail(where, 'must be an object of makers, each with its weight');
    return;
  }
  for (const [id, weight] of Object.entries(table)) {
    if (!makerIds.has(id)) fail(where, `"${id}" is not a maker (manufacturers.json)`);
    if (!(Number.isInteger(weight) && weight >= 1 && weight <= 100)) fail(where, `${id}'s weight must be a whole number from 1 to 100`);
  }
}

// What a rack sells: { [weapon id]: weight }, weights 1 to 100, with at
// least `least` weapons, a rack's worth, in it.
export function checkArms(table, where, weaponIds, least, fail) {
  if (!isObject(table)) {
    fail(where, 'must be an object of weapons, each with its weight');
    return;
  }
  for (const [id, weight] of Object.entries(table)) {
    if (!weaponIds.has(id)) fail(where, `"${id}" is not a weapon`);
    if (!(Number.isInteger(weight) && weight >= 1 && weight <= 100)) fail(where, `${id}'s weight must be a whole number from 1 to 100`);
  }
  if (Object.keys(table).length < least) fail(where, `needs at least ${least} weapons, a whole rack's worth`);
}
