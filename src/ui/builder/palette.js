// The palette, on the drawer's Parts tab: one tile per module type. Tap a
// tile to pick the part for tap placement, drag it onto the hull to place it
// directly, long-press it for details. If the tiles don't fit, up and down
// scrolls them, and a part has to be dragged out sideways.
import { partIconSvg } from '../../render/parts.js';
import { attachGestures } from '../gestures.js';

// handlers: tap(type), longPress(type), dragStart(type, x, y), dragMove(x, y),
// dragEnd(x, y), dragCancel()
export function createPalette(defs, handlers) {
  const el = document.createElement('div');
  el.className = 'bld-palette';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Parts');
  const tiles = new Map();
  for (const def of defs.modules.values()) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'bld-part';
    tile.dataset.type = def.id;
    tile.setAttribute('aria-pressed', 'false');
    tile.innerHTML = partIconSvg(def);
    const label = document.createElement('span');
    label.textContent = def.name;
    tile.append(label);
    el.append(tile);
    tiles.set(def.id, tile);
  }

  const typeAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.bld-part')?.dataset.type ?? null;

  const detach = attachGestures(el, {
    tap(x, y) {
      const type = typeAt(x, y);
      if (type) handlers.tap(type);
    },
    longPress(x, y) {
      const type = typeAt(x, y);
      if (type) handlers.longPress(type);
    },
    dragStart(x0, y0, x, y) {
      const type = typeAt(x0, y0);
      if (!type || (el.dataset.scrolls !== undefined && Math.abs(y - y0) > Math.abs(x - x0))) return false;
      handlers.dragStart(type, x, y);
      return true;
    },
    dragMove: handlers.dragMove,
    dragEnd: handlers.dragEnd,
    dragCancel: handlers.dragCancel,
  });

  // Lets the browser scroll the drawer (touch-action in style.css) only
  // when it has to.
  const observer = new ResizeObserver(() => {
    el.toggleAttribute('data-scrolls', el.scrollHeight > el.clientHeight + 1);
  });
  observer.observe(el);

  let armed = null;
  return {
    el,
    setArmed(type) {
      if (type === armed) return;
      tiles.get(armed)?.setAttribute('aria-pressed', 'false');
      tiles.get(type)?.setAttribute('aria-pressed', 'true');
      armed = type;
    },
    dispose() {
      observer.disconnect();
      detach();
      el.remove();
    },
  };
}
