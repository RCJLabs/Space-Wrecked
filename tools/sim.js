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
//   node tools/sim.js --rank 1           the crew at job rank 1 (M32b): each
//                                        order as its rank sharpens it. With
//                                        --compare, the same fights at rank 0
//                                        first
//   node tools/sim.js --talent varga     the crew at rank 2, and the first of
//                                        the companion's job at the third rank
//                                        with their talent (M33c,
//                                        data/companions.json); the squad must
//                                        have the job (--squad). With
//                                        --compare, the same fights all at
//                                        rank 2 first
//   node tools/sim.js --rounds 30        fights still going after this many
//                                        rounds stop with no winner
//   node tools/sim.js --seed balance     the seed every fight's seeds come from
//   node tools/sim.js --json             the report as JSON
//   node tools/sim.js --boardings        boardings both ways instead (M22,
//                                        tools/boarding.js): the squad at home
//                                        and aboard each hostile preset's ship,
//                                        the fights spread over the rows
//   node tools/sim.js --boardings --fit turret   the ship at home with the
//                                        parts fitted (M39: a security turret
//                                        fights for it)
//   node tools/sim.js --weapon autogun   the whole squad carries the weapon
//                                        (M37). With --compare, the same
//                                        fights with the squad as issued first
//   node tools/sim.js --sites            the fights on act 1's job sites
//                                        instead: the first three jobs on a
//                                        fresh board of each background, seeds
//                                        from 1, the crew played by the job
//                                        player (jobAi.js), 60 rounds at most
//   node tools/sim.js --weapons          every weapon's table (M37): the crew's
//                                        wins with the whole squad carrying
//                                        each, aboard ships, on job sites and
//                                        against armor (the Provost's patrol),
//                                        --fights in each
//
// Each fight gets its own seed; on a preset, its own generated ship too.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeBlueprint } from '../src/core/blueprint.js';
import { aiAction } from '../src/sim/ai.js';
import { autoplay, playFrom } from '../src/sim/autoplay.js';
import { buildShip, layoutProblems } from '../src/sim/builder.js';
import { newCampaign } from '../src/sim/campaign.js';
import { takeJob, withBoard } from '../src/sim/contracts.js';
import { indexDefs } from '../src/sim/defs.js';
import { deploy } from '../src/sim/deploy.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { jobAction } from '../src/sim/jobAi.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { scriptedAction } from '../src/sim/scripted.js';
import { TALENT_RANK } from '../src/sim/talents.js';
import { exampleShipMap } from './battle-log.js';
import { readData } from './data.js';
import { launchedShip, withPart } from './startShip.js';
import { validateData } from './validate-data.js';

const PLAYERS = { ai: aiAction, scripted: scriptedAction };
export const DEFAULTS = { fights: 1000, ships: null, sets: [], crew: 'ai', boarders: 'ai', rounds: 30, seed: 'balance', encounter: null, compare: false, json: false, boardings: false, fit: [], squad: null, orders: 'all', rank: 0, talent: null, weapon: null, sites: false, weapons: false };
// A job site's fight still going after this many rounds stops with no
// winner, as act 1's test runs stop it (tools/run.js).
const SITE_ROUNDS = 60;
// The jobs a fresh board gives the job sites' fights.
const SITE_JOBS = 3;
// The armor the weapons' table is measured against (M37).
const ARMORED = 'provostpatrol';
// A talent's run (M33c) puts the rest of the crew at this rank, the
// talent's own rank's below.
const TALENT_BELOW = TALENT_RANK - 1;
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
    else if (arg === '--fit') options.fit = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--squad') options.squad = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--orders') options.orders = value();
    else if (arg === '--rank') options.rank = whole(value(), arg, 0);
    else if (arg === '--talent') options.talent = value();
    else if (arg === '--weapon') options.weapon = value();
    else if (arg === '--sites') options.sites = true;
    else if (arg === '--weapons') options.weapons = true;
    else throw new Error(`Unknown option "${arg}".`);
  }
  if (options.talent) options.rank = TALENT_BELOW;
  if (options.compare && !options.sets.length && options.orders === 'all' && !options.rank && !options.weapon) throw new Error('--compare needs a --set, --orders, --rank, --talent or --weapon to compare with.');
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

// Plays the fights, ships taking turns: fight i is on ships[i % n], the
// crew at job rank `rank` (M32b), and with `talent` (a companion's id,
// M33c) the first of the companion's job at the third rank with their
// talent. Each fight's seed (and a preset's ship) comes from the run's
// seed, the ship and how many fights that ship has had, so adding a ship to
// the list doesn't change the others' fights.
// Returns one record a fight:
//   { ship, winner, rounds, orders: { crew, enemy }, given, shots, downs, outs, deaths }
// orders count each side's actions; given, the crew's job orders by kind
// (M32); shots are { side, chance, hit, overwatch, crit, damage }; downs,
// outs and deaths count crew downed, crew bled out and boarders killed.
export function runFights(rules, { ships, fights, seed, crew, boarders, rounds, encounter, rank = 0, talent = null, weapon = null }) {
  const party = encounter ? rules.encounters.get(encounter) : rules.encounters.values().next().value;
  if (!party) throw new Error(`No encounter "${encounter}" in data/encounters.json.`);
  const talentJob = talent ? talentJobOf(rules, talent) : null;
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
    const units = armed(ranked(placed.units, rules, rank, talent, talentJob), rules, weapon);
    const played = autoplay({ map, units, seed: fightSeed }, rules, players, { maxRounds: rounds });
    records.push(record(source.label, played));
  }
  return records;
}

// The fights on act 1's job sites (M37's weapons' table): the first
// SITE_JOBS jobs on a fresh board of each background in turn, campaign
// seeds from 1, until there are `fights`; the crew played by the job player
// (jobAi.js), the enemy by the AI, the whole crew carrying `weapon` if one
// is given. One record a fight, as runFights's, by background.
export function runSites(rules, { fights, weapon = null }) {
  const records = [];
  const backgrounds = [...rules.backgrounds.values()];
  for (let seed = 1; records.length < fights; seed++) {
    for (const background of backgrounds) {
      const campaign = withBoard(newCampaign(rules, seed, { background: background.id }), rules);
      const crew = weapon ? campaign.crew.map((member) => ({ ...member, weapon })) : campaign.crew;
      for (let index = 0; index < Math.min(SITE_JOBS, campaign.board.length) && records.length < fights; index++) {
        const taken = takeJob({ ...campaign, crew }, rules, index);
        if (!taken.ok) throw new Error(`${background.name}, seed ${seed}: ${taken.error}`);
        records.push(record(background.name, playFrom(taken.campaign.fight.battle, rules, { crew: jobAction, enemy: aiAction }, { maxRounds: SITE_ROUNDS })));
      }
    }
  }
  return records;
}

// Every weapon's table (M37): the crew's wins with the whole squad as
// issued and then carrying each weapon, aboard ships (against the first
// encounter), on job sites and against armor (ARMORED), `fights` in each.
// [{ weapon (null as issued), kind, aboard, sites, armor }], each a share.
export function runWeapons(rules, { ships, fights, seed, rounds }) {
  const base = { ships, fights, seed, crew: 'ai', boarders: 'ai', rounds };
  const wins = (records) => share(records.filter((r) => r.winner === 'crew').length, records.length);
  return [null, ...rules.weapons.keys()].map((weapon) => ({
    weapon,
    kind: weapon ? rules.weapons.get(weapon).kind : null,
    aboard: wins(runFights(rules, { ...base, weapon })),
    sites: wins(runSites(rules, { fights, weapon })),
    armor: wins(runFights(rules, { ...base, weapon, encounter: ARMORED })),
  }));
}

// The weapons' table as text: a row a weapon, its kind's best in each
// column marked *.
export function weaponsText(rows, rules, fights) {
  const pct = (s) => `${Math.round(s.rate * 100)}%`;
  const best = {};
  for (const row of rows.filter((r) => r.kind)) {
    for (const column of ['aboard', 'sites', 'armor']) best[`${row.kind} ${column}`] = Math.max(best[`${row.kind} ${column}`] ?? 0, row[column].rate);
  }
  const cell = (row, column) => `${pct(row[column])}${row.kind && row[column].rate === best[`${row.kind} ${column}`] ? '*' : ' '}`;
  const lines = [['Weapon', 'Kind', 'Aboard ships', 'Job sites', 'Against armor']];
  for (const row of rows) lines.push([row.weapon ? rules.weapons.get(row.weapon).name : 'As issued', row.kind ?? '', cell(row, 'aboard'), cell(row, 'sites'), cell(row, 'armor')]);
  return [
    `The crew's wins, the whole squad (${rules.squad.join(', ')}) carrying each weapon: aboard ships against the ${rules.encounters.values().next().value.name.toLowerCase()}, on act 1's job sites, and against the ${rules.encounters.get(ARMORED).name.toLowerCase()}'s armor; ${commas(fights)} fights in each. * marks the best of its kind.`,
    '',
    ...table(lines),
  ].join('\n');
}

// The crew's units carrying `weapon`, if one is given; the enemy's as they
// are.
function armed(units, rules, weapon) {
  return weapon ? units.map((unit) => (rules.jobs.has(unit.kind) ? { ...unit, weapon } : unit)) : units;
}

// The job of companion `talent` (M33c), which the squad must have.
export function talentJobOf(rules, talent) {
  const job = rules.companions?.get(talent)?.job;
  if (!job) throw new Error(`No companion "${talent}" in data/companions.json (${[...(rules.companions?.keys() ?? [])].join(', ')}).`);
  if (!rules.squad.includes(job)) throw new Error(`The squad (${rules.squad.join(', ')}) has no ${job} for ${talent}'s talent: name one with --squad.`);
  return job;
}

// The crew's units at job rank `rank`, and the first of `job` at the third
// rank with companion `talent`'s talent (M33c); the enemy's as they are.
function ranked(units, rules, rank, talent, job) {
  let given = false;
  return units.map((unit) => {
    if (!rules.jobs.has(unit.kind)) return unit;
    if (talent && !given && unit.kind === job) {
      given = true;
      return { ...unit, rank: TALENT_RANK, talent };
    }
    return rank ? { ...unit, rank } : unit;
  });
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
  const companion = options.talent ? rules.companions?.get(options.talent) : null;
  const rank = companion
    ? ` at rank ${options.rank}, the ${rules.jobs.get(companion.job)?.name.toLowerCase() ?? companion.job} at rank ${TALENT_RANK} with ${companion.name}'s ${companion.talent.name}${options.compare ? ` (before: all at rank ${options.rank})` : ''}`
    : options.rank ? ` at rank ${options.rank}${options.compare ? ' (before: rank 0)' : ''}` : '';
  const before = options.compare && !options.rank && options.orders !== 'all' ? ' (before: every job order)' : '';
  const carrying = options.weapon ? `, each carrying the ${rules.weapons.get(options.weapon).name.toLowerCase()}${options.compare ? ' (before: as issued)' : ''}` : '';
  return [
    `${commas(options.fights)} fights on ${ships.map((s) => s.label.toLowerCase()).join(', ')}.`,
    `The squad (${rules.squad.join(', ')})${carrying}, played by ${who('crew')} with ${orders}${before}${rank}, against the ${party.name.toLowerCase()} (${party.enemies.join(', ')}), played by ${who('boarders')}.`,
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
    // --fit: parts added to the launched ship the squad defends (M39: a
    // turret).
    let home;
    try {
      home = options.fit.reduce((ship, type) => withPart(ship, changed.rules, type), launchedShip(changed.rules));
    } catch (err) {
      fail(err.message);
    }
    const rows = runBoardings(changed.rules, { fights: perRow, seed: options.seed, rounds: options.rounds, home });
    console.log(options.json ? JSON.stringify(rows, null, 2) : boardingText(rows, options));
    if (!options.json) console.log(`\n${commas(perRow * rows.length)} fights in ${((performance.now() - started) / 1000).toFixed(1)} s.`);
    process.exit(0);
  }
  if (options.weapon && !changed.rules.weapons.has(options.weapon)) fail(`No weapon "${options.weapon}": name one from data/weapons.json (${[...changed.rules.weapons.keys()].join(', ')}).`);
  let ships;
  try {
    ships = shipsFor(options.ships, changed.rules);
    if (options.talent) talentJobOf(changed.rules, options.talent);
  } catch (err) {
    fail(err.message);
  }
  if (options.weapons) {
    const started = performance.now();
    const rows = runWeapons(changed.rules, { ...options, ships });
    console.log(options.json ? JSON.stringify(rows, null, 2) : weaponsText(rows, changed.rules, options.fights));
    if (!options.json) console.log(`\nIn ${((performance.now() - started) / 1000).toFixed(1)} s.`);
    process.exit(0);
  }
  if (options.sites) {
    const started = performance.now();
    const summary = summarize(runSites(changed.rules, options));
    const before = options.compare && options.weapon ? summarize(runSites(changed.rules, { ...options, weapon: null })) : null;
    const carrying = options.weapon ? `, the whole crew carrying the ${changed.rules.weapons.get(options.weapon).name.toLowerCase()}${before ? ' (before: as issued)' : ''}` : '';
    const setup = `${commas(options.fights)} fights on act 1's job sites: the first ${SITE_JOBS} jobs on a fresh board of each background, campaign seeds from 1, the crew played by the job player${carrying}, ${SITE_ROUNDS} rounds at most.`;
    console.log(options.json ? JSON.stringify(before ? { before, after: summary } : summary, null, 2) : reportText(summary, setup, before));
    if (!options.json) console.log(`\nIn ${((performance.now() - started) / 1000).toFixed(1)} s.`);
    process.exit(0);
  }
  // Balance numbers don't change the maps, so both runs share the ships.
  // A rank compares with the same fights at rank 0; otherwise the data as it
  // is, every order given.
  const started = performance.now();
  const summary = summarize(runFights(changed.rules, { ...options, ships }));
  const plain = () => rulesFor(rulesWith(data, []).rules, { squad: options.squad }).rules;
  // A talent (M33c) compares with the same fights all at rank 2.
  const before = options.compare ? summarize(runFights(options.rank ? changed.rules : plain(), { ...options, ships, rank: options.talent ? options.rank : 0, talent: null, weapon: null })) : null;
  const seconds = (performance.now() - started) / 1000;
  if (options.json) {
    console.log(JSON.stringify(before ? { before, after: summary } : summary, null, 2));
  } else {
    console.log(reportText(summary, setupText(changed.rules, options, ships, data.balance), before));
    const runs = before ? 2 : 1;
    console.log(`\n${commas(options.fights * runs)} fights in ${seconds.toFixed(1)} s (${((seconds * 1000) / (options.fights * runs)).toFixed(0)} ms a fight).`);
  }
}
