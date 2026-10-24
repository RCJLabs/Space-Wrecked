// M51: juice. Each order its kind's sound, freeing a captive and setting a
// charge their own, a walk a step, a fight's end won or lost; the camera
// following an enemy turn (follow.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
