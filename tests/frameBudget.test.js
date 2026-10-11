import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUDGET_MS, createFrameBudget } from '../src/render/frameBudget.js';

// A budget on a fake clock: paint(ms) is a full frame that takes ms.
function fake(ms = BUDGET_MS) {
  let t = 0;
  const budget = createFrameBudget({ ms, now: () => t });
  return { budget, paint: (took) => budget.measure(() => (t += took)) };
}

test('a still frame is always full', () => {
  const { budget, paint } = fake();
  paint(100);
  assert.equal(budget.full(false), true);
});

test('moving frames are full until full frames run over the budget', () => {
  const { budget, paint } = fake(12);
  assert.equal(budget.full(true), true, 'nothing measured yet');
  paint(5);
  assert.equal(budget.full(true), true);
  paint(30);
  assert.equal(budget.full(true), true, 'of two frames, the quicker counts');
  paint(30);
  assert.equal(budget.full(true), false, 'two slow frames out of three');
  assert.equal(budget.stats().cost, 30);
});

test("a slow first frame alone doesn't make moving frames rough", () => {
  const { budget, paint } = fake(12);
  paint(40);
  assert.equal(budget.full(true), true);
  assert.equal(budget.stats().cost, 0);
  paint(5);
  assert.equal(budget.full(true), true);
});

test('one slow frame among quick ones keeps moving frames full', () => {
  const { budget, paint } = fake(12);
  for (const took of [4, 4, 40, 4]) paint(took);
  assert.equal(budget.full(true), true);
  assert.equal(budget.stats().cost, 4);
});

test('quick full frames bring full moving frames back', () => {
  const { budget, paint } = fake(12);
  for (const took of [20, 20, 20]) paint(took);
  assert.equal(budget.full(true), false);
  paint(6);
  paint(6);
  assert.equal(budget.full(true), true);
});

test('the paint runs once', () => {
  const budget = createFrameBudget();
  let runs = 0;
  budget.measure(() => runs++);
  assert.equal(runs, 1);
  assert.ok(budget.stats().cost >= 0);
});

test('stats count the moving frames of each kind since they were last read', () => {
  const { budget, paint } = fake(12);
  budget.full(false);
  budget.full(true);
  budget.full(true);
  for (const took of [20, 20]) paint(took);
  budget.full(true);
  assert.deepEqual(budget.stats(), { full: 2, rough: 1, cost: 20 });
  assert.deepEqual(budget.stats(), { full: 0, rough: 0, cost: 20 });
});
