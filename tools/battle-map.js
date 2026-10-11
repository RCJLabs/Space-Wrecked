#!/usr/bin/env node
// Prints a ship's battle map (src/sim/mapFromShip.js) as text: tiles, the
// walls between them, doorways and hatches, and the wrecked rooms' hazards.
//
//   node tools/battle-map.js [script.json] [uid=fire|vacuum|rubble ...]
//   node tools/battle-map.js --golden    rewrites tests/golden/example-ship.map.txt
//
// A script is what tools/build-ship.js takes; the default is the example
// ship. The golden file is the example ship's map: only rewrite it on
// purpose, and say so in PROGRESS.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cellAt, createGrid } from '../src/sim/grid.js';
import { mapFromShip, wallAt } from '../src/sim/mapFromShip.js';
import { indexDefs } from '../src/sim/defs.js';
import { EXAMPLE_SCRIPT, runScript } from './build-ship.js';
import { readData } from './data.js';

export const GOLDEN_MAP = fileURLToPath(new URL('../tests/golden/example-ship.map.txt', import.meta.url));

// Edges, by what stands there: [on a north edge, on a west edge].
const EDGES = { wall: ['-', '|'], hull: ['=', 'I'], door: ['/', '/'], hatch: ['o', 'o'] };
const HAZARDS = { fire: 'F', vacuum: 'V', rubble: 'R' };

// The map as text, two characters a tile each way: tiles at odd places,
// edges between them and '+' where edges meet. A tile is its character in
// the tiles legend (data/modules.json), ' ' for space and '%' for hull. A
// second block shows hazards when a room is wrecked: F fire, V vacuum,
// R rubble, '.' for a room tile without one.
export function renderMap(map, legend) {
  const chars = { space: ' ', hull: '%', ...Object.fromEntries(Object.entries(legend).map(([char, name]) => [name, char])) };
  const lines = [];
  for (let y = 0; y <= map.height; y++) {
    let edges = '';
    let tiles = '';
    for (let x = 0; x <= map.width; x++) {
      const meets = [wallAt(map, x - 1, y, 'n'), wallAt(map, x, y, 'n'), wallAt(map, x, y - 1, 'w'), wallAt(map, x, y, 'w')];
      edges += meets.some(Boolean) ? '+' : ' ';
      if (x < map.width) edges += EDGES[wallAt(map, x, y, 'n')]?.[0] ?? ' ';
      if (y < map.height) {
        tiles += EDGES[wallAt(map, x, y, 'w')]?.[1] ?? ' ';
        if (x < map.width) tiles += chars[cellAt(map.tiles, x, y)] ?? '?';
      }
    }
    lines.push(edges.trimEnd());
    if (y < map.height) lines.push(tiles.trimEnd());
  }
  if (map.hazards.cells.some(Boolean)) {
    lines.push('');
    for (let y = 0; y < map.height; y++) {
      let row = '';
      for (let x = 0; x < map.width; x++) {
        const hazard = cellAt(map.hazards, x, y);
        row += hazard ? HAZARDS[hazard] : cellAt(map.roomAt, x, y) === null ? ' ' : '.';
      }
      lines.push(row.trimEnd());
    }
  }
  return `${lines.join('\n')}\n`;
}

const EDGE_NAMES = { '-': 'wall', '|': 'wall', '=': 'hull', I: 'hull', '/': 'door', o: 'hatch' };

// A map from text in renderMap's format, so tests can draw their own: tiles
// and edges only. The text starts with the first row of edges and ends with
// the last, and a final newline is ignored. Every tile that isn't space or
// hull is room 1, nothing is wrecked, and each hatch opens from its room's
// side. Trailing spaces can be left off, so give the width when the last
// column is bare space.
export function parseMap(text, legend, { width } = {}) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const height = (lines.length - 1) / 2;
  if (!Number.isInteger(height) || height < 1) throw new Error(`parseMap: expected 2 × height + 1 lines, got ${lines.length}`);
  width ??= Math.max(...lines.map((line) => Math.floor(line.length / 2)));
  const names = { ' ': 'space', '%': 'hull', ...legend };
  const at = (row, col) => lines[row][col] ?? ' ';
  const grid = (fill) => createGrid(width, height, fill);
  const [tiles, roomAt, hazards] = [grid('space'), grid(null), grid(null)];
  const walls = { n: grid(null), w: grid(null) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = y * width + x;
      const char = at(2 * y + 1, 2 * x + 1);
      if (!(char in names)) throw new Error(`parseMap: no tile for "${char}" at (${x}, ${y})`);
      tiles.cells[k] = names[char];
      if (names[char] !== 'space' && names[char] !== 'hull') roomAt.cells[k] = 1;
      walls.n.cells[k] = EDGE_NAMES[at(2 * y, 2 * x + 1)] ?? null;
      walls.w.cells[k] = EDGE_NAMES[at(2 * y + 1, 2 * x)] ?? null;
    }
  }
  const map = { width, height, tilesPerCell: 1, origin: [0, 0], tiles, roomAt, hazards, walls, rooms: [], hatches: [] };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const side of ['n', 'e', 's', 'w']) {
        if (wallAt(map, x, y, side) === 'hatch' && cellAt(roomAt, x, y) !== null) map.hatches.push({ uid: 1, x, y, side });
      }
    }
  }
  return map;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const defs = indexDefs(readData());
  if (args.includes('--golden')) {
    const { ship } = runScript(JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8')), defs);
    writeFileSync(GOLDEN_MAP, renderMap(mapFromShip(ship, defs), defs.tiles));
    console.log(`Wrote ${GOLDEN_MAP}`);
    process.exit(0);
  }
  const path = args.find((arg) => arg.endsWith('.json')) ?? EXAMPLE_SCRIPT;
  const wrecked = Object.fromEntries(args.filter((arg) => arg.includes('=')).map((arg) => arg.split('=')));
  const { ship, rejected } = runScript(JSON.parse(readFileSync(path, 'utf8')), defs);
  for (const r of rejected) console.log(`rejected #${r.index} ${r.placement.type}: ${r.message}`);
  const map = mapFromShip(ship, defs, { wrecked });
  if (!map) {
    console.log('An empty ship has no map.');
    process.exit(1);
  }
  process.stdout.write(renderMap(map, defs.tiles));
  console.log(`${map.width} × ${map.height} tiles; yard cell (${map.origin.join(', ')}) at the top left.`);
  console.log('Edges: - | wall, = I hull, / door, o hatch. Tiles: % hull, blank space, the rest from the tiles legend:');
  console.log(`  ${Object.entries(defs.tiles).map(([char, name]) => `${char} ${name}`).join(', ')}`);
  for (const room of map.rooms) {
    console.log(`  room ${room.uid} ${room.type} at (${room.x}, ${room.y}), ${room.w} × ${room.h}${room.wreck ? `, ${room.wreck}` : ''}`);
  }
  for (const hatch of map.hatches) console.log(`  hatch of room ${hatch.uid} at (${hatch.x}, ${hatch.y}), ${hatch.side} side`);
}
