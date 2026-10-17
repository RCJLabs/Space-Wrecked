// A sound in data/sounds.json is ZzFX's parameters by name (M35): this turns
// them into the list ZzFX takes (src/platform/zzfx.js), in its order, a name
// left out taking ZzFX's own default. Pure, for the game, the validator and
// tools/sounds.js.
//   shape        0 sine, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square
//                (shapeCurve is then the square's duty: 1 is half)
//   slide        Hz a second the pitch moves, over 500; deltaSlide moves it
//   filter       a low-pass at that many Hz if negative, a high-pass if
//                positive, none at 0
//   randomness   how far each play's pitch may stray, as a share of it
export const ZZFX_PARAMS = [
  'volume', 'randomness', 'frequency', 'attack', 'sustain', 'release', 'shape', 'shapeCurve', 'slide', 'deltaSlide',
  'pitchJump', 'pitchJumpTime', 'repeatTime', 'noise', 'modulation', 'bitCrush', 'delay', 'sustainVolume', 'decay', 'tremolo', 'filter',
];

// ZzFX's defaults for the two these read.
const RELEASE = 0.1;
const FREQUENCY = 220;

export function zzfxArgs(sound) {
  return ZZFX_PARAMS.map((name) => sound[name]);
}

// How long a sound lasts, in seconds: its envelope and its echo.
export function soundLength(sound) {
  const { attack = 0, decay = 0, sustain = 0, release = RELEASE, delay = 0 } = sound;
  return attack + decay + sustain + release + delay;
}

// Whether its slides take the pitch through zero before it ends, or before
// it first repeats: ZzFX then plays the pitch rising again, mirrored.
export function slidesThroughZero(sound) {
  const f0 = sound.frequency ?? FREQUENCY;
  const slide = 500 * (sound.slide ?? 0);
  const delta = 500 * (sound.deltaSlide ?? 0);
  const end = Math.min(soundLength(sound), sound.repeatTime || Infinity);
  for (let t = 0; t <= end; t += 0.001) if (f0 + slide * t + 0.5 * delta * t * t <= 0) return true;
  return false;
}
