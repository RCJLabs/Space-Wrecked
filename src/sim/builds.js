// The builder's saved ships: a few slots, each a named ship with its build
// log (replay.js), and which one is open. Plain data and a reducer, saved
// with the game:
//   { active, slots: [{ name, ship, log }] }
// With no slots, the builder starts one when it opens.
import { isShipData } from './builder.js';
import { isCommand } from './replay.js';

export const MAX_SLOTS = 6;
export const MAX_NAME = 24;

export function emptyBuilds() {
  return { active: 0, slots: [] };
}

// The open slot, or null if there are none.
export function activeSlot(builds) {
  return builds.slots[builds.active] ?? null;
}

// "Ship 1", "Ship 2"...: the first not taken.
export function nextSlotName(builds) {
  const taken = new Set(builds.slots.map((slot) => slot.name));
  for (let n = 1; ; n++) if (!taken.has(`Ship ${n}`)) return `Ship ${n}`;
}

// Actions:
//   builds/save   { ship, log }   the open ship changed (starts slot 1 if none)
//   builds/add    { slot }        a new slot, opened; ignored when full
//   builds/open   { index }
//   builds/delete { index }       the next slot down opens in its place
export function reduceBuilds(builds, action) {
  switch (action.type) {
    case 'builds/save': {
      const slot = activeSlot(builds);
      if (!slot) return { active: 0, slots: [{ name: nextSlotName(builds), ship: action.ship, log: action.log }] };
      if (slot.ship === action.ship && slot.log === action.log) return builds;
      return { ...builds, slots: builds.slots.map((s, i) => (i === builds.active ? { ...s, ship: action.ship, log: action.log } : s)) };
    }
    case 'builds/add':
      if (builds.slots.length >= MAX_SLOTS) return builds;
      return { active: builds.slots.length, slots: [...builds.slots, action.slot] };
    case 'builds/open':
      if (action.index === builds.active || !builds.slots[action.index]) return builds;
      return { ...builds, active: action.index };
    case 'builds/delete': {
      if (!builds.slots[action.index]) return builds;
      const slots = builds.slots.filter((_, i) => i !== action.index);
      const active = action.index < builds.active ? builds.active - 1 : Math.min(builds.active, Math.max(0, slots.length - 1));
      return { active, slots };
    }
    default:
      return builds;
  }
}

// True if value has the shape of saved builds. Whether each log still
// replays to its ship is the builder's to check when it opens one.
export function isBuilds(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { active, slots } = value;
  if (!Array.isArray(slots) || slots.length > MAX_SLOTS || !Number.isInteger(active)) return false;
  if (slots.length ? active < 0 || active >= slots.length : active !== 0) return false;
  return slots.every(
    (slot) =>
      typeof slot === 'object' && slot !== null &&
      typeof slot.name === 'string' && slot.name.trim() !== '' && slot.name.length <= MAX_NAME &&
      isShipData(slot.ship) && Array.isArray(slot.log) && slot.log.every(isCommand),
  );
}
