#!/usr/bin/env node
// Builds a ship from a script: a JSON file listing placements in order, the
// same commands the builder issues. Prints the layout and every placement
// rule it breaks. Exits 1 if a placement is rejected or the layout has
// problems.
//
//   node tools/build-ship.js [script.json]
//
// A script is { "frame": "starter", "placements": [{ "type", "x", "y", "rot" }] }.
// The default script is tests/fixtures/example-ship.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cellAt } from '../src/sim/grid.js';
import { buildShip, layoutProblems, occupancy } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { readData } from './data.js';

export const EXAMPLE_SCRIPT = fileURLToPath(new URL('../tests/fixtures/example-ship.json', import.meta.url));

// One glyph per cell, "." for empty, one row per line.
export function renderShip(ship, defs) {
  const grid = occupancy(ship, defs);
  const glyphs = new Map(ship.modules.map((m) => [m.uid, defs.modules.get(m.type)?.glyph ?? '?']));
  const rows = [];
  for (let y = 0; y < grid.height; y++) {
    let row = '';
    for (let x = 0; x < grid.width; x++) {
      const uid = cellAt(grid, x, y);
      row += uid === null ? '.' : glyphs.get(uid);
    }
    rows.push(row);
  }
  return rows.join('\n');
}

export function runScript(script, defs) {
  const { ship, rejected } = buildShip(defs, script.frame, script.placements);
  return { ship, rejected, problems: layoutProblems(ship, defs) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? EXAMPLE_SCRIPT;
  const defs = indexDefs(readData());
  const script = JSON.parse(readFileSync(path, 'utf8'));
  const { ship, rejected, problems } = runScript(script, defs);
  for (const r of rejected) {
    console.log(`rejected #${r.index} ${r.placement.type} at (${r.placement.x}, ${r.placement.y}): ${r.message}`);
  }
  console.log(renderShip(ship, defs));
  console.log(`${ship.modules.length} modules on the ${defs.frames.get(ship.frame).name}`);
  for (const p of problems) console.log(`problem (${p.rule}): ${p.message}`);
  if (!rejected.length && !problems.length) console.log('All placement rules pass.');
  process.exit(rejected.length || problems.length ? 1 : 0);
}
