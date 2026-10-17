// The painted backdrop behind the lift-off and the landing (M34,
// render/scenes/): a world's ground from above and the world seen whole,
// painted once a screen size and drawn each frame for the sequence's
// moment (render/scenes/paint.js backdropAt).
//   backdrop = createBackdrop(sceneId)   'homeworld', or a kind of world's
//   backdrop.ready(view)   paints for the screen's size if it hasn't yet:
//                          the milliseconds that took, so the sequence can
//                          start after it
//   backdrop.draw(ctx, view, moment, at, smooth)   at: the ship's place on
//                          screen; smooth false for a ground in motion
//                          (paint.js drawBackdrop)
import { drawBackdrop, paintCover, paintTile, tileSide } from '../../render/scenes/paint.js';
import { worldPictures } from '../../render/scenes/scenes.js';

export function createBackdrop(sceneId) {
  const pictures = worldPictures(sceneId);
  let painted = null; // { w, h, dpr, world, ground }
  const backdrop = {
    ready(view) {
      if (painted && painted.w === view.width && painted.h === view.height && painted.dpr === view.dpr) return 0;
      const start = performance.now();
      painted = {
        w: view.width,
        h: view.height,
        dpr: view.dpr,
        world: paintCover(pictures.world, view.width, view.height, view.dpr),
        ground: paintTile(pictures.ground, tileSide(view.width, view.height, view.dpr)),
      };
      return performance.now() - start;
    },
    draw(ctx, view, moment, at, smooth) {
      backdrop.ready(view);
      drawBackdrop(ctx, painted, moment, view, at, smooth);
    },
  };
  return backdrop;
}
