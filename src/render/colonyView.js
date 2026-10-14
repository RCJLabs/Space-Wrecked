// Draws the colony (colonyScene.js, M26): the world's land filling the
// view, the ground cleared for the grid and the buildings' slabs flat on
// it, in their order, then what stands on them, back to front. Works in
// CSS pixels; never changes the scene.
import { project } from './orbit.js';
import { paintSolid, prepareSolid } from './painter.js';
import { groundFor, rgba } from './palette.js';
import { shade } from './solid.js';

// A scene lit and ready to draw: made once per change.
export function prepareColony(scene, kind) {
  return { ground: prepareSolid(scene.ground, shade), faces: prepareSolid(scene.faces, shade), glows: scene.glows, colors: groundFor(kind) };
}

export function drawColony(ctx, rect, cam, prepared) {
  drawLand(ctx, rect, prepared.colors);
  paintFlat(ctx, prepared.ground, cam);
  paintSolid(ctx, prepared.faces, prepared.glows, cam);
}

// The land, lighter where the colony is and darker toward the edges.
function drawLand(ctx, rect, colors) {
  ctx.fillStyle = colors.land;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const [cx, cy] = [rect.x + rect.w * 0.55, rect.y + rect.h * 0.45];
  const light = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rect.w, rect.h) * 0.75);
  light.addColorStop(0, rgba('#ffffff', 0.07));
  light.addColorStop(1, rgba('#000000', 0.3));
  ctx.fillStyle = light;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

// Faces lying flat on the ground, in their order: nothing in them passes
// in front of anything else, and sorting a plate the size of the grid
// against a slab on it would put the slab under it.
function paintFlat(ctx, faces, cam) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.9;
  for (const face of faces) {
    ctx.beginPath();
    face.pts.forEach(([x, y, z], i) => {
      const [sx, sy] = project(cam, x, y, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    if (face.edge) {
      ctx.strokeStyle = face.edge;
      ctx.stroke();
    }
  }
}
