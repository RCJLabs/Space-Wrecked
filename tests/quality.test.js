// M62: the Quality setting. High draws up to 2 pixels a CSS pixel, as the
// game always has; Low draws 1, for a phone that can't keep up. Save v52
// gives a save from before High.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIGRATIONS, SAVE_VERSION } from '../src/core/save.js';
import { MAX_DPR, pixelRatio } from '../src/render/canvas.js';
import { defaultSettings, QUALITIES, reduceSettings, settingsProblems } from '../src/sim/settings.js';
import { settingsText } from '../src/ui/settingsText.js';
import { rules } from './battleKit.js';

test('the pixels a CSS pixel is drawn with: the device\'s up to 2 on High, 1 on Low', () => {
  assert.equal(MAX_DPR, 2);
  assert.deepEqual([1, 1.5, 2.625, 3].map((device) => pixelRatio(device, 'high')), [1, 1.5, 2, 2]);
  assert.deepEqual([1, 1.5, 2.625, 3].map((device) => pixelRatio(device, 'low')), [1, 1, 1, 1]);
  assert.equal(pixelRatio(0.75, 'low'), 0.75, 'never more than the device has');
  assert.equal(pixelRatio(undefined), 1);
  assert.equal(pixelRatio(2.625), 2, 'High by default');
});

test('the setting takes High or Low only, a new game on High', () => {
  const settings = defaultSettings();
  assert.equal(settings.quality, 'high');
  assert.deepEqual(QUALITIES, ['high', 'low']);
  assert.equal(reduceSettings(settings, { type: 'settings/quality', value: 'low' }).quality, 'low');
  assert.equal(reduceSettings(settings, { type: 'settings/quality', value: 'ultra' }), settings);
  assert.deepEqual(settingsProblems({ ...settings, quality: 'ultra' }), ['The quality setting is invalid.']);
  assert.deepEqual(settingsProblems(settings), []);
});

test('the settings screen offers it with what it does', () => {
  const row = (settings) => settingsText(settings, rules.balance).find((r) => r.key === 'quality');
  const high = row(defaultSettings());
  assert.deepEqual(high.choices.map((c) => c.label), ['High', 'Low']);
  assert.equal(high.action, 'settings/quality');
  assert.equal(high.line, 'Sharp.');
  assert.match(row({ ...defaultSettings(), quality: 'low' }).line, /slower phone/);
});

test('save v52: a save from before draws on High', () => {
  assert.equal(SAVE_VERSION, 53);
  const step = MIGRATIONS.find((m) => m.from === 51);
  assert.equal(step, MIGRATIONS.at(-2));
  const { quality, ...before } = defaultSettings();
  assert.equal(step.up({ settings: before }).settings.quality, 'high');
  assert.equal(step.up({ settings: { ...before, quality: 'low' } }).settings.quality, 'low', 'a quality already there stays');
  assert.deepEqual(step.up({ settings: null }), { settings: null });
});
