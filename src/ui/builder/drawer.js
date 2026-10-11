// The drawer on the left of the builder, with three tabs: Parts (the
// palette), Ship (the flight check, Launch and the totals) and Saves (the
// ships kept in slots, codes and the replay). The Ship tab carries a badge:
// how many checks are still open, or a tick when the ship can launch.
import { onTap } from '../gestures.js';
import { createPalette } from './palette.js';
import { createSavesPanel } from './savesPanel.js';
import { createShipPanel } from './shipPanel.js';

// palette: the palette's handlers (see palette.js). onLaunch() and
// onFix(type) as in shipPanel.js; saves: the handlers in savesPanel.js.
export function createDrawer(defs, { palette: paletteHandlers, onLaunch, onFix, saves: savesHandlers }) {
  const el = node('div', 'bld-drawer');
  const tabs = node('div', 'bld-tabs');
  tabs.setAttribute('role', 'tablist');
  const partsTab = tab('Parts');
  const shipTab = tab('Ship');
  const savesTab = tab('Saves');
  const badge = node('span', 'bld-badge');
  shipTab.append(badge);
  tabs.append(partsTab, shipTab, savesTab);
  const parts = createPalette(defs, paletteHandlers);
  const ship = createShipPanel({ onLaunch, onFix });
  const saves = createSavesPanel(savesHandlers);
  el.append(tabs, parts.el, ship.el, saves.el);
  const panels = { parts: [parts.el, partsTab], ship: [ship.el, shipTab], saves: [saves.el, savesTab] };
  const detach = Object.entries(panels).map(([name, [, button]]) => onTap(button, () => show(name)));
  show('parts');

  function show(name) {
    for (const [key, [panel, button]] of Object.entries(panels)) {
      panel.hidden = key !== name;
      button.setAttribute('aria-selected', String(key === name));
    }
  }

  return {
    el,
    show,
    saves,
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
      saves.dispose();
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
