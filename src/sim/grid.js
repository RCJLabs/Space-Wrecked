// The one grid model: ship layouts now, battle maps and the colony later.
// A grid is plain data, { width, height, cells }, with cells in row-major
// order. Functions never change their input.

export const SIDES = ['n', 'e', 's', 'w'];
export const OPPOSITE = { n: 's', e: 'w', s: 'n', w: 'e' };
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

export function createGrid(width, height, fill = null) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`createGrid: bad size ${width}x${height}`);
  }
  return { width, height, cells: new Array(width * height).fill(fill) };
}

export function inBounds(grid, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

// The value at (x, y), or undefined outside the grid.
export function cellAt(grid, x, y) {
  return inBounds(grid, x, y) ? grid.cells[y * grid.width + x] : undefined;
}

// A copy of the grid with each [x, y] in positions set to value.
export function withCells(grid, positions, value) {
  const cells = grid.cells.slice();
  for (const [x, y] of positions) {
    if (!inBounds(grid, x, y)) throw new RangeError(`withCells: (${x}, ${y}) is outside the grid`);
    cells[y * grid.width + x] = value;
  }
  return { ...grid, cells };
}

// The cell across the given side of (x, y).
export function step(x, y, side) {
  const [dx, dy] = STEP[side];
  return [x + dx, y + dy];
}

// A predicate for "(x, y) is outside": beyond the grid, or an open cell
// joined to the grid's edge through open cells. Open means isOpen(value) is
// true. Enclosed holes are not outside.
export function exteriorOf(grid, isOpen) {
  const { width, height } = grid;
  const outside = new Uint8Array(width * height);
  const queue = [];
  const visit = (x, y) => {
    const i = y * width + x;
    if (!outside[i] && isOpen(grid.cells[i])) {
      outside[i] = 1;
      queue.push(x, y);
    }
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    for (const side of SIDES) {
      const [nx, ny] = step(x, y, side);
      if (inBounds(grid, nx, ny)) visit(nx, ny);
    }
  }
  return (x, y) => !inBounds(grid, x, y) || outside[y * width + x] === 1;
}
