import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { OVERHANG, traceHull } from '../src/render/hull.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, project, screenBounds, turnOrbit, twist, unproject, zoomOrbit } from '../src/render/orbit.js';
import { BOARD_VIEW, boardBox, MIN_VIEW, yardBox } from '../src/render/shipView.js';
import { buildShip, newShip } from '../src/sim/builder.js';
import { indexDefs } from '../src/sim/defs.js';
import { EXAMPLE_SCRIPT } from '../tools/build-ship.js';
import { readData } from '../tools/data.js';

const defs = indexDefs(readData());
const FRAME = defs.frames.get('starter');
const example = buildShip(defs, 'starter', JSON.parse(readFileSync(EXAMPLE_SCRIPT, 'utf8')).placements).ship;
const hull = traceHull(example, defs);
const box = boardBox(FRAME, hull);
// The board on the Fold's cover screen in the installed app: 905 × 370 CSS
// px, less the palette drawer (228 px at that height) and the tools (72 px).
const COVER = { x: 228, y: 0, w: 605, h: 370 };
const fit = (rect = COVER, view = BOARD_VIEW) => fitOrbit({ ...view, pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, 14);
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

test('fitting shows the whole ship and what sticks out of it, inside the margin', () => {
  for (const rect of [COVER, { x: 176, y: 0, w: 573, h: 283 }, { x: 228, y: 0, w: 660, h: 825 }]) {
    const b = screenBounds(fit(rect), box);
    assert.ok(b.x0 >= rect.x + 14 - 1e-6 && b.x1 <= rect.x + rect.w - 14 + 1e-6);
    assert.ok(b.y0 >= rect.y + 14 - 1e-6 && b.y1 <= rect.y + rect.h - 14 + 1e-6);
    assert.ok(near(b.x1 - b.x0, rect.w - 28, 1e-6) || near(b.y1 - b.y0, rect.h - 28, 1e-6), 'as large as fits');
  }
  // The example ship spans x 7 to 17 and y 5 to 10: 10 × 5 cells, so the
  // view keeps MIN_VIEW around its middle, room to build on all sides.
  assert.deepEqual([box.x0, box.x1], [12 - MIN_VIEW[0] / 2 - OVERHANG.left, 12 + MIN_VIEW[0] / 2 + OVERHANG.right]);
  assert.deepEqual([box.y0, box.y1], [7.5 - MIN_VIEW[1] / 2 - OVERHANG.top, 7.5 + MIN_VIEW[1] / 2 + OVERHANG.bottom]);
});

test("an empty yard frames a starter ship's worth of grid in its middle, and a big ship all of it", () => {
  const empty = boardBox(FRAME, traceHull(newShip('starter'), defs));
  assert.deepEqual([empty.x0 + OVERHANG.left, empty.x1 - OVERHANG.right], [FRAME.width / 2 - MIN_VIEW[0] / 2, FRAME.width / 2 + MIN_VIEW[0] / 2]);
  const row = Array.from({ length: 20 }, (_, i) => ({ type: 'corridor', x: 2 + i, y: 4, rot: 0 }));
  const long = boardBox(FRAME, traceHull(buildShip(defs, 'starter', row).ship, defs));
  assert.deepEqual([long.x0, long.x1], [2 - OVERHANG.left, 22 + OVERHANG.right]);
  const yard = yardBox(FRAME);
  assert.deepEqual([yard.x0, yard.x1, yard.y1], [-OVERHANG.left, FRAME.width + OVERHANG.right, FRAME.height + OVERHANG.bottom]);
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

// Cells are smaller than a 48 px touch target (one per battle tile), so a
// tap only ever previews a part; this keeps them big enough to aim at.
test('at the default view every cell around a starter ship is at least 22 px on the cover screen', () => {
  const cam = fit();
  let smallest = Infinity;
  for (let y = Math.ceil(box.y0); y < Math.floor(box.y1); y++) {
    for (let x = Math.ceil(box.x0); x < Math.floor(box.x1); x++) {
      smallest = Math.min(smallest, narrowest([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => project(cam, a, b, 0))));
    }
  }
  assert.ok(smallest >= 22, `smallest cell ${smallest.toFixed(1)} px`);
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

test('panning moves the view by the drag; clamping keeps the yard in sight', () => {
  const cam = fit();
  assert.deepEqual(panOrbit(cam, 10, -4), { ...cam, x: cam.x + 10, y: cam.y - 4 });
  // On the cover screen the yard is bigger than the view: the view stays on it.
  const yard = yardBox(FRAME);
  const far = clampOrbit(panOrbit(cam, 5000, 0), COVER, yard, 14);
  assert.ok(near(screenBounds(far, yard).x0, COVER.x + 14, 1e-6), "the yard's edge stops at the margin");
  // Unfolded, the yard fits the view top to bottom: it stays wholly on
  // screen, but the fitted ship needn't sit in its middle.
  const OPEN = { x: 228, y: 0, w: 660, h: 825 };
  const open = fit(OPEN);
  assert.deepEqual(clampOrbit(open, OPEN, yard, 14), open, 'the fit itself is left alone');
  const down = clampOrbit(panOrbit(open, 0, 5000), OPEN, yard, 14);
  assert.ok(near(screenBounds(down, yard).y1, OPEN.h - 14, 1e-6), 'pushed down, the yard stops at the bottom margin');
});

test('a tap picks the room it lands on, the nearest when rooms overlap on screen', async () => {
  const { pickModule, hitsGhost, convexHull, inside } = await import('../src/render/pick.js');
  const { indexDefs } = await import('../src/sim/defs.js');
  const { readData } = await import('../tools/data.js');
  const defs = indexDefs(readData());
  const cam = fit();
  const modules = [{ uid: 1, type: 'reactor', x: 1, y: 0, rot: 0 }, { uid: 2, type: 'corridor', x: 1, y: 3, rot: 0 }];
  const [rx, ry] = project(cam, 2, 1, 0.1);
  assert.equal(pickModule(cam, defs, modules, rx, ry), 1);
  // The top of the corridor's front wall, above the deck behind it.
  const [wx, wy] = project(cam, 1.5, 3.88, 0.42);
  const deck = unproject(cam, wx, wy);
  assert.ok(deck[1] < 3.88, 'the deck point under it is further back');
  assert.equal(pickModule(cam, defs, modules, wx, wy), 2);
  const [ex, ey] = project(cam, 5.5, 3.5, 0);
  assert.equal(pickModule(cam, defs, modules, ex, ey), null);
  const ghost = { type: 'corridor', x: 4, y: 1, rot: 0 };
  assert.ok(hitsGhost(cam, defs, ghost, ...project(cam, 4.5, 1.5, 1.2).slice(0, 2)), 'the floating part');
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
