// Drop tables: what parts come from where, by weight (ROADMAP §4.6). A
// table is { [module type]: weight }, whole-number weights, read in the
// order written. A job's drops (data/contracts.json) are { chance, parts }:
// a part comes with the job `chance` times in 100, picked from `parts` by
// weight. A shop's stock (shop.js) is picked from its own table. Pure: each
// function takes an RNG state and returns { value, state }.
import { int, percent } from '../core/rng.js';

// One module type from a non-empty table, by weight.
export function pickWeighted(state, table) {
  const entries = Object.entries(table);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = int(state, 0, total - 1);
  let at = roll.value;
  for (const [type, weight] of entries) {
    if (at < weight) return { value: type, state: roll.state };
    at -= weight;
  }
  throw new Error('A drop table needs a weight above 0.');
}

// What a job's drops bring: a module type, or null. No drops, no roll.
export function rollDrop(state, drops) {
  if (!drops) return { value: null, state };
  const hit = percent(state, drops.chance);
  return hit.value ? pickWeighted(hit.state, drops.parts) : { value: null, state: hit.state };
}

// Up to `count` different module types from a table, by weight, each
// picked from what the ones before left.
export function pickSeveral(state, table, count) {
  const left = { ...table };
  const picked = [];
  while (picked.length < count && Object.keys(left).length) {
    const pick = pickWeighted(state, left);
    picked.push(pick.value);
    delete left[pick.value];
    state = pick.state;
  }
  return { value: picked, state };
}
