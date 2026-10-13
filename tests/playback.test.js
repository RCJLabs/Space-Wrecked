import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvent, durationOf, FLIGHT, FLOAT_MS, frameAt, makeTimeline, poseAt, STEP_MS } from '../src/render/playback.js';
import { createBattle } from '../src/sim/battle.js';
import { deploy } from '../src/sim/deploy.js';
import { createFight, reduceFight } from '../src/sim/fight.js';
import { scriptedAction } from '../src/sim/scripted.js';
import { exampleMap, openMap, rules } from './battleKit.js';

const boarders = rules.encounters.get('boarders').enemies;

function fightOn(setup) {
  const { battle, events } = createBattle(setup, rules);
  return createFight(battle, rules, events);
}

const send = (fight, action) => reduceFight(fight, action, rules);

test('events take time: a walk by its steps, a shot, a new turn; the end of a turn none', () => {
  assert.equal(durationOf({ type: 'move', path: [[0, 0], [1, 0], [1, 1]] }), 2 * STEP_MS);
  assert.ok(durationOf({ type: 'shot' }) > 0);
  assert.ok(durationOf({ type: 'turn' }) > durationOf({ type: 'shot' }));
  assert.equal(durationOf({ type: 'end' }), 0);
});

test('a walk goes a step at a time, facing each step, and ends exactly where the rules put it', () => {
  const fight = fightOn({ map: openMap(8, 3), units: [{ kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 7, y: 0 }], seed: 1 });
  // Two steps east.
  const moved = send(send(fight, { type: 'fight/tap', x: 2, y: 1 }), { type: 'fight/tap', x: 2, y: 1 });
  const timeline = makeTimeline(fight.battle, moved.played);
  assert.equal(timeline.length, 2 * STEP_MS);
  const halfway = frameAt(timeline, STEP_MS * 0.5);
  assert.deepEqual(halfway.moving, { id: 'c1', at: [1, 1.5], facing: [1, 0] });
  assert.equal(halfway.view, fight.battle, 'not there yet');
  assert.equal(halfway.done, false);
  const end = frameAt(timeline, timeline.length);
  assert.equal(end.view, moved.played[0].battle, "the rules' own battle");
  assert.equal(end.moving, null);
  assert.equal(end.done, true);
});

test('a shot flies, lands with a flash on a hit, and words rise over the target', () => {
  const fight = fightOn({ map: openMap(8, 3), units: [{ kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 4, y: 1 }], seed: 2 });
  const fired = send(send(fight, { type: 'fight/aim', target: 'e1' }), { type: 'fight/aim', target: 'e1' });
  const shot = fired.played[0].events.find((e) => e.type === 'shot');
  const timeline = makeTimeline(fight.battle, fired.played);
  const ms = durationOf(shot);
  const flying = frameAt(timeline, ms * FLIGHT * 0.5);
  assert.equal(flying.shot.target, 'e1');
  assert.deepEqual([flying.shot.from, flying.shot.to], [[0, 1], [4, 1]]);
  assert.equal(flying.floats.length, 0, 'nothing until it lands');
  const landed = frameAt(timeline, ms * (FLIGHT + 0.1));
  assert.equal(landed.hit, shot.hit ? 'e1' : null);
  assert.deepEqual(landed.floats.map((f) => [f.at, f.text, f.tone]), [[[4, 1], shot.hit ? `${shot.crit ? 'CRIT ' : ''}−${shot.damage}` : 'MISS', shot.hit ? 'hit' : 'miss']]);
  const later = frameAt(timeline, ms * FLIGHT + FLOAT_MS + 1);
  assert.ok(later.floats.every((f) => f.text !== landed.floats[0].text), 'faded');
  assert.ok(timeline.tail > timeline.length);
});

test("events applied one by one bring the board to the rules' own battle after every action", () => {
  for (const seed of [1, 2, 3, 7]) {
    const map = exampleMap();
    let fight = fightOn({ map, units: deploy(map, rules.squad, boarders, rules).units, seed });
    let checked = 0;
    while (!fight.battle.winner && fight.battle.round <= 10) {
      const action = scriptedAction(fight.battle, rules);
      const before = fight.battle;
      const orders = action.type === 'end' ? [{ type: 'fight/end' }] : [{ type: 'fight/select', unit: action.unit }, ...toTaps(action)];
      for (const order of orders) fight = send(fight, order);
      let view = before;
      for (const step of fight.played) {
        for (const event of step.events) view = applyEvent(view, event);
        const sameUnits = (b) => b.units.map(({ id, x, y, hp, status, overwatch }) => [id, x, y, hp, status, overwatch]);
        assert.deepEqual(sameUnits(view), sameUnits(step.battle), `seed ${seed}`);
        assert.deepEqual([view.doors, view.side, view.round, view.winner], [step.battle.doors, step.battle.side, step.battle.round, step.battle.winner]);
        view = step.battle;
        checked += 1;
      }
    }
    assert.ok(checked > 20, `seed ${seed}: ${checked} actions`);
  }
});

function toTaps(action) {
  if (action.type === 'move') return [{ type: 'fight/tap', x: action.to[0], y: action.to[1] }, { type: 'fight/tap', x: action.to[0], y: action.to[1] }];
  if (action.type === 'shoot') return [{ type: 'fight/aim', target: action.target }, { type: 'fight/aim', target: action.target }];
  return [{ type: `fight/${action.type}` }];
}

test('a new turn holds the board for its banner, and the view keeps whose turn it is', () => {
  const map = exampleMap();
  const fight = fightOn({ map, units: deploy(map, rules.squad, boarders, rules).units, seed: 7 });
  const ended = send(fight, { type: 'fight/end' });
  const timeline = makeTimeline(fight.battle, ended.played);
  const first = timeline.beats.find((b) => b.event?.type === 'turn');
  const frame = frameAt(timeline, first.at + 1);
  assert.deepEqual(frame.event, { type: 'turn', side: 'enemy', round: 1 });
  assert.ok(frame.progress > 0 && frame.progress < 0.01);
  assert.equal(frameAt(timeline, first.at + first.ms).view.side, 'enemy');
});

test('a unit strides through a walk, aims as it shoots or watches, and falls as it goes down', () => {
  const unit = { id: 'c1', overwatch: false };
  const at = (event, progress) => ({ event, progress });
  assert.deepEqual(poseAt(unit, null), { aim: 0, stride: null, fall: 0 });
  const walk = { type: 'move', unit: 'c1', path: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] };
  assert.equal(poseAt(unit, at(walk, 0)).stride, 0);
  assert.equal(poseAt(unit, at(walk, 0.25)).stride, 0.5, 'a step to every tile, a stride to every two');
  assert.equal(poseAt(unit, at(walk, 0.5)).stride, 0);
  assert.equal(poseAt({ id: 'c2', overwatch: false }, at(walk, 0.25)).stride, null, 'only the walker walks');
  assert.equal(poseAt(unit, at({ type: 'shot', unit: 'c1', target: 'e1' }, 0.2)).aim, 1);
  assert.equal(poseAt(unit, at({ type: 'shot', unit: 'e1', target: 'c1' }, 0.2)).aim, 0, 'shot at is not aiming');
  assert.equal(poseAt(unit, at({ type: 'overwatch', unit: 'c1' }, 0.1)).aim, 1, 'going on watch');
  assert.equal(poseAt({ id: 'c1', overwatch: true }, null).aim, 1, 'on watch, aimed');
  for (const type of ['down', 'dead']) {
    assert.equal(poseAt(unit, at({ type, unit: 'c1' }, 0.5)).fall, 0.25, 'quicker as it goes');
    assert.equal(poseAt(unit, at({ type, unit: 'c1' }, 1)).fall, 1);
  }
});
