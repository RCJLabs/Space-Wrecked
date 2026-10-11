// Draws a battle map: deep space, then the map's solid scene
// (battleScene.js), lit and drawn back to front by the painter. Works in CSS
// pixels; the caller sets the device-pixel transform and clips to the
// board. Never changes the map.
//   board = createBattleBoard()
//   board.setMap(input)          { map, skin } (see battleScene), or null
//   board.draw(ctx, cam, rect)   true means this frame was a rough one (the
//                                camera moved): draw again once it settles
import { battleScene } from './battleScene.js';
import { paintSolid, prepareSolid } from './painter.js';
import { palette } from './palette.js';
import { drawSpace } from './shipView.js';
import { shade } from './solid.js';

const deg = Math.PI / 180;

// The camera a battle map opens at: the builder's angle, a little nearer,
// so the same ship looks the same in both.
export const BATTLE_VIEW = { yaw: -11 * deg, pitch: 60 * deg, distance: 40 };

export function createBattleBoard() {
  let scene = null;
  // While the camera moves, frames are drawn at one pixel per CSS pixel
  // without outlines, and scaled up: a quarter of the pixels on a 2x
  // screen, and nobody looks closely mid-gesture.
  const rough = { canvas: null };
  // Space behind the map doesn't move with it, so it is painted once per
  // size and pixel ratio, and copied in every frame.
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
    draw(ctx, cam, rect) {
      const moving = Boolean(cam && lastCam && cam !== lastCam);
      lastCam = cam;
      if (!moving) {
        paint(ctx, cam, rect, ctx.getTransform().a, true);
        return false;
      }
      rough.canvas ??= document.createElement('canvas');
      const [w, h] = [Math.round(rect.w), Math.round(rect.h)];
      if (rough.canvas.width !== w || rough.canvas.height !== h) {
        rough.canvas.width = w;
        rough.canvas.height = h;
      }
      const g = rough.canvas.getContext('2d', { alpha: false });
      g.setTransform(1, 0, 0, 1, -rect.x, -rect.y);
      paint(g, cam, rect, 1, false);
      ctx.drawImage(rough.canvas, rect.x, rect.y, rect.w, rect.h);
      return true;
    },
  };

  function paint(g, cam, rect, ratio, edges) {
    g.drawImage(backdrop(rect, ratio, scene?.space ?? palette.space), rect.x, rect.y, rect.w, rect.h);
    if (scene && cam) paintSolid(g, scene.faces, scene.glows, cam, { edges });
  }

  function backdrop(rect, ratio, color) {
    const key = [rect.x, rect.y, rect.w, rect.h, color].join();
    let kept = backdrops.get(ratio);
    if (kept?.key !== key) {
      const canvas = kept?.canvas ?? document.createElement('canvas');
      canvas.width = Math.round(rect.w * ratio);
      canvas.height = Math.round(rect.h * ratio);
      const g = canvas.getContext('2d', { alpha: false });
      g.setTransform(ratio, 0, 0, ratio, -rect.x * ratio, -rect.y * ratio);
      drawSpace(g, rect, color);
      kept = { canvas, key };
      backdrops.set(ratio, kept);
    }
    return kept.canvas;
  }
}
