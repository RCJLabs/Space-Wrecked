// The palette's colors for every eye (M42): the colorblind-safe set keeps
// each pair a player tells apart by color 20 or more apart (CIEDE2000) to
// normal eyes and to protanopia, deuteranopia and tritanopia; text in
// either set keeps WCAG AA on the panels; and Settings swaps the set in
// place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorblindSafe, COLOR_SETS, MUST_DIFFER, palette, usePalette } from '../src/render/palette.js';
import { apart, contrast, rgbOf, VISIONS } from './colorVision.js';

const PANEL = [12, 17, 32].map((c, i) => c * 0.95 + rgbOf(palette.space)[i] * 0.05);
const TEXT = ['ink', 'inkDim', 'good', 'bad', 'dash', 'accent'];

test('colorblind-safe: every pair told apart by color is 20 or more apart, to every eye', () => {
  usePalette('safe');
  try {
    const short = [];
    for (const [a, b, where] of MUST_DIFFER) {
      for (const vision of VISIONS) {
        const d = apart(palette[a], palette[b], vision);
        if (d < 20) short.push(`${a}/${b} ${vision ?? 'normal'} ${d.toFixed(1)} (${where})`);
      }
    }
    assert.deepEqual(short, []);
  } finally {
    usePalette('standard');
  }
});

test('either set: text on the panels keeps WCAG AA (4.5)', () => {
  for (const set of COLOR_SETS) {
    usePalette(set);
    for (const token of TEXT) assert.ok(contrast(rgbOf(palette[token]), PANEL) >= 4.5, `${set} ${token} ${contrast(rgbOf(palette[token]), PANEL).toFixed(2)}`);
  }
  usePalette('standard');
});

test('the set is swapped in place, and back', () => {
  const before = { ...palette };
  usePalette('safe');
  assert.equal(palette.good, colorblindSafe.good);
  assert.equal(palette.space, before.space, 'what the set leaves alone stays');
  usePalette('standard');
  assert.deepEqual(palette, before);
  assert.deepEqual(COLOR_SETS, ['standard', 'safe']);
});
