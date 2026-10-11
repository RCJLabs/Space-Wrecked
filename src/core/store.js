// One-way store: dispatch(action) -> reducer (in src/sim/) -> new state ->
// subscribers. Reducers must return the same object when nothing changed, so
// subscribers only hear about real changes.

export function createStore(reducer, initialState) {
  let state = initialState;
  let reducing = false;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      if (!action || typeof action.type !== 'string') {
        throw new TypeError('dispatch: an action needs a string type');
      }
      if (reducing) throw new Error(`dispatch: reducers may not dispatch (got ${action.type})`);
      const prev = state;
      reducing = true;
      try {
        state = reducer(state, action);
      } finally {
        reducing = false;
      }
      if (state !== prev) {
        for (const listener of [...listeners]) listener(state, prev, action);
      }
      return action;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
