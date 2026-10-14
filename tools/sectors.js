#!/usr/bin/env node
// Prints act 2's sectors (src/sim/gen/sector.js), and the system past the
// charts (src/sim/gen/system.js, M25).
//
//   node tools/sectors.js             the sector at seed 1
//   node tools/sectors.js --seed 7    another seed
//   node tools/sectors.js --system    the system past the charts instead
//   node tools/sectors.js --golden    rewrites tests/golden/sectors.txt and
//                                     tests/golden/systems.txt
//
// The golden files are the first sector, and the system, at seeds 1 to 3.
// Only rewrite them on purpose, and say so in PROGRESS.md.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { indexDefs } from '../src/sim/defs.js';
import { generateSector } from '../src/sim/gen/sector.js';
import { generateSystem, RATINGS } from '../src/sim/gen/system.js';
import { readData } from './data.js';

export const GOLDEN_SECTORS = fileURLToPath(new URL('../tests/golden/sectors.txt', import.meta.url));
export const GOLDEN_SYSTEMS = fileURLToPath(new URL('../tests/golden/systems.txt', import.meta.url));
export const GOLDEN_SEEDS = [1, 2, 3];
// A node on the drawn map: its id and its kind's mark.
const MARKS = { start: 'S', exit: 'E', station: '$', nebula: 'n', empty: 'o', derelict: 'd', distress: '!', trader: 't', hazard: 'x', hostile: 'h', world: 'w' };
const ROWS = 3; // the map's lines, at least: a column of one sits on the middle one

// A sector as text: the map, column by column (three lines, or as many as
// the tallest column; a column of two uses the top and bottom one), its
// links, and its nodes by name, with their events, hostile ships (preset
// and seed) and worlds (kind, numbers and lanes).
export function sectorText(sector, label = '') {
  const columns = Math.max(...sector.nodes.map((node) => node.col)) + 1;
  const tall = Math.max(ROWS, ...Array.from({ length: columns }, (_, col) => sector.nodes.filter((node) => node.col === col).length));
  const lines = Array.from({ length: tall }, () => []);
  for (let col = 0; col < columns; col++) {
    const here = sector.nodes.filter((node) => node.col === col);
    const rows = here.length === 1 ? [Math.floor((tall - 1) / 2)] : here.map((_, i) => Math.round((i * (tall - 1)) / (here.length - 1)));
    for (let line = 0; line < tall; line++) {
      const node = here[rows.indexOf(line)];
      lines[line].push((node ? `${node.id}${MARKS[node.type] ?? '?'}` : '.').padStart(4));
    }
  }
  return [
    `${sector.system ? 'System' : 'Sector'} ${sector.index}: ${sector.name}${label}, ${sector.nodes.length} nodes, ${sector.links.length} links`,
    ...lines.map((cells) => cells.join('')),
    `links: ${sector.links.map(([a, b]) => `${a}-${b}`).join(' ')}`,
    ...sector.nodes.map((node) => `  ${node.id} ${node.name} (${node.type}${node.event ? `: ${node.event}` : ''}${node.hostile ? `: ${node.hostile.ship} ${node.hostile.seed}` : ''}${node.world ? `: ${worldText(node.world)}` : ''}) at ${node.x}, ${node.y}`),
  ].join('\n');
}

// "ocean, soil 1 water 3 ore 0 danger 2, lanes 1"
function worldText(world) {
  return `${world.kind}, ${RATINGS.map((rating) => `${rating} ${world[rating]}`).join(' ')}, lanes ${world.lanes}`;
}

// The system past the charts comes after act 2's last sector.
const systemIndex = (defs) => (defs.acts.get(2)?.sectors ?? 0) + 1;

export function goldenText(defs) {
  return GOLDEN_SEEDS.map((seed) => sectorText(generateSector(defs, seed, 1), ` (seed ${seed})`)).join('\n\n');
}

export function systemsText(defs) {
  return GOLDEN_SEEDS.map((seed) => sectorText(generateSystem(defs, seed, systemIndex(defs)), ` (seed ${seed})`)).join('\n\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const defs = indexDefs(readData());
  if (args.includes('--golden')) {
    writeFileSync(GOLDEN_SECTORS, `${goldenText(defs)}\n`);
    writeFileSync(GOLDEN_SYSTEMS, `${systemsText(defs)}\n`);
    console.log(`Wrote ${GOLDEN_SECTORS} and ${GOLDEN_SYSTEMS}`);
  } else {
    const at = args.indexOf('--seed');
    const seed = at >= 0 ? Number(args[at + 1]) : 1;
    const map = args.includes('--system') ? generateSystem(defs, seed, systemIndex(defs)) : generateSector(defs, seed, 1);
    console.log(sectorText(map, ` (seed ${seed})`));
  }
}
