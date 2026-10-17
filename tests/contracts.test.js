import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { aiAction } from '../src/sim/ai.js';
import { autoplay } from '../src/sim/autoplay.js';
import { createBattle } from '../src/sim/battle.js';
import { beginFight, campaignProblems, newCampaign } from '../src/sim/campaign.js';
import { contractsIn, endJob, jobSetup, MISSIONS, rollBoard, takeJob, twistsFor, withBoard } from '../src/sim/contracts.js';
import { PAY_STEP } from '../src/sim/economy.js';
import { jobAction } from '../src/sim/jobAi.js';
import { jobOutcome, jobText, objectiveText, payText } from '../src/ui/campaign/jobText.js';
import { jobsInARow } from '../tools/jobs.js';
import { rules } from './battleKit.js';

const DISTRICT = 'tailings';
const { contracts } = rules;
const boards = Array.from({ length: 200 }, (_, i) => rollBoard(rules, i * 7919, DISTRICT).board);
const offers = boards.flat();

test('a board offers different jobs, each rolled within its template', () => {
  for (const board of boards) {
    assert.equal(board.length, contracts.boardSize);
    assert.equal(new Set(board.map((job) => job.contract)).size, board.length, 'all different');
  }
  for (const job of offers) {
    const contract = contracts.jobs.get(job.contract);
    assert.ok(contract.clients.includes(job.client));
    assert.ok(contract.sites.includes(job.site));
    const twist = job.twist ? contracts.twists.get(job.twist) : null;
    if (twist) assert.ok(twistsFor(contract, rules).includes(twist), `${job.twist} on a ${contract.mission} job`);
    const pay = (n) => PAY_STEP * Math.round((n * (100 + (twist?.pay ?? 0))) / 100 / PAY_STEP);
    assert.ok(job.credits >= pay(contract.credits[0]) && job.credits <= pay(contract.credits[1]), `${job.contract}: ${job.credits}`);
    assert.equal(job.credits % PAY_STEP, 0);
    assert.ok(job.part === null || Object.hasOwn(contract.drops?.parts ?? {}, job.part));
    assert.ok(Number.isInteger(job.seed) && job.seed >= 0 && job.seed <= 0xffffffff);
  }
  assert.deepEqual(rollBoard(rules, 42, DISTRICT), rollBoard(rules, 42, DISTRICT), 'the same RNG state, the same board');
  assert.notDeepEqual(rollBoard(rules, 42, DISTRICT).rng, 42, 'and the state moves on');
});

test('over many boards, every job, client, site, mission and twist turns up', () => {
  const seen = (key) => new Set(offers.map((job) => job[key]));
  assert.equal(seen('contract').size, contractsIn(rules, DISTRICT).length);
  assert.equal(seen('client').size, rules.districts.get(DISTRICT).clients.length);
  assert.equal(seen('site').size, rules.districts.get(DISTRICT).sites.length);
  assert.deepEqual(new Set(offers.map((job) => contracts.jobs.get(job.contract).mission)), new Set(MISSIONS));
  assert.deepEqual(seen('twist'), new Set([null, ...contracts.twists.keys()]));
  const twisted = offers.filter((job) => job.twist).length / offers.length;
  assert.ok(Math.abs(twisted - contracts.twistChance / 100) < 0.06, `twists on ${Math.round(twisted * 100)}%`);
  for (const job of offers.filter((o) => o.twist === 'rush')) assert.notEqual(contracts.jobs.get(job.contract).mission, 'clear', 'no deadline on a clear-out');
  assert.equal(contractsIn(rules, 'nowhere').length, 0);
  assert.deepEqual(rollBoard(rules, 1, 'nowhere'), { board: [], rng: 1 });
  // M30: each district's boards offer its own jobs, clients and sites, and
  // every job belongs to one district.
  for (const district of rules.districts.values()) {
    const own = Array.from({ length: 200 }, (_, i) => rollBoard(rules, i * 7919, district.id).board).flat();
    assert.equal(new Set(own.map((job) => job.contract)).size, contractsIn(rules, district.id).length, district.id);
    assert.equal(new Set(own.map((job) => job.client)).size, district.clients.length, district.id);
    assert.equal(new Set(own.map((job) => job.site)).size, district.sites.length, district.id);
  }
  // Every job but a quest's own (M33b), which is never on the rotation,
  // belongs to one district's.
  const questJobs = [...contracts.jobs.values()].filter((job) => job.quest);
  assert.equal(questJobs.length, 3);
  assert.equal([...rules.districts.keys()].reduce((sum, id) => sum + contractsIn(rules, id).length, 0), contracts.jobs.size - questJobs.length);
  for (const district of rules.districts.keys()) assert.ok(contractsIn(rules, district).every((job) => !job.quest), district);
});

test('a new board offers none of the jobs skipped', () => {
  for (const [i, board] of boards.slice(0, 50).entries()) {
    const skip = board.map((job) => job.contract);
    const next = rollBoard(rules, i, DISTRICT, skip).board;
    assert.equal(next.length, contracts.boardSize);
    assert.ok(next.every((job) => !skip.includes(job.contract)), `board ${i}`);
  }
});

// The repossession is Ma Prewitt's late husband's one engine (once: true).
test('a job done once never comes back; lost, it can', () => {
  let campaign = null;
  for (let seed = 1; !campaign; seed++) {
    const tried = withBoard(newCampaign(rules, seed), rules);
    if (tried.board.some((job) => job.contract === 'repo')) campaign = tried;
  }
  const on = takeJob(campaign, rules, campaign.board.findIndex((job) => job.contract === 'repo')).campaign;
  const end = (fought, winner) => endJob({ ...fought, fight: { ...fought.fight, battle: { ...fought.fight.battle, winner } } }, rules);
  assert.deepEqual(end(on, 'enemy').spent, [], 'lost: it can come again');
  const done = end(on, 'crew');
  assert.deepEqual(done.spent, ['repo']);
  assert.deepEqual(campaignProblems(done), []);
  let later = done;
  for (let n = 0; n < 30; n++) {
    assert.ok(!later.board.some((job) => job.contract === 'repo'), `board ${n}`);
    later = end(takeJob({ ...later, heat: 0 }, rules, 0).campaign, 'crew');
  }
  assert.deepEqual(later.spent, ['repo'], 'counted once');
  assert.match(campaignProblems({ ...done, spent: ['repo', 'repo'] }).join(' '), /jobs done once are unreadable/);
  assert.match(campaignProblems({ ...done, spent: 'repo' }).join(' '), /jobs done once are unreadable/);
});

test('a hub gets a board when it has none, and only then', () => {
  const campaign = newCampaign(rules, 5);
  const boarded = withBoard(campaign, rules);
  assert.equal(boarded.board.length, contracts.boardSize);
  assert.notEqual(boarded.rng, campaign.rng);
  assert.deepEqual(boarded, withBoard(structuredClone(campaign), rules), 'seeded by the campaign');
  assert.equal(withBoard(boarded, rules), boarded, 'a board already');
  const fighting = beginFight(campaign, rules).campaign;
  assert.equal(withBoard(fighting, rules), fighting, 'not during a fight');
  const lost = { ...campaign, background: 'nobody' };
  assert.equal(withBoard(lost, rules), lost, 'no district: no board');
});

test("a job's fight: the site, the crew at the way in, the enemies at the spawn tiles, the mission and the twist", () => {
  const crew = newCampaign(rules, 1).crew;
  for (const job of offers.slice(0, 120)) {
    const contract = contracts.jobs.get(job.contract);
    const twist = job.twist ? contracts.twists.get(job.twist) : null;
    const setup = jobSetup(job, rules, crew);
    assert.deepEqual(jobSetup(job, rules, crew), setup, 'the same job, the same fight');
    const { battle } = createBattle(setup, rules);
    assert.equal(battle.map.site, rules.sites.get(job.site).map);
    const ours = battle.units.filter((u) => u.side === 'crew');
    const theirs = battle.units.filter((u) => u.side === 'enemy');
    assert.deepEqual(ours.map((u) => [u.name, u.kind]), crew.map((m) => [m.name, m.job]));
    const size = rules.encounters.get(contract.encounter).enemies.length;
    assert.equal(theirs.length, size + (twist?.enemies ?? 0), `${job.contract} ${job.twist}`);
    assert.ok(theirs.every((u) => rules.encounters.get(contract.encounter).enemies.includes(u.kind)));
    assert.equal(new Set(battle.units.map((u) => `${u.x},${u.y}`)).size, battle.units.length, 'one to a tile');
    const { objective, options } = battle;
    if (contract.mission === 'clear') assert.equal(objective, null);
    if (contract.mission === 'grab') assert.equal(objective.crates.length, contract.crates);
    if (contract.mission === 'hack') assert.deepEqual([objective.type, objective.turns], ['hack', contract.turns]);
    assert.equal(options.sight, twist?.sight);
    assert.equal(options.deadline, twist?.deadline);
    const laid = battle.map.hazards.cells.filter(Boolean);
    assert.ok(twist?.hazard ? laid.length && laid.every((h) => h === twist.hazard) : !laid.length);
  }
});

test('taking a job begins its fight, and says why when it can\'t', () => {
  const campaign = withBoard(newCampaign(rules, 9), rules);
  const taken = takeJob(campaign, rules, 2);
  assert.ok(taken.ok, taken.error);
  const { fight } = taken.campaign;
  assert.equal(taken.campaign.place, 'fight');
  assert.deepEqual(fight.job, campaign.board[2]);
  assert.equal(fight.seed, campaign.board[2].seed);
  assert.equal(fight.encounter, contracts.jobs.get(campaign.board[2].contract).encounter);
  assert.deepEqual(fight.crew, [1, 2, 3]);
  assert.equal(taken.campaign.rng, campaign.rng, 'the job was rolled with the board: nothing more to roll');
  assert.deepEqual(campaignProblems(taken.campaign), []);
  assert.deepEqual(takeJob(taken.campaign, rules, 0), { ok: false, error: 'A fight is on already.' });
  assert.deepEqual(takeJob(campaign, rules, 3), { ok: false, error: 'That job is gone.' });
  assert.deepEqual(takeJob({ ...campaign, board: [{ ...campaign.board[0], contract: 'heist' }] }, rules, 0), { ok: false, error: 'That job is gone.' });
  assert.deepEqual(takeJob({ ...campaign, crew: [] }, rules, 0), { ok: false, error: 'There is no one to send.' });
  assert.deepEqual(takeJob({ ...campaign, crew: [{ ...campaign.crew[0], job: 'cook' }] }, rules, 0), { ok: false, error: `${campaign.crew[0].name}'s job "cook" is unknown.` });
  const crowd = Array.from({ length: 6 }, (_, i) => ({ ...campaign.crew[0], id: i + 1 }));
  assert.match(takeJob({ ...campaign, crew: crowd }, rules, 0).error, /^That job can't start: .* room for 5 crew/);
});

test('a job done pays, a job lost doesn\'t, and either way the crew heals and the board is new', () => {
  const rolled = withBoard(newCampaign(rules, 9), rules);
  // The first job, paying an engine as well.
  const campaign = { ...rolled, board: [{ ...rolled.board[0], part: 'engine' }, ...rolled.board.slice(1)] };
  const job = campaign.board[0];
  const on = takeJob(campaign, rules, 0).campaign;
  const ended = (winner) => {
    const units = on.fight.battle.units.map((u) => (u.side === 'crew' ? { ...u, hp: 1 } : u));
    return endJob({ ...on, fight: { ...on.fight, battle: { ...on.fight.battle, units, winner } } }, rules);
  };
  const won = ended('crew');
  assert.equal(won.place, 'hub');
  assert.equal(won.credits, campaign.credits + job.credits);
  assert.equal(won.parts[job.part], (campaign.parts[job.part] ?? 0) + 1);
  assert.deepEqual(won.flags, { fightsWon: 1, jobsDone: 1 });
  assert.deepEqual(won.crew.map((m) => m.hp), [10, 8, 8], 'healed at the hangar');
  assert.equal(won.board.length, contracts.boardSize);
  assert.ok(won.board.every((offer) => !campaign.board.some((old) => old.contract === offer.contract)), 'none of the old board');
  assert.deepEqual(campaignProblems(won), []);
  const lost = ended('enemy');
  assert.equal(lost.credits, campaign.credits);
  assert.deepEqual(lost.parts, campaign.parts);
  assert.deepEqual(lost.flags, { fightsLost: 1, jobsFailed: 1 });
  assert.deepEqual(lost.board, won.board, 'the same roll either way');
  assert.equal(endJob(on, rules), on, 'a fight still going is left alone');
  // A fight at home isn't a job: no pay, and the board stays.
  const home = beginFight(campaign, rules).campaign;
  const over = endJob({ ...home, fight: { ...home.fight, battle: { ...home.fight.battle, winner: 'crew' } } }, rules);
  assert.equal(over.credits, campaign.credits);
  assert.deepEqual(over.board, campaign.board);
});

// The crew player the tools use can do every kind of job, and its fights
// end: done, lost, or out of time.
test('jobs play out to the end, and each kind can be done', () => {
  const done = new Set();
  const crew = newCampaign(rules, 1).crew;
  for (const job of offers.slice(0, 60)) {
    const { battle, events } = autoplay(jobSetup(job, rules, crew), rules, { crew: jobAction, enemy: aiAction }, { maxRounds: 30 });
    assert.ok(battle.winner, `${job.contract} seed ${job.seed}: no winner after 30 rounds`);
    const over = events.findLast((event) => event.type === 'over');
    if (battle.winner === 'crew') done.add(contracts.jobs.get(job.contract).mission);
    if (over.reason === 'deadline') assert.ok(job.twist === 'rush');
  }
  assert.deepEqual(done, new Set(MISSIONS));
});

test('a job in words: the board card, the objective and the pay', () => {
  const job = { contract: 'repo', client: 'prewitt', site: 'depot', twist: 'rush', seed: 7, credits: 35, part: 'engine' };
  assert.deepEqual(jobText(job, rules), {
    title: 'Repossession',
    who: 'Ma Prewitt, your landlady',
    where: 'Depot 4',
    pitch: "Con-Reg impounded Ma Prewitt's late husband's engine for storage fees. It's sitting in Depot 4. She'd like it back. You'd like it more.",
    mission: 'Grab and go',
    brief: "Grab 1 tagged crate. You have to stand right beside a crate to grab it, and the job's done when the last one's in hand.",
    twist: { name: 'Rush job', text: 'Done by the end of round 6, or nobody gets paid.' },
    // M37: Con-Reg's breacher among them.
    against: 'Recovery agent, Hired heavy, Con-Reg breacher',
    // M33: whom it is against, and no client's side to add to the pay.
    sides: 'Against Con-Reg: −2 done or lost.',
    pay: '35 credits + Engine',
    bonus: null,
    heat: '+8 heat',
    // M37: what a win can leave the crew.
    gear: 'Win: 30% to pick up one of their weapons.',
  });
  assert.equal(jobText({ ...job, contract: 'jumpers', site: 'pit9', client: 'marta', twist: null }, rules).heat, '+15 heat, loud');
  assert.equal(jobText(job, rules, ['agent']).against, 'Recovery agent ×2, Hired heavy, Con-Reg breacher', 'a hunter along');
  assert.equal(jobText({ ...job, site: 'yard', contract: 'scrap', client: 'dutch', twist: null }, rules).where, 'The Cable Street yard');
  assert.equal(jobText({ ...job, contract: 'payroll', site: 'pit9', client: 'marta', twist: 'overtime' }, rules).brief, "Work the terminal for 2 turns. It takes a crew member's whole turn, and it only counts once a round.");
  assert.equal(jobText({ ...job, contract: 'scrap', site: 'yard', client: 'dutch', twist: null }, rules).brief, "Grab 3 tagged crates. You have to stand right beside a crate to grab it, and the job's done when the last one's in hand.");
  assert.equal(payText({ ...job, part: null, credits: 1250 }, rules), '1,250 credits');
  for (const gone of [{ contract: 'heist' }, { client: 'nobody' }, { site: 'moon' }]) assert.equal(jobText({ ...job, ...gone }, rules), null, 'a job the content no longer has');
  const { battle } = createBattle(jobSetup(job, rules, newCampaign(rules, 1).crew), rules);
  assert.deepEqual(objectiveText(battle, job, rules), { title: 'Grab and go', progress: 'Crates: 0 of 1', done: false, deadline: 'Round 1 of 6' });
  const clear = { contract: 'jumpers', client: 'marta', site: 'pit9', twist: null, seed: 7, credits: 80, part: null };
  const cleared = createBattle(jobSetup(clear, rules, newCampaign(rules, 1).crew), rules).battle;
  assert.deepEqual(objectiveText(cleared, clear, rules), { title: 'Clear out', progress: '4 left standing', done: false, deadline: null });
  assert.equal(objectiveText(cleared, null, rules), null);
  assert.deepEqual(jobOutcome({ ...battle, winner: 'crew' }, job, rules), { tone: 'good', title: 'Job done', text: 'Paid 35 credits + Engine. Heat +8.' });
  assert.deepEqual(jobOutcome({ ...battle, winner: 'enemy' }, job, rules, [{ type: 'over', winner: 'enemy', reason: 'deadline' }]), { tone: 'bad', title: 'Job lost', text: 'Out of time: no pay. Heat +8.' });
  assert.deepEqual(jobOutcome({ ...battle, winner: 'enemy' }, job, rules, []), { tone: 'bad', title: 'Job lost', text: 'The crew is down: no pay. Heat +8.' });
});

test('ten jobs in a row from a new campaign all play out, a raid too, and the tool prints them', () => {
  const { lines, raids } = jobsInARow(rules, 1, 10);
  assert.equal(lines.filter((line) => /^\d+\. /.test(line)).length, 10);
  assert.equal(lines.filter((line) => /^ {3}(Done|Lost) in round \d+.*\. Heat \d+, (calm|rumors|hunters|raid)\.$/.test(line)).length, 10);
  assert.equal(lines.filter((line) => /^ {3}Raid at heat \d+: (held|lost.*) in round \d+\. Heat \d+\.$/.test(line)).length, raids);
  assert.ok(raids > 0, 'ignoring heat, a raid came');
  assert.match(lines.at(-1), /^After: \d+ credits; on hand: .*; \d+ done, \d+ lost; heat \d+, \d+ raids?(, and one at the door)?\.$/);
  const tool = fileURLToPath(new URL('../tools/jobs.js', import.meta.url));
  const run = spawnSync(process.execPath, [tool, '--seed', '1'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, `${lines.join('\n')}\n`);
  const managed = spawnSync(process.execPath, [tool, '--seed', '1', '--manage', '--count', '12'], { encoding: 'utf8' });
  assert.equal(managed.stdout, `${jobsInARow(rules, 1, 12, { manage: true }).lines.join('\n')}\n`);
  assert.match(managed.stdout, /A payment on the debt: heat \d+ to \d+/);
});
