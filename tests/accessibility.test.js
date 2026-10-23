// Accessibility (M42): the colors and the text size are settings, saved
// (v40, Standard and 100% for a save from before), each a row on the
// settings screen; the board tells things apart without color; and with
// reduced motion a fight's playback shows its end at once.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { LABEL_TONES } from '../src/render/blueprintStyles.js';
import { colorblindSafe, COLOR_SETS, palette, usePalette } from '../src/render/palette.js';
import { cuesBetween, FLOAT_MS, frameAt, makeTimeline } from '../src/render/playback.js';
import { ordersScene, zonesScene } from '../src/render/units.js';
import { deploy } from '../src/sim/deploy.js';
import { createBattle } from '../src/sim/battle.js';
import { createFight, reduceFight } from '../src/sim/fight.js';
import { COLORS, defaultSettings, reduceSettings, settingsProblems, TEXT_SIZES } from '../src/sim/settings.js';
import { settingsText } from '../src/ui/settingsText.js';
import { exampleMap, rules } from './battleKit.js';

test('the colors and the text size take only what they can hold', () => {
  const settings = defaultSettings();
  assert.deepEqual([settings.colors, settings.textSize], ['standard', 100]);
  assert.deepEqual(COLORS, COLOR_SETS, "the settings' sets are the palette's");
  assert.deepEqual(TEXT_SIZES, [100, 115, 130]);
  assert.equal(reduceSettings(settings, { type: 'settings/colors', value: 'safe' }).colors, 'safe');
  assert.equal(reduceSettings(settings, { type: 'settings/colors', value: 'mono' }), settings);
  assert.equal(reduceSettings(settings, { type: 'settings/textSize', value: 130 }).textSize, 130);
  assert.equal(reduceSettings(settings, { type: 'settings/textSize', value: 120 }), settings);
  assert.deepEqual(settingsProblems({ ...settings, colors: 'mono', textSize: 0 }), ['The colors setting is invalid.', 'The text size setting is invalid.']);
});

test('save v40: a save from before has Standard colors at 100%', () => {
  // On to the version now (v41 adds fog of war, M45).
  const { colors, textSize, fog, ...v39 } = defaultSettings();
  const moved = migrate({ version: 39, data: { settings: v39, campaign: null } });
  assert.equal(moved.version, SAVE_VERSION);
  assert.deepEqual(moved.data.settings, defaultSettings());
  assert.deepEqual(migrate({ version: 39, data: { settings: null } }).data, { settings: null }, 'unreadable settings are left for validate to report');
});

test("Settings' rows: Colors and Text size, each saying what it does", () => {
  const rows = (settings) => Object.fromEntries(settingsText(settings, rules.balance).map((row) => [row.key, row]));
  const safe = rows({ ...defaultSettings(), colors: 'safe', textSize: 130 });
  assert.deepEqual(safe.colors.choices.map((c) => c.label), ['Standard', 'Colorblind-safe']);
  assert.deepEqual([safe.colors.value, safe.colors.action], ['safe', 'settings/colors']);
  assert.match(safe.colors.line, /^Colors picked to stay apart for every kind of colorblindness/);
  assert.deepEqual(safe.textSize.choices.map((c) => c.label), ['100%', '115%', '130%']);
  assert.equal(safe.textSize.line, 'Every word 130% as big, in the panels and on the board. Long lists scroll.');
  assert.equal(rows(defaultSettings()).textSize.line, 'Text as drawn.');
  assert.match(rows({ ...defaultSettings(), motion: 'reduce' }).motion.line, /an enemy's turn in a fight shows its end at once\.$/);
});

test('the board without color: a dash hatched, the way in held crossed, the colors read as drawn', () => {
  const dash = ordersScene({ reach: new Map([['2,1', { x: 2, y: 1, dash: true }]]) }).faces;
  const step = ordersScene({ reach: new Map([['2,1', { x: 2, y: 1, dash: false }]]) }).faces;
  assert.deepEqual([dash.length, step.length], [4, 1], 'a dash tile: its plate and three strips across');
  assert.deepEqual([zonesScene([{ tiles: [[0, 0]], tone: 'hold' }]).length, zonesScene([{ tiles: [[0, 0]], tone: 'out' }]).length], [3, 1], 'the way in held: a cross on its plate');
  usePalette('safe');
  try {
    assert.equal(LABEL_TONES.bad, colorblindSafe.bad, "the builder's callouts take the set in use");
    assert.equal(ordersScene({ reach: new Map([['2,1', { x: 2, y: 1, dash: true }]]) }).faces[0].color, palette.dash);
  } finally {
    usePalette('standard');
  }
});

test("reduced motion: an enemy turn shows its end at once, every action's words together and its sounds with them", () => {
  const map = exampleMap();
  const boarders = rules.encounters.get('boarders').enemies;
  const { battle, events } = createBattle({ map, units: deploy(map, rules.squad, boarders, rules).units, seed: 7 }, rules);
  const fight = createFight(battle, rules, events);
  const ended = reduceFight(fight, { type: 'fight/end' }, rules);
  const moving = makeTimeline(fight.battle, ended.played);
  const still = makeTimeline(fight.battle, ended.played, { still: true });
  assert.ok(moving.length > 3000, `as it plays: ${moving.length} ms`);
  assert.deepEqual([still.length, still.tail], [0, FLOAT_MS], 'free at once; the words fade in their time');
  const now = frameAt(still, 0);
  assert.equal(now.done, true);
  assert.equal(now.view, ended.played.at(-1).battle, "the rules' own battle at the end");
  assert.deepEqual([now.moving, now.shot], [null, null], 'nothing walks or flies');
  // Every word the turn shows, at once, stacked where they share a tile.
  const words = (timeline) => timeline.beats.flatMap((beat) => (beat.snap ? [] : frameAt(timeline, beat.at + 1).floats.filter((f) => f.age <= 1).map((f) => f.text)));
  assert.deepEqual(now.floats.map((f) => f.text).sort(), words(moving).sort());
  for (const [i, f] of now.floats.entries()) assert.equal(f.stack, now.floats.slice(0, i).filter((g) => g.at[0] === f.at[0] && g.at[1] === f.at[1]).length);
  // Its sounds, all in the first moment.
  assert.equal(cuesBetween(still, -1, 0).length, cuesBetween(moving, -1, moving.tail).length);
});
