// A hull frame's footprint: which cells of its width × height grid can hold
// modules. A frame with a shape (rows of '#' for hull and '.' for space) is
// ship-shaped; a frame without one is a full rectangle.

export function inFrame(frame, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= frame.width || y >= frame.height) return false;
  return !frame.shape || frame.shape[y][x] === '#';
}

// Every cell of the footprint as [x, y], row by row.
export function frameCells(frame) {
  const cells = [];
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) if (inFrame(frame, x, y)) cells.push([x, y]);
  }
  return cells;
}
