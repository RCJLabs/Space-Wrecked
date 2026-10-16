import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encodeBlueprint } from '../src/core/blueprint.js';
import { indexDefs } from '../src/sim/defs.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { readData } from '../tools/data.js';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
import { DEFAULTS, parseArgs, reportText, rulesFor, rulesWith, runFights, setupText, share, shipsFor, summarize } from '../tools/sim.js';

const data = readData();
const rules = indexDefs(data);
const run = (overrides) => runFights(rules, { ...DEFAULTS, ...overrides });

test('the command line: defaults, every option, and what is wrong with a bad one', () => {
  assert.deepEqual(parseArgs([]), DEFAULTS);
  const options = parseArgs(['--fights', '200', '--ships', 'example, hauler', '--set', 'halfCover=25', '--set', 'fullCover=50', '--crew', 'scripted', '--rounds', '20', '--seed', 'x', '--compare', '--json']);
  assert.deepEqual(options, {
    ...DEFAULTS,
    fights: 200,
    ships: ['example', 'hauler'],
    sets: [{ name: 'halfCover', value: 25 }, { name: 'fullCover', value: 50 }],
    crew: 'scripted',
    rounds: 20,
    seed: 'x',
    compare: true,
    json: true,
  });
  const wrong = [
    [['--fights', '0'], /--fights needs a whole number, 1 or more/],
    [['--fights'], /--fights needs a value/],
    [['--set', 'halfCover'], /--set needs name=number/],
    [['--boarders', 'human'], /--boarders is played by ai or scripted/],
    [['--compare'], /--compare needs a --set, --orders or --rank/],
    [['--rank', 'one'], /--rank needs a whole number, 0 or more/],
    [['--bogus'], /Unknown option "--bogus"/],
  ];
  for (const [argv, message] of wrong) assert.throws(() => parseArgs(argv), message, argv.join(' '));
});

test('a balance number can change for a run, checked like the data, the file left alone', () => {
  const changed = rulesWith(data, [{ name: 'halfCover', value: 25 }]);
  assert.ok(changed.ok);
  assert.equal(changed.rules.balance.halfCover, 25);
  assert.equal(data.balance.halfCover, 20);
  assert.deepEqual(rulesWith(data, [{ name: 'coverHalf', value: 25 }]), { ok: false, error: 'balance.json has no number "coverHalf".' });
  assert.match(rulesWith(data, [{ name: 'halfCover', value: 101 }]).error, /halfCover must be a whole number from 0 to 100/);
});

test('ships to fight on: the example, the presets, a ship script or a blueprint code', () => {
  assert.deepEqual(shipsFor(null, rules).map((s) => s.label), ['Example ship', 'Pirate cutter', 'Patrol corvette', 'Derelict hauler', 'Con-Reg repo tug', 'Con-Reg gunship', 'Provost cutter', 'Fleet frigate', 'Halloran runner', 'Halloran yacht']);
  assert.deepEqual(shipsFor(['hauler'], rules), [{ label: 'Derelict hauler', preset: 'hauler' }]);
  const [script] = shipsFor([EXAMPLE_SCRIPT], rules);
  assert.equal(script.label, 'example-ship');
  assert.deepEqual(script.map, shipsFor(['example'], rules)[0].map);
  const codes = [1, 2].map((seed) => encodeBlueprint(generateShip(rules, 'cutter', seed).ship));
  assert.deepEqual(shipsFor(codes, rules).map((s) => s.label), ['Blueprint 1', 'Blueprint 2']);
  assert.throws(() => shipsFor(['dreadnought'], rules), /No ship "dreadnought"/);
  assert.throws(() => shipsFor(['wtb.2.AAAA.ffff'], rules), /checksum doesn't match/);
});

test('a run is the same every time, and each ship keeps its own fights', () => {
  const ships = shipsFor(null, rules);
  const records = run({ ships, fights: 4 * ships.length });
  assert.deepEqual(records, run({ ships, fights: 4 * ships.length }));
  // Ships take turns, four fights each; the example ship's fights don't
  // change when the others leave the list.
  assert.deepEqual(records.map((r) => r.ship).slice(0, ships.length), ships.map((s) => s.label));
  const alone = run({ ships: [ships[0]], fights: 4 });
  assert.deepEqual(alone, records.filter((r) => r.ship === 'Example ship'));
  // Another seed, other fights.
  assert.notDeepEqual(run({ ships: [ships[0]], fights: 4, seed: 'other' }), alone);
});

test("a summary's numbers add up", () => {
  const ships = shipsFor(null, rules);
  const records = run({ ships, fights: 4 * ships.length });
  const summary = summarize(records);
  assert.equal(summary.fights, 4 * ships.length);
  for (const row of [...summary.ships, summary.all]) {
    assert.equal(row.crew.count + row.enemy.count + row.stalls.count, row.fights, row.label);
    assert.ok(row.crew.low <= row.crew.rate && row.crew.rate <= row.crew.high);
  }
  assert.deepEqual(summary.ships.map((row) => row.fights), ships.map(() => 4));
  const shots = records.flatMap((r) => r.shots);
  assert.equal(summary.shots.total, shots.length);
  assert.equal(summary.shots.bands.reduce((sum, band) => sum + band.shots, 0), shots.length);
  for (const r of records) {
    assert.ok(r.rounds >= 1 && r.rounds <= 30);
    assert.ok(r.orders.crew > 0 && r.orders.enemy > 0);
    assert.ok(r.shots.every((s) => s.hit === (s.damage > 0) && (!s.crit || s.hit)));
  }
});

test('shots land as often as the odds shown say (Law 4)', () => {
  const summary = summarize(run({ ships: shipsFor(['example'], rules), fights: 100 }));
  assert.ok(summary.shots.total > 1500, `${summary.shots.total} shots`);
  for (const band of summary.shots.bands) {
    if (band.shots < 200) continue;
    assert.ok(Math.abs(band.hit - band.shown) < 0.06, `${band.from}–${band.to}%: shown ${band.shown}, hit ${band.hit} of ${band.shots}`);
  }
});

test('a fight that runs out of rounds ends with no winner, at the limit', () => {
  const records = run({ ships: shipsFor(['example'], rules), fights: 6, rounds: 1 });
  assert.ok(records.every((r) => r.winner === null && r.rounds === 1));
  const summary = summarize(records);
  assert.equal(summary.all.stalls.rate, 1);
  assert.equal(summary.all.rounds, null);
});

test('the players can be the scripted player, and who plays changes the fights', () => {
  const ships = shipsFor(['example'], rules);
  const ai = run({ ships, fights: 6 });
  const scripted = run({ ships, fights: 6, crew: 'scripted' });
  assert.notDeepEqual(scripted, ai);
});

test('a share has a 95% interval (Wilson)', () => {
  const { rate, low, high } = share(7, 10);
  assert.equal(rate, 0.7);
  assert.equal(low.toFixed(3), '0.397');
  assert.equal(high.toFixed(3), '0.892');
  assert.deepEqual(share(0, 0), { count: 0, rate: 0, low: 0, high: 0 });
});

test('the report, and the same fights before and after a change', () => {
  const ships = shipsFor(['example', 'cutter'], rules);
  const options = { ...DEFAULTS, ships, fights: 8, sets: [{ name: 'halfCover', value: 30 }] };
  const after = summarize(runFights(rulesWith(data, options.sets).rules, options));
  const before = summarize(runFights(rules, options));
  const text = reportText(after, setupText(rules, options, ships, data.balance));
  assert.match(text, /^8 fights on example ship, pirate cutter\. The squad \(marine, engineer, medic\), played by the AI with every job order, against the boarding party/);
  assert.match(text, /with halfCover 20 → 30\./);
  assert.match(text, /\nExample ship +4 +\d+% \(\d+–\d+\)/);
  assert.match(text, /\nAll +8 /);
  assert.match(text, /\n0–19% /);
  const compared = reportText(after, 'Compared.', before);
  assert.match(compared, /\nExample ship +4 +\d+% → \d+%/);
  assert.doesNotMatch(compared, /95% interval/);
});

test('another squad, and the orders the crew gives: all, none or some kinds (M32)', () => {
  assert.deepEqual(parseArgs(['--squad', 'pilot, scout,medic', '--orders', 'mark,patch', '--compare']), { ...DEFAULTS, squad: ['pilot', 'scout', 'medic'], orders: 'mark,patch', compare: true });
  const some = rulesFor(rules, { squad: ['pilot', 'scout', 'medic'], orders: 'mark,patch' });
  assert.equal(some.ok, true, some.error);
  assert.deepEqual(some.rules.squad, ['pilot', 'scout', 'medic']);
  assert.deepEqual([...some.rules.jobs.values()].filter((job) => job.order).map((job) => job.order.type), ['patch', 'mark']);
  assert.equal(rules.jobs.get('pilot').order.type, 'hustle', 'the rules themselves are left alone');
  assert.ok([...rulesFor(rules, { orders: 'none' }).rules.jobs.values()].every((job) => job.order === null));
  assert.equal(rulesFor(rules, {}).rules.jobs, rules.jobs);
  assert.match(rulesFor(rules, { squad: ['cook'] }).error, /No job "cook"/);
  assert.match(rulesFor(rules, { orders: 'juggle' }).error, /No order "juggle"/);
  const text = setupText(rules, { ...DEFAULTS, ...parseArgs(['--orders', 'none', '--compare']) }, shipsFor(['example'], rules), data.balance);
  assert.match(text, /The squad \(marine, engineer, medic\), played by the AI with no job orders \(before: every job order\)/);
});

test('every order is used by the crew\'s AI, and the same fights without it come out differently (M32)', () => {
  const ships = shipsFor(['example', 'cutter', 'hauler'], rules);
  const kinds = { marine: 'suppress', engineer: 'weld', medic: 'patch', pilot: 'hustle', scout: 'mark', xenobiologist: 'sedate', quartermaster: 'kit' };
  for (const [job, kind] of Object.entries(kinds)) {
    const squad = job === 'medic' ? ['medic', 'marine', 'engineer'] : [job, 'engineer', 'medic'];
    const others = Object.values(kinds).filter((k) => k !== kind).join(',');
    const fights = (orders) => runFights(rulesFor(rules, { squad, orders }).rules, { ...DEFAULTS, ships, fights: 24 });
    const used = fights('all');
    const unused = fights(others);
    assert.ok(used.some((r) => r.given[kind] > 0), `${kind} is given`);
    assert.ok(unused.every((r) => !r.given[kind]), `${kind} is not given without it`);
    assert.notDeepEqual(used.map((r) => [r.winner, r.rounds]), unused.map((r) => [r.winner, r.rounds]), `${kind} changes the fights`);
  }
});

test('the crew at a rank (M32b): each order as its rank sharpens it, against the same fights at rank 0', () => {
  assert.deepEqual(parseArgs(['--rank', '1', '--compare']), { ...DEFAULTS, rank: 1, compare: true });
  const text = setupText(rules, { ...DEFAULTS, ...parseArgs(['--orders', 'weld', '--rank', '1', '--compare']) }, shipsFor(['example'], rules), data.balance);
  assert.match(text, /with only weld at rank 1 \(before: rank 0\), against/);
  const ships = shipsFor(['example', 'cutter', 'hauler'], rules);
  const kinds = { marine: 'suppress', engineer: 'weld', medic: 'patch', pilot: 'hustle', scout: 'mark', xenobiologist: 'sedate', quartermaster: 'kit' };
  for (const [job, kind] of Object.entries(kinds)) {
    const squad = job === 'medic' ? ['medic', 'marine', 'engineer'] : [job, 'engineer', 'medic'];
    const only = rulesFor(rules, { squad, orders: kind }).rules;
    const fights = (rank) => runFights(only, { ...DEFAULTS, ships, fights: 24, rank });
    const [green, ranked] = [fights(0), fights(1)];
    assert.ok(ranked.some((r) => r.given[kind] > 0), `${kind} is given at rank 1`);
    assert.notDeepEqual(ranked, green, `${kind} at rank 1 changes the fights`);
  }
});

test('the harness runs from the command line', () => {
  const tool = fileURLToPath(new URL('../tools/sim.js', import.meta.url));
  const ok = spawnSync(process.execPath, [tool, '--fights', '4', '--ships', 'example'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^4 fights on example ship\./);
  assert.match(ok.stdout, /\n4 fights in \d+\.\d s/);
  const json = spawnSync(process.execPath, [tool, '--fights', '2', '--ships', 'example', '--json'], { encoding: 'utf8' });
  assert.equal(JSON.parse(json.stdout).fights, 2);
  const bad = spawnSync(process.execPath, [tool, '--set', 'halfCover=500'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^sim: balance\.json: halfCover must be a whole number/);
});
