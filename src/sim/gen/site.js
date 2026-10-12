// Planet maps, v1 (ROADMAP §4.7): the battle map of a job's site, from a
// hand-drawn template (data/sites.json) and a seed. A template is drawn in
// the battle map text format (mapText.js), with marks of its own on the
// tiles (SITE_CHARS):
//   e  where the crew comes in          s  where an enemy may start
//   *  a crate a job can tag            k  a terminal
//   ?  maybe a prop: a crate, a container or nothing
//   !  where a hazard patch can lie (a twist's fire or rubble)
//   %  rock: ground nobody crosses
// and walls ('|', '-') and doors ('/') on the edges. A map is its template
// turned over left to right or top to bottom or neither, its props rolled
// and its hazard patches laid. Pure and seeded: the same template, seed and
// hazard always give the same map. The map has mapFromShip.js's shape,
// with no space around it (margin 0) and its template's id (site).
import { int, seedFrom, shuffle } from '../../core/rng.js';
import { cellAt, createGrid, inBounds, step } from '../grid.js';
import { wallAt } from '../mapFromShip.js';
import { flipMapText, readMapText } from '../mapText.js';
import { besideClear } from '../terrain.js';

export const SITE_CHARS = {
  '.': { tile: 'floor' },
  h: { tile: 'half cover' },
  H: { tile: 'full cover' },
  '#': { tile: 'machinery' },
  c: { tile: 'console' },
  '%': { tile: 'rock' },
  e: { tile: 'floor', mark: 'entry' },
  s: { tile: 'floor', mark: 'spawn' },
  '*': { tile: 'half cover', mark: 'loot' },
  k: { tile: 'console', mark: 'terminal' },
  '?': { tile: 'floor', mark: 'prop' },
  '!': { tile: 'floor', mark: 'hazard' },
};
// What a template needs at the least: room for a squad of five, an
// encounter grown by a twist, three crates to tag, a terminal and two
// hazard patches.
export const SITE_NEEDS = { entry: 5, spawn: 6, loot: 3, terminal: 1, hazard: 2 };
export const SITE_SIZE = { width: [8, 24], height: [5, 16] };
export const HAZARDS = ['fire', 'rubble'];
// A prop slot rolls out of 100: below the first a crate, below the second
// a container, else nothing.
const PROP_ROLLS = [[35, 'half cover'], [50, 'full cover']];
const SITE_EDGES = new Set(['wall', 'door']);
const SIDES = ['n', 'e', 's', 'w'];

// template: { id, rows } from data/sites.json; seed: a number or string.
// hazard: null, 'fire' or 'rubble', laid in `patches` patches. Returns
// { map, zones: { entry, spawn, loot, terminal }, flip, rng }: each zone a
// list of [x, y] tiles in reading order, how the template was turned, and
// the RNG state after, for whatever is rolled next on the map.
export function generateSite(template, seed, { hazard = null, patches = 0 } = {}) {
  let rng = seedFrom(seed);
  const roll = (min, max) => {
    const r = int(rng, min, max);
    rng = r.state;
    return r.value;
  };
  const flip = { x: roll(0, 1) === 1, y: roll(0, 1) === 1 };
  const { width, height, chars, walls } = readMapText(flipMapText(template.rows, flip));
  const tiles = createGrid(width, height, 'floor');
  const zones = { entry: [], spawn: [], loot: [], terminal: [], prop: [], hazard: [] };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const kind = SITE_CHARS[cellAt(chars, x, y)];
      if (!kind) throw new Error(`generateSite: "${cellAt(chars, x, y)}" at (${x}, ${y}) of ${template.id} is no site tile`);
      tiles.cells[y * width + x] = kind.tile;
      if (kind.mark) zones[kind.mark].push([x, y]);
    }
  }
  for (const [x, y] of zones.prop) {
    const r = roll(0, 99);
    tiles.cells[y * width + x] = PROP_ROLLS.find(([below]) => r < below)?.[1] ?? 'floor';
  }
  const hazards = createGrid(width, height, null);
  if (hazard && patches > 0) {
    const order = shuffle(rng, zones.hazard);
    rng = order.state;
    const keep = new Set([...zones.entry, ...zones.spawn].map(([x, y]) => `${x},${y}`));
    for (const [x, y] of order.value.slice(0, patches)) {
      for (const [px, py] of [[x, y], ...SIDES.filter((side) => !wallAt({ walls }, x, y, side)).map((side) => step(x, y, side))]) {
        if (inBounds(tiles, px, py) && cellAt(tiles, px, py) === 'floor' && !keep.has(`${px},${py}`)) hazards.cells[py * width + px] = hazard;
      }
    }
  }
  const map = {
    width,
    height,
    tilesPerCell: 1,
    origin: [0, 0],
    tiles,
    roomAt: regions(tiles, walls),
    hazards,
    walls,
    rooms: [],
    hatches: [],
    margin: 0,
    site: template.id,
  };
  const { entry, spawn, loot, terminal } = zones;
  return { map, zones: { entry, spawn, loot, terminal }, flip, rng };
}

// Each tile's area, for the floor's tint: the tiles that walls and doors
// close off from one another, numbered from 1 in reading order. Rock is in
// none.
function regions(tiles, walls) {
  const roomAt = createGrid(tiles.width, tiles.height, null);
  let next = 1;
  for (let y = 0; y < tiles.height; y++) {
    for (let x = 0; x < tiles.width; x++) {
      if (cellAt(roomAt, x, y) !== null || cellAt(tiles, x, y) === 'rock') continue;
      const id = next++;
      const queue = [[x, y]];
      roomAt.cells[y * tiles.width + x] = id;
      while (queue.length) {
        const [cx, cy] = queue.shift();
        for (const side of SIDES) {
          const [nx, ny] = step(cx, cy, side);
          if (!inBounds(tiles, nx, ny) || cellAt(roomAt, nx, ny) !== null || cellAt(tiles, nx, ny) === 'rock') continue;
          if (wallAt({ walls }, cx, cy, side)) continue;
          roomAt.cells[ny * tiles.width + nx] = id;
          queue.push([nx, ny]);
        }
      }
    }
  }
  return roomAt;
}

// What is wrong with a template, as phrases; empty means it makes good
// maps. Checked with every prop slot a crate, the worst case: every tile
// to stand on can be walked to from where the crew comes in, every crate
// and terminal has a tile beside it to be reached from, and there is room
// for everyone.
export function siteProblems(template) {
  let read;
  try {
    read = readMapText(template.rows);
  } catch (err) {
    return [err.message.replace('readMapText: ', '')];
  }
  const { width, height, chars, walls } = read;
  const problems = [];
  if (width < SITE_SIZE.width[0] || width > SITE_SIZE.width[1] || height < SITE_SIZE.height[0] || height > SITE_SIZE.height[1]) {
    problems.push(`${width} × ${height} tiles: it has to be ${SITE_SIZE.width.join(' to ')} across and ${SITE_SIZE.height.join(' to ')} down`);
  }
  for (const char of chars.cells) if (!SITE_CHARS[char]) problems.push(`"${char}" is no site tile`);
  const counts = countMarks(chars);
  for (const edge of [...walls.n.cells, ...walls.w.cells]) {
    if (edge !== null && !SITE_EDGES.has(edge)) problems.push(`a ${edge} on an edge: a site has only walls and doors`);
  }
  for (const [mark, least] of Object.entries(SITE_NEEDS)) {
    if (counts[mark] < least) problems.push(`${counts[mark]} ${mark} tiles: it needs ${least}`);
  }
  if (problems.length) return [...new Set(problems)];

  // On foot from the entry, with every prop slot a crate.
  const open = (x, y) => ['.', 'e', 's', '!'].includes(cellAt(chars, x, y));
  const seen = new Set();
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cellAt(chars, x, y) === 'e') {
        seen.add(`${x},${y}`);
        queue.push([x, y]);
      }
    }
  }
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const side of SIDES) {
      const [nx, ny] = step(x, y, side);
      if (!inBounds(chars, nx, ny) || seen.has(`${nx},${ny}`) || !open(nx, ny) || wallAt({ walls }, x, y, side) === 'wall') continue;
      seen.add(`${nx},${ny}`);
      queue.push([nx, ny]);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const char = cellAt(chars, x, y);
      if (open(x, y) && !seen.has(`${x},${y}`)) problems.push(`(${x}, ${y}) can't be walked to from where the crew comes in`);
      if ((char === '*' || char === 'k') && !reachedBeside(seen, walls, x, y)) problems.push(`the ${char === '*' ? 'crate' : 'terminal'} at (${x}, ${y}) can't be reached`);
    }
  }
  return problems;
}

// How many tiles a template has of each mark: { entry, spawn, loot,
// terminal, prop, hazard }. Throws on a malformed template.
export function siteMarks(template) {
  return countMarks(readMapText(template.rows).chars);
}

function countMarks(chars) {
  const counts = { entry: 0, spawn: 0, loot: 0, terminal: 0, prop: 0, hazard: 0 };
  for (const char of chars.cells) if (SITE_CHARS[char]?.mark) counts[SITE_CHARS[char].mark] += 1;
  return counts;
}

// True if a tile walked to is in reach of (x, y) (terrain.js inReach), with
// every door open.
function reachedBeside(seen, walls, x, y) {
  const open = (ax, ay, side) => wallAt({ walls }, ax, ay, side) !== 'wall';
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && seen.has(`${x + dx},${y + dy}`) && besideClear([x + dx, y + dy], [x, y], open)) return true;
    }
  }
  return false;
}
