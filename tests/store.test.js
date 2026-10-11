import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore } from '../src/core/store.js';

const counter = (state, action) => (action.type === 'add' ? { n: state.n + action.by } : state);

test('dispatch runs the reducer and notifies subscribers with state, previous state and action', () => {
  const store = createStore(counter, { n: 0 });
  const calls = [];
  store.subscribe((state, prev, action) => calls.push([state.n, prev.n, action.type]));
  store.dispatch({ type: 'add', by: 2 });
  assert.equal(store.getState().n, 2);
  assert.deepEqual(calls, [[2, 0, 'add']]);
});

test('an action that changes nothing notifies nobody', () => {
  const store = createStore(counter, { n: 0 });
  let calls = 0;
  store.subscribe(() => (calls += 1));
  store.dispatch({ type: 'noop' });
  assert.equal(calls, 0);
});

test('unsubscribe stops notifications', () => {
  const store = createStore(counter, { n: 0 });
  let calls = 0;
  const off = store.subscribe(() => (calls += 1));
  store.dispatch({ type: 'add', by: 1 });
  off();
  store.dispatch({ type: 'add', by: 1 });
  assert.equal(calls, 1);
});

test('subscribers may dispatch, reducers may not', () => {
  const store = createStore(counter, { n: 0 });
  store.subscribe((state) => {
    if (state.n === 1) store.dispatch({ type: 'add', by: 10 });
  });
  store.dispatch({ type: 'add', by: 1 });
  assert.equal(store.getState().n, 11);

  const sneaky = createStore((state, action) => {
    if (action.type === 'go') sneaky.dispatch({ type: 'again' });
    return state;
  }, {});
  assert.throws(() => sneaky.dispatch({ type: 'go' }), /reducers may not dispatch/);
  sneaky.dispatch({ type: 'fine' }); // the store recovers afterwards
});

test('actions need a string type', () => {
  const store = createStore(counter, { n: 0 });
  assert.throws(() => store.dispatch({}), TypeError);
  assert.throws(() => store.dispatch(null), TypeError);
});
