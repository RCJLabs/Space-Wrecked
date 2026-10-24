// The sounds (data/sounds.json, M35, src/platform/audio.js), for
// validate-data.js: each one's id, what it is for, its caption (M49), how
// loud it is meant to be (tools/sounds.js measures it), and its ZzFX
// parameters by name
// (src/core/soundParams.js), each in a range ZzFX makes sense of. A sound
// lasts at most MAX_LENGTH, and its slides never take the pitch through
// zero. Every sound the game plays at its moments (src/ui/sounds.js) is
// there. Returns the ids, for the weapons' sounds.
import { slidesThroughZero, soundLength, ZZFX_PARAMS } from '../src/core/soundParams.js';
import { MOMENT_SOUNDS } from '../src/ui/sounds.js';
import { isId, isIntIn, isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const SOUND_KEYS = ['id', 'for', 'caption', 'loudness', 'zzfx'];
// A caption is a few words, shown as the sound plays (Settings' Captions).
const MAX_CAPTION = 24;
export const MAX_LENGTH = 2.5; // s
const LOUDNESS = [-40, -6]; // dB
const MAX_FOR = 120;
// [least, most] of each parameter but shape (a whole number, 0 to 5) and
// filter (0, or 20 to 20000 Hz either way).
const RANGES = {
  volume: [0.01, 8],
  randomness: [0, 0.5],
  frequency: [20, 10000],
  attack: [0, MAX_LENGTH],
  sustain: [0, MAX_LENGTH],
  release: [0, MAX_LENGTH],
  decay: [0, MAX_LENGTH],
  delay: [0, MAX_LENGTH],
  shapeCurve: [0.01, 5],
  slide: [-200, 200],
  deltaSlide: [-200, 200],
  pitchJump: [-5000, 5000],
  pitchJumpTime: [0, MAX_LENGTH],
  repeatTime: [0, MAX_LENGTH],
  noise: [0, 10],
  modulation: [-1000, 1000],
  bitCrush: [0, 1],
  sustainVolume: [0, 1],
  tremolo: [0, 1],
};

export function checkSounds(file, fail) {
  const sounds = listOf(file, 'sounds', 'sounds.json', fail);
  const ids = uniqueIds(sounds, 'sounds.json', fail);
  sounds.forEach((sound, i) => {
    const where = `sounds.json ${sound.id ?? `#${i}`}`;
    knownKeys(sound, SOUND_KEYS, where, fail);
    if (!isText(sound.for) || sound.for.length > MAX_FOR) fail(where, `for must say what the sound is for, in up to ${MAX_FOR} letters`);
    if (!isText(sound.caption) || sound.caption.length > MAX_CAPTION) fail(where, `caption must name the sound in words, in up to ${MAX_CAPTION} letters`);
    if (!(Number.isFinite(sound.loudness) && sound.loudness >= LOUDNESS[0] && sound.loudness <= LOUDNESS[1])) {
      fail(where, `loudness must be a number of dB from ${LOUDNESS[0]} to ${LOUDNESS[1]}`);
    }
    if (!isObject(sound.zzfx)) {
      fail(where, 'zzfx must be an object of ZzFX parameters by name');
      return;
    }
    checkZzfx(sound.zzfx, `${where} zzfx`, fail);
  });
  for (const id of MOMENT_SOUNDS) if (!ids.has(id)) fail('sounds.json', `the game plays "${id}" and it isn't here`);
  return ids;
}

function checkZzfx(zzfx, where, fail) {
  knownKeys(zzfx, ZZFX_PARAMS, where, fail);
  let numbers = true;
  for (const [key, value] of Object.entries(zzfx)) {
    if (!ZZFX_PARAMS.includes(key)) continue;
    if (!Number.isFinite(value)) {
      fail(where, `${key} must be a number`);
      numbers = false;
    } else if (key === 'shape') {
      if (!isIntIn(value, 0, 5)) fail(where, 'shape must be 0 (sine), 1 (triangle), 2 (saw), 3 (tan), 4 (noise) or 5 (square)');
    } else if (key === 'filter') {
      if (value !== 0 && !(Math.abs(value) >= 20 && Math.abs(value) <= 20000)) fail(where, 'filter must be 0, or 20 to 20000 Hz (negative a low-pass)');
    } else if (value < RANGES[key][0] || value > RANGES[key][1]) {
      fail(where, `${key} must be from ${RANGES[key][0]} to ${RANGES[key][1]}`);
    }
  }
  if (!numbers) return;
  if (soundLength(zzfx) > MAX_LENGTH) fail(where, `it lasts ${soundLength(zzfx).toFixed(2)} s, over ${MAX_LENGTH}`);
  if (soundLength(zzfx) <= 0) fail(where, 'it must last some time');
  if (slidesThroughZero(zzfx)) fail(where, 'its slides take the pitch through zero, where it turns back up');
}

// What a weapon's sound must be: one of the sounds.
export function checkSoundOf(item, ids, where, fail) {
  if (!isId(item.sound) || !ids.has(item.sound)) fail(where, 'sound must be one of the sounds in sounds.json');
}
