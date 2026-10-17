// Companions' busts (M34, src/render/portraits/bust.js): drawn in code,
// richer than a recruit's helmet badge. Each companion's is well formed at
// both crops, the same each time, in their trim and their side's color;
// every kind of clothes and gear draws its own way, as does every choice
// in every layer of a face; a side's patch shows unless the gear carries
// the side's color; and two drawings share a page.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portraitSvg } from '../src/render/portraits/badge.js';
import { bustSvg, GEAR, WEARS } from '../src/render/portraits/bust.js';
import { mix } from '../src/render/portraits/paths.js';
import { portraitColors, sideColors } from '../src/render/palette.js';
import { FACES, LOOK_KEYS, LOOK_LAYERS, stepLook } from '../src/sim/looks.js';
import { rules } from './battleKit.js';
import { idsOf, wellFormed } from './svgKit.js';

const look = { face: 0, skin: 'sand', hair: 'crop', hairColor: 'darkBrown', eyes: 'brown', beard: 'none', mark: 'none' };
const TRIM = '#5fd3e8';

test("each companion's bust is well formed, close up and as a face, the same each time, in their trim and their side's color", () => {
  assert.equal(rules.companions.size, 4);
  for (const companion of rules.companions.values()) {
    assert.ok(WEARS[companion.bust?.wear] && GEAR[companion.bust?.gear], `${companion.id} has a bust`);
    const mark = sideColors[rules.factions.sides.get(companion.side).color];
    const svgs = ['bust', 'face'].map((crop) => {
      const svg = bustSvg(companion.look, companion.bust, { trim: TRIM, mark, crop, id: 'a' });
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100">/);
      wellFormed(svg);
      assert.equal(bustSvg(companion.look, companion.bust, { trim: TRIM, mark, crop, id: 'a' }), svg, 'pure');
      assert.ok(svg.includes(TRIM) && svg.includes(mark), `${companion.id}: their trim and their side's color`);
      return svg;
    });
    assert.notEqual(svgs[0], svgs[1], 'the face crop is closer');
    // Richer than their badge: bareheaded, in clothes of their own, lit.
    const badge = portraitSvg(companion.look, { ...rules.jobs.get(companion.job).look, trim: TRIM });
    assert.ok(svgs[0].length > badge.length, `${companion.id}: more drawn than the badge`);
  }
  // No two companions dressed alike.
  const dressed = [...rules.companions.values()].map((c) => `${c.bust.wear} ${c.bust.gear}`);
  assert.equal(new Set(dressed).size, dressed.length, dressed.join(', '));
});

test('every kind of clothes and gear draws its own way, each with each', () => {
  const mark = sideColors.brick;
  const seen = new Set();
  for (const wear of Object.keys(WEARS)) {
    for (const gear of Object.keys(GEAR)) {
      const svg = bustSvg(look, { wear, gear }, { trim: TRIM, mark, id: 'c' });
      wellFormed(svg);
      seen.add(svg);
    }
  }
  assert.equal(seen.size, Object.keys(WEARS).length * Object.keys(GEAR).length);
});

test("a side's patch shows on the clothes, unless the gear carries the side's color", () => {
  const mark = sideColors.magenta;
  const chevron = `stroke="${mix(mark, portraitColors.shadow, 0.45)}"`;
  for (const wear of Object.keys(WEARS)) {
    for (const gear of Object.keys(GEAR)) {
      const svg = bustSvg(look, { wear, gear }, { mark });
      assert.equal(svg.includes(chevron), gear !== 'armband', `${wear} with ${gear}`);
    }
  }
});

test('every choice in every layer of a face draws its own way in a bust', () => {
  const bust = { wear: 'coverall', gear: 'goggles' };
  for (const key of LOOK_KEYS) {
    const count = key === 'face' ? FACES : LOOK_LAYERS[key].length;
    const seen = new Set();
    let at = key === 'hairColor' ? { ...look, hair: 'long', beard: 'full' } : look;
    for (let i = 0; i < count; i++) {
      const svg = bustSvg(at, bust, { id: 'd' });
      wellFormed(svg);
      seen.add(svg);
      at = stepLook(at, key);
    }
    assert.equal(seen.size, count, `${key}: ${count} drawings`);
  }
});

test("ids are the drawing's own, so two drawings can share a page; clothes or gear not drawn fall back", () => {
  const bust = { wear: 'dockcoat', gear: 'goggles' };
  const a = bustSvg(look, bust, { id: 'x1' });
  const b = bustSvg(look, bust, { id: 'x2' });
  for (const id of idsOf(a)) assert.ok(!idsOf(b).has(id), id);
  // Unknown clothes draw as a coverall, unknown gear as none.
  assert.equal(bustSvg(look, { wear: 'tuxedo', gear: 'none' }), bustSvg(look, { wear: 'coverall', gear: 'none' }));
  wellFormed(bustSvg(look, { wear: 'tuxedo', gear: 'jetpack' }));
});
