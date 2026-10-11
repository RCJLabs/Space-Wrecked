// Root reducer for the store. Pure: no DOM, window, timers, Date.now() or
// Math.random(). The starting seed comes in from outside.
import { emptyBuilds, reduceBuilds } from './builds.js';
import { defaultSettings, reduceSettings } from './settings.js';

export function initialState(seed) {
  return {
    screen: 'title',
    settings: defaultSettings(),
    rng: seed >>> 0,
    // The builder's saved ships (builds.js), saved after every change.
    builds: emptyBuilds(),
  };
}

export function reduce(state, action) {
  switch (action.type) {
    case 'save/restore':
      return { ...state, settings: { ...action.data.settings }, rng: action.data.rng, builds: action.data.builds ?? emptyBuilds() };
    case 'screen/show':
      return action.screen === state.screen ? state : { ...state, screen: action.screen };
    default: {
      if (action.type.startsWith('builds/')) {
        const builds = reduceBuilds(state.builds, action);
        return builds === state.builds ? state : { ...state, builds };
      }
      const settings = reduceSettings(state.settings, action);
      return settings === state.settings ? state : { ...state, settings };
    }
  }
}

// The part of the state that goes into a save. The screen is not saved.
export function saveData(state) {
  return { settings: state.settings, rng: state.rng, builds: state.builds };
}
