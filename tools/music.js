#!/usr/bin/env node
// Each bed in data/music.json (M60) as the worker renders it: how long its
// loop lasts, its peak (1 clips) and its loudness, measured as
// tools/sounds.js measures a sound. Each bed says how loud it is meant to be
// (its `loudness`, 10 to 16 dB under the sounds' middle, UNDER); where it is
// more than LOUDNESS_SLACK off, the gain that would bring it there.
//
//   node tools/music.js              the table
//   node tools/music.js --wav <dir>  and each bed's loop, twice over, as a
//                                    WAV file there, to listen to
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderBed } from '../src/core/music.js';
import { zzfxArgs } from '../src/core/soundParams.js';
import { readData } from './data.js';
import { LOUDNESS_SLACK, loadZzfx, measure } from './sounds.js';

export const UNDER = [10, 16]; // dB under the sounds' middle loudness

export function bedSynth(ZZFX) {
  return (zzfx) => ZZFX.buildSamples(...zzfxArgs(zzfx));
}

// The sounds' middle loudness, in dB: what a bed sits under.
export function soundsMiddle(sounds) {
  const levels = sounds.map((s) => s.loudness).sort((a, b) => a - b);
  return levels[Math.floor(levels.length / 2)];
}

// The rows: { id, ms, peak, loudness, target, gain } with gain the one that
// would meet the target, or null when the bed is near enough.
export function bedReport(ZZFX, beds) {
  return beds.map((bed) => {
    const { ms, peak, loudness } = measure(renderBed(bed, bedSynth(ZZFX), ZZFX.sampleRate), ZZFX.sampleRate);
    const off = bed.loudness - loudness;
    const gain = Math.abs(off) > LOUDNESS_SLACK ? Number((bed.gain * 10 ** (off / 20)).toPrecision(3)) : null;
    return { id: bed.id, ms, peak, loudness, target: bed.loudness, gain };
  });
}

// A mono 16-bit WAV of samples at sampleRate.
export function wav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

async function main() {
  const ZZFX = await loadZzfx();
  const data = readData();
  const middle = soundsMiddle(data.sounds.sounds);
  console.log(`the sounds' middle: ${middle} dB, so a bed between ${middle - UNDER[1]} and ${middle - UNDER[0]} dB`);
  console.log('bed      loop      peak   loudness  meant to be');
  for (const { id, ms, peak, loudness, target, gain } of bedReport(ZZFX, data.music.beds)) {
    const fix = gain === null ? '' : `  off: gain ${gain} would meet it`;
    console.log(`${id.padEnd(8)} ${(ms / 1000).toFixed(1).padStart(5)} s  ${peak.toFixed(2)}  ${loudness.toFixed(1).padStart(6)} dB  ${String(target).padStart(4)} dB${fix}`);
  }
  const at = process.argv.indexOf('--wav');
  if (at < 0) return;
  const dir = process.argv[at + 1];
  mkdirSync(dir, { recursive: true });
  for (const bed of data.music.beds) {
    const loop = renderBed(bed, bedSynth(ZZFX), ZZFX.sampleRate);
    const twice = new Float32Array(loop.length * 2);
    twice.set(loop);
    twice.set(loop, loop.length);
    writeFileSync(join(dir, `${bed.id}.wav`), wav(twice, ZZFX.sampleRate));
  }
  console.log(`${data.music.beds.length} beds written to ${dir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
