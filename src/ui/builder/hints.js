// Text for the builder's status line and layout chip, as { tone, text }.
import { placementError, removeModule } from '../../sim/builder.js';

// What the player can do next. `drag` is the drag in progress, if any:
// { kind: 'part' | 'ghost' | 'module' | 'pan', type, placement, error }.
export function hintFor(session, defs, drag) {
  const name = (type) => defs.modules.get(type)?.name ?? type;
  if (drag && drag.kind !== 'pan') {
    if (!drag.placement) return { tone: 'info', text: 'Let go off the grid to cancel.' };
    if (drag.error) return { tone: 'bad', text: drag.error };
    const verb = drag.kind === 'module' ? 'move' : 'place';
    return { tone: 'good', text: `Let go to ${verb} the ${name(drag.type)} here.` };
  }
  if (session.armed) {
    const part = name(session.armed.type);
    if (!session.ghost) return { tone: 'info', text: `Tap the grid where the ${part} goes.` };
    const error = placementError(session.ship, defs, session.ghost);
    if (error) return { tone: 'bad', text: error.message };
    return { tone: 'good', text: `Tap the ${part} again to place it.` };
  }
  const selected = session.ship.modules.find((m) => m.uid === session.selected);
  if (selected && session.ghost) {
    const error = placementError(removeModule(session.ship, selected.uid), defs, session.ghost);
    if (error) return { tone: 'bad', text: error.message };
    return { tone: 'good', text: `Tap the ${name(selected.type)} again to move it here.` };
  }
  if (selected) return { tone: 'info', text: `${name(selected.type)}: tap where to move it, or Turn or Delete.` };
  return { tone: 'info', text: 'Drag a part onto the grid, or tap a part and then the grid.' };
}

// The part count and either "Ready to launch" or how many flight checks
// are open with the first fix, for the chip on the board. Null for an empty
// hull.
export function flightSummary(ship, defs, lines) {
  if (!ship.modules.length) return null;
  const frame = defs.frames.get(ship.frame);
  const count = `${ship.modules.length}/${frame?.maxModules ?? '?'} parts`;
  const open = lines.filter((line) => line.ok !== true);
  if (!open.length) return { tone: 'good', text: `${count} · Ready to launch` };
  return { tone: 'bad', text: `${count} · ${open.length} to fix: ${open.find((line) => line.fix).fix}` };
}
