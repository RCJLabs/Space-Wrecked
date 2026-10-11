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
// The scripted player is plain on purpose, for tests and this tool: it is
// not the enemy AI (M9). The golden battle pins the rules: only rewrite it
// on purpose, and say so in PROGRESS.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { act, createBattle, targetsFor } from '../src/sim/battle.js';
import { describeEvent } from '../src/sim/battleLog.js';
import { buildShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { SIDES, step } from '../src/sim/grid.js';
import { edgeKey, mapFromShip, wallAt } from '../src/sim/mapFromShip.js';
import { reachable } from '../src/sim/moves.js';
import { walkable } from '../src/sim/terrain.js';
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

// The scripted player's next action, for whichever side's turn it is. The
// first unit of that side with an action left: if it can see an enemy, it
// reloads if empty, or shoots the one it is likeliest to hit (then the one
// with the fewest hit points, then the first listed). If it can't, it steps
// as near an enemy as one action takes it, by walking distance. With
// nowhere nearer, it opens a closed door beside it, or else goes on
// overwatch (or reloads). With no one left to act, the turn ends.
export function scriptedAction(battle, rules) {
  const unit = battle.units.find((u) => u.side === battle.side && u.status === 'active' && u.ap > 0);
  if (!unit) return { type: 'end' };
  const targets = targetsFor(battle, unit, rules);
  if (targets.length) {
    if (unit.ammo < 1) return { type: 'reload', unit: unit.id };
    targets.sort((a, b) => b.odds.hit - a.odds.hit || a.target.hp - b.target.hp);
    return { type: 'shoot', unit: unit.id, target: targets[0].target.id };
  }
  const away = walkingDistance(battle, battle.units.filter((u) => u.side !== unit.side && u.status === 'active'), rules);
  let best = { d: away.get(`${unit.x},${unit.y}`) ?? Infinity, cost: 0, x: unit.x, y: unit.y };
  for (const spot of reachable(battle, unit, unit.mobility, rules).values()) {
    const d = away.get(`${spot.x},${spot.y}`) ?? Infinity;
    if (d < best.d || (d === best.d && spot.cost < best.cost)) best = { d, cost: spot.cost, x: spot.x, y: spot.y };
  }
  if (best.x !== unit.x || best.y !== unit.y) return { type: 'move', unit: unit.id, to: [best.x, best.y] };
  const door = SIDES.find((side) => wallAt(battle.map, unit.x, unit.y, side) === 'door' && !battle.doors.includes(edgeKey(unit.x, unit.y, side)));
  if (door) return { type: 'open', unit: unit.id, side: door };
  return unit.ammo < 1 ? { type: 'reload', unit: unit.id } : { type: 'overwatch', unit: unit.id };
}

// Steps from the nearest of `from` (units) to every tile, walking through
// doors and past anyone: a Map from "x,y" to steps.
function walkingDistance(battle, from, rules) {
  const away = new Map(from.map((u) => [`${u.x},${u.y}`, 0]));
  const queue = from.map((u) => [u.x, u.y]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const side of SIDES) {
      const edge = wallAt(battle.map, x, y, side);
      if (edge && edge !== 'door') continue;
      const [nx, ny] = step(x, y, side);
      if (!walkable(battle, nx, ny, rules) || away.has(`${nx},${ny}`)) continue;
      away.set(`${nx},${ny}`, away.get(`${x},${y}`) + 1);
      queue.push([nx, ny]);
    }
  }
  return away;
}

// Plays a battle with the scripted player on both sides until it ends, or
// until maxRounds have passed. Returns { battle, actions, events }.
export function playScripted(setup, rules, { maxRounds = 30 } = {}) {
  let { battle, events } = createBattle(setup, rules);
  events = [...events];
  const actions = [];
  while (!battle.winner && battle.round <= maxRounds) {
    const action = scriptedAction(battle, rules);
    const result = act(battle, action, rules);
    if (!result.ok) throw new Error(`The scripted player tried ${JSON.stringify(action)}: ${result.error}`);
    actions.push(action);
    events.push(...result.events);
    battle = result.battle;
  }
  return { battle, actions, events };
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
