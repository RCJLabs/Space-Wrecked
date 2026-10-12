// The palette, on the drawer's Parts tab: one tile per module type. Tap a
// tile to pick the part for tap placement, drag it onto the grid to place it
// directly, long-press it for details. If the tiles don't fit, up and down
// scrolls them, and a part has to be dragged out sideways. In construction
// mode only the parts on hand show, each with how many.
import { partIconSvg } from '../../render/parts/blueprint.js';
import { attachGestures } from '../gestures.js';

// The space for an icon on a tile, in CSS px (style.css .bld-part svg).
const ICON_HEIGHT = 21;
const ICON_WIDTH = 52;

// handlers: tap(type), longPress(type), dragStart(type, x, y), dragMove(x, y),
// dragEnd(x, y), dragCancel()
export function createPalette(defs, handlers) {
  const el = document.createElement('div');
  el.className = 'bld-palette';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Parts');
  const tiles = new Map();
  const counts = new Map();
  const empty = document.createElement('p');
  empty.className = 'bld-empty';
  empty.textContent = 'Nothing on hand to fit.';
  empty.hidden = true;
  for (const def of defs.modules.values()) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'bld-part';
    tile.dataset.type = def.id;
    tile.setAttribute('aria-pressed', 'false');
    // Drawn at the size it shows (style.css caps its height), so its lines
    // keep their weight whatever the part's shape.
    const [w, h] = def.size;
    tile.innerHTML = partIconSvg(def, Math.min(ICON_HEIGHT / h, ICON_WIDTH / w));
    const label = document.createElement('span');
    label.textContent = def.name;
    const count = document.createElement('b');
    count.className = 'bld-count';
    count.hidden = true;
    tile.append(label, count);
    el.append(tile);
    tiles.set(def.id, tile);
    counts.set(def.id, count);
  }
  el.append(empty);

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
    // onHand(type): how many of a part there are to fit, or null for
    // endless parts, every one shown.
    setStock(onHand) {
      let shown = 0;
      for (const [type, tile] of tiles) {
        const left = onHand ? onHand(type) : Infinity;
        tile.hidden = left < 1;
        if (!tile.hidden) shown += 1;
        const count = counts.get(type);
        count.hidden = !onHand || left < 1;
        if (!count.hidden) count.textContent = `×${left}`;
        tile.setAttribute('aria-label', onHand && left > 0 ? `${defs.modules.get(type).name}, ${left} on hand` : defs.modules.get(type).name);
      }
      empty.hidden = shown > 0;
    },
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
