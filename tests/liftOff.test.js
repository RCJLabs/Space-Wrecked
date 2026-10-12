import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traceHull } from '../src/render/hull.js';
import { AWAY, CLIMB, END, flameGlows, IGNITE, liftOffAt, liftOffCamera, liftOffScene, PLUME } from '../src/render/liftOff.js';
import { fitOrbit, project, screenBounds } from '../src/render/orbit.js';
import { skins } from '../src/render/palette.js';
import { BOARD_VIEW, boardBox } from '../src/render/shipView.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { ship } = readyToLaunch();
const hull = traceHull(ship, rules);
const scene = liftOffScene({ ship, defs: rules, hull, skin: skins.yard });
const box = boardBox(rules.frames.get('starter'), hull, [0, 0]);
// The Fold's cover screen and the unfolded one, with the ship where the
// launch puts it.
const RECTS = [{ x: 109, y: 59, w: 688, h: 192 }, { x: 101, y: 111, w: 640, h: 360 }];
const fit = (rect) => fitOrbit({ ...BOARD_VIEW, pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, 10);
const times = Array.from({ length: Math.round(END * 20) + 1 }, (_, i) => i / 20);
// Whether any of the ship's box shows in rect with this camera.
function inSight(cam, rect) {
  const b = screenBounds(cam, box);
  return b.x1 > rect.x && b.x0 < rect.x + rect.w && b.y1 > rect.y && b.y0 < rect.y + rect.h;
}

test('the flames come out of every engine at the stern', () => {
  assert.equal(scene.exhausts.length, 6, "a nozzle for each cell of the three engines' exhaust sides");
  for (const { at, dir } of scene.exhausts) {
    assert.deepEqual(dir, [-1, 0]);
    assert.ok(at[0] < 7, 'behind the engines, which start at x 7');
  }
});

test('the sequence: the engines light, the ship climbs, flies off and is gone', () => {
  assert.deepEqual(liftOffAt(0), { flame: 0, shake: 0, rise: 0, away: 0, gone: false, over: false });
  assert.deepEqual(flameGlows(scene, liftOffAt(0), 0), [], 'nothing burns before it lights');
  const lit = liftOffAt(IGNITE);
  assert.deepEqual([lit.flame, lit.shake, lit.rise, lit.away], [1, 1, 0, 0]);
  assert.equal(flameGlows(scene, lit, IGNITE).length, 6 * PLUME + 1, 'a plume for each nozzle, and the pad lit');
  assert.equal(liftOffAt(CLIMB).rise, 1);
  assert.equal(flameGlows(scene, liftOffAt(CLIMB), CLIMB).length, 6 * PLUME, 'the pad is left behind');
  assert.deepEqual(flameGlows(scene, liftOffAt(AWAY), AWAY), [], 'gone');
  assert.equal(liftOffAt(END - 0.01).over, false);
  assert.equal(liftOffAt(END).over, true);
  for (const t of times) {
    const m = liftOffAt(t);
    for (const key of ['shake', 'rise', 'away']) assert.ok(m[key] >= 0 && m[key] <= 1, `${key} at ${t}`);
    assert.ok(m.flame >= 0 && m.flame <= 1.5, `flame at ${t}`);
  }
});

test('the ship stays in sight through most of its flight, flying off ever further to the right, and is out of sight once gone', () => {
  for (const rect of RECTS) {
    const base = fit(rect);
    let last = -Infinity;
    for (const t of times) {
      const m = liftOffAt(t);
      const cam = liftOffCamera(base, rect, box, m, t);
      for (const key of ['x', 'y', 'scale']) assert.ok(Number.isFinite(cam[key]) && cam.scale > 0, `${key} at ${t}`);
      const [nose] = project(cam, box.x1, (box.y0 + box.y1) / 2, 0);
      if (t >= CLIMB) {
        assert.ok(nose >= last - 2 * 3, `the ship doesn't turn back at ${t}`);
        last = nose;
      }
      if (m.away <= 0.8) assert.ok(inSight(cam, rect), `in sight at ${t}`);
      if (m.gone) assert.ok(!inSight(cam, rect), `out of sight at ${t}`);
    }
  }
});

test('with nothing moving the camera, the moment at rest is the fitted camera', () => {
  const rect = RECTS[0];
  const base = fit(rect);
  assert.deepEqual(liftOffCamera(base, rect, box, liftOffAt(0), 0), base);
});
