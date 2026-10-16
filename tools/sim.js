#!/usr/bin/env node
// The balance harness: plays many fights headless, AI against AI, and
// reports how they went: who wins, how long fights run, and how shots land.
// Seeded: the same options always give the same report. Before changing a
// number in data/balance.json, run it and paste its summary into
// PROGRESS.md (CLAUDE.md).
//
//   node tools/sim.js                    1,000 fights: the squad against the
//                                        boarding party (data/encounters.json),
//                                        a quarter each on the example ship
//                                        and on ships of the three presets
//   node tools/sim.js --fights 200       another count
//   node tools/sim.js --ships example,hauler
//                                        some of them, or a ship script (a
//                                        .json file tools/build-ship.js
//                                        takes) or a blueprint code copied
//                                        from the builder
//   node tools/sim.js --set halfCover=25 a balance number changed for this run
//                                        only (as many --set as you like)
//   node tools/sim.js --set halfCover=25 --compare
//                                        the same fights before and after
//   node tools/sim.js --crew scripted    the crew played by the plain scripted
//                                        player, not the AI (--boarders too)
//   node tools/sim.js --squad pilot,scout,medic
//                                        another squad: jobs from
//                                        data/jobs.json (M32)
//   node tools/sim.js --orders none      the crew gives no orders (M32); or
//                                        only some kinds, --orders mark,patch;
//                                        all by default. With --compare, the
//                                        same fights with every order first
//   node tools/sim.js --rounds 30        fights still going after this many
//                                        rounds stop with no winner
//   node tools/sim.js --seed balance     the seed every fight's seeds come from
//   node tools/sim.js --json             the report as JSON
//   node tools/sim.js --boardings        boardings both ways instead (M22,
//                                        tools/boarding.js): the squad at home
//                                        and aboard each hostile preset's ship,
//                                        the fights spread over the rows
//
// Each fight gets its own seed; on a preset, its own generated ship too.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeBlueprint } from '../src/core/blueprint.js';
import { aiAction } from '../src/sim/ai.js';
import { autoplay } from '../src/sim/autoplay.js';
import { buildShip, layoutProblems } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { deploy } from '../src/sim/deploy.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { scriptedAction } from '../src/sim/scripted.js';
import { exampleShipMap } from './battle-log.js';
import { readData } from './data.js';
import { validateData } from './validate-data.js';

const PLAYERS = { ai: aiAction, scripted: scriptedAction };
export const DEFAULTS = { fights: 1000, ships: null, sets: [], crew: 'ai', boarders: 'ai', rounds: 30, seed: 'balance', encounter: null, compare: false, json: false, boardings: false, squad: null, orders: 'all' };
// Shown hit chances, grouped for the check that shots land as often as shown.
const BANDS = [[0, 19], [20, 39], [40, 59], [60, 79], [80, 100]];

// The options on a command line, or an Error saying what's wrong.
export function parseArgs(argv) {
  const options = { ...DEFAULTS, sets: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} needs a value.`);
      return argv[++i];
    };
    if (arg === '--fights') options.fights = whole(value(), arg, 1);
    else if (arg === '--rounds') options.rounds = whole(value(), arg, 1);
    else if (arg === '--ships') options.ships = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--set') options.sets.push(setting(value()));
    else if (arg === '--crew' || arg === '--boarders') options[arg.slice(2)] = player(value(), arg);
    else if (arg === '--seed') options.seed = value();
    else if (arg === '--encounter') options.encounter = value();
    else if (arg === '--compare') options.compare = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--boardings') options.boardings = true;
    else if (arg === '--squad') options.squad = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--orders') options.orders = value();
    else throw new Error(`Unknown option "${arg}".`);
  }
  if (options.compare && !options.sets.length && options.orders === 'all') throw new Error('--compare needs a --set or --orders to compare with.');
  return options;
}

// The rules with the squad and the orders a run asks for: rules.squad as
// given, and each job's order kept only if `orders` is 'all' or names its
// kind ('none' keeps none). Returns { ok: true, rules } or { ok: false,
// error }.
export function rulesFor(rules, { squad = null, orders = 'all' } = {}) {
  const unknown = (squad ?? []).find((job) => !rules.jobs.has(job));
  if (unknown) return { ok: false, error: `No job "${unknown}": name jobs from data/jobs.json (${[...rules.jobs.keys()].join(', ')}).` };
  const kinds = orders === 'all' ? null : orders === 'none' ? [] : orders.split(',').map((s) => s.trim());
  const types = new Set([...rules.jobs.values()].map((job) => job.order?.type).filter(Boolean));
  const stray = (kinds ?? []).find((kind) => !types.has(kind));
  if (stray) return { ok: false, error: `No order "${stray}": --orders takes all, none or kinds (${[...types].join(', ')}).` };
  const jobs = kinds ? new Map([...rules.jobs].map(([id, job]) => [id, job.order && !kinds.includes(job.order.type) ? { ...job, order: null } : job])) : rules.jobs;
  return { ok: true, rules: { ...rules, jobs, squad: squad ?? rules.squad } };
}

function whole(text, arg, least) {
  if (!/^\d+$/.test(text) || Number(text) < least) throw new Error(`${arg} needs a whole number, ${least} or more.`);
  return Number(text);
}

export function setting(text) {
  const match = /^([A-Za-z]+)=(-?\d+)$/.exec(text);
  if (!match) throw new Error(`--set needs name=number, like halfCover=25, not "${text}".`);
  return { name: match[1], value: Number(match[2]) };
}

function player(text, arg) {
  if (!(text in PLAYERS)) throw new Error(`${arg} is played by ai or scripted, not "${text}".`);
  return text;
}

// The content with balance numbers changed, checked as data/ is: returns
// { ok: true, rules } or { ok: false, error }.
export function rulesWith(data, sets) {
  const changed = { ...data, balance: { ...data.balance } };
  for (const { name, value } of sets) {
    if (!(name in data.balance)) return { ok: false, error: `balance.json has no number "${name}".` };
    changed.balance[name] = value;
  }
  const problems = validateData(changed);
  return problems.length ? { ok: false, error: problems.join('; ') } : { ok: true, rules: indexDefs(changed) };
}

// The ships to fight on, from names: 'example', a preset id, a ship script
// path (.json) or a blueprint code. Each is { label, map } (one ship for
// every fight) or { label, preset } (a new ship of the preset each fight).
// Throws an Error naming a ship that can't be fought on.
export function shipsFor(names, rules) {
  const list = names ?? ['example', ...rules.ships.keys()];
  const codes = list.filter((name) => !name.endsWith('.json') && name.includes('.'));
  return list.map((name) => {
    if (name === 'example') return { label: 'Example ship', map: exampleShipMap(rules) };
    if (rules.ships.has(name)) return { label: rules.ships.get(name).name, preset: name };
    let ship;
    let label;
    if (name.endsWith('.json')) {
      const script = JSON.parse(readFileSync(name, 'utf8'));
      const built = buildShip(rules, script.frame, script.placements);
      if (built.rejected.length) throw new Error(`${name}: ${built.rejected[0].message}`);
      ({ ship } = built);
      label = basename(name, '.json');
    } else if (name.includes('.')) {
      const decoded = decodeBlueprint(name, rules);
      if (!decoded.ok) throw new Error(`Blueprint code ${name.slice(0, 16)}…: ${decoded.error}`);
      ({ ship } = decoded);
      label = codes.length > 1 ? `Blueprint ${codes.indexOf(name) + 1}` : 'Blueprint';
    } else {
      throw new Error(`No ship "${name}": name example, a preset (${[...rules.ships.keys()].join(', ')}), a ship script (.json) or a blueprint code.`);
    }
    const problems = layoutProblems(ship, rules);
    if (problems.length) throw new Error(`${label}: ${problems[0].message}`);
    return { label, map: mapFromShip(ship, rules) };
  });
}

// Plays the fights, ships taking turns: fight i is on ships[i % n]. Each
// fight's seed (and a preset's ship) comes from the run's seed, the ship
// and how many fights that ship has had, so adding a ship to the list
// doesn't change the others' fights. Returns one record a fight:
//   { ship, winner, rounds, orders: { crew, enemy }, given, shots, downs, outs, deaths }
// orders count each side's actions; given, the crew's job orders by kind
// (M32); shots are { side, chance, hit, overwatch, crit, damage }; downs,
// outs and deaths count crew downed, crew bled out and boarders killed.
export function runFights(rules, { ships, fights, seed, crew, boarders, rounds, encounter }) {
  const party = encounter ? rules.encounters.get(encounter) : rules.encounters.values().next().value;
  if (!party) throw new Error(`No encounter "${encounter}" in data/encounters.json.`);
  const players = { crew: PLAYERS[crew], enemy: PLAYERS[boarders] };
  const records = [];
  for (let i = 0; i < fights; i++) {
    const source = ships[i % ships.length];
    const n = Math.floor(i / ships.length) + 1;
    const fightSeed = `${seed} ${source.preset ?? source.label} ${n}`;
    let { map } = source;
    if (!map) {
      const made = generateShip(rules, source.preset, fightSeed);
      if (!made.ok) throw new Error(made.error);
      map = mapFromShip(made.ship, rules, { wrecked: made.wrecked });
    }
    const placed = deploy(map, rules.squad, party.enemies, rules);
    if (!placed.ok) throw new Error(`${source.label}: ${placed.error}`);
    const played = autoplay({ map, units: placed.units, seed: fightSeed }, rules, players, { maxRounds: rounds });
    records.push(record(source.label, played));
  }
  return records;
}

// What one fight comes to (see runFights).
function record(ship, { battle, actions, events }) {
  const sideOf = (id) => (id.startsWith('c') ? 'crew' : 'enemy');
  const orders = { crew: 0, enemy: 0 };
  for (const action of actions) if (action.unit) orders[sideOf(action.unit)] += 1;
  const shots = [];
  const given = {};
  let downs = 0;
  let outs = 0;
  let deaths = 0;
  for (const event of events) {
    if (event.type === 'order') given[event.order] = (given[event.order] ?? 0) + 1;
    if (event.type === 'shot') {
      shots.push({ side: sideOf(event.unit), chance: event.chance, hit: event.hit, overwatch: event.overwatch, crit: Boolean(event.crit), damage: event.damage ?? 0 });
    } else if (event.type === 'down') downs++;
    else if (event.type === 'bled out') outs++;
    else if (event.type === 'dead' && sideOf(event.unit) === 'enemy') deaths++;
  }
  // A battle that ran out of rounds stopped one round past the limit.
  return { ship, winner: battle.winner, rounds: battle.winner ? battle.round : battle.round - 1, orders, given, shots, downs, outs, deaths };
}

// The records summed up: overall and ship by ship, the winners (with a 95%
// interval on each rate), rounds and crew orders in the fights that ended,
// and the shots.
export function summarize(records) {
  const labels = [...new Set(records.map((r) => r.ship))];
  const shots = records.flatMap((r) => r.shots);
  const hits = shots.filter((s) => s.hit);
  const rate = (list, test) => (list.length ? list.filter(test).length / list.length : 0);
  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
  return {
    fights: records.length,
    ships: labels.map((label) => outcomes(label, records.filter((r) => r.ship === label))),
    all: outcomes('All', records),
    shots: {
      total: shots.length,
      perFight: shots.length / Math.max(1, records.length),
      hit: { crew: rate(shots.filter((s) => s.side === 'crew'), (s) => s.hit), enemy: rate(shots.filter((s) => s.side === 'enemy'), (s) => s.hit) },
      bands: BANDS.map(([from, to]) => {
        const band = shots.filter((s) => s.chance >= from && s.chance <= to);
        return { from, to, shots: band.length, shown: mean(band.map((s) => s.chance)) / 100, hit: rate(band, (s) => s.hit) };
      }),
      overwatch: { share: rate(shots, (s) => s.overwatch), hit: rate(shots.filter((s) => s.overwatch), (s) => s.hit) },
      crits: rate(hits, (s) => s.crit),
      damage: { crew: mean(hits.filter((s) => s.side === 'crew').map((s) => s.damage)), enemy: mean(hits.filter((s) => s.side === 'enemy').map((s) => s.damage)) },
    },
    perFight: {
      downs: mean(records.map((r) => r.downs)),
      outs: mean(records.map((r) => r.outs)),
      deaths: mean(records.map((r) => r.deaths)),
    },
    given: Object.fromEntries([...new Set(records.flatMap((r) => Object.keys(r.given ?? {})))].sort().map((kind) => [kind, mean(records.map((r) => r.given?.[kind] ?? 0))])),
  };
}

function outcomes(label, records) {
  const n = records.length;
  const count = (winner) => records.filter((r) => r.winner === winner).length;
  const ended = records.filter((r) => r.winner);
  return {
    label,
    fights: n,
    crew: share(count('crew'), n),
    enemy: share(count('enemy'), n),
    stalls: share(n - ended.length, n),
    rounds: spread(ended.map((r) => r.rounds)),
    crewOrders: spread(ended.map((r) => r.orders.crew)),
  };
}

// k of n, as a rate with a 95% interval (Wilson's).
export function share(k, n) {
  if (!n) return { count: 0, rate: 0, low: 0, high: 0 };
  const z = 1.96;
  const p = k / n;
  const middle = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return { count: k, rate: p, low: Math.max(0, middle - half), high: Math.min(1, middle + half) };
}

// The median and the 10th and 90th percentiles of whole numbers.
function spread(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { median: at(0.5), low: at(0.1), high: at(0.9) };
}

// The summary as text, for the terminal and for PROGRESS.md. With `before`
// (the same fights before a change), each figure shows "before → after".
export function reportText(summary, setup, before = null) {
  const lines = [setup];
  const pct = (r) => `${Math.round(r * 100)}%`;
  const two = (a, b, f) => (before ? `${f(a)} → ${f(b)}` : f(b));
  const rows = [['Ship', 'Fights', 'Crew wins', 'Boarders win', 'No winner', 'Rounds', 'Crew orders']];
  const rowFor = (now, then) => [
    now.label,
    commas(now.fights),
    before ? two(then.crew.rate, now.crew.rate, pct) : `${pct(now.crew.rate)} (${Math.round(now.crew.low * 100)}–${Math.round(now.crew.high * 100)})`,
    two(then?.enemy.rate, now.enemy.rate, pct),
    two(then?.stalls.rate, now.stalls.rate, pct),
    two(then?.rounds, now.rounds, (s) => (s ? `${s.median} (${s.low}–${s.high})` : '–')),
    two(then?.crewOrders, now.crewOrders, (s) => (s ? String(s.median) : '–')),
  ];
  summary.ships.forEach((ship, i) => rows.push(rowFor(ship, before?.ships[i])));
  if (summary.ships.length > 1) rows.push(rowFor(summary.all, before?.all));
  lines.push('', ...table(rows));
  lines.push(
    '',
    `Rounds and crew orders count the fights with a winner: the median (10th to 90th percentile).${before ? '' : ' Win rates have a 95% interval.'}`,
  );
  const s = summary.shots;
  const b = before?.shots;
  lines.push(
    '',
    `Shots: ${two(b?.total, s.total, commas)}, ${two(b?.perFight, s.perFight, (v) => v.toFixed(1))} a fight. Hit: crew ${two(b?.hit.crew, s.hit.crew, pct)}, boarders ${two(b?.hit.enemy, s.hit.enemy, pct)}.`,
  );
  const bandRows = [['Shown odds', 'Shots', 'Shown', 'Hit']];
  s.bands.forEach((band, i) => {
    const old = b?.bands[i];
    bandRows.push([`${band.from}–${band.to}%`, two(old?.shots, band.shots, commas), two(old?.shown, band.shown, pct), two(old?.hit, band.hit, pct)]);
  });
  lines.push(...table(bandRows));
  lines.push(
    `On overwatch: ${two(b?.overwatch.share, s.overwatch.share, pct)} of shots, ${two(b?.overwatch.hit, s.overwatch.hit, pct)} hit. Crits: ${two(b?.crits, s.crits, pct)} of hits. Damage a hit: crew ${two(b?.damage.crew, s.damage.crew, (v) => v.toFixed(1))}, boarders ${two(b?.damage.enemy, s.damage.enemy, (v) => v.toFixed(1))}.`,
  );
  const f = summary.perFight;
  const g = before?.perFight;
  lines.push(`A fight: ${two(g?.downs, f.downs, (v) => v.toFixed(1))} crew go down, ${two(g?.outs, f.outs, (v) => v.toFixed(1))} bleed out, ${two(g?.deaths, f.deaths, (v) => v.toFixed(1))} boarders die.`);
  const kinds = [...new Set([...Object.keys(summary.given ?? {}), ...Object.keys(before?.given ?? {})])].sort();
  if (kinds.length) lines.push(`Job orders a fight: ${kinds.map((kind) => `${kind} ${two(before?.given?.[kind] ?? 0, summary.given?.[kind] ?? 0, (v) => v.toFixed(1))}`).join(', ')}.`);
  return lines.join('\n');
}

// Rows of cells as aligned text: the first column to the left, the rest to
// the right.
function table(rows) {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((row) => row[c].length)));
  return rows.map((row) => row.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join('  ').trimEnd());
}

function commas(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// What a run is, in a few sentences. balance is data/balance.json as it is,
// for the numbers a run changes.
export function setupText(rules, options, ships, balance) {
  const party = options.encounter ? rules.encounters.get(options.encounter) : rules.encounters.values().next().value;
  const who = (side) => (options[side] === 'ai' ? 'the AI' : 'the scripted player');
  const sets = options.sets.map(({ name, value }) => `${name} ${balance[name]} → ${value}`).join(', ');
  const orders = options.orders === 'all' ? 'every job order' : options.orders === 'none' ? 'no job orders' : `only ${options.orders.split(',').join(' and ')}`;
  return [
    `${commas(options.fights)} fights on ${ships.map((s) => s.label.toLowerCase()).join(', ')}.`,
    `The squad (${rules.squad.join(', ')}), played by ${who('crew')} with ${orders}${options.compare && options.orders !== 'all' ? ' (before: every job order)' : ''}, against the ${party.name.toLowerCase()} (${party.enemies.join(', ')}), played by ${who('boarders')}.`,
    `${options.rounds} rounds at most, seed "${options.seed}"${sets ? `, with ${sets}` : ''}.`,
  ].join(' ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = (message) => {
    console.error(`sim: ${message}`);
    process.exit(1);
  };
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    fail(`${err.message} See the top of tools/sim.js for the options.`);
  }
  const data = readData();
  const changed = rulesWith(data, options.sets);
  if (!changed.ok) fail(changed.error);
  const shaped = rulesFor(changed.rules, options);
  if (!shaped.ok) fail(shaped.error);
  changed.rules = shaped.rules;
  if (options.boardings) {
    const { boardingRows, boardingText, runBoardings } = await import('./boarding.js');
    const perRow = Math.max(1, Math.round(options.fights / boardingRows(changed.rules).length));
    const started = performance.now();
    const rows = runBoardings(changed.rules, { fights: perRow, seed: options.seed, rounds: options.rounds });
    console.log(options.json ? JSON.stringify(rows, null, 2) : boardingText(rows, options));
    if (!options.json) console.log(`\n${commas(perRow * rows.length)} fights in ${((performance.now() - started) / 1000).toFixed(1)} s.`);
    process.exit(0);
  }
  let ships;
  try {
    ships = shipsFor(options.ships, changed.rules);
  } catch (err) {
    fail(err.message);
  }
  // Balance numbers don't change the maps, so both runs share the ships.
  const started = performance.now();
  const summary = summarize(runFights(changed.rules, { ...options, ships }));
  const before = options.compare ? summarize(runFights(rulesFor(rulesWith(data, []).rules, { squad: options.squad }).rules, { ...options, ships })) : null;
  const seconds = (performance.now() - started) / 1000;
  if (options.json) {
    console.log(JSON.stringify(before ? { before, after: summary } : summary, null, 2));
  } else {
    console.log(reportText(summary, setupText(changed.rules, options, ships, data.balance), before));
    const runs = before ? 2 : 1;
    console.log(`\n${commas(options.fights * runs)} fights in ${seconds.toFixed(1)} s (${((seconds * 1000) / (options.fights * runs)).toFixed(0)} ms a fight).`);
  }
}
