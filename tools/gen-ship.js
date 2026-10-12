#!/usr/bin/env node
// Generates ships from the presets in data/ships.json (src/sim/gen/ship.js)
// and prints them: the layout, one glyph a cell (tools/build-ship.js), the
// parts in the order they went in, the wrecked rooms and the flight
// checklist.
//
//   node tools/gen-ship.js                    every preset, seed 1
//   node tools/gen-ship.js hauler --seed 7    one preset, another seed
//   node tools/gen-ship.js --check 100        seeds 1 to 100 of every preset
//                                             (or the one named): every ship
//                                             has to pass the checklist
//   node tools/gen-ship.js --golden           rewrites tests/golden/ships.txt
//
// The golden file is every preset at seeds 1 to 3: only rewrite it on
// purpose, and say so in PROGRESS.md.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { layoutProblems } from '../src/sim/builder.js';
import { canLaunch, flightChecklist } from '../src/sim/constraints.js';
import { indexDefs } from '../src/sim/defs.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { renderShip } from './build-ship.js';
import { readData } from './data.js';

export const GOLDEN_SHIPS = fileURLToPath(new URL('../tests/golden/ships.txt', import.meta.url));
export const GOLDEN_SEEDS = [1, 2, 3];

// A generated ship as text: what it is, its layout, its parts in build order
// and its wrecks. A preset that can't be built gives its error instead.
export function shipText(defs, presetId, seed) {
  const result = generateShip(defs, presetId, seed);
  const name = defs.ships.get(presetId)?.name ?? presetId;
  if (!result.ok) return `${name}, seed ${seed}: ${result.error}\n`;
  const { ship, crew, wrecked } = result;
  const rows = renderShip(ship, defs).split('\n');
  const parts = ship.modules.map((m) => `  ${m.uid} ${m.type} at (${m.x}, ${m.y}), turned ${m.rot}`);
  const wrecks = Object.entries(wrecked).map(([uid, wreck]) => `${uid} ${wreck}`);
  return [
    `${name}, seed ${seed}: ${ship.modules.length} parts, ${rows[0].length} × ${rows.length} cells, crew ${crew}`,
    ...rows,
    ...parts,
    `Wrecked: ${wrecks.length ? wrecks.join(', ') : 'none'}`,
    '',
  ].join('\n');
}

// Every preset at the golden seeds.
export function goldenText(defs) {
  return [...defs.ships.keys()].flatMap((id) => GOLDEN_SEEDS.map((seed) => shipText(defs, id, seed))).join('\n');
}

// Seeds 1 to count of each preset: how many pass the flight checklist, and
// their sizes. Returns { lines, failed }.
export function check(defs, ids, count) {
  const lines = [];
  let failed = 0;
  for (const id of ids) {
    const started = performance.now();
    const sizes = { w: [], h: [], parts: [] };
    let passed = 0;
    for (let seed = 1; seed <= count; seed++) {
      const result = generateShip(defs, id, seed);
      if (!result.ok || layoutProblems(result.ship, defs).length || !canLaunch(flightChecklist(result.ship, defs, result.crew))) {
        failed++;
        lines.push(`  seed ${seed} fails: ${result.ok ? 'the flight checklist' : result.error}`);
        continue;
      }
      passed++;
      const rows = renderShip(result.ship, defs).split('\n');
      sizes.w.push(rows[0].length);
      sizes.h.push(rows.length);
      sizes.parts.push(result.ship.modules.length);
    }
    const span = (list) => (list.length ? `${Math.min(...list)} to ${Math.max(...list)}` : 'none');
    const ms = Math.round(performance.now() - started);
    lines.push(`${defs.ships.get(id).name}: ${passed} of ${count} pass the flight checklist; ${span(sizes.w)} cells long, ${span(sizes.h)} across, ${span(sizes.parts)} parts (${ms} ms)`);
  }
  return { lines, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const defs = indexDefs(readData());
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const named = args.find((arg, i) => !arg.startsWith('--') && !['--seed', '--check'].includes(args[i - 1]));
  if (named && !defs.ships.has(named)) {
    console.error(`gen-ship: no preset "${named}" (presets: ${[...defs.ships.keys()].join(', ')}).`);
    process.exit(1);
  }
  const ids = named ? [named] : [...defs.ships.keys()];
  if (args.includes('--golden')) {
    writeFileSync(GOLDEN_SHIPS, goldenText(defs));
    console.log(`Wrote ${GOLDEN_SHIPS}: ${defs.ships.size} presets at seeds ${GOLDEN_SEEDS.join(', ')}.`);
  } else if (args.includes('--check')) {
    const { lines, failed } = check(defs, ids, Number(valueOf('--check')) || 100);
    console.log(lines.join('\n'));
    process.exit(failed ? 1 : 0);
  } else {
    // A seed of digits is a number; anything else is a string.
    const raw = valueOf('--seed') ?? '1';
    const seed = /^\d+$/.test(raw) ? Number(raw) : raw;
    for (const id of ids) {
      console.log(shipText(defs, id, seed));
      const result = generateShip(defs, id, seed);
      if (!result.ok) continue;
      for (const line of flightChecklist(result.ship, defs, result.crew)) {
        console.log(`  ${line.ok === true ? 'ok  ' : line.ok === false ? 'FAIL' : 'wait'} ${line.text}${line.fix ? `  ->  ${line.fix}` : ''}`);
      }
      console.log('');
    }
  }
}
