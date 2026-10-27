// M49: senses. Two settings (save v44): captions, each sound the game makes
// in words, and how the text is set (standard or easier reading); every
// sound's caption.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { defaultSettings, READINGS, reduceSettings, settingsProblems } from '../src/sim/settings.js';
import { captionWords } from '../src/ui/captions.js';
import { settingsText } from '../src/ui/settingsText.js';
import { MOMENT_SOUNDS } from '../src/ui/sounds.js';
import { rules } from './battleKit.js';

test('captions and reading: their defaults, the values each takes, checked in a save, and on the Settings screen', () => {
  const settings = defaultSettings();
  assert.deepEqual([settings.captions, settings.reading], [false, 'standard']);
  assert.deepEqual(READINGS, ['standard', 'readable']);
  const apply = (type, value) => reduceSettings(settings, { type: `settings/${type}`, value });
  assert.equal(apply('captions', true).captions, true);
  assert.equal(apply('captions', 'on'), settings);
  assert.equal(apply('reading', 'readable').reading, 'readable');
  assert.equal(apply('reading', 'dyslexic'), settings);
  assert.equal(apply('reading', 'standard'), settings, 'the same value changes nothing');
  assert.deepEqual(settingsProblems({ ...settings, captions: 1, reading: 'big' }), ['The captions setting is invalid.', 'The reading setting is invalid.']);
  const rows = Object.fromEntries(settingsText({ ...settings, captions: true, reading: 'readable' }, rules.balance).map((row) => [row.key, row]));
  assert.deepEqual(['captions', 'reading'].map((key) => [rows[key].title, rows[key].action, rows[key].value]), [
    ['Captions', 'settings/captions', true],
    ['Reading', 'settings/reading', 'readable'],
  ]);
  assert.deepEqual(rows.reading.choices.map((c) => c.label), ['Standard', 'Easier reading']);
  assert.match(rows.captions.line, /sound on or off/);
  assert.match(rows.reading.line, /wider apart/);
  const off = Object.fromEntries(settingsText(settings, rules.balance).map((row) => [row.key, row]));
  assert.equal(off.captions.line, 'No captions.');
});

test('save v44: a save from before has captions off and standard reading', () => {
  assert.equal(SAVE_VERSION, 48);
  const { captions, reading, ...v43 } = { ...defaultSettings(), hand: 'left' };
  const moved = migrate({ version: 43, data: { settings: v43, campaign: null } });
  assert.equal(moved.version, 48);
  assert.deepEqual(moved.data.settings, { ...defaultSettings(), hand: 'left' });
});

test("every sound has a caption, and a go's sounds read as their captions in order", () => {
  const sounds = rules.sounds;
  const shots = Object.values(rules.weapons).map((w) => w.sound).filter(Boolean);
  for (const id of new Set([...MOMENT_SOUNDS, ...shots])) {
    const caption = sounds.get(id)?.caption;
    assert.ok(typeof caption === 'string' && caption.length > 1 && caption.length <= 24, `${id}: ${caption}`);
  }
  assert.deepEqual(captionWords(['shotgun', 'hit'], sounds), ['Shotgun blast', 'Hit']);
  assert.deepEqual(captionWords(['alarm', 'nothing-such'], sounds), ['Alarm'], 'an id with no sound is left out');
  assert.deepEqual(captionWords([], sounds), []);
});
