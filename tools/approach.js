// The approach phase's balance harness (ROADMAP §4.2): the launched start
// ship against each hostile preset, many times, with the test player giving
// its orders (tools/approachPlan.js) and the preset its tactics. It reports
// how the approaches end, and the same again with each part that fights in
// an approach added to the start ship by itself (ADDED): Law 1 says every
// one of them should change how it goes. And with each maker's version of
// every part on the start ship (M23g): its hit points and its mass should
// change it too; a maker whose parts draw more power than its reactors make
// adds its own reactor, as the flight checklist's fix asks, so the ship can
// fly (M31). For each, the parts its volleys wreck on the player's ship in
// an approach, on average, how many for each hit it takes, and the ship's
// evasion.
//   node tools/approach.js              300 approaches a preset per ship
//   node tools/approach.js --runs 1000
//   node tools/approach.js --set gunnery=65   (any balance number)
// Every approach is seeded: the enemy ship is preset seed 1 up, and its
// rolls are seeded by the same number, so a run is the same every time and
// each ship meets the same enemies on the same rolls.
import { pathToFileURL } from 'node:url';
import { seedFrom } from '../src/core/rng.js';
import { ROUND_OUTCOMES as OUTCOMES, playRound, sideStats } from '../src/sim/approach.js';
import { shipStats } from '../src/sim/constraints.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { versionBy } from '../src/sim/makers.js';
import { captainOrder } from './approachPlan.js';
import { readData } from './data.js';
import { rulesWith, setting } from './sim.js';
import { launchedShip, withPart } from './startShip.js';

export { launchedShip, withPart } from './startShip.js';

// The parts tried one at a time on the launched ship: v0.1's gun, shield
// and engine, and M23e's variants of them, the point defense turret and the
// small reactor (a spare).
export const ADDED = ['weapon', 'shield', 'engine', 'cannon', 'pointdefense', 'shieldarray', 'lightengine', 'heavyengine', 'smallreactor'];
// How an outcome counts for the player.
const WINS = ['boarded', 'destroyed'];
const LOSSES = ['boardedBy'];

// The ships the harness flies: the launched start ship, it with each of
// ADDED, and it with every part by each maker but the first (M23g, named
// 'start <maker>', with the reactors it needs to fly: madeToFly), and that
// again with the maker's shield (M31, 'start <maker> +shield', beside the
// Yard's '+shield'): [{ name, ship }].
export function harnessShips(rules) {
  const base = launchedShip(rules);
  const makers = [...rules.manufacturers.keys()].slice(1);
  return [
    { name: 'start', ship: base },
    ...ADDED.map((type) => ({ name: `+${type}`, ship: withPart(base, rules, type) })),
    ...makers.flatMap((maker) => [
      { name: `start ${maker}`, ship: madeToFly(base, rules, maker) },
      { name: `start ${maker} +shield`, ship: madeToFly(base, rules, maker, ['shield']) },
    ]),
  ];
}

// The ship with every part the maker makes as its version, where it is.
export function madeBy(ship, rules, maker) {
  return { ...ship, modules: ship.modules.map((module) => ({ ...module, type: versionBy(rules, module.type, maker) })) };
}

// The ship made by the maker (madeBy), with the maker's versions of the
// parts in `more` fitted too, and then the maker's reactor added until its
// reactors make all the power its parts draw (M31: Scrapline's draw more),
// as the flight checklist's fix asks.
export function madeToFly(ship, rules, maker, more = []) {
  let made = madeBy(ship, rules, maker);
  for (const type of more) made = withPart(made, rules, versionBy(rules, type, maker));
  for (let i = 0; i < 3 && shipStats(made, rules).power < 0; i++) made = withPart(made, rules, versionBy(rules, 'reactor', maker));
  return made;
}

// The presets with tactics: the hostile ones.
export function hostilePresets(rules) {
  return [...rules.ships.values()].filter((preset) => preset.tactics).map((preset) => preset.id);
}

// One approach, played to its end: { outcome, rounds, fired, shots, hits,
// you, them }, shots being the other's shots at the player's ship and hits
// those that hit.
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
  let shots = 0;
  let hits = 0;
  for (;;) {
    const played = playRound(state, order(state, rules), rng, rules);
    if (!played.ok) throw new Error(played.error);
    fired = fired || played.fired;
    for (const volley of played.events.filter((event) => event.kind === 'volley' && event.side === 'them')) {
      shots += volley.shots.length;
      hits += volley.shots.filter((shot) => shot.hit).length;
    }
    rng = played.rng;
    if (played.outcome) return { outcome: played.outcome, rounds: played.round, fired, shots, hits, you: played.you, them: played.them };
    state = { ...state, you: played.you, them: played.them, round: played.round };
  }
}

// Every ship against every hostile preset, `runs` times each: [{ ship,
// preset, outcomes: { [kind]: count }, runs, wins, losses, score, wrecked,
// shots, hits, evasion }], score being wins less losses for every 100
// approaches, wrecked the parts wrecked on the player's ship in all of
// them, shots the other's shots at it and hits those that hit, and evasion
// the ship's at the start.
export function runApproaches(rules, { runs = 300 } = {}) {
  const rows = [];
  const enemies = new Map(hostilePresets(rules).map((preset) => [preset, Array.from({ length: runs }, (_, i) => generateShip(rules, preset, i + 1))]));
  for (const { name, ship } of harnessShips(rules)) {
    const { evasion } = sideStats({ ship, damage: {}, wrecked: {} }, rules);
    for (const preset of hostilePresets(rules)) {
      const outcomes = Object.fromEntries(OUTCOMES.map((kind) => [kind, 0]));
      let wrecked = 0;
      let shots = 0;
      let hits = 0;
      for (let seed = 1; seed <= runs; seed++) {
        const played = playApproach(rules, ship, preset, seed, { made: enemies.get(preset)[seed - 1] });
        outcomes[played.outcome.kind] += 1;
        wrecked += Object.keys(played.you.wrecked).length;
        shots += played.shots;
        hits += played.hits;
      }
      const wins = WINS.reduce((sum, kind) => sum + outcomes[kind], 0);
      const losses = LOSSES.reduce((sum, kind) => sum + outcomes[kind], 0);
      rows.push({ ship: name, preset, outcomes, runs, wins, losses, score: Math.round((100 * (wins - losses)) / runs), wrecked, shots, hits, evasion });
    }
  }
  return rows;
}

// The rows as a table.
export function approachText(rules, rows) {
  const pct = (n, of) => `${Math.round((100 * n) / of)}%`.padStart(5);
  const head = `${'Ship'.padEnd(24)}${'Against'.padEnd(18)}${OUTCOMES.map((kind) => kind.padStart(10)).join('')}${'Score'.padStart(8)}${'Wrecked'.padStart(9)}${'Per hit'.padStart(9)}${'Hit'.padStart(6)}${'Evasion'.padStart(9)}`;
  const lines = rows.map((row) => `${row.ship.padEnd(24)}${rules.ships.get(row.preset).name.padEnd(18)}${OUTCOMES.map((kind) => pct(row.outcomes[kind], row.runs).padStart(10)).join('')}${String(row.score).padStart(8)}${(row.wrecked / row.runs).toFixed(2).padStart(9)}${(row.hits ? row.wrecked / row.hits : 0).toFixed(2).padStart(9)}${pct(row.hits, row.shots || 1).padStart(6)}${String(row.evasion).padStart(9)}`);
  return [
    `${rows[0]?.runs ?? 0} approaches a preset for each ship: the launched start ship, it with one part more, and it with every part by another maker (and that maker's reactor, if it needs one to fly), without a shield and with that maker's. The test player against each preset's tactics.`,
    head,
    ...lines,
    "Score: wins (boarded, destroyed) less losses (boardedBy), in every 100. Wrecked: the player's parts wrecked in an approach, on average. Per hit: parts wrecked for each hit the ship takes. Hit: the share of the other's shots that hit it. Evasion: the ship's.",
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
