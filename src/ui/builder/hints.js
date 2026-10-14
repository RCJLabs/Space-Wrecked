// Text for the builder's status line and layout chip, as { tone, text }.
import { placementError, removeModule } from '../../sim/builder.js';
import { pieceError } from '../../sim/styling.js';

// What the player can do next, on the session's layer: the rooms (the
// plans) or the styling (the hull from outside, M23f). `drag` is the drag
// in progress, if any: { kind: 'part' | 'ghost' | 'placed' | 'pan', type,
// placement, error }.
export function hintFor(session, defs, drag) {
  const styling = session.layer === 'styling';
  const name = (type) => defs.modules.get(type)?.name ?? defs.styling?.get(type)?.name ?? type;
  // Why the placement can't be made: a part or a piece being moved doesn't
  // block itself.
  const errorOf = (placement, uid = null) =>
    styling ? pieceError(session.ship, defs, placement, uid) : placementError(uid === null ? session.ship : removeModule(session.ship, uid), defs, placement);
  if (drag && drag.kind !== 'pan') {
    if (!drag.placement) return { tone: 'info', text: 'Let go off the grid to cancel.' };
    if (drag.error) return { tone: 'bad', text: drag.error };
    const verb = drag.kind === 'placed' ? 'move' : 'place';
    return { tone: 'good', text: `Let go to ${verb} the ${name(drag.type)} here.` };
  }
  if (session.armed) {
    const part = name(session.armed.type);
    if (!session.ghost) return { tone: 'info', text: styling ? `Tap beside the hull where the ${part} goes.` : `Tap the grid where the ${part} goes.` };
    const error = errorOf(session.ghost);
    if (error) return { tone: 'bad', text: error.message };
    return { tone: 'good', text: styling ? `Tap the ${part} again to place it, or Turn it.` : `Tap the ${part} again to place it.` };
  }
  const items = styling ? session.ship.styling ?? [] : session.ship.modules;
  const selected = items.find((m) => m.uid === session.selected);
  if (selected && session.ghost) {
    const error = errorOf(session.ghost, selected.uid);
    if (error) return { tone: 'bad', text: error.message };
    return { tone: 'good', text: `Tap the ${name(selected.type)} again to move it here.` };
  }
  if (selected) return { tone: 'info', text: `${name(selected.type)}: tap where to move it, or Turn or Delete.` };
  if (styling) return { tone: 'info', text: 'Drag a piece beside the hull, or tap one to pick it out. Paint and trim are in the Look tab.' };
  return { tone: 'info', text: 'Drag a part onto the grid, or tap a part and then the grid.' };
}

// The part count and either "Ready to launch" or how many flight checks
// are open with a fix, for the chip on the board: the first that can be
// made with the parts on hand, if any can. Null for an empty hull.
// onHand(type): how many of a part are on hand (endless if not given).
export function flightSummary(ship, defs, lines, onHand = () => Infinity) {
  if (!ship.modules.length) return null;
  const frame = defs.frames.get(ship.frame);
  const count = `${ship.modules.length}/${frame?.maxModules ?? '?'} parts`;
  const open = lines.filter((line) => line.ok !== true);
  if (!open.length) return { tone: 'good', text: `${count} · Ready to launch` };
  const fixes = open.filter((line) => line.fix);
  const fix = fixes.find((line) => !line.add || onHand(line.add) > 0) ?? fixes[0];
  return { tone: 'bad', text: `${count} · ${open.length} to fix: ${fix.fix}` };
}
