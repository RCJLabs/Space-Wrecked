// M59: what a shot looks like besides its tracer: the muzzle's flash, a
// hit's sparks, a miss's puff, and the colors by weapon.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FLIGHT, frameAt, makeTimeline } from '../src/render/playback.js';
import { endOf, muzzle, puff, SPARKS, sparks, tone } from '../src/render/shotFx.js';
import { rules } from './battleKit.js';

const shot = (over = {}) => ({ from: [2, 3], to: [8, 3], hit: true, progress: 0, seed: 1300, ...over });

test('a weapon that stuns shoots blue, one that sets fires orange, any other as before', () => {
  assert.equal(tone(rules.weapons.get('baton')), 'stun');
  assert.equal(tone(rules.weapons.get('torch')), 'fire');
  assert.equal(tone(rules.weapons.get('rifle')), 'plain');
  assert.equal(tone(null), 'plain', 'a turret or a unit with no weapon');
});

test('the muzzle flashes as the shot leaves, a little way out toward the target, then is gone', () => {
  const first = muzzle(shot());
  assert.deepEqual(first.at, [2.82, 3.5]);
  assert.equal(first.alpha, 1);
  assert.ok(muzzle(shot({ progress: 0.06 })).alpha < 1);
  assert.equal(muzzle(shot({ progress: FLIGHT })), null);
});

test("a hit's sparks fly from where it lands, the same each time, and fade", () => {
  assert.deepEqual(sparks(shot({ progress: FLIGHT - 0.01 })), [], 'none in flight');
  const landed = sparks(shot({ progress: FLIGHT + 0.1 }));
  assert.equal(landed.length, SPARKS);
  assert.deepEqual(landed, sparks(shot({ progress: FLIGHT + 0.1 })), 'the same frame draws the same sparks');
  assert.notDeepEqual(landed, sparks(shot({ progress: FLIGHT + 0.1, seed: 2000 })), 'another shot scatters its own');
  const [x, y] = endOf(shot());
  assert.ok(landed.every((s) => Math.hypot(s.at[0] - x, s.at[1] - y) <= 0.6 && s.alpha > 0 && s.alpha <= 1));
  const later = sparks(shot({ progress: FLIGHT + 0.3 }));
  assert.ok(later[0].alpha < landed[0].alpha, 'fading');
  assert.deepEqual(sparks(shot({ progress: 1 })), [], 'gone by the end');
  assert.deepEqual(sparks(shot({ hit: false, progress: FLIGHT + 0.1 })), [], 'a miss throws none');
});

test('a miss ends wide and past the target, in a puff of dust there', () => {
  const miss = shot({ hit: false, progress: FLIGHT + 0.1 });
  const [x, y] = endOf(miss);
  assert.ok(x > 8.5 && y !== 3.5, `past and wide: ${x}, ${y}`);
  const dust = puff(miss);
  assert.equal(dust.length, 4);
  assert.ok(dust.every((d) => Math.hypot(d.at[0] - x, d.at[1] - y) < 0.3));
  assert.deepEqual(puff(shot({ progress: FLIGHT + 0.1 })), [], 'a hit raises none');
});

test("the playback's shot carries the shooter's weapon and its beat's start, the sparks' seed", () => {
  const unit = (id, side, x, weapon) => ({ id, side, x, y: 3, status: 'active', weapon });
  const before = { units: [unit('c', 'crew', 2, 'torch'), unit('e', 'enemy', 4, 'pistol')] };
  const played = [{ events: [{ type: 'reload', unit: 'c' }, { type: 'shot', unit: 'c', target: 'e', hit: true }], battle: before }];
  const timeline = makeTimeline(before, played);
  const frame = frameAt(timeline, timeline.beats[1].at + 100);
  assert.equal(frame.shot.weapon, 'torch');
  assert.equal(frame.shot.seed, timeline.beats[1].at);
});

test('a kill moment: a unit a shot drops is held on 400 ms more, its fall at its usual pace; not without hold, nor with reduced motion', async () => {
  const { KILL_HOLD, cuesBetween, durationOf } = await import('../src/render/playback.js');
  const unit = (id, side, x) => ({ id, side, x, y: 3, status: 'active', weapon: 'rifle' });
  const before = { units: [unit('c', 'crew', 2), unit('e', 'enemy', 4)] };
  const events = [{ type: 'shot', unit: 'c', target: 'e', hit: true }, { type: 'dead', unit: 'e' }];
  const played = [{ events, battle: before }];
  const plain = makeTimeline(before, played);
  const held = makeTimeline(before, played, { hold: true });
  assert.equal(held.length, plain.length + KILL_HOLD);
  assert.equal(held.beats[1].kill, true);
  assert.equal(makeTimeline(before, played, { hold: true, still: true }).length, 0, 'reduced motion: none');
  const fall = durationOf(events[1]);
  assert.equal(frameAt(held, held.beats[1].at + fall / 2).progress, 0.5, 'the fall at its usual pace');
  assert.equal(frameAt(held, held.beats[1].at + fall + 200).progress, 1, 'then held');
  assert.deepEqual(cuesBetween(held, -1, held.length).map((c) => c.kill ?? false), [false, false, true]);
  const missed = [{ events: [{ type: 'reload', unit: 'c' }, { type: 'dead', unit: 'e' }], battle: before }];
  assert.equal(makeTimeline(before, missed, { hold: true }).beats[1].kill, undefined, 'only a fall right after the shot that caused it');
});
