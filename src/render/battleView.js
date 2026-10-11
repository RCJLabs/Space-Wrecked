// Draws a battle map: deep space, then the map's solid scene
// (battleScene.js) and whatever stands on it (units.js), lit and drawn back
// to front together by the painter, so walls hide what is behind them.
// Works in CSS pixels; the caller sets the device-pixel transform and clips
// to the board. Never changes the map.
//   board = createBattleBoard()
//   board.setMap(input)          { map, skin, open } (see battleScene), or null
//   board.setActors(input)       { faces, glows }: units and marks on the
//                                deck (units.js), or null
//   board.draw(ctx, cam, rect, overlay, { animating })
//                                overlay(ctx), if given, draws on top
//                                (labels, shots in flight); animating says
//                                units are moving. True means this frame was
//                                a rough one (the camera or units moved, on
//                                a phone too slow for full frames): draw
//                                again once it settles
//   board.frameStats()           for the dev overlay (frameBudget.js)
import { battleScene } from './battleScene.js';
import { createFrameBudget } from './frameBudget.js';
import { paintLayer } from './layer.js';
import { paintSolid, prepareSolid } from './painter.js';
import { palette } from './palette.js';
import { drawSpace } from './shipView.js';
import { shade } from './solid.js';

const deg = Math.PI / 180;

// The camera a battle map opens at: the builder's angle, a little nearer,
// so the same ship looks the same in both.
export const BATTLE_VIEW = { yaw: -11 * deg, pitch: 60 * deg, distance: 40 };

// The camera a fight opens at: square to the ship, where tiles come out
// biggest for the player's taps (48 px and more for the example ship on the
// Fold's cover screen, against 39 at the builder's angle). Twist to turn it.
export const FIGHT_VIEW = { ...BATTLE_VIEW, yaw: 0 };

const NONE = { faces: [], glows: [] };

export function createBattleBoard() {
  let scene = null;
  let actors = NONE;
  // The map as last drawn in full, reused until something changes; a
  // half-resolution canvas for rough frames, drawn without outlines; and
  // the budget that picks between them while the camera moves.
  const still = { canvas: null, cam: null, scene: null, actors: null, rect: null, ratio: 0 };
  const lowRes = { canvas: null };
  const budget = createFrameBudget();
  // Space behind the map doesn't move with it, so it is painted once per
  // size and pixel ratio.
  const backdrops = new Map();
  let lastCam = null;
  return {
    setMap(input) {
      scene = null;
      if (input) {
        const { faces, glows } = battleScene(input);
        scene = { faces: prepareSolid(faces, shade), glows, space: input.skin.space };
      }
      lastCam = null; // the next frame is a full one
    },
    setActors(input) {
      actors = input ? { faces: prepareSolid(input.faces, shade), glows: input.glows } : NONE;
    },
    draw(ctx, cam, rect, overlay, { animating = false } = {}) {
      const moving = Boolean(cam && lastCam && cam !== lastCam) || animating;
      lastCam = cam;
      const ratio = ctx.getTransform().a;
      if (still.cam === cam && still.scene === scene && still.actors === actors && still.rect === rect && still.ratio === ratio) {
        // Nothing on the board changed: the last full frame will do.
        ctx.drawImage(still.canvas, rect.x, rect.y, rect.w, rect.h);
      } else if (budget.full(moving)) {
        // Timed with the copy to the screen, which is where a phone that
        // draws canvas without its GPU fills the pixels.
        budget.measure(() => ctx.drawImage(paintLayer(still, rect, ratio, (g) => paint(g, cam, rect, ratio, true)), rect.x, rect.y, rect.w, rect.h));
        Object.assign(still, { cam, scene, actors, rect, ratio });
      } else {
        ctx.drawImage(paintLayer(lowRes, rect, 1, (g) => paint(g, cam, rect, 1, false)), rect.x, rect.y, rect.w, rect.h);
        still.cam = null;
        overlay?.(ctx);
        return true;
      }
      overlay?.(ctx);
      return false;
    },
    frameStats: () => budget.stats(),
  };

  function paint(g, cam, rect, ratio, edges) {
    g.drawImage(backdrop(rect, ratio, scene?.space ?? palette.space), rect.x, rect.y, rect.w, rect.h);
    if (!scene || !cam) return;
    const faces = actors.faces.length ? scene.faces.concat(actors.faces) : scene.faces;
    paintSolid(g, faces, actors.glows.length ? scene.glows.concat(actors.glows) : scene.glows, cam, { edges });
  }

  function backdrop(rect, ratio, color) {
    const key = [rect.x, rect.y, rect.w, rect.h, color].join();
    let kept = backdrops.get(ratio);
    if (kept?.key !== key) {
      kept = { canvas: kept?.canvas ?? null, key };
      paintLayer(kept, rect, ratio, (g) => drawSpace(g, rect, color));
      backdrops.set(ratio, kept);
    }
    return kept.canvas;
  }
}
