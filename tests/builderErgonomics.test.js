// M44: the builder's everyday chores. A run of corridors laid by a drag as
// one undo step; Suggest putting the armed part's ghost where it fits best;
// another maker's version swapped in where a part stands; and the log each
// leaves still plays back to the same ship.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, layoutProblems } from '../src/sim/builder.js';
import { newCampaign, stockOf } from '../src/sim/campaign.js';
import { fitPart, suggestSpot } from '../src/sim/fit.js';
import { replay } from '../src/sim/replay.js';
import { createSession, partsLeft, reduceSession } from '../src/sim/session.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const act = (session, action) => reduceSession(session, action, rules);
const arm = (session, moduleType) => act(session, { type: 'build/arm', moduleType });
// The miner's half-built start in construction mode, with extra parts on
// hand.
const opened = (parts = {}) => {
  const campaign = newCampaign(rules, 5);
  const withParts = { ...campaign, parts: { ...campaign.parts, ...parts } };
  return createSession(withParts.ship, [], stockOf(withParts));
};
// The ship the log plays back to, without its uid counter's own say.
const played = (session) => replay(session.log, rules, session.ship.frame);
const sameShip = (a, b) => assert.deepEqual(a.modules, b.modules);
// An empty cell on the frame beside the ship, and a straight line of cells
// out from it, for a run.
function lineOut(ship, length) {
  const frame = rules.frames.get(ship.frame);
  const taken = new Set(ship.modules.flatMap((m) => {
    const def = rules.modules.get(m.type);
    const [w, h] = m.rot % 2 ? [def.size[1], def.size[0]] : def.size;
    return Array.from({ length: w * h }, (_, i) => `${m.x + (i % w)},${m.y + Math.floor(i / w)}`);
  }));
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x + length <= frame.width; x++) {
      const cells = Array.from({ length }, (_, i) => [x + i, y]);
      if (cells.some(([cx, cy]) => taken.has(`${cx},${cy}`))) continue;
      const touches = [[x - 1, y], [x, y - 1], [x, y + 1]].some(([cx, cy]) => taken.has(`${cx},${cy}`));
      if (touches && applyCommand(ship, rules, { op: 'place', type: 'corridor', x, y, rot: 0 }).ok) return cells;
    }
  }
  return null;
}

test('a run of corridors goes on as one undo step, and its log plays back', () => {
  let s = arm(opened({ corridor: 4 }), 'corridor');
  const cells = lineOut(s.ship, 3);
  assert.ok(cells, 'a line of three free cells beside the ship');
  const before = s.ship;
  s = act(s, { type: 'build/run', cells });
  const added = s.ship.modules.filter((m) => !before.modules.includes(m));
  assert.deepEqual(added.map((m) => [m.type, m.x, m.y]), cells.map(([x, y]) => ['corridor', x, y]));
  assert.equal(s.past.length, 1, 'one undo step');
  assert.equal(s.log.length, 3, 'the log keeps each place');
  assert.match(s.notice.text, /Placed 3 × Corridor\./);
  assert.deepEqual(s.armed?.type, 'corridor', 'still armed: corridors are left on hand');
  s = act(s, { type: 'build/undo' });
  assert.equal(s.ship, before, 'one undo takes the whole run back');
  assert.equal(s.log.length, 0);
  s = act(s, { type: 'build/redo' });
  assert.equal(s.ship.modules.length, before.modules.length + 3);
  assert.equal(s.log.length, 3);
});

test('a run stops short at a cell that can\'t take one, or when the corridors run out', () => {
  let s = arm(opened(), 'corridor');
  const cells = lineOut(s.ship, 3);
  const onHand = partsLeft(s, 'corridor');
  assert.equal(onHand, 2, "the miner's start has 2 corridors on hand");
  s = act(s, { type: 'build/run', cells });
  assert.equal(s.past.length, 1);
  assert.equal(s.log.length, 2, 'two placed, then none left');
  assert.match(s.notice.text, /Placed 2 × Corridor\. Stopped: No Corridor on hand\./);
  assert.equal(s.armed, null, 'none left to arm');

  let t = arm(opened({ corridor: 5 }), 'corridor');
  const taken = t.ship.modules[0];
  t = act(t, { type: 'build/run', cells: [cells[0], [taken.x, taken.y], cells[1]] });
  assert.equal(t.log.length, 1, 'stops at the cell already taken');
  assert.match(t.notice.text, /Stopped:/);
});

test('only a corridor runs', () => {
  const s = arm(opened({ quarters: 1 }), 'quarters');
  assert.equal(act(s, { type: 'build/run', cells: [[0, 0]] }), s);
});

test("Suggest puts the armed part's ghost where it fits best, on a ship still being built", () => {
  // The start with its airlock off: a ship with a problem of its own.
  const start = opened();
  const airlock = start.ship.modules.find((m) => m.type === 'airlock');
  let s = arm({ ...start, ship: applyCommand(start.ship, rules, { op: 'remove', uid: airlock.uid }).ship }, 'quarters');
  assert.ok(layoutProblems(s.ship, rules).length > 0, 'no airlock: a problem of its own');
  assert.equal(fitPart(s.ship, rules, 'quarters'), null, "the test players' fitter wants a whole ship");
  s = act(s, { type: 'build/suggest' });
  assert.ok(s.ghost, 'a ghost at the suggested spot');
  assert.deepEqual({ x: s.ghost.x, y: s.ghost.y, rot: s.ghost.rot }, suggestSpot(s.ship, rules, 'quarters'));
  assert.match(s.notice.text, /fits best here: tap it to place it/);
  const before = layoutProblems(s.ship, rules).map((p) => p.message);
  s = act(s, { type: 'build/tap', x: s.ghost.x + 0.5, y: s.ghost.y + 0.5 });
  const placed = s.ship.modules.find((m) => m.type === 'quarters');
  assert.ok(placed, 'a second tap on the ghost places it');
  assert.ok(layoutProblems(s.ship, rules).every((p) => before.includes(p.message) && !p.uids.includes(placed.uid)), 'it adds no problem');
});

test('Suggest on a whole ship is the fitter; with nowhere to go it says so', () => {
  const ship = readyToLaunch().ship;
  assert.deepEqual(suggestSpot(ship, rules, 'corridor'), fitPart(ship, rules, 'corridor').at);
  const s = arm(createSession(ship, [], null), 'corridor');
  assert.ok(act(s, { type: 'build/suggest' }).ghost);
  // An empty frame: nothing to join a part to.
  const empty = act(arm(createSession({ ...ship, modules: [] }, [], null), 'corridor'), { type: 'build/suggest' });
  assert.equal(empty.ghost, null);
  assert.match(empty.notice.text, /No spot for the Corridor joins the ship as it stands\./);
});

test("another maker's version swaps in where the part stands, as one undo step", () => {
  let s = opened({ 'bastion-corridor': 1 });
  const corridor = s.ship.modules.find((m) => m.type === 'corridor');
  const corridorsLeft = partsLeft(s, 'corridor');
  s = act(s, { type: 'build/swap', uid: corridor.uid, moduleType: 'bastion-corridor' });
  const swapped = s.ship.modules.find((m) => m.type === 'bastion-corridor');
  assert.deepEqual([swapped.x, swapped.y, swapped.rot], [corridor.x, corridor.y, corridor.rot], 'the same spot and turn');
  assert.equal(s.ship.modules.length, opened().ship.modules.length);
  assert.equal(partsLeft(s, 'corridor'), corridorsLeft + 1, 'the old one back on hand');
  assert.equal(partsLeft(s, 'bastion-corridor'), 0);
  assert.equal(s.past.length, 1, 'one undo step');
  assert.deepEqual(s.log.map((c) => c.op), ['remove', 'place'], 'the log keeps a remove and a place');
  assert.equal(s.selected, swapped.uid);
  assert.match(s.notice.text, /Swapped the Corridor for a Bastion corridor\./i);
  // The log plays back from the start ship's own log.
  s = act(s, { type: 'build/undo' });
  assert.ok(s.ship.modules.some((m) => m.uid === corridor.uid && m.type === 'corridor'), 'undo puts the old one back');
});

test('a swap needs the same part, one on hand and a part that isn\'t wrecked', () => {
  const s = opened({ 'bastion-corridor': 1, 'bastion-engine': 1 });
  const corridor = s.ship.modules.find((m) => m.type === 'corridor');
  assert.match(act(s, { type: 'build/swap', uid: corridor.uid, moduleType: 'bastion-engine' }).notice.text, /can't stand in for the Corridor/);
  assert.match(act(s, { type: 'build/swap', uid: corridor.uid, moduleType: 'scrapline-corridor' }).notice.text, /No Scrapline corridor on hand/i);
  const wrecked = { ...s, wrecked: [corridor.uid] };
  assert.match(act(wrecked, { type: 'build/swap', uid: corridor.uid, moduleType: 'bastion-corridor' }).notice.text, /wrecked/);
});

test('a swap and a run on a built log still play back to the ship', () => {
  const campaign = newCampaign(rules, 5);
  // A log from an empty frame: every part of the start ship placed in turn.
  let s = createSession({ ...campaign.ship, modules: [], nextUid: 1 }, [], { ...stockOf(campaign), 'bastion-corridor': 1, corridor: 9 });
  for (const m of campaign.ship.modules) s = act(s, { type: 'build/drop', placement: { type: m.type, x: m.x, y: m.y, rot: m.rot } });
  const corridor = s.ship.modules.find((m) => m.type === 'corridor');
  s = act(s, { type: 'build/swap', uid: corridor.uid, moduleType: 'bastion-corridor' });
  s = arm(s, 'corridor');
  s = act(s, { type: 'build/run', cells: lineOut(s.ship, 2) });
  const back = played(s);
  assert.equal(back.error, null);
  sameShip(back.ships.at(-1), s.ship);
});
