// M51: juice. Each order its kind's sound, freeing a captive and setting a
// charge their own, a walk a step, a fight's end won or lost; the camera
// following an enemy turn (follow.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { followPoints, followShift, glideAt } from '../src/render/follow.js';
import { fitOrbit, panOrbit, project } from '../src/render/orbit.js';
import { aboardAt, landerAt, LANDING_MS, landingTimeline, shotsBetween } from '../src/render/raidLanding.js';
import { FIGHT_VIEW } from '../src/render/battleView.js';
import { ORDER_KINDS } from '../src/sim/orders.js';
import { cueSound, endSound, MOMENT_SOUNDS, ORDER_SOUNDS } from '../src/ui/sounds.js';
import { rules } from './battleKit.js';

test("each crew job's order sounds as its own kind, and every one of them is a sound with a caption", () => {
  assert.deepEqual(ORDER_SOUNDS, Object.keys(ORDER_KINDS).map((kind) => `order-${kind}`));
  for (const job of rules.jobs.values()) {
    if (!job.order) continue;
    const battle = { units: [{ id: 'c1', side: 'crew', kind: job.id, rank: 0 }] };
    const id = cueSound({ event: { type: 'order', unit: 'c1' }, lands: false }, battle, rules);
    assert.equal(id, `order-${job.order.type}`, job.id);
    assert.ok(rules.sounds.get(id)?.caption, id);
  }
  const of = (type) => cueSound({ event: { type, unit: 'c1' }, lands: false }, { units: [] }, rules);
  assert.deepEqual([of('free'), of('plant'), of('move')], ['free', 'plant', 'step']);
  for (const id of ['free', 'plant', 'step', 'won', 'lost', ...ORDER_SOUNDS]) assert.ok(MOMENT_SOUNDS.includes(id) && rules.sounds.has(id), id);
});

test("a fight's end sounds won or lost by who won, and nothing while it goes on", () => {
  assert.equal(endSound({ winner: 'crew' }), 'won');
  assert.equal(endSound({ winner: 'enemy' }), 'lost');
  assert.equal(endSound({ winner: null }), null);
});

test('what a moment wants in view: a walk from and to, a shot from shooter to target, nothing else', () => {
  const view = { units: [{ id: 'c1', x: 1, y: 2 }, { id: 'e1', x: 9, y: 4 }] };
  assert.deepEqual(followPoints({ type: 'move', unit: 'e1', path: [[9, 4], [8, 4], [7, 3]] }, view), [[9.5, 4.5], [7.5, 3.5]]);
  assert.deepEqual(followPoints({ type: 'shot', unit: 'e1', target: 'c1' }, view), [[9.5, 4.5], [1.5, 2.5]]);
  assert.deepEqual(followPoints({ type: 'turn', side: 'crew' }, view), []);
});

test('the camera pans as little as it can, the zoom kept, to bring what it follows in from the edges', () => {
  const rect = { x: 128, y: 0, w: 697, h: 370 };
  const box = { x0: 0, y0: 0, x1: 40, y1: 20, z1: 1 };
  // Zoomed in on the left end of a long map.
  const fit = fitOrbit({ ...FIGHT_VIEW, pivot: [20, 10] }, rect, box, 14);
  const cam = { ...fit, scale: fit.scale * 4 };
  const inside = (c, [x, y], inset) => {
    const [sx, sy] = project(c, x, y, 0);
    return sx >= rect.x + inset - 0.5 && sx <= rect.x + rect.w - inset + 0.5 && sy >= rect.y + inset - 0.5 && sy <= rect.y + rect.h - inset + 0.5;
  };
  const near = [[20.5, 10.5]];
  assert.ok(inside(cam, near[0], 48));
  assert.equal(followShift(cam, rect, near, 48), null, 'already in view: no pan');
  const far = [[34.5, 10.5]];
  assert.ok(!inside(cam, far[0], 48));
  const shift = followShift(cam, rect, far, 48);
  const moved = panOrbit(cam, ...shift);
  assert.ok(inside(moved, far[0], 48), 'in view after the pan');
  assert.equal(moved.scale, cam.scale);
  // Just inside the edge: no further than it had to.
  const [sx] = project(moved, ...far[0], 0);
  assert.ok(Math.abs(sx - (rect.x + rect.w - 48)) < 1, `${sx}`);
  // Two points too far apart to fit are centred between them.
  const wide = followShift(cam, rect, [[2.5, 10.5], [38.5, 10.5]], 48);
  const centred = panOrbit(cam, ...wide);
  const [ax] = project(centred, 2.5, 10.5, 0);
  const [bx] = project(centred, 38.5, 10.5, 0);
  assert.ok(Math.abs((ax + bx) / 2 - (rect.x + rect.w / 2)) < 1);
  assert.equal(followShift(cam, rect, [], 48), null);
});

test('a glide eases from one camera to the other, its zoom and turn the end\'s', () => {
  const from = { x: 0, y: 0, scale: 2, yaw: 0 };
  const to = { x: 100, y: -40, scale: 2, yaw: 0 };
  assert.deepEqual(glideAt(from, to, 0), { ...to, x: 0, y: 0 });
  assert.deepEqual(glideAt(from, to, 1), to);
  assert.deepEqual(glideAt(from, to, 2), to);
  const mid = glideAt(from, to, 0.5);
  assert.deepEqual([mid.x, mid.y], [50, -20]);
  assert.ok(glideAt(from, to, 0.1).x < 10, 'eased in');
});

test("the landing seen: the lander eases down to the raiders' edge, each rolled shot fired in turn from its gun, a raider fewer for each hit", () => {
  const landing = { shots: [{ uid: 1, hit: true }, { uid: 1, hit: false }, { uid: 2, hit: true }], hits: 2, landed: ['a', 'b'] };
  const guns = [{ uid: 1, x: 1, y: 1 }, { uid: 2, x: 3, y: 5 }];
  const line = landingTimeline(landing, guns, [18.5, 6], 4);
  assert.equal(line.ms, LANDING_MS);
  assert.deepEqual(line.shots.map((s) => [s.from, s.hit]), [[[1, 1], true], [[1, 1], false], [[3, 5], true]], 'as rolled, from their guns');
  assert.ok(line.shots.every((s, i) => s.at > 0 && s.at < LANDING_MS && (i === 0 || s.at > line.shots[i - 1].at)), 'in turn, during the descent');
  assert.deepEqual(landerAt(line, 0).slice(0, 2), [18.5, 6]);
  assert.ok(landerAt(line, 0)[2] > landerAt(line, LANDING_MS / 2)[2] && landerAt(line, LANDING_MS)[2] === 0, 'down to the ground');
  assert.equal(aboardAt(line, 0), 4);
  assert.equal(aboardAt(line, LANDING_MS), 2, 'two raiders fewer for two hits: as many as land');
  const heard = shotsBetween(line, -1, LANDING_MS);
  assert.equal(heard.filter((h) => !h.lands).length, 3);
  assert.equal(heard.filter((h) => h.lands).length, 3);
  assert.deepEqual(shotsBetween(line, LANDING_MS, LANDING_MS + 1000), []);
  assert.deepEqual(landingTimeline({ shots: [], hits: 0, landed: ['a'] }, [], [10, 4], 1).shots, [], 'no guns: it just comes down');
});
