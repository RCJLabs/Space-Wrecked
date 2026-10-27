// Words for the reckoning and the epilogue (M56): the leader's words while
// the reckoning comes, its end panel won or lost, the colony's raid line
// once the pursuit is over, and the epilogue's panels.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colonyRaidOutcome, raidStatus } from '../src/ui/campaign/raidText.js';
import { epilogueText } from '../src/ui/campaign/epilogueText.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';

const leader = rules.backgrounds.get('miner').pursuer.colony.reckoning;

function coming(lands) {
  const colony = settled();
  return { ...colony, colony: { ...colony.colony, day: 90, raid: { found: 89, lands, extra: 0, reckoning: true } } };
}

test("the reckoning coming and down speaks in the leader's words", () => {
  assert.equal(raidStatus(coming(95), rules).line, leader.found);
  assert.equal(raidStatus(coming(90), rules).line, leader.landing);
});

test('the reckoning won ends the pursuit; lost, the leader comes again', () => {
  const down = coming(90);
  assert.deepEqual(colonyRaidOutcome({ winner: 'crew', units: [] }, down, rules), { tone: 'good', title: `${leader.name} beaten`, text: 'The pursuit is over.' });
  const lost = colonyRaidOutcome({ winner: 'enemy', units: [] }, down, rules);
  assert.equal(lost.title, 'The reckoning lost');
  assert.ok(lost.text.startsWith(leader.lost));
});

test('the pursuit over, the colony says nothing more comes', () => {
  const colony = settled();
  const over = { ...colony, heat: 90, ending: { day: 95, colony: colony.colony.world.name, won: true, seen: true } };
  assert.deepEqual(raidStatus(over, rules), { label: 'Found', value: 'The pursuit is over', ok: true, state: 'quiet', line: `${leader.name} won't be back.` });
});

test("the epilogue: the leader beaten, the background's words, the colony, the crew and the run", () => {
  const colony = settled();
  const name = colony.colony.world.name;
  const ended = { ...colony, ending: { day: 95, colony: name, won: true, seen: false } };
  const text = epilogueText(ended, rules);
  assert.equal(text.title, 'The pursuit is over');
  assert.equal(text.line, `${leader.name} beaten at ${name} on its day 95.`);
  assert.equal(text.words, leader.won);
  assert.deepEqual(text.colony[0], ['World', name]);
  assert.equal(text.crew.length, colony.crew.length);
  assert.ok(text.crew.some((member) => member.about.includes('captain')));
  assert.deepEqual(text.fallen, []);
  assert.ok(text.record.some(([label]) => label === 'Raids'));
});
