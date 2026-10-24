// Sound (M35): each sound in data/sounds.json made in code by ZzFX
// (zzfx.js, MIT, as published) from its parameters, and played at the
// player's volume. Audio starts with the first tap: until then nothing
// loads and nothing plays, and while sound is off nothing loads at all.
//
//   startAudio(store)  once, at boot: follows the settings, and waits for
//                      the first tap
//   cue(id)            a moment's sound (ui/sounds.js). The sounds cued in
//                      one go of the page's work (one tap, one change) play
//                      one after another, and a tap's own sound gives way to
//                      any other: one tap, one sound
//   playNow(id)        a sound at once, sound off or not (the dev menu)
//   audioStatus()      a line on how sound stands, with the last few
//                      played (the dev menu)
//   recentSounds()     the ids of the last RECENT sounds played
//   onSounds(listener) listener(ids) hears each go's sounds as they would
//                      play, a tap's own left out, whether sound is on or
//                      not: the captions (M49, ui/captions.js)
//
// ZzFX scales a sound by its own volume (0.3) as it makes it and again as
// it plays it; the samples are made once with the first scaling (the
// loudness tools/sounds.js measures), then played through a gain at the
// player's volume, so 100% is the sound as measured. Each play strays a
// little in pitch by the sound's randomness, as ZzFX's own plays do: Math
// here is not the game's dice.
import { zzfxArgs } from '../core/soundParams.js';
import { loadContent } from './content.js';

const MAX_VOICES = 12; // sounds playing at once; any more are dropped
const GAP = 0.05; // s between sounds cued together
const RECENT = 40;

let setting = { sound: true, volume: 70 };
let touched = false; // the page has had its first tap
let loading = null; // loading ZzFX and the sounds, once begun
let ready = null; // { ZZFX, ctx, gain, sounds } once loaded
const buffers = new Map(); // id -> AudioBuffer
let voices = 0;
let pending = [];
const recent = [];
const listeners = new Set();

export function startAudio(store) {
  follow(store.getState().settings);
  store.subscribe((state, prev) => state.settings !== prev.settings && follow(state.settings));
  const first = () => {
    touched = true;
    if (setting.sound) load();
  };
  addEventListener('pointerdown', first, { capture: true, once: true });
  addEventListener('keydown', first, { capture: true, once: true });
  // The phone may hold the audio while the game is away; a tap, or coming
  // back, lets it go again.
  addEventListener('pointerdown', wake, { capture: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? ready?.ctx.suspend() : wake()));
}

export function cue(id) {
  if (!id) return;
  pending.push(id);
  if (pending.length === 1) queueMicrotask(flush);
}

export async function playNow(id) {
  touched = true;
  await load();
  start(id, 0);
}

export function audioStatus() {
  if (!setting.sound) return 'Sound: off';
  if (!ready) return touched ? 'Sound: loading' : 'Sound: waiting for the first tap';
  return `Sound: ${setting.volume}%, ${ready.ctx.state}, ${voices} playing; last: ${recent.slice(-6).join(', ') || 'none'}`;
}

export function recentSounds() {
  return [...recent];
}

export function onSounds(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function follow(settings) {
  setting = { sound: settings.sound !== false, volume: settings.volume ?? 70 };
  if (ready) ready.gain.gain.value = setting.volume / 100;
  if (touched && setting.sound) load();
}

function load() {
  loading ??= Promise.all([import('./zzfx.js'), loadContent()])
    .then(([{ ZZFX }, content]) => {
      const ctx = ZZFX.audioContext;
      const gain = ctx.createGain();
      gain.gain.value = setting.volume / 100;
      gain.connect(ctx.destination);
      ready = { ZZFX, ctx, gain, sounds: content.sounds };
    })
    .catch((err) => {
      loading = null; // the next tap tries again
      console.warn(`Sound not loaded: ${err.message}`);
    });
  return loading;
}

function wake() {
  if (ready?.ctx.state === 'suspended' && !document.hidden) ready.ctx.resume();
}

function flush() {
  const ids = pending;
  pending = [];
  const telling = [...new Set(ids.filter((id) => id !== 'tap'))];
  if (telling.length) for (const listener of listeners) listener(telling);
  if (!ready || !setting.sound) return;
  let at = 0;
  for (const id of telling.length ? telling : ['tap']) at = start(id, at) + GAP;
}

// Plays a sound `delay` s from now; returns when it ends, in s from now.
function start(id, delay) {
  const buffer = ready && bufferOf(id);
  if (!buffer || voices >= MAX_VOICES) return delay;
  const { ctx, gain, sounds } = ready;
  const source = ctx.createBufferSource();
  const stray = sounds.get(id).zzfx.randomness ?? 0.05;
  source.buffer = buffer;
  source.playbackRate.value = 1 + stray * (Math.random() * 2 - 1);
  source.connect(gain);
  source.onended = () => {
    voices -= 1;
    source.disconnect();
  };
  voices += 1;
  source.start(ctx.currentTime + delay);
  recent.push(id);
  if (recent.length > RECENT) recent.shift();
  return delay + buffer.duration;
}

function bufferOf(id) {
  if (!buffers.has(id)) {
    const sound = ready.sounds.get(id);
    if (!sound) return null;
    const { ZZFX, ctx } = ready;
    const samples = ZZFX.buildSamples(...zzfxArgs({ ...sound.zzfx, randomness: 0 }));
    const buffer = ctx.createBuffer(1, samples.length, ZZFX.sampleRate);
    buffer.getChannelData(0).set(samples);
    buffers.set(id, buffer);
  }
  return buffers.get(id);
}
