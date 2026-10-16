// The sides (data/factions.json, M33, src/sim/standing.js), for
// validate-data.js: each side's id, name, words and color (one of
// src/render/palette.js sideColors), and the words of its patrols where its
// ships can be met at a sector's nodes (the Fleet's corvettes), which wave
// a friend through and fire on an enemy; the stations that belong to a
// side, each by a name the sectors give stations (data/sectors.json); and
// the side each ship preset is on (data/ships.json). Returns the sides'
// ids, for the other files that name them.
import { sideColors } from '../src/render/palette.js';
import { isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const FILE_KEYS = ['sides', 'stations'];
const SIDE_KEYS = ['id', 'name', 'blurb', 'color', 'patrol'];
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
  sides.forEach((side, i) => {
    const at = `${where} side ${side.id ?? `#${i}`}`;
    knownKeys(side, SIDE_KEYS, at, fail);
    if (!isText(side.name) || side.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!isText(side.blurb) || side.blurb.length > MAX_BLURB) fail(at, `blurb must be a non-empty string of up to ${MAX_BLURB} letters`);
    if (typeof side.color !== 'string' || !Object.hasOwn(sideColors, side.color)) fail(at, `color must be one of src/render/palette.js sideColors (${Object.keys(sideColors).join(', ')})`);
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
  const names = new Set(data.sectors?.names?.stations ?? []);
  if (!isObject(file.stations)) {
    fail(where, 'stations must be an object of station names, each with its side');
  } else {
    for (const [name, side] of Object.entries(file.stations)) {
      if (!names.has(name)) fail(`${where} stations`, `"${name}" isn't a station's name in sectors.json`);
      if (!ids.has(side)) fail(`${where} stations`, `${name}: unknown side "${side}"`);
    }
  }
  for (const ship of presets.values()) {
    if (ship.side !== undefined && !ids.has(ship.side)) fail(`ships.json ${ship.id}`, `side: unknown side "${ship.side}" (factions.json)`);
  }
  return ids;
}
