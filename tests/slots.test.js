// M63: campaign slots, their backups and the reminder to export. The rules
// (src/core/slots.js) and the slots kept in a store (slotStore.js), here a
// Map standing in for localStorage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, parseSave } from '../src/core/save.js';
import { activeSlot, backupFor, backupName, markName, openedData, reminderDue, saveName, slotState } from '../src/core/slots.js';
import { createSaves } from '../src/core/slotStore.js';
import { newCampaign } from '../src/sim/campaign.js';
import { launch } from '../src/sim/launch.js';
import { initialState, saveData } from '../src/sim/root.js';
import { rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { readyToLaunch } from './launchKit.js';

const serialize = (data) => JSON.stringify(makeSave(data));
const game = (campaign, seed = 1) => ({ ...saveData(initialState(seed)), campaign });

function memory(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    read: (name) => (map.has(name) ? map.get(name) : null),
    write: (name, text) => (map.set(name, text), true),
  };
}
const slotsIn = (kv) => createSaves(kv, { parse: parseSave, serialize });

const act1 = readyToLaunch();
const act2 = launch(act1, rules).campaign;
const act3 = settled();
const other = newCampaign(rules, act1.seed + 1);

test('names: slot 1 is the save the game always had; the slot in play is 1 to 3, else 1', () => {
  assert.equal(saveName(1), 'save');
  assert.equal(saveName(2), 'save:2');
  assert.equal(backupName(3, 'act2'), 'save:3:act2');
  assert.equal(markName(2), 'exported:2');
  assert.deepEqual([null, '2', '3', '4', '0', 'x'].map(activeSlot), [1, 2, 3, 1, 1, 1]);
});

test("the backup a write calls for: an act on, an act back, or another campaign; none for the same campaign's next step", () => {
  assert.equal(act2.act, 2);
  assert.equal(act3.act, 3);
  assert.equal(backupFor(game(act1), game(act2)), 'act2');
  assert.equal(backupFor(game(act2), game(act3)), 'act3');
  assert.equal(backupFor(game(act2), game(act1)), 'replaced', 'an act back: a restore');
  assert.equal(backupFor(game(act1), game(other)), 'replaced', 'a New game');
  assert.equal(backupFor(game(act1), game(null)), 'replaced', 'an import with no campaign');
  assert.equal(backupFor(game(act1), game({ ...act1, credits: act1.credits + 5 })), null);
  assert.equal(backupFor(game(null), game(act1)), null, 'nothing to keep');
  assert.equal(backupFor(null, game(act1)), null);
});

test("a slot opens with its own campaign and RNG, and the game's settings and ships", () => {
  const mine = { ...game(act1), settings: { ...game(act1).settings, music: 0 }, builds: { active: 0, slots: [] } };
  const theirs = { ...game(act2), rng: 77 };
  assert.deepEqual(openedData(theirs, mine, 5), { settings: mine.settings, builds: mine.builds, rng: 77, campaign: act2 });
  assert.deepEqual(openedData(null, mine, 5), { settings: mine.settings, builds: mine.builds, rng: 5, campaign: null });
});

test('what a slot holds, read from its text', () => {
  assert.deepEqual(slotState(null, parseSave), { kind: 'empty' });
  assert.equal(slotState(serialize(game(act2)), parseSave).campaign.act, 2);
  assert.deepEqual(slotState(serialize(game(null)), parseSave), { kind: 'none' });
  assert.equal(slotState('{"nope', parseSave).kind, 'broken');
});

test('the reminder: due at each new act until a code is made (or Later), and for a new campaign', () => {
  assert.equal(reminderDue(null, null), false);
  assert.equal(reminderDue(act1, null), true);
  assert.equal(reminderDue(act1, `${act1.seed}:1`), false);
  assert.equal(reminderDue(act2, `${act1.seed}:1`), true, 'a new act');
  assert.equal(reminderDue(act2, `${act1.seed}:2`), false);
  assert.equal(reminderDue(other, `${act1.seed}:3`), true, 'another campaign');
  const kv = memory();
  const saves = slotsIn(kv);
  assert.equal(saves.reminderDue(act1), true);
  saves.markDone(act1);
  assert.equal(saves.reminderDue(act1), false);
  assert.equal(saves.reminderDue(act2), true);
});

test("a save from before slots is slot 1's, as it was", () => {
  const text = serialize(game(act2));
  const kv = memory({ save: text });
  const saves = slotsIn(kv);
  assert.equal(saves.slot(), 1);
  assert.deepEqual(saves.load().data.campaign, act2);
  assert.equal(saves.persist(game(act2)), true);
  assert.equal(kv.read('save'), text, 'written back the same');
  assert.deepEqual([...kv.map.keys()], ['save']);
});

test('playing on keeps the save before each act, and a New game keeps the one it replaces', () => {
  const kv = memory();
  const saves = slotsIn(kv);
  assert.equal(saves.load(), null);
  saves.persist(game(act1));
  saves.persist(game(act2));
  assert.deepEqual(parseSave(kv.read('save:1:act2')).save.data.campaign, act1);
  saves.persist(game(act3));
  assert.deepEqual(parseSave(kv.read('save:1:act3')).save.data.campaign, act2);
  saves.persist(game(other));
  assert.deepEqual(parseSave(kv.read('save:1:replaced')).save.data.campaign, act3);
  assert.deepEqual(saves.list()[0].backups.map((b) => b.kind), ['act2', 'act3', 'replaced']);
});

test('slots: each its own campaign; opening one keeps the game settings and keeps no backup', () => {
  const kv = memory();
  const saves = slotsIn(kv);
  saves.persist(game(act2));
  const empty = saves.open(2, game(act2), 99);
  assert.deepEqual(empty, { ok: true, data: { ...openedData(null, game(act2), 99) } });
  assert.equal(kv.read('slot'), '2');
  saves.persist(empty.data);
  saves.persist({ ...empty.data, campaign: other });
  assert.equal(kv.read('save:2:replaced'), null, 'nothing was replaced in an empty slot');
  const back = saves.open(1, { ...game(other), settings: { ...game(other).settings, music: 0 } }, 5);
  assert.deepEqual(back.data.campaign, act2);
  assert.equal(back.data.settings.music, 0, "the game's settings");
  saves.persist(back.data);
  assert.equal(kv.read('save:1:replaced'), null);
  assert.deepEqual(saves.list().map((s) => s.state.kind), ['campaign', 'campaign', 'empty']);
  assert.deepEqual(saves.list().map((s) => s.state.campaign?.seed), [act2.seed, other.seed, undefined]);
  // A slot that can't be read isn't opened, and the one in play stays.
  kv.write('save:3', 'broken');
  assert.equal(saves.open(3, game(act2), 1).ok, false);
  assert.equal(saves.slot(), 1);
  assert.equal(kv.read('slot'), '1', 'as the last open left it');
});

test('restoring a backup brings it back and keeps the campaign it replaces, so it can be undone', () => {
  const kv = memory();
  const saves = slotsIn(kv);
  saves.persist(game(act1));
  saves.persist(game(act2));
  const restored = saves.restore('act2', game(act2));
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.data.campaign, act1);
  saves.persist(restored.data);
  assert.deepEqual(parseSave(kv.read('save:1:replaced')).save.data.campaign, act2);
  // Undone: the replaced backup restored.
  const undone = saves.restore('replaced', restored.data);
  assert.deepEqual(undone.data.campaign, act2);
  saves.persist(undone.data);
  assert.deepEqual(parseSave(kv.read('save:1:replaced')).save.data.campaign, act1);
  assert.equal(saves.restore('act3', game(act2)).ok, false);
});
