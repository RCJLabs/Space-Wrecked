import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OVERHANG } from '../src/render/hull.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, project, screenBounds, turnOrbit, twist, unproject, zoomOrbit } from '../src/render/orbit.js';
import { BOARD_VIEW, boardBox } from '../src/render/shipView.js';

const FRAME = { width: 7, height: 4 };
const box = boardBox(FRAME);
// The board on the Fold's cover screen in the installed app: 905 × 370 CSS
// px, less the palette drawer (228 px at that height) and the tools (72 px).
const COVER = { x: 228, y: 0, w: 605, h: 370 };
const fit = (rect = COVER, view = BOARD_VIEW) => fitOrbit({ ...view, pivot: [FRAME.width / 2, FRAME.height / 2] }, rect, box, 14);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('a deck point projects to the screen and back', () => {
  const cam = fit();
  for (const [x, y] of [[0, 0], [7, 4], [3.5, 2], [-0.4, 4.3], [6.2, 0.7]]) {
    const [sx, sy] = project(cam, x, y, 0);
    const [bx, by] = unproject(cam, sx, sy);
    assert.ok(near(bx, x) && near(by, y), `(${x}, ${y}) came back as (${bx}, ${by})`);
  }
  const [sx, sy] = project(cam, 2, 1, 0.4);
  const [bx, by] = unproject(cam, sx, sy, 0.4);
  assert.ok(near(bx, 2) && near(by, 1), 'and from a height');
});

test('a point above the horizon has no deck under it', () => {
  const cam = fit();
  assert.equal(unproject(cam, cam.x, cam.y - 1e6), null);
});

test('fitting shows the whole frame and what sticks out of it, inside the margin', () => {
  for (const rect of [COVER, { x: 176, y: 0, w: 573, h: 283 }, { x: 228, y: 0, w: 660, h: 825 }]) {
    const b = screenBounds(fit(rect), box);
    assert.ok(b.x0 >= rect.x + 14 - 1e-6 && b.x1 <= rect.x + rect.w - 14 + 1e-6);
    assert.ok(b.y0 >= rect.y + 14 - 1e-6 && b.y1 <= rect.y + rect.h - 14 + 1e-6);
    assert.ok(near(b.x1 - b.x0, rect.w - 28, 1e-6) || near(b.y1 - b.y0, rect.h - 28, 1e-6), 'as large as fits');
  }
  assert.equal(box.x0, -OVERHANG.left);
  assert.equal(box.x1, FRAME.width + OVERHANG.right);
});

// The narrowest width across a convex quad, in px.
function narrowest(quad) {
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const [a, b] = [quad[i], quad[(i + 1) % 4]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let far = 0;
    for (const p of quad) far = Math.max(far, Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length);
    best = Math.min(best, far);
  }
  return best;
}

test('at the default view every cell of the starter frame is a 48 px target on the cover screen', () => {
  const cam = fit();
  let smallest = Infinity;
  for (let y = 0; y < FRAME.height; y++) {
    for (let x = 0; x < FRAME.width; x++) {
      smallest = Math.min(smallest, narrowest([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => project(cam, a, b, 0))));
    }
  }
  assert.ok(smallest >= 48, `smallest cell ${smallest.toFixed(1)} px`);
});

test('zooming keeps the deck point under the fingers where it is, within the limits', () => {
  const cam = fit();
  const limits = { min: cam.scale, max: cam.scale * 3 };
  const [sx, sy] = project(cam, 5, 1);
  const zoomed = zoomOrbit(cam, sx, sy, cam.scale * 2, limits);
  assert.equal(zoomed.scale, cam.scale * 2);
  const [zx, zy] = project(zoomed, 5, 1);
  assert.ok(near(zx, sx, 1e-6) && near(zy, sy, 1e-6));
  assert.equal(zoomOrbit(cam, sx, sy, cam.scale * 10, limits).scale, limits.max);
  assert.equal(zoomOrbit(cam, sx, sy, cam.scale / 10, limits).scale, limits.min);
});

test('turning keeps the deck point under the fingers where it is', () => {
  const cam = fit();
  const [sx, sy] = project(cam, 2, 3);
  const turned = turnOrbit(cam, sx, sy, cam.yaw + 0.7);
  assert.ok(near(turned.yaw, cam.yaw + 0.7));
  const [tx, ty] = project(turned, 2, 3);
  assert.ok(near(tx, sx, 1e-6) && near(ty, sy, 1e-6));
  // Turning clockwise brings the nose toward the viewer: down the screen.
  const before = project(cam, 7, 2)[1] - project(cam, 0, 2)[1];
  const after = project(turned, 7, 2)[1] - project(turned, 0, 2)[1];
  assert.ok(after > before);
});

test('a pinch zooms with the spread, follows the midpoint, and turns only past the slop', () => {
  const cam = fit();
  const limits = { min: cam.scale * 0.5, max: cam.scale * 3 };
  const from = { x: 500, y: 180, spread: 100, angle: 0 };
  const under = unproject(cam, from.x, from.y);
  const plain = pinchOrbit(cam, from, { x: 520, y: 170, spread: 150, angle: 0.1 }, limits, 0.15);
  assert.ok(near(plain.scale, cam.scale * 1.5));
  assert.equal(plain.yaw, cam.yaw, 'a small twist is part of the pinch, not a turn');
  const [px, py] = project(plain, under[0], under[1]);
  assert.ok(near(px, 520, 1e-6) && near(py, 170, 1e-6));
  const turned = pinchOrbit(cam, from, { ...from, angle: 0.65 }, limits, 0.15);
  assert.ok(near(turned.yaw, cam.yaw + 0.5), 'past the slop it turns by the rest, without a jump');
});

test('twist measures the short way round', () => {
  assert.ok(near(twist(3.1, -3.1, 0), 2 * Math.PI - 6.2));
  assert.equal(twist(0, 0.1, 0.15), 0);
  assert.ok(near(twist(0, -0.4, 0.15), -0.25));
});

test('panning moves the view by the drag; clamping keeps the ship in sight', () => {
  const cam = fit();
  assert.deepEqual(panOrbit(cam, 10, -4), { ...cam, x: cam.x + 10, y: cam.y - 4 });
  const back = clampOrbit(panOrbit(cam, 200, 90), COVER, box, 14);
  assert.ok(near(back.x, cam.x, 1e-6) && near(back.y, cam.y, 1e-6), 'a fitted ship stays centred');
  const zoomed = zoomOrbit(cam, 530, 185, cam.scale * 3, { min: cam.scale, max: cam.scale * 3 });
  const far = clampOrbit(panOrbit(zoomed, 5000, 0), COVER, box, 14);
  assert.ok(near(screenBounds(far, box).x0, COVER.x + 14, 1e-6), "the ship's edge stops at the margin");
});

test('a tap picks the room it lands on, the nearest when rooms overlap on screen', async () => {
  const { pickModule, hitsGhost, convexHull, inside } = await import('../src/render/pick.js');
  const { indexDefs } = await import('../src/sim/defs.js');
  const { readData } = await import('../tools/data.js');
  const defs = indexDefs(readData());
  const cam = fit();
  const modules = [{ uid: 1, type: 'reactor', x: 1, y: 0, rot: 0 }, { uid: 2, type: 'corridor', x: 1, y: 2, rot: 0 }];
  const [rx, ry] = project(cam, 2, 1, 0.1);
  assert.equal(pickModule(cam, defs, modules, rx, ry), 1);
  // The top of the corridor's front wall, above the deck behind it.
  const [wx, wy] = project(cam, 1.5, 2.93, 0.25);
  const deck = unproject(cam, wx, wy);
  assert.ok(deck[1] < 2.93, 'the deck point under it is further back');
  assert.equal(pickModule(cam, defs, modules, wx, wy), 2);
  const [ex, ey] = project(cam, 5.5, 3.5, 0);
  assert.equal(pickModule(cam, defs, modules, ex, ey), null);
  const ghost = { type: 'corridor', x: 4, y: 1, rot: 0 };
  assert.ok(hitsGhost(cam, defs, ghost, ...project(cam, 4.5, 1.5, 0.7).slice(0, 2)), 'the floating part');
  assert.ok(hitsGhost(cam, defs, ghost, ...project(cam, 4.5, 1.5, 0).slice(0, 2)), 'its outline on the deck');
  assert.ok(!hitsGhost(cam, defs, ghost, ...project(cam, 6.5, 3.5, 0).slice(0, 2)));
  assert.ok(inside(convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]), 5, 9));
});

test("the camera's eye sits at depth zero, straight back from the pivot", async () => {
  const { eyeOf } = await import('../src/render/orbit.js');
  for (const yaw of [0, BOARD_VIEW.yaw, 1.3, -2.8]) {
    const cam = fitOrbit({ ...BOARD_VIEW, yaw, pivot: [FRAME.width / 2, FRAME.height / 2] }, COVER, box, 14);
    const eye = eyeOf(cam);
    assert.ok(near(project(cam, ...eye)[2], 0, 1e-9));
    assert.ok(near(Math.hypot(eye[0] - cam.pivot[0], eye[1] - cam.pivot[1], eye[2]), cam.distance, 1e-9));
  }
});
