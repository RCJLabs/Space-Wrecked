// Act 2's sectors (data/sectors.json), for validate-campaign.js: how a
// sector is laid out (gen/sector.js), its kinds of node, the mix the nodes
// between roll their kind from, and the names they draw on. Every name a
// sector can need is there, so none comes twice in a sector, nor a
// sector's name twice in a run.
import { MAX_PLACE_NAME as MAX_NAME } from '../src/sim/runShape.js';
import { isId, isIntIn, isObject, isRange, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const SECTOR_KEYS = ['columns', 'rows', 'extraLinkChance', 'counts', 'mix', 'nodes', 'names'];
const NODE_KEYS = ['id', 'name', 'names', 'events', 'text'];
// The kinds every sector has: where the ship comes in, and where it jumps
// on from. The generator places them itself.
const FIXED = ['start', 'exit'];
const MAX_COLUMNS = 12;
const MAX_ROWS = 4;
const MAX_TEXT = 200;

// acts: campaign.json's acts, for the number of sectors a run crosses.
// Returns the node kinds that hold events (events: true), as a Set, for
// validate-events.js.
export function checkSectors(file, acts, fail) {
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
  const run = (acts ?? []).reduce((longest, act) => Math.max(longest, Number.isInteger(act?.sectors) ? act.sectors : 0), 0);
  if (!Array.isArray(names.sectors)) fail(where, 'names.sectors must be a list');
  else if (names.sectors.length < run) fail(`${where} names.sectors`, `needs ${run} names for a run of ${run} sectors, has ${names.sectors.length}`);
  return holding;
}
