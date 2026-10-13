// What a finger is on, on the 3D board. Rooms stand up from the deck and a
// part being placed floats above it, so the deck point straight under the
// finger isn't always the part the player sees there: a tap on a tall room
// near the front lands, on the deck, behind it. These test the projected
// shapes instead and fall back to the deck.
import { footprint } from '../sim/modules.js';
import { project } from './orbit.js';
import { HOVER, roomBounds, WALL } from './shipScene.js';

// The uid of the front-most module whose room, walls and all, is under
// screen point (sx, sy), or null.
export function pickModule(cam, defs, modules, sx, sy) {
  let best = null;
  let nearest = Infinity;
  for (const module of modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    const [x0, y0, x1, y1] = roomBounds(def, module);
    const corners = boxCorners(cam, x0, y0, x1, y1, 0, WALL);
    if (!inside(convexHull(corners), sx, sy)) continue;
    const depth = Math.min(...corners.map((c) => c[2]));
    if (depth < nearest) {
      nearest = depth;
      best = module.uid;
    }
  }
  return best;
}

// True if (sx, sy) is on a part being placed: its floating room, the
// outline on the deck below, or anything between.
export function hitsGhost(cam, defs, ghost, sx, sy) {
  const [w, h] = footprint(defs.modules.get(ghost.type), ghost.rot);
  const corners = boxCorners(cam, ghost.x, ghost.y, ghost.x + w, ghost.y + h, 0, HOVER + WALL);
  return inside(convexHull(corners), sx, sy);
}

// The uid of the front-most of `items`, { uid, box: [x0, y0, z0, x1, y1,
// z1] }, whose box is under screen point (sx, sy), or null: styling pieces
// seen from outside (lookOverlay.js pieceBox).
export function pickBox(cam, items, sx, sy) {
  let best = null;
  let nearest = Infinity;
  for (const { uid, box } of items) {
    if (!box) continue;
    const corners = boxCorners(cam, box[0], box[1], box[3], box[4], box[2], box[5]);
    if (!inside(convexHull(corners), sx, sy)) continue;
    const depth = Math.min(...corners.map((c) => c[2]));
    if (depth < nearest) {
      nearest = depth;
      best = uid;
    }
  }
  return best;
}

function boxCorners(cam, x0, y0, x1, y1, z0, z1) {
  const corners = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push(project(cam, x, y, z));
  return corners;
}

// The convex hull of [x, y, ...] points, anticlockwise on screen.
export function convexHull(points) {
  const pts = points.map(([x, y]) => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// True if (x, y) is inside a convex polygon (or on its edge).
export function inside(polygon, x, y) {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c === 0) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return polygon.length > 2;
}
