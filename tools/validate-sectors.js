// Act 2's sectors (data/sectors.json), for validate-campaign.js: how a
// sector is laid out (gen/sector.js), its kinds of node, the mix the nodes
// between roll their kind from, and the names they draw on. Every name a
// sector can need is there, so none comes twice in a sector, nor a
// sector's name twice in a run. A kind of node with ships on it (hostile
// ships, M21) lists the presets it can have, by weight, each from a sector
// on: presets with tactics for the approach phase (data/ships.json).
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { isId, isIntIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const SECTOR_KEYS = ['columns', 'rows', 'extraLinkChance', 'counts', 'mix', 'nodes', 'names'];
const NODE_KEYS = ['id', 'name', 'names', 'events', 'ships', 'text'];
const SHIP_KEYS = ['ship', 'weight', 'from'];
// The kinds every sector has: where the ship comes in, and where it jumps
// on from. The generator places them itself.
const FIXED = ['start', 'exit'];
const MAX_COLUMNS = 12;
const MAX_ROWS = 4;
const MAX_TEXT = 200;

// acts: campaign.json's acts, for the number of sectors a run crosses;
// presets: the ship presets by id (ships.json). Returns the node kinds that
// hold events (events: true), as a Set, for validate-events.js.
export function checkSectors(file, acts, presets, fail) {
  const where = 'sectors.json';
  const holding = new Set();
  if (!isObject(file)) {
    fail(where, 'must be an object');
    return holding;
  }
  knownKeys(file, SECTOR_KEYS, where, fail);
  if (!isIntIn(file.columns, 3, MAX_COLUMNS)) fail(where, `columns must be a whole number from 3 to ${MAX_COLUMNS}`);
  if (!isRange(file.rows, 1, MAX_ROWS)) fail(where, `rows must be [least, most] nodes in a column, from 1 to ${MAX_ROWS}`);
  if (!isIntIn(file.extraLinkChance, 0, 100)) fail(where, 'extraLinkChance must be a whole number from 0 to 100');

  const run = (acts ?? []).reduce((longest, act) => Math.max(longest, Number.isInteger(act?.sectors) ? act.sectors : 0), 0);
  const nodes = listOf(file, 'nodes', where, fail);
  const ids = uniqueIds(nodes, where, fail);
  for (const id of FIXED) if (!ids.has(id)) fail(where, `the "${id}" node kind is missing`);
  const names = isObject(file.names) ? file.names : {};
  if (!isObject(file.names)) fail(where, 'names must be an object of name lists');
  for (const [list, values] of Object.entries(names)) {
    if (!Array.isArray(values) || !values.length || !values.every((name) => isText(name) && name.length <= MAX_NAME)) {
      fail(`${where} names.${list}`, `must be a list of names of up to ${MAX_NAME} letters`);
    } else if (new Set(values).size !== values.length) {
      fail(`${where} names.${list}`, 'has a name twice');
    }
  }
  nodes.forEach((node, i) => {
    const at = `${where} node ${node.id ?? `#${i}`}`;
    knownKeys(node, NODE_KEYS, at, fail);
    if (!isText(node.name) || node.name.length > MAX_NAME) fail(at, `name must be a non-empty string of up to ${MAX_NAME} letters`);
    if (!isText(node.text) || node.text.length > MAX_TEXT) fail(at, `text must be a non-empty string of up to ${MAX_TEXT} letters`);
    if (node.names !== undefined && !Array.isArray(names[node.names])) fail(at, `names "${node.names}" is not a list in names`);
    if (node.events !== undefined && node.events !== true) fail(at, 'events must be true, or left out');
    else if (node.events && FIXED.includes(node.id)) fail(at, 'the way in and the jump point hold no events');
    else if (node.events && isId(node.id)) holding.add(node.id);
    if (node.ships !== undefined) checkShips(node, at, run, presets, fail);
  });

  // The kinds counted into a sector, each in a column of its own between
  // the way in and the jump point, and the mix every other node between
  // rolls its kind from.
  const kindOf = new Map(nodes.map((node) => [node.id, node]));
  const middle = Number.isInteger(file.columns) ? file.columns - 2 : 0;
  const most = Array.isArray(file.rows) ? file.rows[1] : 0;
  let counted = 0;
  if (!isObject(file.counts)) fail(where, 'counts must be an object of node kinds and [least, most]');
  else {
    for (const [kind, range] of Object.entries(file.counts)) {
      const at = `${where} counts.${kind}`;
      if (!kindOf.has(kind) || FIXED.includes(kind)) fail(at, 'must be a node kind other than start and exit');
      if (!isRange(range, 0, MAX_COLUMNS)) fail(at, 'must be [least, most]');
      else {
        counted += range[1];
        const list = names[kindOf.get(kind)?.names];
        if (Array.isArray(list) && list.length < range[1]) fail(at, `needs ${range[1]} names in its list, has ${list.length}`);
      }
    }
    if (counted > middle) fail(where, `counts take up to ${counted} columns, but only ${middle} lie between the way in and the jump point`);
  }
  const counts = isObject(file.counts) ? file.counts : {};
  if (!isObject(file.mix) || !Object.keys(file.mix).length) fail(where, 'mix must be an object of node kinds and weights');
  else {
    for (const [kind, weight] of Object.entries(file.mix)) {
      const at = `${where} mix.${kind}`;
      if (!kindOf.has(kind) || FIXED.includes(kind) || kind in counts) fail(at, 'must be a node kind other than start, exit and the counted kinds');
      if (!isIntIn(weight, 1, 100)) fail(at, 'must be a weight from 1 to 100');
      // Every node between could roll this kind.
      const list = names[kindOf.get(kind)?.names];
      if (Array.isArray(list) && list.length < middle * most) fail(at, `needs ${middle * most} names in its list, has ${list.length}`);
    }
  }

  // A sector's name never comes twice in a run.
  if (!Array.isArray(names.sectors)) fail(where, 'names.sectors must be a list');
  else if (names.sectors.length < run) fail(`${where} names.sectors`, `needs ${run} names for a run of ${run} sectors, has ${names.sectors.length}`);
  return holding;
}

// A kind of node with hostile ships on it: [{ ship, weight, from? }], the
// presets it can have, each with tactics and a party for the boardings, by
// weight, from sector `from` on (1 if left out). The first sector has to
// have one, and the kind holds no events: meeting the ship is what happens
// there.
function checkShips(node, at, run, presets, fail) {
  if (node.events) fail(at, 'a kind with ships holds no events');
  if (FIXED.includes(node.id)) fail(at, 'the way in and the jump point have no ships on them');
  if (!Array.isArray(node.ships) || !node.ships.length) {
    fail(at, 'ships must be a list of presets, by weight');
    return;
  }
  node.ships.forEach((entry, i) => {
    const where = `${at} ships #${i + 1}`;
    if (!isObject(entry)) {
      fail(where, 'must be an object');
      return;
    }
    knownKeys(entry, SHIP_KEYS, where, fail);
    const preset = presets.get(entry.ship);
    if (!preset) fail(where, `unknown ship preset "${entry.ship}"`);
    else if (!preset.tactics) fail(where, `the ${preset.name} has no tactics for the approach phase`);
    else if (!preset.party) fail(where, `the ${preset.name} has no party for the boarding fights`);
    if (!isIntIn(entry.weight, 1, 100)) fail(where, 'weight must be a whole number from 1 to 100');
    if (entry.from !== undefined && !isIntIn(entry.from, 1, Math.max(1, run))) fail(where, `from must be a sector from 1 to ${Math.max(1, run)}`);
  });
  if (!node.ships.some((entry) => entry?.from === undefined || entry.from === 1)) fail(at, 'needs a ship for the first sector');
}
