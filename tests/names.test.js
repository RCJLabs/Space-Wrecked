// Crew names cut short for buttons and list rows (M23c): first names, an
// initial where two share one, whole names where the initials match too.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pick, seedFrom } from '../src/core/rng.js';
import { shortNames } from '../src/ui/names.js';
import { rules } from './battleKit.js';

test('a first name each, unless two share one: then the initial, or the whole names', () => {
  assert.deepEqual(shortNames(['Fen Lindqvist', 'Quill Petrov', 'Medic']), ['Fen', 'Quill', 'Medic']);
  assert.deepEqual(shortNames(['Fen Lindqvist', 'Quill Petrov', 'Fen Varga']), ['Fen L.', 'Quill', 'Fen V.']);
  assert.deepEqual(shortNames(['Fen', 'Fen Varga']), ['Fen', 'Fen V.']);
  assert.deepEqual(shortNames(['Fen Lindqvist', 'Fen Lowe', 'Fen Varga']), ['Fen Lindqvist', 'Fen Lowe', 'Fen V.']);
  assert.deepEqual(shortNames([]), []);
});

test("crews from the recruits' names never show two the same", () => {
  const { first, last } = rules.recruits;
  for (let i = 0; i < 500; i++) {
    let state = seedFrom(`short names ${i}`);
    const names = new Set();
    while (names.size < 8) {
      const a = pick(state, first);
      const b = pick(a.state, last);
      state = b.state;
      names.add(`${a.value} ${b.value}`);
    }
    const short = shortNames([...names]);
    assert.equal(new Set(short).size, short.length, [...names].join(', '));
  }
});
