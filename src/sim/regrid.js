// M5b split every builder cell in four: what was one cell is now 2 × 2, one
// per battle tile. A ship laid out before that moves to twice its
// coordinates, shifted to the middle of the 24 × 14 yard (the old 7 × 4
// frame becomes 14 × 8 cells, 5 in from the left and 3 down). Parts keep
// their turn and their place in the build order. Their new footprints fit
// inside the old ones, so nothing overlaps; the smaller parts leave gaps.
// Frozen: save version 2 and blueprint version 1 come forward through this.
// Pure.

export const REGRID = { scale: 2, dx: 5, dy: 3 };

export function regridPlacement(placement) {
  return { ...placement, x: placement.x * REGRID.scale + REGRID.dx, y: placement.y * REGRID.scale + REGRID.dy };
}

export function regridShip(ship) {
  return { ...ship, modules: ship.modules.map(regridPlacement) };
}

// A build command (replay.js): place and move have a position; remove doesn't.
export function regridCommand(command) {
  return command.op === 'remove' ? command : regridPlacement(command);
}
