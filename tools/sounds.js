#!/usr/bin/env node
// Each sound in data/sounds.json as a phone plays it (M35), rendered with
// the game's own ZzFX (src/platform/zzfx.js) with no randomness: how long it
// lasts, its peak at full volume (1 clips), and its loudness, the loudest
// 30 ms through a phone speaker's low end (a fourth-order high-pass at
// 450 Hz), in dB. Each sound says how loud it is meant to be (its
// `loudness`, matched across the styles on M35's audition page); where it
// is more than LOUDNESS_SLACK off, the volume that would bring it there.
//
//   node tools/sounds.js
import { pathToFileURL } from 'node:url';
import { zzfxArgs } from '../src/core/soundParams.js';
import { readData } from './data.js';

export const LOUDNESS_SLACK = 1; // dB
const WINDOW = 0.03; // s
const PHONE_LOW = 450; // Hz

// ZzFX makes its AudioContext as it loads, which Node has none of; nothing
// here plays, so a stand-in does.
export async function loadZzfx() {
  globalThis.AudioContext ??= class {};
  return (await import('../src/platform/zzfx.js')).ZZFX;
}

// The samples a sound makes, at ZzFX's own volume: the game plays them at
// the player's volume, at most 1.
export function renderSound(ZZFX, zzfx) {
  return Float64Array.from(ZZFX.buildSamples(...zzfxArgs({ ...zzfx, randomness: 0 })));
}

// { ms, peak, loudness } of a sound's samples.
export function measure(samples, sampleRate) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const heard = highPass(highPass(samples, sampleRate, PHONE_LOW, 0.5412), sampleRate, PHONE_LOW, 1.3066);
  const win = Math.round(WINDOW * sampleRate);
  let loudest = 0;
  let sum = 0;
  for (let i = 0; i < heard.length; i++) {
    sum += heard[i] ** 2;
    if (i >= win) sum -= heard[i - win] ** 2;
    loudest = Math.max(loudest, sum / Math.min(i + 1, win));
  }
  return { ms: Math.round((samples.length / sampleRate) * 1000), peak, loudness: 10 * Math.log10(loudest + 1e-12) };
}

// The rows: { id, ms, peak, loudness, target, volume } with volume the one
// that would meet the target, or null when the sound is near enough.
export function soundReport(ZZFX, sounds) {
  return sounds.map(({ id, loudness: target, zzfx }) => {
    const { ms, peak, loudness } = measure(renderSound(ZZFX, zzfx), ZZFX.sampleRate);
    const off = target - loudness;
    const volume = Math.abs(off) > LOUDNESS_SLACK ? Number(((zzfx.volume ?? 1) * 10 ** (off / 20)).toPrecision(3)) : null;
    return { id, ms, peak, loudness, target, volume };
  });
}

// A biquad high-pass at fc Hz.
function highPass(x, sampleRate, fc, q) {
  const w = (2 * Math.PI * fc) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const [b0, b1, a1, a2] = [(1 + cos) / 2 / a0, -(1 + cos) / a0, (-2 * cos) / a0, (1 - alpha) / a0];
  const y = new Float64Array(x.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, x[i], y1, v];
    y[i] = v;
  }
  return y;
}

async function main() {
  const ZZFX = await loadZzfx();
  const rows = soundReport(ZZFX, readData().sounds.sounds);
  console.log('sound      length  peak   loudness  meant to be');
  for (const { id, ms, peak, loudness, target, volume } of rows) {
    const fix = volume === null ? '' : `  off: volume ${volume} would meet it`;
    console.log(`${id.padEnd(10)} ${String(ms).padStart(4)} ms  ${peak.toFixed(2)}  ${loudness.toFixed(1).padStart(6)} dB  ${String(target).padStart(4)} dB${fix}`);
  }
  console.log(`loudest peak: ${Math.max(...rows.map((r) => r.peak)).toFixed(2)}, where a peak of 1 clips`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
