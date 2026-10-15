// M32: the words for a crew job's order, ship effect and colony effect,
// made from its numbers in data/jobs.json. Every kind the rules know has
// its words, so a job made of known kinds needs no code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLONY_EFFECTS, STATION_EFFECTS } from '../src/sim/edges.js';
import { ORDER_KINDS } from '../src/sim/orders.js';
import { byJob, COLONY_WORDS, jobName, jobSaid, ORDER_WORDS, STATION_WORDS } from '../src/ui/campaign/crewJobText.js';
import { rules } from './battleKit.js';

test('every order kind and every ship and colony effect has its words', () => {
  assert.deepEqual(Object.keys(ORDER_WORDS).sort(), Object.keys(ORDER_KINDS).sort());
  assert.deepEqual(Object.keys(STATION_WORDS).sort(), Object.keys(STATION_EFFECTS).sort());
  assert.deepEqual(Object.keys(COLONY_WORDS).sort(), Object.keys(COLONY_EFFECTS).sort());
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
