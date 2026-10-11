import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampCamera, fitCamera, panCamera, pinchCamera, toScreen, toWorld, zoomCamera } from '../src/render/camera.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const rect = { x: 200, y: 0, w: 560, h: 370 };

test('fit shows the whole frame as large as it fits, centered', () => {
  const cam = fitCamera(rect, 7, 4, 12);
  assert.equal(cam.scale, Math.min((560 - 24) / 7, (370 - 24) / 4));
  const [left, top] = toScreen(cam, 0, 0);
  const [right, bottom] = toScreen(cam, 7, 4);
  assert.ok(close(left - rect.x, rect.x + rect.w - right), 'centered across');
  assert.ok(close(top - rect.y, rect.y + rect.h - bottom), 'centered down');
  assert.ok(top >= 12 - 1e-9 && left >= rect.x + 12 - 1e-9);
});

test('screen and world coordinates convert both ways', () => {
  const cam = { x: 37.5, y: -12, scale: 81.25 };
  const [sx, sy] = toScreen(cam, 2.25, 3.5);
  const [wx, wy] = toWorld(cam, sx, sy);
  assert.ok(close(wx, 2.25) && close(wy, 3.5));
});

test('zooming keeps the point under the fingers still, within the limits', () => {
  const cam = fitCamera(rect, 7, 4, 12);
  const limits = { min: cam.scale, max: cam.scale * 3 };
  const before = toWorld(cam, 500, 200);
  const zoomed = zoomCamera(cam, 500, 200, cam.scale * 2, limits);
  const after = toWorld(zoomed, 500, 200);
  assert.ok(close(before[0], after[0]) && close(before[1], after[1]));
  assert.equal(zoomCamera(cam, 500, 200, cam.scale * 10, limits).scale, limits.max);
  assert.equal(zoomCamera(cam, 500, 200, cam.scale / 10, limits).scale, limits.min);
});

test('a pinch follows the fingers from where it began', () => {
  const start = fitCamera(rect, 7, 4, 12);
  const limits = { min: start.scale, max: start.scale * 3 };
  const from = { x: 400, y: 180, spread: 100 };
  const to = { x: 450, y: 160, spread: 200 };
  const cam = pinchCamera(start, from, to, limits);
  assert.ok(close(cam.scale, start.scale * 2));
  const [wx, wy] = toWorld(start, from.x, from.y);
  const [sx, sy] = toScreen(cam, wx, wy);
  assert.ok(close(sx, to.x) && close(sy, to.y), 'the pinched point moved with the midpoint');
  assert.equal(pinchCamera(start, from, { ...to, spread: 10 }, limits).scale, limits.min);
});

test('clamping keeps a frame that fits centered, and a zoomed one covering the view', () => {
  const fit = fitCamera(rect, 7, 4, 12);
  assert.deepEqual(clampCamera(panCamera(fit, 80, -50), rect, 7, 4, 12), fit, 'a pan at fit snaps back');
  const zoomed = { ...fit, scale: fit.scale * 3 };
  const far = clampCamera(panCamera(zoomed, 5000, 5000), rect, 7, 4, 12);
  assert.ok(close(far.x, rect.x + 12) && close(far.y, rect.y + 12), 'top-left edge stops at the margin');
  const other = clampCamera(panCamera(zoomed, -5000, -5000), rect, 7, 4, 12);
  const [right, bottom] = toScreen(other, 7, 4);
  assert.ok(close(right, rect.x + rect.w - 12) && close(bottom, rect.y + rect.h - 12), 'bottom-right edge too');
});
