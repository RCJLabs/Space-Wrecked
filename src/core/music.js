// The music (M60): each bed in data/music.json, a loop of a few bars, made
// from its parts' notes by ZzFX the way the sounds are (soundParams.js).
// Pure: given a synth, zzfx parameters by name -> samples (ZZFX.buildSamples
// with zzfxArgs, in the worker or a tool), it returns the loop's samples.
//
// A bed: { bpm, steps (to a bar), bars, root (Hz), gain, parts }. A part:
// { zzfx (an instrument), octave (whole octaves up or down), notes }. Its
// notes count from its instrument's own frequency if it has one (a drum, a
// hum), else from the bed's root. They are steps written out, split by
// spaces: "." a rest, "0" a note that many semitones up, "0,3,7" several at
// once. A part shorter than the bed repeats; its length must go into the
// bed's evenly. A note that rings past the loop's end carries on at its
// start, so the loop has no seam.

export const REST = '.';

// The steps of a part's notes: each a list of semitones (empty: a rest).
export function parseNotes(text) {
  return text.trim().split(/\s+/).map((token) => (token === REST ? [] : token.split(',').map(Number)));
}

export function noteFrequency(root, semitones) {
  return root * 2 ** (semitones / 12);
}

export function stepSeconds(bed) {
  return (60 / bed.bpm) * (4 / bed.steps);
}

export function bedSamples(bed, sampleRate) {
  return Math.round(bed.bars * bed.steps * stepSeconds(bed) * sampleRate);
}

// The loop, at the bed's gain.
export function renderBed(bed, synth, sampleRate) {
  const length = bedSamples(bed, sampleRate);
  const out = new Float32Array(length);
  const steps = bed.bars * bed.steps;
  const made = new Map(); // a note's samples, made once however often it plays
  for (const part of bed.parts) {
    const pattern = parseNotes(part.notes);
    for (let step = 0; step < steps; step++) {
      for (const semitones of pattern[step % pattern.length]) {
        const frequency = noteFrequency(part.zzfx.frequency ?? bed.root, semitones + 12 * (part.octave ?? 0));
        const key = `${bed.parts.indexOf(part)}:${frequency}`;
        if (!made.has(key)) made.set(key, synth({ ...part.zzfx, frequency, randomness: 0 }));
        const samples = made.get(key);
        const at = Math.round(step * stepSeconds(bed) * sampleRate);
        for (let i = 0; i < samples.length; i++) out[(at + i) % length] += samples[i] * bed.gain;
      }
    }
  }
  return out;
}
