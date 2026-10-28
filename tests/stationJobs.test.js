// Jobs at the stations (M38c): every station on the run posts a board of
// its side's clients' jobs (nobody's, of the clients of no side), rolled
// afresh at each visit without moving the campaign's RNG; a job taken is
// gone till the ship leaves; a squad goes, with no hunters; and after it
// act 1's pay, heat and standing, with the wounds kept and the dead gone,
// counted apart from act 1's jobs. Saves keep the jobs taken this visit.
// tools/jobs.js --stations prints them, and the test player's numbers for
// them come from its --odds.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { campaignProblems } from '../src/sim/campaign.js';
import { contractsIn, endJob, jobSetup, MISSIONS } from '../src/sim/contracts.js';
import { defaultSquad } from '../src/sim/crew.js';
import { jobHeat, pursuerOf, withHeat } from '../src/sim/heat.js';
import { launch } from '../src/sim/launch.js';
import { campaignScreen, initialState, reduce, saveData } from '../src/sim/root.js';
import { jobMoves, jobPay, standingWith, stationSide } from '../src/sim/standing.js';
import { stationBoard, stationClients, stationContracts, stationHere, takeStationJob } from '../src/sim/stationJobs.js';
import { beginRun, jump, linked } from '../src/sim/travel.js';
import { stationJobsText } from '../tools/jobs.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { docks, contracts, balance } = rules;
const SIDES = [...rules.factions.sides.keys(), null];
const atStations = [...contracts.jobs.values()].filter((job) => job.sites.every((site) => docks.sites.includes(site)));
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
const fresh = onRun({ credits: 300 });
const stations = fresh.run.sector.nodes.filter((node) => node.type === 'station');
// The ship at node `id`, as though it had jumped there.
const at = (campaign, id) => ({ ...campaign, run: { ...campaign.run, at: id, seen: [...new Set([...campaign.run.seen, id])], docked: false, jobbed: [] } });
// The ship at a station renamed `name`, so it is whose that name says.
const atNamed = (campaign, name) => {
  const { id } = stations[0];
  const nodes = campaign.run.sector.nodes.map((node) => (node.id === id ? { ...node, name } : node));
  return at({ ...campaign, run: { ...campaign.run, sector: { ...campaign.run.sector, nodes } } }, id);
};
// A station of each side, and one of nobody's, by name.
const NAMES = rules.sectors.names.stations;
const NAMED = Object.fromEntries(SIDES.map((side) => [side ?? 'nobody', NAMES.find((name) => (rules.factions.stations[name] ?? null) === side)]));

test('15 station jobs, at the docks and on the rocks, with all eight missions; no district posts one', () => {
  assert.equal(atStations.length, 15);
  assert.deepEqual([...new Set(atStations.map((job) => job.mission))].sort(), [...MISSIONS].sort());
  assert.ok(atStations.every((job) => !job.quest && job.clients.every((id) => docks.clients.includes(id))));
  for (const district of rules.districts.keys()) assert.ok(contractsIn(rules, district).every((job) => !atStations.includes(job)), district);
  // Two docks and two rocks, each site map naming its look.
  const looks = docks.sites.map((id) => rules.siteMaps.get(rules.sites.get(id).map).look);
  assert.deepEqual(looks.sort(), ['dock', 'dock', 'rock', 'rock']);
  // Each side's stations, and nobody's, have twice a board to post.
  for (const side of SIDES) assert.ok(stationContracts(rules, side).length >= 2 * docks.board, `${side}: ${stationContracts(rules, side).length}`);
});

test("a station's board: its side's clients' jobs, with the station's name, the same all visit, and the campaign's RNG untouched", () => {
  for (const side of SIDES) {
    const campaign = atNamed(fresh, NAMED[side ?? 'nobody']);
    assert.equal(stationSide(stationHere(campaign, rules), rules), side);
    const board = stationBoard(campaign, rules);
    assert.equal(board.length, docks.board);
    assert.equal(new Set(board.map((job) => job.contract)).size, board.length, 'all different');
    for (const job of board) {
      const contract = contracts.jobs.get(job.contract);
      assert.ok(stationClients(contract, rules, side).includes(job.client), `${job.contract} for ${job.client}`);
      assert.equal(rules.clients.get(job.client).side ?? null, side);
      assert.ok(contract.sites.includes(job.site));
      assert.ok(job.credits >= 20 && job.credits <= 200, `${job.contract}: ${job.credits}`);
      assert.equal(job.station, NAMED[side ?? 'nobody']);
    }
    assert.deepEqual(stationBoard(campaign, rules), board, 'the same however often it is looked at');
  }
  const campaign = at(fresh, stations[0].id);
  stationBoard(campaign, rules);
  assert.equal(campaign.rng, fresh.rng);
});

test('a fresh board at each visit: the jumps made seed it', () => {
  // The same station, visited after different numbers of jumps, posts
  // different boards: over 20 visits, more than a few kinds.
  const campaign = at(fresh, stations[0].id);
  const boards = Array.from({ length: 20 }, (_, jumps) => stationBoard({ ...campaign, flags: { ...campaign.flags, jumps } }, rules).map((job) => `${job.contract}:${job.seed}`).join());
  assert.ok(new Set(boards).size >= 15, `${new Set(boards).size} different boards in 20 visits`);
  // A jump is a new visit wherever it goes: one more jump made, and no job
  // taken yet where the ship comes out.
  const taken = takeStationJob(campaign, rules, 0).campaign;
  const ended = endJob({ ...taken, fight: { ...taken.fight, battle: { ...taken.fight.battle, winner: 'crew' } } }, rules);
  const next = linked(fresh.run.sector, stations[0].id)[0];
  const away = jump({ ...ended, supplies: 50 }, rules, next);
  assert.ok(away.ok, away.error);
  assert.deepEqual(away.campaign.run.jobbed, []);
  assert.equal(away.campaign.flags.jumps, (ended.flags.jumps ?? 0) + 1);
});

test('no board away from a station: elsewhere on the chart, at a shipyard, or off the run', () => {
  const elsewhere = fresh.run.sector.nodes.find((node) => !['station'].includes(node.type));
  assert.deepEqual(stationBoard(at(fresh, elsewhere.id), rules), []);
  const yard = fresh.run.sector.nodes.find((node) => node.type === 'shipyard');
  if (yard) assert.deepEqual(stationBoard(at(fresh, yard.id), rules), []);
  assert.deepEqual(stationBoard({ ...fresh, place: 'fight' }, rules), []);
  assert.equal(stationHere(readyToLaunch(), rules), null);
  assert.deepEqual(takeStationJob(at(fresh, elsewhere.id), rules, 0), { ok: false, error: 'Work on the run is taken at a station.' });
});

test('taking a job sends a squad, the healthiest by default, with no hunters even at high heat', () => {
  const hot = { ...at(fresh, stations[0].id), heat: 80 };
  // Four aboard, so one sits it out.
  const crew = [...hot.crew, { ...hot.crew[1], id: 9, name: 'Ada Hale', hp: 2 }];
  const campaign = { ...hot, crew };
  const board = stationBoard(campaign, rules);
  const taken = takeStationJob(campaign, rules, 0);
  assert.ok(taken.ok, taken.error);
  const { fight } = taken.campaign;
  assert.equal(taken.campaign.place, 'fight');
  assert.deepEqual(fight.job, board[0]);
  assert.deepEqual(fight.crew, defaultSquad(crew, rules));
  assert.equal(fight.crew.length, balance.squadSize);
  assert.ok(!fight.crew.includes(9), 'the wounded one sits it out');
  // The enemies are the job's alone: no hunters join it at a station,
  // though at this heat they would join one of act 1's.
  assert.ok(campaign.heat >= balance.huntHeat && pursuerOf(campaign, rules).hunters.length > 0);
  const alone = jobSetup(board[0], rules, crew.filter((m) => fight.crew.includes(m.id)), { hunters: [] });
  const enemies = (units) => units.filter((u) => rules.enemies.has(u.kind)).map((u) => u.kind).sort();
  assert.deepEqual(enemies(fight.battle.units), enemies(alone.units));
  assert.deepEqual(taken.campaign.run.jobbed, [board[0].contract]);
  assert.equal(taken.campaign.rng, campaign.rng);
  assert.deepEqual(campaignProblems(taken.campaign), []);
  // A squad picked instead.
  const picked = takeStationJob(campaign, rules, 1, [crew[0].id, 9]);
  assert.ok(picked.ok, picked.error);
  assert.deepEqual(picked.campaign.fight.crew, [crew[0].id, 9]);
  // Why not, when not.
  assert.deepEqual(takeStationJob(taken.campaign, rules, 0), { ok: false, error: 'A fight is on already.' });
  assert.deepEqual(takeStationJob(campaign, rules, docks.board), { ok: false, error: 'That job is gone.' });
  assert.deepEqual(takeStationJob(campaign, rules, 0, []), { ok: false, error: 'Pick someone to go.' });
  assert.deepEqual(takeStationJob(campaign, rules, 0, crew.map((m) => m.id)), { ok: false, error: `A squad is ${balance.squadSize} at most.` });
});

test('a job taken is gone from the board till the ship leaves', () => {
  const campaign = at(fresh, stations[0].id);
  const board = stationBoard(campaign, rules);
  const taken = takeStationJob(campaign, rules, 1).campaign;
  const after = endJob({ ...taken, fight: { ...taken.fight, battle: { ...taken.fight.battle, winner: 'crew' } } }, rules);
  assert.deepEqual(stationBoard(after, rules), board.filter((_, i) => i !== 1));
});

test("at a station of the pursuer's side, a job is a trade: they log the ship, once a visit", () => {
  const side = pursuerOf(fresh, rules).side;
  const campaign = atNamed(fresh, NAMED[side]);
  const taken = takeStationJob(campaign, rules, 0).campaign;
  assert.equal(taken.heat, withHeat(campaign.heat, balance.dockHeat));
  assert.equal(taken.run.docked, true);
  const docked = takeStationJob({ ...campaign, run: { ...campaign.run, docked: true } }, rules, 0).campaign;
  assert.equal(docked.heat, campaign.heat, 'docked already this visit');
  const other = takeStationJob(atNamed(fresh, NAMED.nobody), rules, 0).campaign;
  assert.equal(other.heat, fresh.heat, "nobody's station logs nothing");
});

test("after a station's job: act 1's pay, heat and standing; wounds kept, the dead gone; counted apart; back to the chart", () => {
  const campaign = { ...atNamed(fresh, NAMED.union), heat: 20 };
  const board = stationBoard(campaign, rules);
  const job = { ...board[0], part: 'engine' };
  const on = takeStationJob(campaign, rules, 0).campaign;
  const placed = { ...on, fight: { ...on.fight, job } };
  // With permadeath (a setting to come, M41) a crew member who bleeds out
  // dies: one who isn't the captain, here.
  const doomed = `c${placed.fight.crew.findIndex((id) => id !== campaign.captain) + 1}`;
  const ended = (winner, dead = false) => {
    const units = placed.fight.battle.units.map((u) => (u.side === 'crew' && !u.ward ? { ...u, hp: dead && u.id === doomed ? 0 : 1, status: dead && u.id === doomed ? 'dead' : u.status } : u));
    return endJob({ ...placed, fight: { ...placed.fight, battle: { ...placed.fight.battle, units, winner } } }, rules);
  };
  const won = ended('crew');
  assert.equal(won.place, 'hub');
  assert.equal(campaignScreen(won), 'sector');
  assert.equal(won.credits, campaign.credits + jobPay(campaign, rules, job));
  assert.equal(won.parts.engine, (campaign.parts.engine ?? 0) + 1);
  assert.equal(won.heat, withHeat(campaign.heat, jobHeat(job, rules).heat));
  assert.ok(jobHeat(job, rules).heat >= balance.jobHeat);
  const moves = Object.entries(jobMoves(job, rules, true));
  assert.ok(moves.length > 0);
  for (const [side, by] of moves) assert.equal(standingWith(won, side), standingWith(campaign, side) + by, side);
  assert.equal(won.flags.stationJobsDone, 1);
  assert.equal(won.flags.fightsWon, (campaign.flags.fightsWon ?? 0) + 1);
  assert.equal(won.flags.jobsDone, campaign.flags.jobsDone, "act 1's count is act 1's");
  // Wounds stay on the run: those who went are at 1, the rest as they were.
  for (const member of won.crew) assert.equal(member.hp, on.fight.crew.includes(member.id) ? 1 : campaign.crew.find((m) => m.id === member.id).hp, member.name);
  // Act 1's board, shop and RNG are left alone.
  assert.deepEqual([won.board, won.shop, won.spent, won.rng], [campaign.board, campaign.shop, campaign.spent, campaign.rng]);
  assert.deepEqual(campaignProblems(won), []);
  const lost = ended('enemy', true);
  assert.equal(lost.credits, campaign.credits);
  assert.equal(lost.heat, won.heat, 'heat, done or lost');
  assert.equal(lost.flags.stationJobsFailed, 1);
  assert.equal(lost.flags.stationJobsDone, undefined);
  assert.equal(lost.crew.length, campaign.crew.length - 1, 'the dead are gone');
  assert.deepEqual(campaignProblems(lost), []);
});

test('the store takes a station job into its fight and brings the crew back to the chart', () => {
  const campaign = at(fresh, stations[0].id);
  const state = { ...initialState(7), campaign, screen: 'jobs' };
  const fought = reduce(state, { type: 'campaign/job/station', index: 0, rules });
  assert.equal(fought.screen, 'campaign-fight');
  assert.equal(fought.campaign.fight.job.station, stations[0].name);
  const { fight } = fought.campaign;
  const over = reduce({ ...fought, campaign: { ...fought.campaign, fight: { ...fight, battle: { ...fight.battle, winner: 'crew' } } } }, { type: 'campaign/fight/end', rules });
  assert.equal(over.screen, 'sector');
  assert.equal(over.campaign.flags.stationJobsDone, 1);
  assert.equal(reduce({ ...state, campaign: { ...campaign, crew: [] } }, { type: 'campaign/job/station', index: 0, rules }).screen, 'jobs', 'turned down: nothing changes');
});

test('saves: v35 keeps the jobs taken this visit, and a v34 run takes none', () => {
  assert.equal(SAVE_VERSION, 52);
  const campaign = at(fresh, stations[0].id);
  const taken = takeStationJob(campaign, rules, 0).campaign;
  const loaded = parseSave(JSON.stringify(makeSave(saveData({ ...initialState(7), campaign: taken }))));
  assert.ok(loaded.ok, loaded.error);
  assert.deepEqual(loaded.save.data.campaign.run.jobbed, taken.run.jobbed);
  assert.deepEqual(loaded.save.data.campaign.fight.job, taken.fight.job);
  // A run saved at v34 has no jobbed; it migrates to none taken.
  const { jobbed, ...old } = campaign.run;
  const v34 = { ...makeSave(saveData({ ...initialState(7), campaign: { ...campaign, run: old } })), version: 34 };
  assert.equal(jobbed.length, 0);
  const migrated = parseSave(JSON.stringify(v34));
  assert.ok(migrated.ok, migrated.error);
  assert.deepEqual(migrated.save.data.campaign.run.jobbed, []);
  assert.equal(MIGRATIONS.at(-1).from, SAVE_VERSION - 1);
  // Jobs taken where no station is, or twice, don't read.
  assert.match(campaignProblems({ ...campaign, run: { ...campaign.run, jobbed: ['undeclared', 'undeclared'] } }).join(), /jobs taken/);
  const elsewhere = fresh.run.sector.nodes.find((node) => node.type !== 'station').id;
  assert.match(campaignProblems({ ...at(fresh, elsewhere), run: { ...at(fresh, elsewhere).run, jobbed: ['undeclared'] } }).join(), /jobs taken/);
});

test("tools/jobs.js --stations prints every station job, whose stations post it and its pay; with --odds, how often the test crew wins it and the hit points it costs", () => {
  const plain = stationJobsText(rules);
  assert.equal(plain.lines.length, 1 + atStations.length);
  assert.match(plain.lines[0], /^15 station jobs; a board posts 3:$/);
  for (const job of atStations) assert.ok(plain.lines.some((line) => line.includes(`(${job.id}): `) && line.includes(`${job.credits[0]} to ${job.credits[1]} credits.`)), job.id);
  assert.match(plain.lines.find((line) => line.includes('(safepassage)')), /posted at the Fleet's, the Hallorans' and nobody's stations/);
  const measured = stationJobsText(rules, { odds: 2 });
  assert.deepEqual(Object.keys(measured.rates).sort(), atStations.map((job) => job.id).sort());
  for (const job of atStations) {
    assert.ok([0, 0.5, 1].includes(measured.rates[job.id]), `${job.id} won ${measured.rates[job.id]}`);
    assert.ok(measured.wounds[job.id] >= 0, `${job.id} lost ${measured.wounds[job.id]}`);
  }
  assert.match(measured.lines.find((line) => line.includes('(holdberth)')), /; won \d+%, \d+ hit points lost\.$/);
});
