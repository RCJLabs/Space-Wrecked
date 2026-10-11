// The drawer on the left of the builder, with two tabs: Parts (the palette)
// and Ship (the flight check, Launch and the totals). The Ship tab carries a
// badge: how many checks are still open, or a tick when the ship can launch.
import { onTap } from '../gestures.js';
import { createPalette } from './palette.js';
import { createShipPanel } from './shipPanel.js';

// palette: the palette's handlers (see palette.js). onLaunch() and
// onFix(type) as in shipPanel.js.
export function createDrawer(defs, { palette: paletteHandlers, onLaunch, onFix }) {
  const el = node('div', 'bld-drawer');
  const tabs = node('div', 'bld-tabs');
  tabs.setAttribute('role', 'tablist');
  const partsTab = tab('Parts');
  const shipTab = tab('Ship');
  const badge = node('span', 'bld-badge');
  shipTab.append(badge);
  tabs.append(partsTab, shipTab);
  const parts = createPalette(defs, paletteHandlers);
  const ship = createShipPanel({ onLaunch, onFix });
  el.append(tabs, parts.el, ship.el);
  const detach = [onTap(partsTab, () => show('parts')), onTap(shipTab, () => show('ship'))];
  show('parts');

  function show(name) {
    parts.el.hidden = name !== 'parts';
    ship.el.hidden = name !== 'ship';
    partsTab.setAttribute('aria-selected', String(name === 'parts'));
    shipTab.setAttribute('aria-selected', String(name === 'ship'));
  }

  return {
    el,
    show,
    setArmed: parts.setArmed,
    update(lines, totals, context) {
      ship.update(lines, totals, context);
      const open = lines.filter((line) => line.ok !== true).length;
      badge.textContent = open ? String(open) : '✓';
      badge.dataset.tone = open ? 'bad' : 'good';
      badge.setAttribute('aria-label', open ? `${open} checks open` : 'ready to launch');
    },
    dispose() {
      for (const off of detach) off();
      parts.dispose();
      ship.dispose();
      el.remove();
    },
  };
}

function tab(label) {
  const button = node('button', 'btn bld-tab');
  button.type = 'button';
  button.setAttribute('role', 'tab');
  button.append(node('span', null, label));
  return button;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
