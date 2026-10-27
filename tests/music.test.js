// M60: the music's beds, made from data by src/core/music.js: a seamless
// loop of the right length, notes from the part's own frequency or the
// root, each real bed under clipping and as loud as it says, 10 to 16 dB
// under the sounds; and the validator's refusals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bedSamples, noteFrequency, parseNotes, renderBed } from '../src/core/music.js';
import { SCREEN_IDS } from '../src/ui/screens.js';
import { readData } from '../tools/data.js';
import { bedReport, soundsMiddle, UNDER } from '../tools/music.js';
import { LOUDNESS_SLACK, loadZzfx } from '../tools/sounds.js';
import { checkMusic } from '../tools/validate-music.js';

const RATE = 1000; // samples a second, for the made-up synth
const bed = (parts, more = {}) => ({ id: 'test', bpm: 120, steps: 8, bars: 1, root: 100, gain: 1, parts, ...more });
// A made-up synth: a note is `length` samples of its frequency.
const synth = (length) => (zzfx) => new Float32Array(length).fill(zzfx.frequency);

test('notes: rests, notes, chords; a note a semitone up', () => {
  assert.deepEqual(parseNotes(' . 0  0,4,7 -12 '), [[], [0], [0, 4, 7], [-12]]);
  assert.equal(noteFrequency(110, 12), 220);
  assert.ok(Math.abs(noteFrequency(440, 1) - 466.16) < 0.01);
});

test("a bed is its bars' length, and a part shorter than it repeats", () => {
  const loop = bed([{ zzfx: {}, notes: '0 . . .' }]); // a bar of 8 steps at 120 bpm: 2 s
  assert.equal(bedSamples(loop, RATE), 2000);
  const out = renderBed(loop, synth(10), RATE);
  assert.equal(out.length, 2000);
  assert.equal(out[0], 100);
  assert.equal(out[1000], 100, 'played again halfway');
  assert.equal(out[500], 0);
});

test('a note that rings past the end carries on at the start: no seam', () => {
  const out = renderBed(bed([{ zzfx: {}, notes: '. . . . . . . 0' }]), synth(400), RATE); // the last step is at 1750
  assert.equal(out[1999], 100);
  assert.equal(out[0], 100, 'wrapped round');
  assert.equal(out[149], 100);
  assert.equal(out[150], 0);
});

test("a part's notes count from its own frequency, else the root an octave shift away; the bed's gain scales it", () => {
  const out = renderBed(bed([{ zzfx: { frequency: 50 }, notes: '12 . . . . . . .' }, { octave: 1, zzfx: {}, notes: '. 0 . . . . . .' }], { gain: 0.5 }), synth(1), RATE);
  assert.equal(out[0], 50, 'its own 50 Hz, an octave up, at half gain');
  assert.equal(out[250], 100, 'the root an octave up, at half gain');
});

test('each bed in data/music.json: under clipping, as loud as it says, and 10 to 16 dB under the sounds', async () => {
  const ZZFX = await loadZzfx();
  const data = readData();
  const middle = soundsMiddle(data.sounds.sounds);
  for (const row of bedReport(ZZFX, data.music.beds)) {
    assert.ok(row.peak < 1, `${row.id}: peak ${row.peak}`);
    assert.ok(Math.abs(row.loudness - row.target) <= LOUDNESS_SLACK, `${row.id}: ${row.loudness.toFixed(1)} dB, meant ${row.target}`);
    assert.ok(row.target <= middle - UNDER[0] && row.target >= middle - UNDER[1], `${row.id}: ${row.target} dB against the sounds' ${middle}`);
    assert.ok(row.ms >= 4000, `${row.id}: a loop of some length`);
  }
});

test('the beds cover the hangar, the run, a fight and the colony; only the lift-off, the landing and the game over are silent', () => {
  const beds = readData().music.beds;
  assert.deepEqual(beds.map((b) => b.id), ['hangar', 'run', 'fight', 'colony']);
  const scored = new Set(beds.flatMap((b) => b.screens));
  assert.deepEqual(SCREEN_IDS.filter((id) => !scored.has(id)).sort(), ['landing', 'launch', 'over']);
});

test("the validator refuses a screen that isn't one, a screen under two beds, notes that don't fit, and a frequency with an octave", () => {
  const problems = (beds) => {
    const found = [];
    checkMusic({ beds }, (where, what) => found.push(`${where}: ${what}`));
    return found;
  };
  const good = { id: 'a', for: 'A test', screens: ['title'], bpm: 90, steps: 8, bars: 2, root: 110, gain: 1, loudness: -30, parts: [{ name: 'p', zzfx: { volume: 0.2 }, notes: '0 . . .' }] };
  assert.deepEqual(problems([good]), []);
  assert.match(problems([{ ...good, screens: ['nowhere'] }]).join(), /not a screen/);
  assert.match(problems([good, { ...good, id: 'b' }]).join(), /already plays under a/);
  assert.match(problems([{ ...good, parts: [{ ...good.parts[0], notes: '0 . .' }] }]).join(), /go into the bed's 16 evenly/);
  assert.match(problems([{ ...good, parts: [{ ...good.parts[0], octave: 1, zzfx: { frequency: 55 } }] }]).join(), /no octave too/);
  assert.match(problems([{ ...good, parts: [{ ...good.parts[0], notes: '0 x . .' }] }]).join(), /"x" is not a step/);
  assert.match(problems([{ ...good, parts: [{ ...good.parts[0], zzfx: { sustain: 7 } }] }]).join(), /sustain must be from 0 to 6/);
});

test('the Music setting takes its levels only; save v50 gives a save from before music at 30', async () => {
  const { defaultSettings, reduceSettings, settingsProblems, MUSIC_LEVELS } = await import('../src/sim/settings.js');
  const { MIGRATIONS, SAVE_VERSION } = await import('../src/core/save.js');
  const settings = defaultSettings();
  assert.equal(settings.music, 30);
  assert.deepEqual(MUSIC_LEVELS, [0, 10, 30, 50, 70]);
  assert.equal(reduceSettings(settings, { type: 'settings/music', value: 0 }).music, 0);
  assert.equal(reduceSettings(settings, { type: 'settings/music', value: 45 }), settings);
  assert.deepEqual(settingsProblems({ ...settings, music: 45 }), ['The music setting is invalid.']);
  assert.equal(SAVE_VERSION, 50);
  const step = MIGRATIONS.at(-1);
  assert.equal(step.from, 49);
  const { music, ...before } = settings;
  assert.equal(step.up({ settings: before }).settings.music, 30);
  assert.equal(step.up({ settings: { ...before, music: 10 } }).settings.music, 10, 'a level already there stays');
});

test("a screen's bed: the one that lists it, else none", async () => {
  const { bedFor } = await import('../src/core/music.js');
  const beds = new Map(readData().music.beds.map((b) => [b.id, b]));
  assert.equal(bedFor(beds, 'title'), 'hangar');
  assert.equal(bedFor(beds, 'sector'), 'run');
  assert.equal(bedFor(beds, 'campaign-fight'), 'fight');
  assert.equal(bedFor(beds, 'colony'), 'colony');
  assert.equal(bedFor(beds, 'launch'), null);
});
