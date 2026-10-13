#!/usr/bin/env node
// Prints act 2's sectors (src/sim/gen/sector.js).
//
//   node tools/sectors.js             the sector at seed 1
//   node tools/sectors.js --seed 7    another seed
//   node tools/sectors.js --golden    rewrites tests/golden/sectors.txt
//
// The golden file is the first sector at seeds 1 to 3. Only rewrite it on
// purpose, and say so in PROGRESS.md.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { indexDefs } from '../src/sim/defs.js';
import { generateSector } from '../src/sim/gen/sector.js';
import { readData } from './data.js';

export const GOLDEN_SECTORS = fileURLToPath(new URL('../tests/golden/sectors.txt', import.meta.url));
export const GOLDEN_SEEDS = [1, 2, 3];
// A node on the drawn map: its id and its kind's mark.
const MARKS = { start: 'S', exit: 'E', station: '$', empty: 'o', derelict: 'd', distress: '!', trader: 't', hazard: 'x', hostile: 'h' };
const ROWS = 3; // the map's lines: a column of one sits on the middle one

// A sector as text: the map, column by column (three lines; a column of two
// uses the top and bottom one), its links, and its nodes by name, with
// their events and hostile ships (preset and seed).
export function sectorText(sector, label = '') {
  const columns = Math.max(...sector.nodes.map((node) => node.col)) + 1;
  const lines = Array.from({ length: ROWS }, () => []);
  for (let col = 0; col < columns; col++) {
    const here = sector.nodes.filter((node) => node.col === col);
    const rows = here.length === 1 ? [1] : here.length === 2 ? [0, 2] : [0, 1, 2];
    for (let line = 0; line < ROWS; line++) {
      const node = here[rows.indexOf(line)];
      lines[line].push((node ? `${node.id}${MARKS[node.type] ?? '?'}` : '.').padStart(4));
    }
  }
  return [
    `Sector ${sector.index}: ${sector.name}${label}, ${sector.nodes.length} nodes, ${sector.links.length} links`,
    ...lines.map((cells) => cells.join('')),
    `links: ${sector.links.map(([a, b]) => `${a}-${b}`).join(' ')}`,
    ...sector.nodes.map((node) => `  ${node.id} ${node.name} (${node.type}${node.event ? `: ${node.event}` : ''}${node.hostile ? `: ${node.hostile.ship} ${node.hostile.seed}` : ''}) at ${node.x}, ${node.y}`),
  ].join('\n');
}

export function goldenText(defs) {
  return GOLDEN_SEEDS.map((seed) => sectorText(generateSector(defs, seed, 1), ` (seed ${seed})`)).join('\n\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const defs = indexDefs(readData());
  if (args.includes('--golden')) {
    writeFileSync(GOLDEN_SECTORS, `${goldenText(defs)}\n`);
    console.log(`Wrote ${GOLDEN_SECTORS}`);
  } else {
    const at = args.indexOf('--seed');
    const seed = at >= 0 ? Number(args[at + 1]) : 1;
    console.log(sectorText(generateSector(defs, seed, 1), ` (seed ${seed})`));
  }
}
