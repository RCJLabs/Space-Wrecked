// The 3D board camera: it looks down at the deck at an angle, in
// perspective, and turns about a pivot on the deck. World units are cells:
// x along the ship (the nose is +x), y across it (rows run down the grid),
// z up from the deck.
//
// A camera is plain data, and these functions return new ones:
//   { yaw, pitch, distance, pivot: [x, y], scale, x, y }
// yaw turns the ship on screen (clockwise as it grows), pitch is the angle
// above the deck the camera looks down from, distance is how far the camera
// sits from the pivot (in cells; nearer is stronger perspective), scale is
// CSS px per cell at the pivot's depth, and (x, y) is where the pivot lands
// on screen. A rect is { x, y, w, h } in CSS pixels; a box is
// { x0, y0, x1, y1, z1 } in cells, from the deck (z = 0) up to z1.

// [screen x, screen y, depth] for world point (x, y, z).
export function project(cam, x, y, z = 0) {
  const dx = x - cam.pivot[0];
  const dy = y - cam.pivot[1];
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const right = dx * c - dy * s;
  const toward = dx * s + dy * c; // along the deck, toward the viewer
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const depth = cam.distance - toward * cp - z * sp;
  const k = (cam.scale * cam.distance) / depth;
  return [cam.x + right * k, cam.y - (z * cp - toward * sp) * k, depth];
}

// Where the camera itself is, as a world point [x, y, z].
export function eyeOf(cam) {
  const level = cam.distance * Math.cos(cam.pitch);
  return [cam.pivot[0] + level * Math.sin(cam.yaw), cam.pivot[1] + level * Math.cos(cam.yaw), cam.distance * Math.sin(cam.pitch)];
}

// The world point at height z (the deck by default) under screen point
// (sx, sy), as [x, y], or null if that point is above the horizon.
export function unproject(cam, sx, sy, z = 0) {
  const f = cam.scale * cam.distance;
  const a = (sx - cam.x) / f;
  const b = (cam.y - sy) / f;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const below = sp - b * cp;
  if (below <= 1e-9) return null;
  const depth = (cam.distance * sp - z) / below;
  if (depth <= 0) return null;
  const right = a * depth;
  const toward = (z * cp - b * depth) / sp;
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  return [cam.pivot[0] + right * c + toward * s, cam.pivot[1] - right * s + toward * c];
}

// The screen-space bounds { x0, y0, x1, y1 } of a box's corners.
export function screenBounds(cam, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const x of [box.x0, box.x1]) {
    for (const y of [box.y0, box.y1]) {
      for (const z of [0, box.z1]) {
        const [sx, sy] = project(cam, x, y, z);
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
    }
  }
  return { x0, y0, x1, y1 };
}

// The camera at { yaw, pitch, distance, pivot } that shows the box as large
// as fits in rect, centred, with margin pixels to spare on every side.
// Depth doesn't depend on scale or position, so the fit is exact.
export function fitOrbit(view, rect, box, margin = 0) {
  const unit = { ...view, scale: 1, x: 0, y: 0 };
  const b = screenBounds(unit, box);
  const scale = Math.max(0.01, Math.min((rect.w - 2 * margin) / (b.x1 - b.x0), (rect.h - 2 * margin) / (b.y1 - b.y0)));
  return {
    ...unit,
    scale,
    x: rect.x + rect.w / 2 - (scale * (b.x0 + b.x1)) / 2,
    y: rect.y + rect.h / 2 - (scale * (b.y0 + b.y1)) / 2,
  };
}

export function panOrbit(cam, dx, dy) {
  return { ...cam, x: cam.x + dx, y: cam.y + dy };
}

// Moves the camera on screen so world point `at` (on the deck) lands on
// (sx, sy). The projection shifts with (x, y) without changing shape, so one
// step is exact.
function pin(cam, at, sx, sy) {
  const [px, py] = project(cam, at[0], at[1], 0);
  return { ...cam, x: cam.x + sx - px, y: cam.y + sy - py };
}

// Zooms to `scale` (within limits { min, max }) and keeps the deck point
// under (sx, sy) where it is.
export function zoomOrbit(cam, sx, sy, scale, limits) {
  const at = unproject(cam, sx, sy) ?? cam.pivot;
  return pin({ ...cam, scale: clamp(scale, limits.min, limits.max) }, at, sx, sy);
}

// Turns the ship to `yaw` about the deck point under (sx, sy).
export function turnOrbit(cam, sx, sy, yaw) {
  const at = unproject(cam, sx, sy) ?? cam.pivot;
  return pin({ ...cam, yaw }, at, sx, sy);
}

// A two-finger gesture, worked out from where it began so it can't drift.
// `from` and `to` are { x, y, spread, angle }: the fingers' midpoint, the
// distance between them and the angle of the line through them. The deck
// point under the first midpoint follows the midpoint, the zoom follows the
// spread and the ship turns with the fingers once they have twisted more
// than `slop` radians (so a plain pinch doesn't turn it).
export function pinchOrbit(start, from, to, limits, slop = 0) {
  const at = unproject(start, from.x, from.y) ?? start.pivot;
  const scale = clamp(start.scale * (to.spread / Math.max(from.spread, 1)), limits.min, limits.max);
  const yaw = start.yaw + twist(from.angle, to.angle, slop);
  return pin({ ...start, scale, yaw }, at, to.x, to.y);
}

// How far a twist from angle a to angle b turns the ship: nothing within
// slop, then the rest, so turning starts without a jump.
export function twist(a, b, slop) {
  let turn = b - a;
  turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
  if (Math.abs(turn) <= slop) return 0;
  return turn - Math.sign(turn) * slop;
}

// Keeps the box in view. Along an axis where it fits (with the margin), it
// stays centred; along one where it doesn't, its edges can't come further
// inside the rect than the margin.
export function clampOrbit(cam, rect, box, margin = 0) {
  const b = screenBounds(cam, box);
  return {
    ...cam,
    x: cam.x + clampShift(b.x0, b.x1, rect.x, rect.w, margin),
    y: cam.y + clampShift(b.y0, b.y1, rect.y, rect.h, margin),
  };
}

function clampShift(lo, hi, start, size, margin) {
  const length = hi - lo;
  if (length <= size - 2 * margin) return start + (size - length) / 2 - lo;
  if (lo > start + margin) return start + margin - lo;
  if (hi < start + size - margin) return start + size - margin - hi;
  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
