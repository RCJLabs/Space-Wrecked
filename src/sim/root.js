// Root reducer for the store. Pure: no DOM, window, timers, Date.now() or
// Math.random(). The starting seed comes in from outside.
import { defaultSettings, reduceSettings } from './settings.js';

export function initialState(seed) {
  return {
    screen: 'title',
    settings: defaultSettings(),
    rng: seed >>> 0,
    // The builder's ship, saved after every change; null until one is started.
    ship: null,
  };
}

export function reduce(state, action) {
  switch (action.type) {
    case 'save/restore':
      return { ...state, settings: { ...action.data.settings }, rng: action.data.rng, ship: action.data.ship ?? null };
    case 'ship/set':
      return action.ship === state.ship ? state : { ...state, ship: action.ship };
    case 'screen/show':
      return action.screen === state.screen ? state : { ...state, screen: action.screen };
    default: {
      const settings = reduceSettings(state.settings, action);
      return settings === state.settings ? state : { ...state, settings };
    }
  }
}

// The part of the state that goes into a save. The screen is not saved.
export function saveData(state) {
  return { settings: state.settings, rng: state.rng, ship: state.ship };
}
