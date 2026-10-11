// An offscreen canvas covering a rect of the screen at `ratio` device pixels
// per CSS pixel. Boards draw a frame into one and copy it to the screen, so
// a frame can be reused, drawn at a lower resolution, or kept (space behind
// a battle map). target is { canvas }: the canvas is made on first use and
// resized only when the size changes. paint(g) draws in CSS pixels.
// Returns the canvas.
export function paintLayer(target, rect, ratio, paint) {
  target.canvas ??= document.createElement('canvas');
  const [w, h] = [Math.round(rect.w * ratio), Math.round(rect.h * ratio)];
  if (target.canvas.width !== w || target.canvas.height !== h) {
    target.canvas.width = w;
    target.canvas.height = h;
  }
  const g = target.canvas.getContext('2d', { alpha: false });
  g.setTransform(ratio, 0, 0, ratio, -rect.x * ratio, -rect.y * ratio);
  paint(g);
  return target.canvas;
}
