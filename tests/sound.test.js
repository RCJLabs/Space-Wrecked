// M35: sound. Every sound renders, never clips and is as loud as it is
// meant to be; the validator's checks; the settings and their migration;
// and which sound each moment of the game makes: the campaign's, the
// builder's, the fight's taps and its playback.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, parseSave, SAVE_VERSION } from '../src/core/save.js';
import { slidesThroughZero, soundLength, zzfxArgs } from '../src/core/soundParams.js';
import { cuesBetween, makeTimeline } from '../src/render/playback.js';
import { newShip } from '../src/sim/builder.js';
import { newCampaign } from '../src/sim/campaign.js';
import { indexDefs } from '../src/sim/defs.js';
import { initialState, saveData } from '../src/sim/root.js';
import { createSession, reduceSession } from '../src/sim/session.js';
import { defaultSettings, reduceSettings, settingsProblems, VOLUMES } from '../src/sim/settings.js';
import { settingsText } from '../src/ui/settingsText.js';
import { builderSounds, cueSound, fightSounds, gameSounds, MOMENT_SOUNDS, roundSounds } from '../src/ui/sounds.js';
import { readData } from '../tools/data.js';
import { loadZzfx, measure, renderSound, soundReport } from '../tools/sounds.js';
import { validateData } from '../tools/validate-data.js';
import { MAX_LENGTH } from '../tools/validate-sounds.js';
import { rules } from './battleKit.js';

test('every sound renders, never clips, and is as loud as it is meant to be', async () => {
  const ZZFX = await loadZzfx();
  const { sounds } = readData().sounds;
  for (const { id, zzfx } of sounds) {
    const samples = renderSound(ZZFX, zzfx);
    assert.ok(samples.every(Number.isFinite), `${id} renders numbers`);
    const { ms, peak } = measure(samples, ZZFX.sampleRate);
    assert.ok(ms > 0 && ms <= MAX_LENGTH * 1000 + 1, `${id} lasts ${ms} ms`);
    assert.ok(peak < 0.9, `${id} peaks at ${peak.toFixed(2)} at full volume`);
  }
  for (const { id, loudness, target, volume } of soundReport(ZZFX, sounds)) {
    assert.equal(volume, null, `${id} is ${loudness.toFixed(1)} dB, meant to be ${target}: volume ${volume} would meet it`);
  }
  // Every moment the game plays a sound at has one, and so does every weapon.
  const ids = new Set(sounds.map((s) => s.id));
  for (const id of MOMENT_SOUNDS) assert.ok(ids.has(id), id);
  for (const weapon of rules.weapons.values()) assert.ok(ids.has(weapon.sound), weapon.id);
});

test("ZzFX takes a sound's parameters in its order; a slide through zero is caught", () => {
  const args = zzfxArgs({ volume: 0.5, frequency: 440, filter: -1000 });
  assert.equal(args.length, 21);
  assert.deepEqual([args[0], args[1], args[2], args[20]], [0.5, undefined, 440, -1000], "a name left out takes ZzFX's default");
  assert.ok(Math.abs(soundLength({ attack: 0.1, sustain: 0.2, delay: 0.05 }) - 0.45) < 1e-9, "release is ZzFX's 0.1 when left out");
  // The audition's first soft hit slid from 300 Hz through zero in 40 ms.
  assert.ok(slidesThroughZero({ frequency: 300, slide: -15, release: 0.1 }));
  assert.ok(!slidesThroughZero({ frequency: 420, slide: -6, release: 0.1 }));
  assert.ok(!slidesThroughZero({ frequency: 300, slide: -40, repeatTime: 0.01, release: 0.2 }), 'it repeats before it gets there');
  assert.ok(slidesThroughZero({ frequency: 100, slide: 1, deltaSlide: -40, release: 0.5 }), 'a slide turned back by deltaSlide');
});

const sound = (d, id) => d.sounds.sounds.find((s) => s.id === id);
const soundCases = [
  ['an unknown parameter', (d) => (sound(d, 'tap').zzfx.pitch = 3), /tap zzfx: unknown field "pitch"/],
  ['a shape ZzFX has not', (d) => (sound(d, 'tap').zzfx.shape = 6), /tap zzfx: shape must be 0 \(sine\)/],
  ['a word for a number', (d) => (sound(d, 'tap').zzfx.frequency = '440'), /tap zzfx: frequency must be a number/],
  ['too long', (d) => Object.assign(sound(d, 'turn').zzfx, { attack: 1, sustain: 1, release: 1 }), /turn zzfx: it lasts 3\.00 s, over 2\.5/],
  ['a slide through zero', (d) => Object.assign(sound(d, 'turn').zzfx, { frequency: 200, slide: -10 }), /turn zzfx: its slides take the pitch through zero/],
  ['a filter under 20 Hz', (d) => (sound(d, 'turn').zzfx.filter = 10), /turn zzfx: filter must be 0, or 20 to 20000 Hz/],
  ['loudness out of range', (d) => (sound(d, 'miss').loudness = 0), /miss: loudness must be a number of dB/],
  ['nothing said of it', (d) => delete sound(d, 'miss').for, /miss: for must say what the sound is for/],
  ['a moment with no sound', (d) => (d.sounds.sounds = d.sounds.sounds.filter((s) => s.id !== 'alarm')), /the game plays "alarm" and it isn't here/],
  ["a weapon's sound that isn't one", (d) => (d.weapons.weapons[0].sound = 'bang'), /weapons\.json rifle: sound must be one of the sounds/],
  ['a weapon with no sound', (d) => delete d.weapons.weapons[1].sound, /weapons\.json shotgun: sound must be one of the sounds/],
];

test("the validator names each sound's mistake", () => {
  for (const [name, breakIt, expected] of soundCases) {
    const data = structuredClone(readData());
    breakIt(data);
    const problems = validateData(data);
    assert.ok(problems.some((p) => expected.test(p)), `${name}: got ${JSON.stringify(problems)}`);
  }
});

test('sound and volume take only what they can hold; a save from before M35 has sound on at 70%', () => {
  const settings = defaultSettings();
  assert.deepEqual([settings.sound, settings.volume], [true, 70], "a new game: on at 70% (Evan's pick)");
  assert.deepEqual(VOLUMES, [10, 30, 50, 70, 100]);
  assert.equal(reduceSettings(settings, { type: 'settings/sound', value: false }).sound, false);
  assert.equal(reduceSettings(settings, { type: 'settings/sound', value: 'off' }), settings);
  assert.equal(reduceSettings(settings, { type: 'settings/volume', value: 30 }).volume, 30);
  assert.equal(reduceSettings(settings, { type: 'settings/volume', value: 45 }), settings);
  assert.equal(reduceSettings(settings, { type: 'settings/volume', value: 70 }), settings, 'the same volume changes nothing');
  assert.deepEqual(settingsProblems({ ...settings, sound: 1, volume: 45 }), ['The sound setting is invalid.', 'The volume setting is invalid.']);
  // The migration: v29 had no sound to switch.
  assert.equal(SAVE_VERSION, 51);
  const { sound, volume, ...v29 } = settings;
  const step = MIGRATIONS.find((m) => m.from === 29);
  assert.deepEqual(step.up({ settings: { ...v29, motion: 'reduce' } }).settings, { ...v29, motion: 'reduce', sound: true, volume: 70 });
  assert.deepEqual(step.up({ settings: null }), { settings: null }, 'unreadable settings are left for validate to report');
  const old = { version: 29, data: { ...saveData(initialState(5)), settings: v29 } };
  const loaded = parseSave(JSON.stringify(old));
  assert.ok(loaded.ok, loaded.error);
  assert.equal(loaded.save.version, 51);
  assert.deepEqual([loaded.save.data.settings.sound, loaded.save.data.settings.volume], [true, 70]);
});

test("the settings screen's sound rows: on or off, and five volumes", () => {
  const rows = settingsText(defaultSettings(), rules.balance);
  const [soundRow, volumeRow] = rows;
  assert.deepEqual([soundRow.key, volumeRow.key], ['sound', 'volume'], 'first, where a player looks for them');
  assert.deepEqual(soundRow.choices.map((c) => c.label), ['Off', 'On']);
  assert.deepEqual(volumeRow.choices.map((c) => c.label), ['10%', '30%', '50%', '70%', '100%']);
  assert.equal(volumeRow.line, 'Every sound at 70%.');
  const off = settingsText({ ...defaultSettings(), sound: false, volume: 30 }, rules.balance);
  assert.equal(off[0].line, 'No sound.');
  assert.equal(off[1].line, 'Every sound at 30%, once sound is on.');
});

test("the campaign's sounds: a purchase confirms, a jump flies, trouble sounds the alarm; the screens' own changes are silent", () => {
  const plain = { campaign: {} };
  const heard = (type, state = plain, prev = plain, extra = {}) => gameSounds(state, prev, { type, ...extra });
  for (const type of ['campaign/buy', 'campaign/hire', 'campaign/job/take', 'campaign/pay', 'campaign/event/choose', 'campaign/day']) assert.deepEqual(heard(type), ['confirm'], type);
  for (const type of ['campaign/jump', 'campaign/sector/leave', 'campaign/trip/out', 'campaign/trip/home']) assert.deepEqual(heard(type), ['jump'], type);
  assert.deepEqual(heard('campaign/build'), ['place']);
  assert.deepEqual(heard('campaign/move'), ['place']);
  assert.deepEqual(heard('campaign/takedown'), ['remove']);
  // A screen rolls the board as it opens, construction follows the builder,
  // a fight saves every order: none of them a player's.
  for (const type of ['campaign/board', 'campaign/ship', 'campaign/fight/save', 'campaign/places', 'campaign/run/begin', 'campaign/continue', 'screen/show', 'settings/volume', 'builds/save', 'save/restore']) {
    assert.deepEqual(heard(type), [], type);
  }
  // The hunters waiting where the ship comes to; a hostile ship is no alarm.
  const at = (approach) => ({ campaign: { run: { approach } } });
  assert.deepEqual(heard('campaign/jump', at({ hunt: true, node: 4 }), at(null)), ['jump', 'alarm']);
  assert.deepEqual(heard('campaign/jump', at({ hunt: false, node: 4 }), at(null)), ['jump']);
  assert.deepEqual(heard('campaign/approach/close', at({ hunt: true, node: 4 }), at({ hunt: true, node: 4 })), [], 'once, as they are found');
  // A raid coming at the colony.
  const colony = (raid) => ({ campaign: { colony: { raid } } });
  assert.deepEqual(heard('campaign/day', colony({ found: 2, lands: 4 }), colony(null)), ['confirm', 'alarm']);
  assert.deepEqual(heard('campaign/day', colony({ found: 2, lands: 4 }), colony({ found: 2, lands: 4 })), ['confirm']);
  // A raid due at the hangar, as a job's heat brings it.
  const home = newCampaign(rules, 7);
  const cool = { campaign: { ...home, heat: rules.balance.raidHeat - 1 } };
  const hot = { campaign: { ...home, heat: rules.balance.raidHeat } };
  assert.deepEqual(heard('campaign/fight/end', hot, cool, { rules }), ['alarm']);
  assert.deepEqual(heard('campaign/fight/end', hot, hot, { rules }), []);
});

test("an approach's round all at once, as reduced motion plays it: the ships' guns, then whether the crew's volley hit", () => {
  const last = (events) => ({ order: 'fire', events });
  const round = (events) => roundSounds(last(events));
  const volley = (side, ...hits) => ({ kind: 'volley', side, shots: hits.map((hit) => ({ hit })) });
  // The approach screen plays them, with its shots (M38b): giving the order
  // makes none of its own.
  assert.deepEqual(gameSounds({ campaign: { run: { approach: { node: 2, hunt: false, last: last([volley('you', true)]) } } } }, { campaign: {} }, { type: 'campaign/approach/order' }), []);
  assert.deepEqual(round([volley('you', false, true), volley('them', false)]), ['shotgun', 'hit']);
  assert.deepEqual(round([volley('you', false, false), volley('them', true)]), ['shotgun', 'miss']);
  assert.deepEqual(round([volley('them', true)]), ['shotgun'], 'evading: only theirs');
  assert.deepEqual(round([{ kind: 'flee', side: 'you', ok: true }]), ['jump'], 'got away');
  assert.deepEqual(round([{ kind: 'close', side: 'you', ok: false }]), ['confirm'], 'nothing fired');
});

// The builder on a small frame, as tests/session.test.js has it.
const mod = (id, size) => ({ id, name: id, size, rotates: true, tags: [] });
const defs = indexDefs({
  modules: { tilesPerCell: 1, tiles: { '.': 'floor' }, modules: [mod('hall', [1, 1]), mod('long', [2, 1]), mod('big', [2, 2])] },
  frames: { frames: [{ id: 'yard', name: 'Yard frame', width: 6, height: 4, maxModules: 10 }] },
  manufacturers: { manufacturers: [] },
});

test("the builder's sounds: placed, moved, turned and taken off; a refusal; undo and redo are their buttons'", () => {
  let session = createSession(newShip('yard'));
  const step = (action) => {
    const next = reduceSession(session, action, defs);
    const sounds = builderSounds(next, session);
    session = next;
    return sounds;
  };
  assert.deepEqual(step({ type: 'build/arm', moduleType: 'hall' }), ['tap'], 'a part picked');
  assert.deepEqual(step({ type: 'build/tap', x: 1.5, y: 1.5 }), ['tap'], 'its ghost shown');
  assert.deepEqual(step({ type: 'build/rotate' }), ['turn'], 'its ghost turned');
  assert.deepEqual(step({ type: 'build/tap', x: 1.5, y: 1.5 }), ['place'], 'a second tap on the ghost puts it down');
  assert.deepEqual(step({ type: 'build/drop', placement: { type: 'long', x: 3, y: 0, rot: 0 } }), ['place'], 'a drag puts one down');
  const uid = session.ship.modules.find((m) => m.type === 'long').uid;
  assert.deepEqual(step({ type: 'build/move', uid, x: 3, y: 2, rot: 0 }), ['place'], 'moved');
  assert.deepEqual(step({ type: 'build/move', uid, x: 3, y: 2, rot: 1 }), ['turn'], 'turned where it is');
  assert.deepEqual(step({ type: 'build/drop', placement: { type: 'big', x: 5, y: 3, rot: 0 } }), ['refuse'], "a part that can't go there");
  assert.deepEqual(step({ type: 'build/cancel' }), ['tap'], 'Done: its ghost goes');
  assert.deepEqual(step({ type: 'build/tap', x: 3.5, y: 2.5 }), ['tap'], 'a part picked out');
  assert.equal(session.selected, uid);
  assert.deepEqual(step({ type: 'build/delete' }), ['remove']);
  const telling = ['place', 'turn', 'remove', 'confirm', 'refuse'];
  for (const type of ['build/undo', 'build/undo', 'build/redo']) assert.ok(!step({ type }).some((s) => telling.includes(s)), type);
});

test("a fight's taps and refusals, and its playback's sounds in step with it", () => {
  assert.deepEqual(fightSounds({ notice: { id: 2 } }, { notice: { id: 1 } }, { type: 'fight/tap' }), ['refuse'], 'why a tap did nothing');
  assert.deepEqual(fightSounds({ notice: null }, { notice: null }, { type: 'fight/tap' }), ['tap']);
  assert.deepEqual(fightSounds({ notice: null }, { notice: null }, { type: 'fight/end' }), []);
  const before = { units: [{ id: 1, side: 'crew', weapon: 'shotgun' }, { id: 2, side: 'enemy', weapon: 'carbine' }, { id: 3, side: 'crew', weapon: 'dartgun' }], doors: [] };
  const events = [
    { type: 'shot', unit: 1, target: 2, hit: true, damage: 4 }, // 0 to 650 ms, landing at 195
    { type: 'down', unit: 2, bleed: 3 }, // 650 to 1100
    { type: 'shot', unit: 2, target: 3, hit: false }, // 1100 to 1750, landing at 1295
    { type: 'reload', unit: 1, ammo: 3 }, // 1750 to 2200
    { type: 'turn', side: 'enemy', round: 1 },
  ];
  const timeline = makeTimeline(before, [{ events, battle: before }]);
  const heard = (from, to) => cuesBetween(timeline, from, to).map((cue) => cueSound(cue, before, rules));
  assert.deepEqual(heard(-1, 0), ['shotgun'], "the shot as its weapon's");
  assert.deepEqual(heard(0, 194), []);
  assert.deepEqual(heard(194, 200), ['hit'], 'as it lands');
  assert.deepEqual(heard(200, 1100), ['down', 'shot']);
  assert.deepEqual(heard(1100, 1300), ['miss']);
  assert.deepEqual(heard(1300, 9999), ['reload', null], 'a turn makes none');
  assert.deepEqual(heard(-1, 9999), ['shotgun', 'hit', 'down', 'shot', 'miss', 'reload', null], 'every moment once, in order');
  const of = (event) => cueSound({ event, lands: false }, before, rules);
  assert.deepEqual([of({ type: 'shot', unit: 3 }), of({ type: 'dead', unit: 2 }), of({ type: 'order', unit: 1 }), of({ type: 'door' }), of({ type: 'move', unit: 1 })], ['dart', 'down', 'order', 'door', 'step'], 'an order with no kind of its own the plain chime; a walk a step (M51)');
});
