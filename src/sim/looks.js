// Crew looks (ROADMAP §4.5, M23c): what a crew member's portrait is drawn
// from, saved with them as plain data. A look has one choice in each layer:
//   face     which of FACES face shapes, a whole number
//   skin, hair, hairColor, eyes, beard, mark   an id from LOOK_LAYERS
// Each id is a drawing (src/render/portraits/ draws every one), so the
// choices live here, where the sim rolls them and a save's migration can
// reach them. Rolls are seeded and pure: two crew aboard always differ in at
// least LOOKS_APART layers.
import { next, seedFrom } from '../core/rng.js';

export const FACES = 12;

export const LOOK_LAYERS = {
  skin: ['porcelain', 'fair', 'peach', 'sand', 'olive', 'tan', 'umber', 'brown', 'deep'],
  hair: ['bald', 'buzz', 'crop', 'sidepart', 'quiff', 'mohawk', 'long', 'bun', 'afro', 'locs'],
  hairColor: ['black', 'darkBrown', 'brown', 'auburn', 'copper', 'blond', 'platinum', 'grey', 'teal', 'magenta', 'violet'],
  eyes: ['brown', 'dark', 'hazel', 'green', 'blue', 'grey', 'amber'],
  beard: ['none', 'stubble', 'mustache', 'goatee', 'full'],
  mark: ['none', 'scar', 'freckles', 'tattoo', 'ports', 'cybereye', 'jawplate', 'earring', 'eyepatch', 'lines'],
};

// Every layer, in the order captain creation steps through them.
export const LOOK_KEYS = ['face', ...Object.keys(LOOK_LAYERS)];

// Two crew aboard differ in at least this many layers.
export const LOOKS_APART = 2;

// How often a roll lands on each choice, in the layer's order. A layer not
// here rolls each choice alike.
const WEIGHTS = {
  hairColor: [5, 5, 4, 2, 2, 3, 1, 2, 0.6, 0.6, 0.6],
  beard: [9, 3, 1.5, 1.5, 2],
  mark: [9, 1.6, 1.6, 1.2, 1, 0.8, 0.6, 1.2, 0.5, 1],
};

// Rolls before taking a look that is too close to someone's.
const TRIES = 20;

// The number of layers in which two looks differ.
export function looksApart(a, b) {
  return LOOK_KEYS.filter((key) => a[key] !== b[key]).length;
}

// A look rolled from RNG `state`, at least LOOKS_APART layers from each of
// `others` when 20 rolls can find one: { value: look, state }.
export function rollLook(state, others = []) {
  let rng = state;
  let look = null;
  for (let tries = 0; tries < TRIES; tries++) {
    const face = next(rng);
    rng = face.state;
    look = { face: Math.floor(face.value * FACES) };
    for (const [key, choices] of Object.entries(LOOK_LAYERS)) {
      const roll = weighted(rng, choices, WEIGHTS[key]);
      look[key] = roll.value;
      rng = roll.state;
    }
    if (others.every((other) => looksApart(look, other) >= LOOKS_APART)) break;
  }
  return { value: look, state: rng };
}

// A crew member's look from the campaign's seed and their id, apart from
// `others`: for the start crew of a new game, and for crews saved before
// looks.
export function crewLook(seed, id, others = []) {
  return rollLook(seedFrom(`look ${seed} ${id}`), others).value;
}

// The look with the next choice in layer `key`, round to the first after
// the last: captain creation's steps.
export function stepLook(look, key) {
  if (key === 'face') return { ...look, face: (look.face + 1) % FACES };
  const choices = LOOK_LAYERS[key];
  return { ...look, [key]: choices[(choices.indexOf(look[key]) + 1) % choices.length] };
}

// True if `look` is a look: a choice in every layer and nothing more.
export function isLook(look) {
  if (look === null || typeof look !== 'object' || Array.isArray(look)) return false;
  if (Object.keys(look).length !== LOOK_KEYS.length) return false;
  if (!Number.isInteger(look.face) || look.face < 0 || look.face >= FACES) return false;
  return Object.entries(LOOK_LAYERS).every(([key, choices]) => choices.includes(look[key]));
}

function weighted(state, choices, weights = choices.map(() => 1)) {
  const roll = next(state);
  let left = roll.value * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < choices.length; i++) {
    left -= weights[i];
    if (left < 0) return { value: choices[i], state: roll.state };
  }
  return { value: choices[choices.length - 1], state: roll.state };
}
