// Accessibility (M42): the colors and the text size are settings, saved
// (v40, Standard and 100% for a save from before), each a row on the
// settings screen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { COLOR_SETS } from '../src/render/palette.js';
import { COLORS, defaultSettings, reduceSettings, settingsProblems, TEXT_SIZES } from '../src/sim/settings.js';
import { settingsText } from '../src/ui/settingsText.js';
import { rules } from './battleKit.js';

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
  assert.equal(SAVE_VERSION, 40);
  const { colors, textSize, ...v39 } = defaultSettings();
  const moved = migrate({ version: 39, data: { settings: v39, campaign: null } });
  assert.equal(moved.version, 40);
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
