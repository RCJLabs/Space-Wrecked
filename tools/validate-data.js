#!/usr/bin/env node
// Checks the content files in data/: required fields, types, ranges and
// cross-references. Adding content never needs an engine edit, so mistakes
// in it have to be caught here instead.
//
//   node tools/validate-data.js
import { pathToFileURL } from 'node:url';
import { REQUIRED_TAGS } from '../src/sim/constraints.js';
import { readData } from './data.js';

const SIDES = ['n', 'e', 's', 'w'];
const STATS = ['power', 'mass', 'thrust', 'berths', 'lifeSupport', 'cargo', 'hp'];
const MODULE_KEYS = ['id', 'name', 'glyph', 'manufacturer', 'size', 'rotates', 'doors', 'stats', 'tags', 'interior', 'cost'];
const FRAME_KEYS = ['id', 'name', 'width', 'height', 'shape', 'maxModules', 'minThrustToMass'];
// balance.json: each number's allowed range.
const BALANCE = { startingCrew: [1, 100] };
const MAX_MODULE_SIZE = 4;
const MAX_FRAME_SIZE = 32;

// Tags the rules read. A new tag means new rules, so it is added here on purpose.
export const KNOWN_TAGS = [
  'bridge', 'reactor', 'engine', 'corridor', 'airlock', 'quarters',
  'lifesupport', 'cargo', 'medbay', 'armory', 'weapon', 'shield',
];

// Returns a list of problems as "where: what" strings. Empty means valid.
export function validateData({ modules: moduleFile, frames: frameFile, manufacturers: makerFile, balance }) {
  const problems = [];
  const fail = (where, message) => problems.push(`${where}: ${message}`);

  const makers = listOf(makerFile, 'manufacturers', 'manufacturers.json', fail);
  const makerIds = uniqueIds(makers, 'manufacturers.json', fail);
  makers.forEach((maker, i) => {
    if (!isText(maker.name)) fail(`manufacturers.json #${i}`, 'name must be a non-empty string');
  });

  const frames = listOf(frameFile, 'frames', 'frames.json', fail);
  uniqueIds(frames, 'frames.json', fail);
  frames.forEach((frame, i) => {
    const where = `frames.json ${frame.id ?? `#${i}`}`;
    for (const key of Object.keys(frame)) {
      if (!FRAME_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (!isText(frame.name)) fail(where, 'name must be a non-empty string');
    if (!(Number.isFinite(frame.minThrustToMass) && frame.minThrustToMass >= 0 && frame.minThrustToMass <= 10)) {
      fail(where, 'minThrustToMass must be a number from 0 to 10');
    }
    for (const key of ['width', 'height']) {
      if (!isIntIn(frame[key], 1, MAX_FRAME_SIZE)) fail(where, `${key} must be an integer from 1 to ${MAX_FRAME_SIZE}`);
    }
    if (!isIntIn(frame.maxModules, 1, Infinity)) fail(where, 'maxModules must be a positive integer');
    if (frame.shape !== undefined) checkShape(frame, where, fail);
  });

  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) {
    fail('balance.json', 'must be an object of named numbers');
  } else {
    for (const key of Object.keys(balance)) {
      if (!(key in BALANCE)) fail('balance.json', `unknown number "${key}"`);
    }
    for (const [key, [min, max]] of Object.entries(BALANCE)) {
      if (!isIntIn(balance[key], min, max)) fail('balance.json', `${key} must be a whole number from ${min} to ${max}`);
    }
  }

  const tilesPerCell = moduleFile?.tilesPerCell;
  if (!isIntIn(tilesPerCell, 1, 8)) fail('modules.json', 'tilesPerCell must be an integer from 1 to 8');
  const tiles = moduleFile?.tiles;
  if (!tiles || typeof tiles !== 'object' || Array.isArray(tiles)) {
    fail('modules.json', 'tiles must be an object mapping one character to a tile name');
  } else {
    for (const [char, name] of Object.entries(tiles)) {
      if ([...char].length !== 1 || !isText(name)) fail('modules.json tiles', `"${char}" must map one character to a name`);
    }
  }

  const modules = listOf(moduleFile, 'modules', 'modules.json', fail);
  uniqueIds(modules, 'modules.json', fail);
  const glyphs = new Set();
  modules.forEach((def, i) => {
    const where = `modules.json ${def.id ?? `#${i}`}`;
    for (const key of Object.keys(def)) {
      if (!MODULE_KEYS.includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (!isText(def.name)) fail(where, 'name must be a non-empty string');
    if (typeof def.glyph !== 'string' || [...def.glyph].length !== 1 || def.glyph === '.' || def.glyph.trim() === '') {
      fail(where, 'glyph must be one visible character other than "."');
    } else if (glyphs.has(def.glyph)) {
      fail(where, `glyph "${def.glyph}" is already used`);
    } else {
      glyphs.add(def.glyph);
    }
    if (!makerIds.has(def.manufacturer)) fail(where, `unknown manufacturer "${def.manufacturer}"`);
    if (typeof def.rotates !== 'boolean') fail(where, 'rotates must be true or false');
    if (!isIntIn(def.cost, 0, Infinity)) fail(where, 'cost must be a whole number, 0 or more');

    const sizeOk = Array.isArray(def.size) && def.size.length === 2 && def.size.every((n) => isIntIn(n, 1, MAX_MODULE_SIZE));
    if (!sizeOk) {
      fail(where, `size must be [width, height] in cells, each from 1 to ${MAX_MODULE_SIZE}`);
    } else {
      checkDoors(def, where, fail);
      if (isIntIn(tilesPerCell, 1, 8) && tiles) checkInterior(def, tilesPerCell, tiles, where, fail);
    }
    checkStats(def.stats, where, fail);
    if (!Array.isArray(def.tags)) {
      fail(where, 'tags must be a list');
    } else {
      for (const tag of def.tags) {
        if (!KNOWN_TAGS.includes(tag)) fail(where, `unknown tag "${tag}"`);
      }
      if (new Set(def.tags).size !== def.tags.length) fail(where, 'tags has duplicates');
    }
  });
  for (const tag of REQUIRED_TAGS) {
    if (!modules.some((def) => Array.isArray(def.tags) && def.tags.includes(tag))) {
      fail('modules.json', `no module is tagged "${tag}", which the flight checklist needs`);
    }
  }
  return problems;
}

function checkDoors(def, where, fail) {
  if (!Array.isArray(def.doors) || def.doors.length === 0) {
    fail(where, 'doors must list at least one socket');
    return;
  }
  const [w, h] = def.size;
  const seen = new Set();
  def.doors.forEach((door, i) => {
    if (!SIDES.includes(door?.side)) {
      fail(where, `door #${i}: side must be one of n, e, s, w`);
      return;
    }
    const length = door.side === 'n' || door.side === 's' ? w : h;
    if (!isIntIn(door.at, 0, length - 1)) {
      fail(where, `door #${i}: "at" must be from 0 to ${length - 1} on side ${door.side}`);
      return;
    }
    const key = `${door.side}${door.at}`;
    if (seen.has(key)) fail(where, `door #${i}: duplicate socket ${door.side} ${door.at}`);
    seen.add(key);
  });
}

function checkInterior(def, tilesPerCell, tiles, where, fail) {
  const [w, h] = def.size;
  const rows = h * tilesPerCell;
  const cols = w * tilesPerCell;
  if (!Array.isArray(def.interior) || def.interior.length !== rows) {
    fail(where, `interior must have ${rows} rows of tiles`);
    return;
  }
  def.interior.forEach((row, y) => {
    if (typeof row !== 'string' || [...row].length !== cols) {
      fail(where, `interior row ${y} must be ${cols} tiles wide`);
      return;
    }
    for (const char of row) {
      if (!(char in tiles)) fail(where, `interior row ${y}: "${char}" is not in the tiles legend`);
    }
  });
}

// A frame's shape: one row per cell row, '#' for hull and '.' for space,
// and every hull cell reachable from every other through hull cells (a ship
// in two pieces can't be joined to its bridge).
function checkShape(frame, where, fail) {
  const { shape, width, height } = frame;
  if (!Array.isArray(shape) || shape.length !== height) {
    fail(where, `shape must be a list of ${height} rows`);
    return;
  }
  const cells = [];
  for (const [y, row] of shape.entries()) {
    if (typeof row !== 'string' || row.length !== width || /[^#.]/.test(row)) {
      fail(where, `shape row ${y} must be ${width} characters of "#" (hull) and "." (space)`);
      return;
    }
    for (let x = 0; x < width; x++) if (row[x] === '#') cells.push(`${x},${y}`);
  }
  if (!cells.length) {
    fail(where, 'shape has no hull cells');
    return;
  }
  const hull = new Set(cells);
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.pop().split(',').map(Number);
    for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
      if (hull.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  if (seen.size !== hull.size) fail(where, 'shape must be one piece: every "#" joined to the rest by its sides');
}

function checkStats(stats, where, fail) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    fail(where, 'stats must be an object');
    return;
  }
  for (const key of Object.keys(stats)) {
    if (!STATS.includes(key)) fail(where, `unknown stat "${key}"`);
  }
  for (const key of STATS) {
    const min = key === 'power' ? -Infinity : key === 'hp' ? 1 : 0;
    if (!isIntIn(stats[key], min, Infinity)) {
      fail(where, `stats.${key} must be a whole number${min === -Infinity ? '' : `, ${min} or more`}`);
    }
  }
}

function listOf(file, key, where, fail) {
  const list = file?.[key];
  if (!Array.isArray(list)) {
    fail(where, `"${key}" must be a list`);
    return [];
  }
  return list.filter((item, i) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) return true;
    fail(where, `${key} #${i} must be an object`);
    return false;
  });
}

function uniqueIds(items, where, fail) {
  const ids = new Set();
  items.forEach((item, i) => {
    if (typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id)) {
      fail(where, `#${i}: id must be lowercase letters, digits and dashes`);
    } else if (ids.has(item.id)) {
      fail(where, `duplicate id "${item.id}"`);
    } else {
      ids.add(item.id);
    }
  });
  return ids;
}

function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIntIn(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let data;
  try {
    data = readData();
  } catch (err) {
    console.error(`validate-data: ${err.message}`);
    process.exit(1);
  }
  const problems = validateData(data);
  if (problems.length) {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`validate-data: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    process.exit(1);
  }
  const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  console.log(
    `validate-data: OK (${count(data.modules.modules.length, 'module')}, ${count(data.frames.frames.length, 'frame')}, ` +
      `${count(data.manufacturers.manufacturers.length, 'manufacturer')})`,
  );
}
