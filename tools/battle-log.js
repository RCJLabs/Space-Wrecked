#!/usr/bin/env node
// Plays a battle on the example ship's map with a scripted player on both
// sides, and prints its log: every event, in words (src/sim/battleLog.js).
//
//   node tools/battle-log.js            the example battle
//   node tools/battle-log.js --seed 42  the same crew and boarders, rolled
//                                       from another seed
//   node tools/battle-log.js --golden   rewrites tests/fixtures/example-battle.json
//                                       (setup and actions) and
//                                       tests/golden/example-battle.txt (its log)
//
// The scripted player (src/sim/scripted.js) is plain on purpose: it is not
// the enemy AI (M9). The golden battle pins the rules: only rewrite it on
// purpose, and say so in PROGRESS.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describeEvent } from '../src/sim/battleLog.js';
import { buildShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { playScripted } from '../src/sim/scripted.js';
import { EXAMPLE_SCRIPT } from './build-ship.js';
import { readData } from './data.js';

export const BATTLE_FIXTURE = fileURLToPath(new URL('../tests/fixtures/example-battle.json', import.meta.url));
export const GOLDEN_BATTLE = fileURLToPath(new URL('../tests/golden/example-battle.txt', import.meta.url));

// The example battle: three crew on the example ship's bridge, and three
// boarders come in through its airlock.
export const EXAMPLE_BATTLE = {
  seed: 'example battle',
  units: [
    { kind: 'marine', x: 9, y: 2 },
    { kind: 'engineer', x: 9, y: 3 },
    { kind: 'medic', x: 10, y: 3 },
    { kind: 'pirate', x: 5, y: 4 },
    { kind: 'pirate', x: 6, y: 4 },
    { kind: 'brute', x: 4, y: 4 },
  ],
};

// The example ship's battle map (tests/fixtures/example-ship.json).
export function exampleShipMap(rules) {
  const { placements } = JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8'));
  return mapFromShip(buildShip(rules, 'starter', placements).ship, rules);
}

// A battle's setup and actions as JSON, one unit or action a line.
function fixtureText({ seed, units, actions }) {
  const list = (items) => `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`;
  return `{\n  "seed": ${JSON.stringify(seed)},\n  "units": ${list(units)},\n  "actions": ${list(actions)}\n}\n`;
}

// A battle's log as text: one event a line.
export function logText(events, battle) {
  return `${events.map((event) => describeEvent(event, battle)).join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const rules = indexDefs(readData());
  // A seed of digits is a number, as the tests pass it; anything else is a string.
  const seedAt = args.indexOf('--seed');
  const raw = seedAt >= 0 ? args[seedAt + 1] : null;
  const setup = { ...EXAMPLE_BATTLE, ...(raw !== null && { seed: /^\d+$/.test(raw) ? Number(raw) : raw }) };
  const { battle, actions, events } = playScripted({ ...setup, map: exampleShipMap(rules) }, rules);
  if (args.includes('--golden')) {
    writeFileSync(BATTLE_FIXTURE, fixtureText({ ...EXAMPLE_BATTLE, actions }));
    writeFileSync(GOLDEN_BATTLE, logText(events, battle));
    console.log(`Wrote ${BATTLE_FIXTURE} and ${GOLDEN_BATTLE}: ${actions.length} actions, ${events.length} events.`);
  } else {
    process.stdout.write(logText(events, battle));
    console.log(`${actions.length} actions over ${battle.round} rounds; ${battle.winner ? `${battle.winner} won` : 'no winner yet'}.`);
  }
}
