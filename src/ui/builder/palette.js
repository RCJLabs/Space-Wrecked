// The palette, on the drawer's Parts tab (M23e, Evan's pick B): a row with
// the category picker and the size filter, over the tiles of the parts they
// pick (catalog.js says which). The picker opens a sheet of the categories,
// all of them and each by itself, with how many parts each would show; a
// tap on one picks it and closes the sheet. The size filter goes Any,
// Small, Medium, Large and round again, a tap a step. Tap a part's tile to
// pick the part for tap placement, drag it onto the grid to place it
// directly, long-press it for details. If the tiles don't fit, up and down
// scrolls them, and a part has to be dragged out sideways. In construction
// mode only the parts on hand show, each with how many.
import { partIconSvg } from '../../render/parts/blueprint.js';
import { attachGestures, onTap } from '../gestures.js';
import { ALL, catalogOrder, catalogView, nextSize, SIZES } from './catalog.js';

// The space for an icon on a tile, in CSS px (style.css .bld-part svg).
const ICON_HEIGHT = 21;
const ICON_WIDTH = 52;

// handlers: tap(type), longPress(type), dragStart(type, x, y), dragMove(x, y),
// dragEnd(x, y), dragCancel()
export function createPalette(defs, handlers) {
  const el = node('div', 'bld-parts');
  const row = node('div', 'bld-pick-row');
  const pick = node('button', 'btn bld-pick');
  pick.type = 'button';
  pick.setAttribute('aria-expanded', 'false');
  const pickName = node('span', 'bld-pick-name');
  const pickCount = node('small', 'bld-pick-count');
  pick.append(pickName, pickCount, node('span', 'bld-pick-arrow', '▾'));
  const sizeButton = node('button', 'btn bld-size');
  sizeButton.type = 'button';
  const sizeName = node('b');
  sizeButton.append(node('small', null, 'Size'), sizeName);
  row.append(pick, sizeButton);

  // The sheet of categories: All, then each in data order, its first part's
  // icon on it.
  const sheet = node('div', 'bld-sheet');
  sheet.hidden = true;
  const categories = [{ id: ALL, name: 'All' }, ...defs.categories];
  const choices = new Map();
  for (const { id, name } of categories) {
    const choice = node('button', 'btn bld-cat');
    choice.type = 'button';
    choice.dataset.category = id;
    const first = [...defs.modules.values()].find((def) => def.category === id);
    if (first) choice.innerHTML = partIconSvg(first, Math.min(ICON_HEIGHT / first.size[1], ICON_WIDTH / first.size[0]));
    choice.append(node('span', null, name), node('small', 'bld-cat-count'));
    sheet.append(choice);
    choices.set(id, choice);
  }

  const grid = node('div', 'bld-palette');
  grid.setAttribute('role', 'toolbar');
  grid.setAttribute('aria-label', 'Parts');
  const tiles = new Map();
  const counts = new Map();
  for (const type of catalogOrder(defs)) {
    const def = defs.modules.get(type);
    const tile = node('button', 'bld-part');
    tile.type = 'button';
    tile.dataset.type = def.id;
    tile.setAttribute('aria-pressed', 'false');
    // Drawn at the size it shows (style.css caps its height), so its lines
    // keep their weight whatever the part's shape.
    const [w, h] = def.size;
    tile.innerHTML = partIconSvg(def, Math.min(ICON_HEIGHT / h, ICON_WIDTH / w));
    const count = node('b', 'bld-count');
    count.hidden = true;
    tile.append(node('span', null, def.name), count);
    grid.append(tile);
    tiles.set(def.id, tile);
    counts.set(def.id, count);
  }
  const empty = node('p', 'bld-empty');
  empty.hidden = true;
  grid.append(empty);
  el.append(row, sheet, grid);

  let category = ALL;
  let size = SIZES[0].id;
  let stock = null;
  let open = false;

  function render() {
    const view = catalogView(defs, { category, size, onHand: stock });
    const shown = new Set(view.shown);
    for (const [type, tile] of tiles) {
      tile.hidden = !shown.has(type);
      const left = stock ? stock(type) : Infinity;
      const count = counts.get(type);
      count.hidden = !stock || left < 1;
      if (!count.hidden) count.textContent = `×${left}`;
      tile.setAttribute('aria-label', stock && left > 0 ? `${defs.modules.get(type).name}, ${left} on hand` : defs.modules.get(type).name);
    }
    empty.hidden = !view.empty;
    empty.textContent = view.empty ?? '';
    const name = categories.find((c) => c.id === category).name;
    pickName.textContent = name;
    pickCount.textContent = String(view.counts[category]);
    pick.setAttribute('aria-label', `Parts: ${name}, ${view.counts[category]} shown. Pick a category`);
    sizeName.textContent = SIZES.find((step) => step.id === size).name;
    sizeButton.setAttribute('aria-label', `Size: ${sizeName.textContent}. Tap for the next size`);
    for (const [id, choice] of choices) {
      choice.setAttribute('aria-pressed', String(id === category));
      choice.querySelector('.bld-cat-count').textContent = String(view.counts[id]);
    }
    sheet.hidden = !open;
    grid.hidden = open;
    pick.setAttribute('aria-expanded', String(open));
    scrolls();
  }

  // Lets the browser scroll the tiles (touch-action in style.css) only when
  // they don't fit: checked whenever what shows or the room for it changes.
  function scrolls() {
    grid.toggleAttribute('data-scrolls', !grid.hidden && grid.scrollHeight > grid.clientHeight + 1);
  }

  const detach = [
    onTap(pick, () => {
      open = !open;
      render();
    }),
    onTap(sizeButton, () => {
      size = nextSize(size);
      render();
    }),
    ...[...choices].map(([id, choice]) =>
      onTap(choice, () => {
        category = id;
        open = false;
        render();
      }),
    ),
  ];

  const typeAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.bld-part')?.dataset.type ?? null;
  detach.push(
    attachGestures(grid, {
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
        if (!type || (grid.dataset.scrolls !== undefined && Math.abs(y - y0) > Math.abs(x - x0))) return false;
        handlers.dragStart(type, x, y);
        return true;
      },
      dragMove: handlers.dragMove,
      dragEnd: handlers.dragEnd,
      dragCancel: handlers.dragCancel,
    }),
  );

  const observer = new ResizeObserver(scrolls);
  observer.observe(grid);
  render();

  let armed = null;
  return {
    el,
    // onHand(type): how many of a part there are to fit, or null for
    // endless parts, every one shown.
    setStock(onHand) {
      stock = onHand;
      render();
    },
    setArmed(type) {
      if (type === armed) return;
      tiles.get(armed)?.setAttribute('aria-pressed', 'false');
      tiles.get(type)?.setAttribute('aria-pressed', 'true');
      armed = type;
    },
    dispose() {
      observer.disconnect();
      for (const off of detach) off();
      el.remove();
    },
  };
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
