// The board camera: maps cells (world) to CSS pixels (screen).
//   screen = world * scale + (x, y)
// A camera is plain data, { x, y, scale }, and these functions return new
// ones. A rect is { x, y, w, h } in CSS pixels.

// The camera that shows a worldW × worldH area as large as fits in rect,
// centered, with margin pixels to spare on every side.
export function fitCamera(rect, worldW, worldH, margin = 0) {
  const scale = Math.max(0.01, Math.min((rect.w - 2 * margin) / worldW, (rect.h - 2 * margin) / worldH));
  return { scale, x: rect.x + (rect.w - worldW * scale) / 2, y: rect.y + (rect.h - worldH * scale) / 2 };
}

export function toScreen(camera, wx, wy) {
  return [camera.x + wx * camera.scale, camera.y + wy * camera.scale];
}

export function toWorld(camera, sx, sy) {
  return [(sx - camera.x) / camera.scale, (sy - camera.y) / camera.scale];
}

export function panCamera(camera, dx, dy) {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

// Zooms to `scale` (clamped to limits { min, max }) and keeps the world point
// under (sx, sy) where it is.
export function zoomCamera(camera, sx, sy, scale, limits) {
  const next = clamp(scale, limits.min, limits.max);
  const [wx, wy] = toWorld(camera, sx, sy);
  return { scale: next, x: sx - wx * next, y: sy - wy * next };
}

// A two-finger pinch, worked out from where it began rather than step by
// step, so it can't drift. `from` and `to` are { x, y, spread }: the
// fingers' midpoint and the distance between them. The world point that was
// under the first midpoint follows the midpoint, and the zoom follows the
// spread.
export function pinchCamera(start, from, to, limits) {
  const scale = clamp(start.scale * (to.spread / Math.max(from.spread, 1)), limits.min, limits.max);
  const [wx, wy] = toWorld(start, from.x, from.y);
  return { scale, x: to.x - wx * scale, y: to.y - wy * scale };
}

// Keeps the world in view. Along an axis where it fits (with the margin), it
// stays centered; along one where it doesn't, its edges can't come further
// inside the rect than the margin.
export function clampCamera(camera, rect, worldW, worldH, margin = 0) {
  return {
    scale: camera.scale,
    x: clampAxis(camera.x, rect.x, rect.w, worldW * camera.scale, margin),
    y: clampAxis(camera.y, rect.y, rect.h, worldH * camera.scale, margin),
  };
}

function clampAxis(position, start, size, length, margin) {
  if (length <= size - 2 * margin) return start + (size - length) / 2;
  return clamp(position, start + size - margin - length, start + margin);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
