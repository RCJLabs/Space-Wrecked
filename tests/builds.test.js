import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeSlot, emptyBuilds, isBuilds, MAX_SLOTS, nextSlotName, reduceBuilds } from '../src/sim/builds.js';

const ship = (n) => ({ frame: 'starter', modules: [], nextUid: n });
const slot = (name, n = 1) => ({ name, ship: ship(n), log: [] });
const act = (builds, action) => reduceBuilds(builds, action);

test('saving the open ship starts slot 1 when there are none, then updates the open slot', () => {
  const first = act(emptyBuilds(), { type: 'builds/save', ship: ship(1), log: [] });
  assert.deepEqual(first, { active: 0, slots: [{ name: 'Ship 1', ship: ship(1), log: [] }] });
  const two = act(act(first, { type: 'builds/add', slot: slot('Ship 2') }), { type: 'builds/save', ship: ship(5), log: [] });
  assert.equal(two.active, 1);
  assert.equal(two.slots[1].ship.nextUid, 5, 'the open slot');
  assert.equal(two.slots[0], first.slots[0], 'the other slot untouched');
  const same = act(two, { type: 'builds/save', ship: two.slots[1].ship, log: two.slots[1].log });
  assert.equal(same, two);
});

test('adding opens the new slot; a full set of slots refuses more', () => {
  let builds = emptyBuilds();
  for (let i = 1; i <= MAX_SLOTS; i++) builds = act(builds, { type: 'builds/add', slot: slot(`Ship ${i}`) });
  assert.equal(builds.slots.length, MAX_SLOTS);
  assert.equal(builds.active, MAX_SLOTS - 1);
  assert.equal(act(builds, { type: 'builds/add', slot: slot('One too many') }), builds);
});

test('opening switches slots; a missing slot or the open one changes nothing', () => {
  const builds = { active: 0, slots: [slot('A'), slot('B')] };
  assert.equal(act(builds, { type: 'builds/open', index: 1 }).active, 1);
  assert.equal(act(builds, { type: 'builds/open', index: 0 }), builds);
  assert.equal(act(builds, { type: 'builds/open', index: 5 }), builds);
});

test('deleting a slot keeps a sensible one open', () => {
  const three = { active: 1, slots: [slot('A'), slot('B'), slot('C')] };
  const del = (builds, index) => act(builds, { type: 'builds/delete', index });
  assert.deepEqual(del(three, 1).slots.map((s) => s.name), ['A', 'C']);
  assert.equal(del(three, 1).active, 1, 'the one after it moves up');
  assert.equal(del(three, 0).active, 0, 'B stays open, one place down');
  assert.equal(activeSlot(del(three, 0)).name, 'B');
  assert.equal(del(three, 2).active, 1, 'B stays open');
  assert.equal(del({ active: 2, slots: three.slots }, 2).active, 1, 'the last one: the one before it opens');
  assert.deepEqual(del({ active: 0, slots: [slot('A')] }, 0), emptyBuilds());
  assert.equal(del(three, 9), three);
});

test('new slots take the first free name', () => {
  assert.equal(nextSlotName(emptyBuilds()), 'Ship 1');
  assert.equal(nextSlotName({ active: 0, slots: [slot('Ship 1'), slot('Ship 3')] }), 'Ship 2');
  assert.equal(activeSlot(emptyBuilds()), null);
});

test('isBuilds accepts what the reducer makes', () => {
  let builds = emptyBuilds();
  assert.ok(isBuilds(builds));
  builds = act(builds, { type: 'builds/save', ship: ship(1), log: [{ op: 'remove', uid: 1 }] });
  assert.ok(isBuilds(builds));
  assert.ok(!isBuilds(null));
  assert.ok(!isBuilds({ active: 0, slots: [{ ...slot('A'), ship: { frame: 'starter' } }] }));
});
