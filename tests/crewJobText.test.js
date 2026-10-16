// M32: the words for a crew job's order, ship effect and colony effect,
// made from its numbers in data/jobs.json. Every kind the rules know has
// its words, so a job made of known kinds needs no code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLONY_EFFECTS, STATION_EFFECTS } from '../src/sim/edges.js';
import { ORDER_KINDS } from '../src/sim/orders.js';
import { captainText } from '../src/ui/campaign/captainText.js';
import { byJob, COLONY_SHORT, COLONY_WORDS, jobBrief, jobName, jobSaid, ORDER_SHORT, ORDER_WORDS, rankGives, rankLine, rankUpLines, STATION_SHORT, STATION_WORDS } from '../src/ui/campaign/crewJobText.js';
import { crewCardText } from '../src/ui/campaign/crewText.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

test('every order kind and every ship and colony effect has its words', () => {
  assert.deepEqual(Object.keys(ORDER_WORDS).sort(), Object.keys(ORDER_KINDS).sort());
  assert.deepEqual(Object.keys(ORDER_SHORT).sort(), Object.keys(ORDER_KINDS).sort());
  assert.deepEqual(Object.keys(STATION_WORDS).sort(), Object.keys(STATION_EFFECTS).sort());
  assert.deepEqual(Object.keys(COLONY_WORDS).sort(), Object.keys(COLONY_EFFECTS).sort());
  assert.deepEqual(Object.keys(STATION_SHORT).sort(), Object.keys(STATION_EFFECTS).sort());
  assert.deepEqual(Object.keys(COLONY_SHORT).sort(), Object.keys(COLONY_EFFECTS).sort());
});

test('the crew card and the recruits say what each job brings on a line; the captain screen in full', () => {
  assert.deepEqual([...rules.jobs.keys()].map((job) => jobBrief(job, rules)), [
    'Suppress ×2 · guns +10 · lander shots +10',
    'Weld ×2 · fixes a wreck a jump · mines +1',
    'Patch ×2 · med bay +1 · infirmary +1',
    'Hustle ×1 · evasion +10 · trips −1 day',
    'Mark ×2 · scans +1 link · +1 place',
    'Sedate ×2 · free surveys · farms +1',
    'Kit out ×2 · lockers +10 · stores +20',
  ]);
  assert.equal(jobBrief('cook', rules), '');
  const card = crewCardText(readyToLaunch(), rules);
  assert.deepEqual(card.members.map((member) => member.brief), card.members.map((member, i) => jobBrief(readyToLaunch().crew[i].job, rules)));
  const draft = { name: 'Ash', job: 'pilot', traits: [], look: null };
  const deserter = captainText(rules, draft, 'deserter');
  assert.deepEqual(deserter.jobs.map((job) => job.id), ['marine', 'pilot', 'medic']);
  assert.deepEqual(deserter.does, Object.values(jobSaid('pilot', rules)));
  assert.deepEqual(captainText(rules, { ...draft, job: null }, 'deserter').does, []);
});

test("each job says its order, what it does aboard and what it does at the colony, from its numbers", () => {
  for (const job of rules.jobs.values()) {
    const said = jobSaid(job.id, rules);
    assert.ok(said.order?.startsWith(`${job.order.name}, ${job.order.uses} a fight: `), job.id);
    assert.ok(said.ship?.startsWith('Aboard: '), job.id);
    assert.ok(said.colony?.startsWith('At the colony: '), job.id);
  }
  assert.deepEqual(jobSaid('marine', rules), {
    order: "Suppress, 2 a fight: an enemy in sight shoots at −30 to hit until its side's next turn ends. It ends the turn.",
    ship: "Aboard: the ship's guns are +10 to hit in the approach.",
    colony: "At the colony: each defense's shot at a lander is +10 to hit.",
  });
  assert.deepEqual(jobSaid('pilot', rules), {
    order: 'Hustle, 1 a fight: 1 more action this turn.',
    ship: "Aboard: the ship's evasion is +10 in the approach.",
    colony: 'At the colony: in the squad, a trip is 1 day shorter each way, never under 1.',
  });
  assert.equal(jobSaid('quartermaster', rules).colony, 'At the colony: the stores keep 20 more food and 20 more materials.');
  assert.deepEqual(jobSaid('cook', rules), { order: null, ship: null, colony: null });
  assert.equal(jobName('scout', rules), 'Scout');
  assert.equal(jobName('cook', rules), 'cook');
  assert.equal(byJob({ name: 'Mara Quist', job: 'xenobiologist' }, rules), 'Mara Quist the xenobiologist');
});

test('what each rank gives, short, from its numbers (M32b)', () => {
  const said = [...rules.jobs.keys()].map((job) => [job, rankGives(job, 1, rules), rankGives(job, 2, rules)]);
  assert.deepEqual(said, [
    ['marine', 'Suppress −40 aim', 'guns +15'],
    ['engineer', 'Weld 5 rounds', 'fixes 2 wrecks a jump'],
    ['medic', 'Patch 5 hit points', 'med bay +2 · infirmary +2'],
    ['pilot', 'Hustle ×2 a fight', 'evasion +15'],
    ['scout', 'Mark +20 to hit', 'scans +2 links'],
    ['xenobiologist', 'Sedate +10 to hit', 'farms +2'],
    ['quartermaster', 'Kit out ×3 a fight', 'lockers +20 · stores +40'],
  ]);
  assert.equal(rankGives('marine', 3, rules), '', 'no rank 3');
  // A rank's words come with the job's: the order and effects at that rank.
  assert.match(jobSaid('xenobiologist', rules, 1).order, /at a shot's odds \+10:/);
  assert.match(jobSaid('xenobiologist', rules).order, /at a shot's odds:/);
  assert.equal(jobBrief('medic', rules, 2), 'Patch ×2 · med bay +2 · infirmary +2');
});

test("a crew member's rank and fights on a line, and who reaches a rank as a fight ends (M32b)", () => {
  assert.equal(rankLine({ job: 'marine', fights: 0 }, rules), '0 fights · rank 1 at 3');
  assert.equal(rankLine({ job: 'marine', fights: 1 }, rules), '1 fight · rank 1 at 3');
  assert.equal(rankLine({ job: 'scout', fights: 3 }, rules), 'Rank 1, Spotter · 3 fights · rank 2 at 8');
  assert.equal(rankLine({ job: 'pilot', fights: 12 }, rules, true), 'Rank 2, Ace · 12 fights stood');
  assert.deepEqual(rankUpLines([{ member: { name: 'Rosa Vint', job: 'marine' }, rank: 1 }, { member: { name: 'Bram Dahl', job: 'quartermaster' }, rank: 2 }], rules), [
    'Rosa Vint reaches rank 1, Pinning fire: Suppress −40 aim.',
    'Bram Dahl reaches rank 2, Stores master: lockers +20 · stores +40.',
  ]);
});
