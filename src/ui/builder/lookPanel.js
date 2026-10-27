// The Look tab (M23f, Evan's pick C): how the ship looks from outside, in
// the drawer while the board shows the hull. A picker row (the group, and
// how many styling pieces the ship has of its frame's most) over the
// group's tiles. A styling piece's tile picks it to place on the board
// (tap it, then tap beside the hull), drags onto the board, or shows its
// card on a long press. A paint, a trim or a hull style takes one tap,
// which undo takes back. The picker opens a sheet of the groups: wings,
// gear and sculpt (data/styling.json), then paint, trim and hull. In the
// campaign (M52) a last group, Name: the ship's name, typed and kept with
// Rename, and the emblems she can wear, or none, a tap each. Since M58 the
// paint's pattern, its second color and the engines' glow, a tap each that
// undo takes back, and in the campaign the crew's suits, standard or the
// ship's.
import { emblemSvg } from '../../render/emblems.js';
import { glows, paints, trims } from '../../render/palette.js';
import { pieceIconSvg } from '../../render/pieces.js';
import { attachGestures, onTap } from '../gestures.js';

// The space for an icon on a tile, in CSS px (style.css .bld-look-tile svg).
const ICON_HEIGHT = 21;
const ICON_WIDTH = 52;

// handlers: piece: { tap(type), longPress(type), dragStart(type, x, y),
// dragMove(x, y), dragEnd(x, y), dragCancel() }; onPaint(id), onTrim(id),
// onStyle(id), onPattern(id), onAccent(id), onGlow(id); identity, in the
// campaign only: { rename(name) -> the reason it won't do or null,
// emblem(id or null), suits(id) }.
export function createLookPanel(defs, handlers) {
  const el = node('div', 'bld-look');
  const row = node('div', 'bld-look-row');
  const pick = node('button', 'btn bld-look-pick');
  pick.type = 'button';
  pick.setAttribute('aria-expanded', 'false');
  const pickName = node('span', 'bld-look-name');
  const pickCount = node('small', 'bld-look-count');
  pick.append(pickName, pickCount, node('span', 'bld-look-arrow', '▾'));
  const tally = node('p', 'bld-tally');
  const tallyCount = node('b');
  tally.append(node('small', null, 'Pieces'), tallyCount);
  row.append(pick, tally);

  const pieces = [...defs.styling.values()];
  const groups = [
    ...defs.stylingGroups.map(({ id, name }) => ({ id, name, kind: 'pieces', ids: pieces.filter((p) => p.group === id).map((p) => p.id) })),
    { id: 'paint', name: 'Paint', kind: 'paint', ids: [...defs.paints.keys()] },
    { id: 'trim', name: 'Trim', kind: 'trim', ids: [...defs.trims.keys()] },
    { id: 'hull', name: 'Hull', kind: 'hull', ids: [...defs.hulls.keys()] },
    { id: 'pattern', name: 'Pattern', kind: 'pattern', ids: [...(defs.patterns?.keys() ?? [])] },
    { id: 'accent', name: 'Second color', kind: 'accent', ids: [...defs.paints.keys()] },
    { id: 'glow', name: 'Glow', kind: 'glow', ids: [...(defs.glows?.keys() ?? [])] },
    ...(handlers.identity ? [{ id: 'name', name: 'Name', kind: 'emblem', ids: ['none', ...[...defs.emblems.values()].filter((e) => e.offered).map((e) => e.id)] }, { id: 'suits', name: 'Suits', kind: 'suits', ids: ['standard', 'ship'] }] : []),
  ];

  // The sheet: a tile a group, its look on it and how many it holds.
  const sheet = node('div', 'bld-look-sheet');
  sheet.hidden = true;
  const choices = new Map();
  for (const group of groups) {
    const choice = node('button', 'btn bld-look-group');
    choice.type = 'button';
    choice.dataset.group = group.id;
    choice.innerHTML = groupIcon(defs, group);
    choice.append(node('span', null, group.name), node('small', 'bld-look-group-count', String(group.ids.length)));
    sheet.append(choice);
    choices.set(group.id, choice);
  }

  // The ship's name, over the emblems: typed, then kept with Rename.
  const nameInput = node('input', 'bld-name-input');
  Object.assign(nameInput, { type: 'text', maxLength: 24, autocomplete: 'off', spellcheck: false, enterKeyHint: 'done' });
  nameInput.setAttribute('autocapitalize', 'words');
  nameInput.setAttribute('aria-label', 'Ship name');
  const renameButton = node('button', 'btn bld-rename', 'Rename');
  renameButton.type = 'button';
  const nameWhy = node('p', 'bld-name-why');
  const nameRow = node('div', 'bld-name-row');
  nameRow.append(nameInput, renameButton, nameWhy);

  // A grid of tiles a group, only the picked one showing.
  const grids = new Map();
  const tiles = new Map(); // 'kind:id' -> tile
  for (const group of groups) {
    const grid = node('div', 'bld-look-tiles');
    grid.setAttribute('role', 'toolbar');
    grid.setAttribute('aria-label', group.name);
    for (const id of group.ids) {
      const tile = node('button', group.kind === 'pieces' ? 'bld-look-tile' : 'bld-look-tile bld-swatch');
      tile.type = 'button';
      tile.dataset[group.kind === 'pieces' ? 'type' : group.kind] = id;
      tile.setAttribute('aria-pressed', 'false');
      tile.innerHTML = tileIcon(defs, group.kind, id);
      tile.append(node('span', null, nameOf(defs, group.kind, id)));
      grid.append(tile);
      tiles.set(`${group.kind}:${id}`, tile);
    }
    if (group.kind === 'emblem') grid.prepend(nameRow);
    grid.hidden = true;
    grids.set(group.id, grid);
  }
  el.append(row, sheet, ...grids.values());

  let current = groups[0].id;
  let open = false;
  let ship = null;
  let armed = null;
  let identity = null;

  function render() {
    const group = groups.find((g) => g.id === current);
    pickName.textContent = group.name;
    pickCount.textContent = String(group.ids.length);
    pick.setAttribute('aria-label', `Look: ${group.name}. Pick a group`);
    pick.setAttribute('aria-expanded', String(open));
    sheet.hidden = !open;
    for (const [id, grid] of grids) grid.hidden = open || id !== current;
    for (const [id, choice] of choices) choice.setAttribute('aria-pressed', String(id === current));
    if (ship) {
      const frame = defs.frames.get(ship.frame);
      tallyCount.textContent = `${(ship.styling ?? []).length}/${frame?.maxStyling ?? 0}`;
      tally.setAttribute('aria-label', `${(ship.styling ?? []).length} styling pieces of ${frame?.maxStyling ?? 0}`);
      for (const [key, tile] of tiles) {
        const [kind, id] = key.split(':');
        if (kind === 'pieces') continue;
        if (kind === 'emblem') tile.setAttribute('aria-pressed', String((identity?.emblem ?? 'none') === id));
        else if (kind === 'suits') tile.setAttribute('aria-pressed', String((identity?.suits ?? 'standard') === id));
        else tile.setAttribute('aria-pressed', String((ship[kind] ?? LOOK_DEFAULTS[kind]) === id));
      }
    }
    scrolls();
  }

  // Lets the tiles scroll (touch-action in style.css) only when they don't
  // fit, as on the Parts tab.
  function scrolls() {
    for (const grid of grids.values()) grid.toggleAttribute('data-scrolls', !grid.hidden && grid.scrollHeight > grid.clientHeight + 1);
  }

  const detach = [
    onTap(pick, () => {
      open = !open;
      render();
    }),
    ...[...choices].map(([id, choice]) =>
      onTap(choice, () => {
        current = id;
        open = false;
        render();
      }),
    ),
  ];
  for (const [id, grid] of grids) {
    const group = groups.find((g) => g.id === id);
    const at = (x, y) => document.elementFromPoint(x, y)?.closest?.('.bld-look-tile') ?? null;
    if (group.kind === 'pieces') {
      const typeAt = (x, y) => at(x, y)?.dataset.type ?? null;
      detach.push(
        attachGestures(grid, {
          tap(x, y) {
            const type = typeAt(x, y);
            if (type) handlers.piece.tap(type);
          },
          longPress(x, y) {
            const type = typeAt(x, y);
            if (type) handlers.piece.longPress(type);
          },
          dragStart(x0, y0, x, y) {
            const type = typeAt(x0, y0);
            if (!type || (grid.dataset.scrolls !== undefined && Math.abs(y - y0) > Math.abs(x - x0))) return false;
            handlers.piece.dragStart(type, x, y);
            return true;
          },
          dragMove: handlers.piece.dragMove,
          dragEnd: handlers.piece.dragEnd,
          dragCancel: handlers.piece.dragCancel,
        }),
      );
    } else if (group.kind === 'emblem') {
      for (const tile of grid.querySelectorAll('.bld-look-tile')) detach.push(onTap(tile, () => handlers.identity.emblem(tile.dataset.emblem === 'none' ? null : tile.dataset.emblem)));
    } else if (group.kind === 'suits') {
      for (const tile of grid.children) detach.push(onTap(tile, () => handlers.identity.suits(tile.dataset.suits)));
    } else {
      const act = { paint: handlers.onPaint, trim: handlers.onTrim, hull: handlers.onStyle, pattern: handlers.onPattern, accent: handlers.onAccent, glow: handlers.onGlow }[group.kind];
      for (const tile of grid.children) detach.push(onTap(tile, () => act(tile.dataset[group.kind])));
    }
  }

  if (handlers.identity) {
    const rename = () => {
      nameWhy.textContent = handlers.identity.rename(nameInput.value) ?? '';
      nameInput.blur();
    };
    const onKey = (event) => {
      if (event.key === 'Enter') rename();
    };
    const onInput = () => {
      nameWhy.textContent = '';
    };
    nameInput.addEventListener('keydown', onKey);
    nameInput.addEventListener('input', onInput);
    detach.push(onTap(renameButton, rename), () => {
      nameInput.removeEventListener('keydown', onKey);
      nameInput.removeEventListener('input', onInput);
    });
  }

  const observer = new ResizeObserver(scrolls);
  for (const grid of grids.values()) observer.observe(grid);
  render();

  return {
    el,
    // The ship as it is: its paint, trim and style show pressed, and its
    // pieces' count; in the campaign, her name and emblem (M52).
    update(next, nextIdentity = null) {
      ship = next;
      if (nextIdentity && nextIdentity.name !== identity?.name && document.activeElement !== nameInput) nameInput.value = nextIdentity.name;
      identity = nextIdentity;
      render();
    },
    setArmed(type) {
      if (type === armed) return;
      tiles.get(`pieces:${armed}`)?.setAttribute('aria-pressed', 'false');
      tiles.get(`pieces:${type}`)?.setAttribute('aria-pressed', 'true');
      armed = type;
    },
    dispose() {
      observer.disconnect();
      for (const off of detach) off();
      el.remove();
    },
  };
}

// What a ship has of M58's looks before they are picked (builder.js).
const LOOK_DEFAULTS = { pattern: 'plain', accent: 'bone', glow: 'maker' };

function nameOf(defs, kind, id) {
  if (kind === 'pieces') return defs.styling.get(id).name;
  if (kind === 'emblem') return id === 'none' ? 'None' : defs.emblems.get(id).name;
  if (kind === 'suits') return id === 'ship' ? "The ship's" : 'Standard';
  return { paint: defs.paints, trim: defs.trims, hull: defs.hulls, pattern: defs.patterns, accent: defs.paints, glow: defs.glows }[kind].get(id).name;
}

// What a tile shows: a piece's icon, a paint's or a trim's color, a hull
// style's outline.
function tileIcon(defs, kind, id) {
  if (kind === 'pieces') {
    const def = defs.styling.get(id);
    return pieceIconSvg(def, Math.min(ICON_HEIGHT / def.size[1], ICON_WIDTH / def.size[0]) * 0.9);
  }
  if (kind === 'paint') return `<i class="bld-chip" style="background:${paints[id]?.hull}"></i>`;
  if (kind === 'trim') return `<i class="bld-chip bld-chip-trim" style="background:${trims[id]}"></i>`;
  if (kind === 'emblem') return id === 'none' ? '<i class="bld-chip bld-chip-none"></i>' : emblemSvg(id, 22);
  if (kind === 'accent') return `<i class="bld-chip" style="background:${paints[id]?.hull}"></i>`;
  if (kind === 'glow') return id === 'maker' ? '<i class="bld-chip bld-chip-maker"></i>' : `<i class="bld-chip bld-chip-glow" style="background:${glows[id]};color:${glows[id]}"></i>`;
  if (kind === 'pattern') return patternIcon(id);
  if (kind === 'suits') return `<i class="bld-chip bld-chip-suits" data-suits="${id}"></i>`;
  return hullIcon(defs.hulls.get(id));
}

// A pattern as a little hull, its second color where the pattern puts it
// (render/livery.js PATTERNS), in the panel's own two tones.
function patternIcon(id) {
  const fill = { plain: '', split: '<path d="M24 4h10c6 0 12 4 12 8s-6 8-12 8H24z"/>', band: '<path d="M17 4h14v16H17z"/>', blocks: '<path d="M8 4h8v8H8zM24 4h8v8h-8zM16 12h8v8h-8zM32 12h8v8h-8z"/>' }[id] ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 48 24" width="44" height="22"><defs><clipPath id="pat-${id}"><path d="M6 4h26c8 0 14 4 14 8s-6 8-14 8H6c-2 0-4-2-4-4V8c0-2 2-4 4-4z"/></clipPath></defs><g clip-path="url(#pat-${id})" fill="currentColor" opacity="0.55">${fill}</g><path d="M6 4h26c8 0 14 4 14 8s-6 8-14 8H6c-2 0-4-2-4-4V8c0-2 2-4 4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

// A hull style as a little outline: soft corners and a round nose, or cut
// corners and a blunt one.
function hullIcon(style) {
  const shape = style?.corners === 'round'
    ? 'M6 4h26c8 0 14 4 14 8s-6 8-14 8H6c-2 0-4-2-4-4V8c0-2 2-4 4-4z'
    : 'M6 4h28l8 4v8l-8 4H6l-4-3V7z';
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 48 24" width="44" height="22"><path d="${shape}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

// A group's tile on the sheet: its first piece's icon, or a few of its
// colors, or the hull's outline.
function groupIcon(defs, group) {
  if (group.kind === 'pieces') {
    const def = defs.styling.get(group.ids[0]);
    return def ? pieceIconSvg(def, 18 / def.size[1]) : '';
  }
  if (group.kind === 'hull') return hullIcon(defs.hulls.get(group.ids[0]));
  if (group.kind === 'emblem') return emblemSvg(group.ids[1], 20);
  if (group.kind === 'pattern') return patternIcon('split');
  if (group.kind === 'suits') return '<i class="bld-chip bld-chip-suits" data-suits="ship"></i>';
  if (group.kind === 'glow') return `<span class="bld-chips">${Object.values(glows).map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
  const colors = group.ids.slice(0, 4).map((id) => (group.kind === 'paint' || group.kind === 'accent' ? paints[id]?.hull : trims[id]));
  return `<span class="bld-chips${group.kind === 'trim' ? ' bld-chips-trim' : ''}">${colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
