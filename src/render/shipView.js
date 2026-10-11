// Draws the builder board: the ship as a 3D blueprint over a navy grid, and
// whatever the player is doing on it, or, with the hull on, the ship as it
// looks from outside. Works in CSS pixels; the caller sets the device-pixel
// transform and clips to the board. Never changes the scene.
//
// Scenes are built once per change (shipScene.js, exterior.js) and drawn
// every frame the camera moves:
//   board = createBoard(frame)
//   board.setShip(input)    the ship and its overlays (see blueprintScene)
//   board.setGhost(input)   a part being placed (see ghostScene), or null
//   board.setHull(input)    the ship seen from outside (see exteriorScene)
//   board.draw(ctx, cam, rect, view)   view is 'plans' or 'hull'; true
//                                      means this frame was a rough one
//                                      (the camera moved, on a phone too
//                                      slow for full frames): draw again
//                                      once it has settled
//   board.frameStats()                 for the dev overlay (frameBudget.js)
import { seedFrom } from '../core/rng.js';
import { BLUEPRINT_ORDER, BLUEPRINT_STYLES, LABEL_TONES } from './blueprintStyles.js';
import { exteriorScene } from './exterior.js';
import { createFrameBudget } from './frameBudget.js';
import { OVERHANG } from './hull.js';
import { paintLayer } from './layer.js';
import { batchModel, paintBatches, paintLabels, paintSolid, prepareSolid } from './painter.js';
import { palette, rgba } from './palette.js';
import { blueprintScene, ghostScene, gridModel } from './shipScene.js';
import { shade } from './solid.js';
import { drawStars, makeStarfield } from './starfield.js';

const deg = Math.PI / 180;

// The camera the builder starts at and Fit returns to: a gentle angle with
// mild perspective. Cells are small (one per battle tile), so placing
// always previews first; the view keeps every cell around a starter ship
// at least 22 px on the Fold's cover screen (tests/orbit.test.js).
export const BOARD_VIEW = { yaw: -11 * deg, pitch: 60 * deg, distance: 48 };

// The least the fitted view shows, in cells: an empty yard or a small ship
// still frames a starter ship's worth of grid, with room around it to build.
export const MIN_VIEW = [14, 8];
const TALL = 1.2; // the rooms and what stands on them

// What the fitted camera keeps in view: the ship (its cells, as traced)
// and what sticks out of its hull, at least MIN_VIEW, centred on the ship
// (or the frame when it is empty).
export function boardBox(frame, hull) {
  const xs = hull.cells.map(([x]) => x);
  const ys = hull.cells.map(([, y]) => y);
  const [cx, cy] = xs.length ? [(Math.min(...xs) + Math.max(...xs) + 1) / 2, (Math.min(...ys) + Math.max(...ys) + 1) / 2] : [frame.width / 2, frame.height / 2];
  const half = (lo, hi, min) => Math.max(min / 2, (hi - lo) / 2);
  const [hw, hh] = xs.length
    ? [half(Math.min(...xs), Math.max(...xs) + 1, MIN_VIEW[0]), half(Math.min(...ys), Math.max(...ys) + 1, MIN_VIEW[1])]
    : [MIN_VIEW[0] / 2, MIN_VIEW[1] / 2];
  return { x0: cx - hw - OVERHANG.left, y0: cy - hh - OVERHANG.top, x1: cx + hw + OVERHANG.right, y1: cy + hh + OVERHANG.bottom, z1: TALL };
}

// The whole frame: how far the camera may pan, and zoom out to.
export function yardBox(frame) {
  return { x0: -OVERHANG.left, y0: -OVERHANG.top, x1: frame.width + OVERHANG.right, y1: frame.height + OVERHANG.bottom, z1: TALL };
}

const GRID = ['gridMinor', 'gridMajor'];
const BACKDROP = rgba(palette.bpDeep, 0.85);
const SKY = makeStarfield(seedFrom('hull view'), 220);

// Styles for rough frames while the camera moves: no halos, which cost the
// most to rasterize and matter least in motion.
const MOVING_STYLES = Object.fromEntries(Object.entries(BLUEPRINT_STYLES).map(([name, { halo, ...style }]) => [name, style]));

export function createBoard(frame) {
  const grid = batchModel(gridModel(frame));
  let ship = null;
  let ghost = null;
  let hull = null;
  // The grid and ship as last drawn in full, reused while only a part being
  // placed moves over them; a half-resolution canvas for rough frames; and
  // the budget that picks between them while the camera moves.
  const still = { canvas: null, cam: null, ship: null, rect: null, ratio: 0 };
  const lowRes = { canvas: null };
  const budget = createFrameBudget();
  let lastCam = null;
  return {
    setShip(input) {
      const { model, labels } = blueprintScene(input);
      ship = { batches: batchModel(model), labels };
    },
    setGhost(input) {
      if (!input) {
        ghost = null;
        return;
      }
      const { model, label } = ghostScene(input);
      ghost = { batches: batchModel(model), labels: [label] };
    },
    setHull(input) {
      const { faces, glows } = exteriorScene(input);
      hull = { faces: prepareSolid(faces, shade), glows, space: input.skin.space };
    },
    draw(ctx, cam, rect, view = 'plans') {
      if (view === 'hull') {
        drawSpace(ctx, rect, hull?.space ?? palette.space);
        if (hull) paintSolid(ctx, hull.faces, hull.glows, cam);
        lastCam = null;
        return false;
      }
      const moving = cam !== lastCam;
      lastCam = cam;
      const rough = !budget.full(moving);
      if (rough) {
        // The camera moved, and full frames take too long on this phone:
        // draw at one pixel per CSS pixel, in the cheaper styles, and scale
        // it up. A quarter of the pixels on a 2x screen.
        ctx.drawImage(paintLayer(lowRes, rect, 1, (g) => plans(g, cam, rect, MOVING_STYLES)), rect.x, rect.y, rect.w, rect.h);
        still.cam = null;
      } else {
        const ratio = ctx.getTransform().a;
        if (still.cam !== cam || still.ship !== ship || still.rect !== rect || still.ratio !== ratio) {
          // Timed with the copy to the screen, which is where a phone that
          // draws canvas without its GPU fills the pixels.
          budget.measure(() => ctx.drawImage(paintLayer(still, rect, ratio, (g) => plans(g, cam, rect, BLUEPRINT_STYLES)), rect.x, rect.y, rect.w, rect.h));
          Object.assign(still, { cam, ship, rect, ratio });
        } else {
          ctx.drawImage(still.canvas, rect.x, rect.y, rect.w, rect.h);
        }
      }
      if (ghost) paintBatches(ctx, ghost.batches, cam, rough ? MOVING_STYLES : BLUEPRINT_STYLES, BLUEPRINT_ORDER);
      const labels = ghost ? ghost.labels : ship?.labels ?? [];
      paintLabels(ctx, labels, cam, rect, LABEL_TONES, BACKDROP);
      return rough;
    },
    frameStats: () => budget.stats(),
  };

  // The blueprint paper, its grid and the ship.
  function plans(g, cam, rect, styles) {
    const sky = g.createRadialGradient(rect.x + rect.w * 0.55, rect.y + rect.h * 0.35, 0, rect.x + rect.w * 0.55, rect.y + rect.h * 0.35, Math.max(rect.w, rect.h) * 0.85);
    sky.addColorStop(0, palette.bpSky);
    sky.addColorStop(1, palette.bpDeep);
    g.fillStyle = sky;
    g.fillRect(rect.x, rect.y, rect.w, rect.h);
    paintBatches(g, grid, cam, styles, GRID);
    if (ship) paintBatches(g, ship.batches, cam, styles, BLUEPRINT_ORDER);
  }
}

// Deep space behind the ship seen from outside (and behind a battle map):
// a faint nebula and stars.
export function drawSpace(ctx, rect, color) {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const [cx, cy] = [rect.x + rect.w * 0.6, rect.y + rect.h * 0.4];
  const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rect.w, rect.h) * 0.7);
  haze.addColorStop(0, rgba(palette.nebulaB, 0.4));
  haze.addColorStop(1, rgba(palette.nebulaB, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawStars(ctx, SKY, { width: rect.x + rect.w, height: rect.y + rect.h }, 0);
}
