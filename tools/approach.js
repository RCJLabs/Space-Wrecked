// The approach phase's balance harness (ROADMAP §4.2): the launched start
// ship against each hostile preset, many times, with the test player giving
// its orders (tools/approachPlan.js) and the preset its tactics. It reports
// how the approaches end, and the same again with a weapon mount, a shield
// generator or an engine added to the start ship, each by itself: Law 1
// says every one of them should change how it goes.
//   node tools/approach.js              300 approaches a preset per ship
//   node tools/approach.js --runs 1000
//   node tools/approach.js --set gunDamage=12   (any balance number)
// Every approach is seeded: the enemy ship is preset seed 1 up, and its
// rolls are seeded by the same number, so a run is the same every time and
// each ship meets the same enemies on the same rolls.
import { pathToFileURL } from 'node:url';
import { seedFrom } from '../src/core/rng.js';
import { OUTCOMES, playRound } from '../src/sim/approach.js';
import { buildShip } from '../src/sim/builder.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { captainOrder } from './approachPlan.js';
import { readData } from './data.js';
import { fitPart } from './run.js';
import { rulesWith, setting } from './sim.js';

// What the start ship gets in act 1 to launch: the parts on hand at the
// start, and the three engines lifting off takes.
const LAUNCH_PARTS = ['quarters', 'lifesupport', 'engine', 'engine', 'engine'];
// The parts tried one at a time on the launched ship.
export const ADDED = ['weapon', 'shield', 'engine'];
// How an outcome counts for the player.
const WINS = ['boarded', 'destroyed'];
const LOSSES = ['boardedBy'];

// The launched start ship: the background's start ship, with LAUNCH_PARTS
// fitted where the test runs fit them (run.js fitPart).
export function launchedShip(rules) {
  const { start } = rules.backgrounds.values().next().value;
  let { ship } = buildShip(rules, start.ship.frame, start.ship.placements);
  for (const type of LAUNCH_PARTS) ship = withPart(ship, rules, type);
  return ship;
}

// The ship with one part more, fitted.
export function withPart(ship, rules, type) {
  const fitted = fitPart(ship, rules, type);
  if (!fitted) throw new Error(`No room for a ${type} on the ship.`);
  return fitted.ship;
}

// The ships the harness flies: the launched start ship, and it with each of
// ADDED: [{ name, ship }].
export function harnessShips(rules) {
  const base = launchedShip(rules);
  return [{ name: 'start', ship: base }, ...ADDED.map((type) => ({ name: `+${type}`, ship: withPart(base, rules, type) }))];
}

// The presets with tactics: the hostile ones.
export function hostilePresets(rules) {
  return [...rules.ships.values()].filter((preset) => preset.tactics).map((preset) => preset.id);
}

// One approach, played to its end: { outcome, rounds, fired, you, them }.
// made: the enemy ship, if it has been generated already.
export function playApproach(rules, ship, presetId, seed, { order = captainOrder, made = generateShip(rules, presetId, seed) } = {}) {
  if (!made.ok) throw new Error(made.error);
  let state = {
    you: { ship, damage: {}, wrecked: {} },
    them: { ship: made.ship, damage: {}, wrecked: made.wrecked },
    round: 1,
    tactics: rules.ships.get(presetId).tactics,
  };
  let rng = seedFrom(`approach ${seed}`);
  let fired = false;
  for (;;) {
    const played = playRound(state, order(state, rules), rng, rules);
    if (!played.ok) throw new Error(played.error);
    fired = fired || played.fired;
    rng = played.rng;
    if (played.outcome) return { outcome: played.outcome, rounds: played.round, fired, you: played.you, them: played.them };
    state = { ...state, you: played.you, them: played.them, round: played.round };
  }
}

// Every ship against every hostile preset, `runs` times each: [{ ship,
// preset, outcomes: { [kind]: count }, runs, wins, losses, score }], score
// being wins less losses for every 100 approaches.
export function runApproaches(rules, { runs = 300 } = {}) {
  const rows = [];
  const enemies = new Map(hostilePresets(rules).map((preset) => [preset, Array.from({ length: runs }, (_, i) => generateShip(rules, preset, i + 1))]));
  for (const { name, ship } of harnessShips(rules)) {
    for (const preset of hostilePresets(rules)) {
      const outcomes = Object.fromEntries(OUTCOMES.map((kind) => [kind, 0]));
      for (let seed = 1; seed <= runs; seed++) outcomes[playApproach(rules, ship, preset, seed, { made: enemies.get(preset)[seed - 1] }).outcome.kind] += 1;
      const wins = WINS.reduce((sum, kind) => sum + outcomes[kind], 0);
      const losses = LOSSES.reduce((sum, kind) => sum + outcomes[kind], 0);
      rows.push({ ship: name, preset, outcomes, runs, wins, losses, score: Math.round((100 * (wins - losses)) / runs) });
    }
  }
  return rows;
}

// The rows as a table.
export function approachText(rules, rows) {
  const pct = (n, of) => `${Math.round((100 * n) / of)}%`.padStart(5);
  const head = `${'Ship'.padEnd(10)}${'Against'.padEnd(18)}${OUTCOMES.map((kind) => kind.padStart(10)).join('')}${'Score'.padStart(8)}`;
  const lines = rows.map((row) => `${row.ship.padEnd(10)}${rules.ships.get(row.preset).name.padEnd(18)}${OUTCOMES.map((kind) => pct(row.outcomes[kind], row.runs).padStart(10)).join('')}${String(row.score).padStart(8)}`);
  return [
    `${rows[0]?.runs ?? 0} approaches a preset for each ship: the launched start ship, and it with one part more. The test player against each preset's tactics.`,
    head,
    ...lines,
    'Score: wins (boarded, destroyed) less losses (boardedBy), in every 100.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = (flag) => args.indexOf(flag);
  const runs = at('--runs') >= 0 ? Number(args[at('--runs') + 1]) : 300;
  const sets = args.flatMap((arg, i) => (args[i - 1] === '--set' ? [setting(arg)] : []));
  const changed = rulesWith(readData(), sets);
  if (!changed.ok) {
    console.error(changed.error);
    process.exit(1);
  }
  console.log(approachText(changed.rules, runApproaches(changed.rules, { runs })));
}
