// Portraits (M23c, src/render/portraits/): the helmet badge drawn as SVG
// text from a look, for every helmet a job can wear: well formed, the same
// each time, and every choice in every layer drawn its own way.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SUITS } from '../src/render/figures/looks.js';
import { portraitSvg } from '../src/render/portraits/badge.js';
import { FACE_SHAPES } from '../src/render/portraits/face.js';
import { FACES, LOOK_KEYS, LOOK_LAYERS, stepLook } from '../src/sim/looks.js';
import { rules } from './battleKit.js';
import { idsOf, wellFormed } from './svgKit.js';

const look = { face: 0, skin: 'sand', hair: 'crop', hairColor: 'darkBrown', eyes: 'brown', beard: 'none', mark: 'none' };
const helmets = Object.entries(SUITS).flatMap(([suit, { helmet }]) => helmet.map((kind) => ({ suit, helmet: kind })));

test('there are as many face shapes as looks have faces', () => {
  assert.equal(FACE_SHAPES.length, FACES);
});

test('every helmet a suit has draws a well-formed badge, close up and as a face, the same each time', () => {
  for (const { suit, helmet } of helmets) {
    for (const crop of ['bust', 'face']) {
      const svg = portraitSvg(look, { suit, helmet, trim: '#5fd3e8', crop, id: 'a' });
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100">/);
      wellFormed(svg);
      assert.equal(portraitSvg(look, { suit, helmet, trim: '#5fd3e8', crop, id: 'a' }), svg, 'pure');
      assert.ok(svg.includes('#5fd3e8'), 'in their trim');
    }
  }
  // Each job's helmet in data is one of them, and its own (M32), so the
  // badges tell all seven jobs apart.
  for (const job of rules.jobs.values()) assert.ok(helmets.some((h) => h.suit === job.look.suit && h.helmet === job.look.helmet), job.id);
  const worn = [...rules.jobs.values()].map((job) => `${job.look.suit} ${job.look.helmet}`);
  assert.equal(new Set(worn).size, rules.jobs.size, worn.join(', '));
});

test('every choice in every layer draws its own way, through glass that shows the hair', () => {
  for (const key of LOOK_KEYS) {
    const count = key === 'face' ? FACES : LOOK_LAYERS[key].length;
    const seen = new Set();
    // Hair color shows best on long hair and a beard.
    let at = key === 'hairColor' ? { ...look, hair: 'long', beard: 'full' } : look;
    for (let i = 0; i < count; i++) {
      const svg = portraitSvg(at, { suit: 'eva', helmet: 'bubble', id: 'b' });
      wellFormed(svg);
      seen.add(svg);
      at = stepLook(at, key);
    }
    assert.equal(seen.size, count, `${key}: ${count} drawings`);
  }
});

test("ids are the drawing's own, so two drawings can share a page", () => {
  const a = portraitSvg(look, { id: 'x1' });
  const b = portraitSvg(look, { id: 'x2' });
  for (const id of idsOf(a)) assert.ok(!idsOf(b).has(id), id);
});
