// The music (data/music.json, M60, src/core/music.js), for validate-data.js:
// each bed's id, what it is for, the screens it plays under (each a real
// screen, under one bed at most), its tempo, steps to a bar, bars, root,
// gain and how loud it is meant to be (tools/music.js measures it), and its
// parts: each a ZzFX instrument checked as a sound's is, but whose notes may
// ring up to MAX_NOTE, an octave shift or a frequency of its own (not
// both), and notes that fill the bed's steps a whole number of times.
import { parseNotes, REST } from '../src/core/music.js';
import { SCREEN_IDS } from '../src/ui/screens.js';
import { checkZzfx } from './validate-sounds.js';
import { isIntIn, isObject, isText, knownKeys, listOf, uniqueIds } from './checks.js';

const BED_KEYS = ['id', 'for', 'screens', 'bpm', 'steps', 'bars', 'root', 'gain', 'loudness', 'parts'];
const PART_KEYS = ['name', 'octave', 'zzfx', 'notes'];
export const MAX_NOTE = 6; // s
const MAX_FOR = 120;
const MAX_PARTS = 8;
const LOUDNESS = [-40, -20]; // dB
const NOTE = /^-?\d{1,2}(,-?\d{1,2})*$/;

export function checkMusic(file, fail) {
  const beds = listOf(file, 'beds', 'music.json', fail);
  uniqueIds(beds, 'music.json', fail);
  const scored = new Map(); // screen -> the bed it plays under
  beds.forEach((bed, i) => {
    const where = `music.json ${bed.id ?? `#${i}`}`;
    knownKeys(bed, BED_KEYS, where, fail);
    if (!isText(bed.for) || bed.for.length > MAX_FOR) fail(where, `for must say where the bed plays and how it sounds, in up to ${MAX_FOR} letters`);
    if (!Array.isArray(bed.screens) || !bed.screens.length) fail(where, 'screens must list the screens it plays under');
    for (const screen of bed.screens ?? []) {
      if (!SCREEN_IDS.includes(screen)) fail(where, `"${screen}" is not a screen (src/ui/screens.js)`);
      else if (scored.has(screen)) fail(where, `"${screen}" already plays under ${scored.get(screen)}`);
      else scored.set(screen, bed.id);
    }
    if (!(Number.isFinite(bed.bpm) && bed.bpm >= 40 && bed.bpm <= 200)) fail(where, 'bpm must be from 40 to 200');
    if (!isIntIn(bed.steps, 2, 16)) fail(where, 'steps must be a whole number of steps to a bar, 2 to 16');
    if (!isIntIn(bed.bars, 1, 16)) fail(where, 'bars must be a whole number, 1 to 16');
    if (!(Number.isFinite(bed.root) && bed.root >= 20 && bed.root <= 2000)) fail(where, 'root must be a pitch from 20 to 2000 Hz');
    if (!(Number.isFinite(bed.gain) && bed.gain > 0 && bed.gain <= 4)) fail(where, 'gain must be above 0 and at most 4');
    if (!(Number.isFinite(bed.loudness) && bed.loudness >= LOUDNESS[0] && bed.loudness <= LOUDNESS[1])) {
      fail(where, `loudness must be a number of dB from ${LOUDNESS[0]} to ${LOUDNESS[1]}`);
    }
    const parts = Array.isArray(bed.parts) ? bed.parts : [];
    if (!parts.length || parts.length > MAX_PARTS) fail(where, `parts must list 1 to ${MAX_PARTS} parts`);
    parts.forEach((part, j) => checkPart(part, bed, `${where} ${part?.name ?? `part #${j}`}`, fail));
  });
}

function checkPart(part, bed, where, fail) {
  if (!isObject(part)) return fail(where, 'a part must be an object');
  knownKeys(part, PART_KEYS, where, fail);
  if (!isText(part.name)) fail(where, 'name must name the part');
  if (part.octave !== undefined && !isIntIn(part.octave, -3, 3)) fail(where, 'octave must be a whole number from -3 to 3');
  if (!isObject(part.zzfx)) return fail(where, 'zzfx must be an object of ZzFX parameters by name');
  if (part.zzfx.frequency !== undefined && part.octave !== undefined) fail(where, 'a part with its own frequency counts its notes from it: no octave too');
  if (part.zzfx.randomness !== undefined) fail(where, 'a bed is made once: no randomness');
  checkZzfx(part.zzfx, `${where} zzfx`, fail, MAX_NOTE);
  if (!isText(part.notes)) return fail(where, 'notes must be the steps written out');
  const tokens = part.notes.trim().split(/\s+/);
  const bad = tokens.find((token) => token !== REST && !NOTE.test(token));
  if (bad !== undefined) return fail(where, `"${bad}" is not a step: "${REST}" a rest, "0" a note, "0,3,7" several`);
  const steps = (bed.bars ?? 0) * (bed.steps ?? 0);
  if (!steps || steps % tokens.length) fail(where, `its ${tokens.length} steps must go into the bed's ${steps} evenly`);
  if (parseNotes(part.notes).every((notes) => !notes.length)) fail(where, 'it plays no notes');
}
