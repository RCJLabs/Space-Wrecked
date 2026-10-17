// Scenes (M34, src/render/scenes/): the painted backdrops, drawn in code.
// Each scene is the same from the same seed, lies in its frame and takes
// its colors from the palette; every kind of world has its own; the
// painter draws them all without a browser; and the backdrop at the
// lift-off and the landing goes from the ground to the world seen whole.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { END, landingAt, liftOffAt } from '../src/render/liftOff.js';
import * as palette from '../src/render/palette.js';
import { groundScene, TILE } from '../src/render/scenes/ground.js';
import { DOOR, hangarScene } from '../src/render/scenes/hangar.js';
import { backdropAt, FAR, MOST_TILE, NEAR, paintCover, paintTile, tileSide } from '../src/render/scenes/paint.js';
import { SCENES, sceneId, titlePicture, worldPictures } from '../src/render/scenes/scenes.js';
import { boxOf, colorsOf } from '../src/render/scenes/shapes.js';
import { FRAME, worldScene } from '../src/render/scenes/world.js';
import { rules } from './battleKit.js';

// Every picture there is: each world's ground and the world seen whole, and
// the hangar.
const pictures = () => [...SCENES.flatMap((id) => Object.entries(worldPictures(id)).map(([what, scene]) => [`${id} ${what}`, scene])), ['hangar', titlePicture()]];

// Every color the palette file defines, however deep.
const PALETTE = new Set();
(function collect(value) {
  if (typeof value === 'string') PALETTE.add(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
})(Object.values(palette).filter((v) => typeof v === 'object'));

test('every scene draws the same from the same seed, and another seed moves its features', () => {
  for (const id of SCENES) {
    assert.deepEqual(groundScene(id, 3), groundScene(id, 3), `${id} ground`);
    assert.deepEqual(worldScene(id, 3), worldScene(id, 3), `${id} world`);
    assert.notDeepEqual(groundScene(id, 3), groundScene(id, 4), `${id} ground, another seed`);
    assert.notDeepEqual(worldScene(id, 3), worldScene(id, 4), `${id} world, another seed`);
  }
  assert.deepEqual(hangarScene('title'), hangarScene('title'));
  assert.deepEqual(titlePicture(), hangarScene('title'), 'the title is the same on every launch');
});

test('every shape lies in its frame, and every number in it is a number', () => {
  for (const [name, scene] of pictures()) {
    const [w, h] = scene.size;
    assert.deepEqual(scene.size, name.endsWith('ground') ? [TILE, TILE] : FRAME, name);
    for (const shape of scene.shapes) {
      const [x0, y0, x1, y1] = boxOf([shape]);
      assert.ok([x0, y0, x1, y1].every(Number.isFinite), `${name}: a ${shape.kind} with a broken number`);
      assert.ok(x1 > 0 && y1 > 0 && x0 < w && y0 < h, `${name}: a ${shape.kind} wholly outside the frame, at ${[x0, y0, x1, y1].map(Math.round)}`);
      assert.ok(x0 > -w && y0 > -h && x1 < 3 * w && y1 < 3 * h, `${name}: a ${shape.kind} far past the frame, at ${[x0, y0, x1, y1].map(Math.round)}`);
    }
  }
});

test('every color a scene uses is a palette token', () => {
  for (const [name, scene] of pictures()) {
    for (const color of colorsOf(scene.shapes)) assert.ok(PALETTE.has(color), `${name}: ${color} is not in palette.js`);
  }
});

test("each kind of world has its own scene, named in its data; the lift-off's is the homeworld's; one not drawn takes barren rock's", () => {
  for (const kind of rules.worlds.kinds.values()) {
    assert.equal(kind.scene, kind.id, `${kind.id} names its own`);
    assert.ok(SCENES.includes(kind.scene));
  }
  assert.equal(rules.acts.get(1).scene, 'homeworld');
  assert.equal(new Set(SCENES.map((id) => JSON.stringify(worldPictures(id).ground.shapes.slice(0, 3)))).size, SCENES.length, 'no two grounds alike');
  assert.equal(sceneId('swamp'), 'rock');
  assert.equal(sceneId(undefined), 'rock');
  assert.deepEqual(worldPictures('swamp'), worldPictures('rock'));
  // A ground starts from the colony's land for its kind (M26), so the
  // landing and the colony match.
  for (const kind of ['ocean', 'desert', 'ice', 'jungle', 'rock']) assert.equal(groundScene(kind, 1).base, palette.groundFor(kind).land, kind);
});

test("the hangar's door is cut out for the title's stars, with nothing but its ridge and lights in it", () => {
  const { shapes } = hangarScene('title');
  const cut = shapes.findIndex((s) => s.blend === 'destination-out');
  assert.ok(cut > 0, 'a cut');
  assert.deepEqual(boxOf([shapes[cut]]), [DOOR.x0, DOOR.y0, DOOR.x1, DOOR.y1], 'the whole door, and only it');
  // The title's words sit over the door's middle: nothing opaque is drawn
  // there after the cut but the ridge below the sky.
  const middle = [DOOR.x0 + 120, DOOR.y0 + 30, DOOR.x1 - 120, DOOR.y0 + 160];
  const over = shapes.slice(cut + 1).filter((s) => {
    const [x0, y0, x1, y1] = boxOf([s]);
    return x0 < middle[2] && x1 > middle[0] && y0 < middle[3] && y1 > middle[1] && s.blend !== 'lighter' && (s.alpha ?? 1) > 0.5 && typeof s.fill === 'string';
  });
  assert.deepEqual(over.map((s) => s.kind), [], 'clear sky behind the words');
});

// A canvas that records what is drawn on it, for painting without a browser.
function fakeCanvas(w, h, log) {
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    m: [1, 0, 0, 1, 0, 0],
    depth: 0,
    save() {
      this.depth++;
    },
    restore() {
      this.depth--;
      assert.ok(this.depth >= 0, 'restored more than saved');
    },
    setTransform(...m) {
      this.m = m;
    },
    getTransform() {
      const [a, b, c, d, e, f] = this.m;
      return { a, b, c, d, e, f };
    },
    clearRect() {},
    clip() {},
    fill() {
      log.fills++;
    },
    stroke() {
      log.strokes++;
    },
    drawImage(image, ...at) {
      log.layers++;
      assert.ok(at.every(Number.isFinite), 'a layer laid at a broken place');
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  for (const name of ['beginPath', 'rect', 'ellipse', 'moveTo', 'lineTo', 'bezierCurveTo', 'closePath']) {
    ctx[name] = (...args) => {
      log.points++;
      assert.ok(args.every(Number.isFinite), `${name} with a broken number`);
    };
  }
  const canvas = { width: w, height: h, getContext: () => ctx };
  ctx.canvas = canvas;
  log.canvases.push(canvas);
  return canvas;
}

test('the painter draws every scene, its soft shapes on a smaller layer, saving and restoring in step', () => {
  for (const [name, scene] of pictures()) {
    const log = { fills: 0, strokes: 0, layers: 0, points: 0, canvases: [] };
    const make = (w, h) => fakeCanvas(w, h, log);
    const canvas = name.endsWith('ground') ? paintTile(scene, 600, make) : paintCover(scene, 905, 370, 2, make);
    assert.equal(canvas.getContext('2d').depth, 0, `${name}: every save restored`);
    assert.ok(log.fills + log.strokes >= scene.shapes.length * 0.9, `${name}: drawn`);
    if (scene.shapes.some((s) => s.blur)) assert.ok(log.layers > 0, `${name}: soft shapes laid from a layer`);
  }
  // A framed scene covers the screen at its pixel ratio.
  const log = { fills: 0, strokes: 0, layers: 0, points: 0, canvases: [] };
  const canvas = paintCover(worldScene('ice', 1), 821, 283, 2, (w, h) => fakeCanvas(w, h, log));
  assert.deepEqual([canvas.width, canvas.height], [1642, 566]);
  assert.equal(tileSide(905, 370, 2), MOST_TILE, 'a ground as sharp as its nearest zoom needs, up to the most');
  assert.ok(tileSide(320, 200, 1) < MOST_TILE);
});

test('the lift-off: the ground close under the ship on the pad, falling away as it climbs, the world seen whole as it flies off', () => {
  const at = (t) => backdropAt(liftOffAt(t));
  assert.deepEqual(at(0), { zoom: NEAR, ground: 1 }, 'on the pad');
  assert.equal(at(2.2).ground, 1, 'climbed: the ground still under it');
  assert.ok(Math.abs(at(2.2).zoom - 1) < 1e-9, 'and further off');
  assert.deepEqual(at(END), { zoom: FAR, ground: 0 }, 'gone: the world alone');
  const times = Array.from({ length: Math.round(END * 20) + 1 }, (_, i) => i / 20);
  for (let i = 1; i < times.length; i++) {
    assert.ok(at(times[i]).zoom <= at(times[i - 1]).zoom + 1e-9, `the ground never comes nearer, at ${times[i]} s`);
    assert.ok(at(times[i]).ground <= at(times[i - 1]).ground + 1e-9, `nor shows more, at ${times[i]} s`);
  }
});

test('the landing: the world seen whole as the ship comes in, its ground rising to meet it, and the ship at rest on it', () => {
  assert.equal(backdropAt(landingAt(0)).ground, 0, 'the world alone at first');
  assert.deepEqual(backdropAt(landingAt(END)), { zoom: NEAR, ground: 1 }, 'down: the ground close under it');
  const times = Array.from({ length: Math.round(END * 20) + 1 }, (_, i) => i / 20);
  for (let i = 1; i < times.length; i++) assert.ok(backdropAt(landingAt(times[i])).ground >= backdropAt(landingAt(times[i - 1])).ground - 1e-9, `the ground only comes in, at ${times[i]} s`);
});
