// The drawer on the left of the builder, with up to three tabs. The first
// is Parts (the palette) while the board shows the plans, and Look (the
// styling pieces, paint, trim and the hull's style, M23f) while it shows the
// hull from outside. Then Ship (the flight check, Launch and the totals) and
// Saves (the ships kept in slots, codes and the replay). The Ship tab
// carries a badge: how many checks are still open, or a tick when the ship
// can launch. In construction mode there is no Saves tab: the way back to
// the hangar takes its place.
import { onTap } from '../gestures.js';
import { createLookPanel } from './lookPanel.js';
import { createPalette } from './palette.js';
import { createSavesPanel } from './savesPanel.js';
import { createShipPanel } from './shipPanel.js';

// palette: the palette's handlers (see palette.js); look: the Look tab's
// (lookPanel.js). onLaunch() (or null: no Launch) and onFix(type) as in
// shipPanel.js; saves: the handlers in savesPanel.js, or null for no Saves
// tab; leave: null, or { icon, label, onTap }, a button at the end of the
// tabs.
export function createDrawer(defs, { palette: paletteHandlers, look: lookHandlers, onLaunch, onFix, saves: savesHandlers, leave }) {
  const el = node('div', 'bld-drawer');
  const tabs = node('div', 'bld-tabs');
  tabs.setAttribute('role', 'tablist');
  const firstTab = tab('Parts');
  const shipTab = tab('Ship');
  const badge = node('span', 'bld-badge');
  shipTab.append(badge);
  tabs.append(firstTab, shipTab);
  const parts = createPalette(defs, paletteHandlers);
  const look = createLookPanel(defs, lookHandlers);
  const ship = createShipPanel({ onLaunch, onFix });
  el.append(tabs, parts.el, look.el, ship.el);
  const panels = { parts: [parts.el, firstTab], ship: [ship.el, shipTab] };
  const saves = savesHandlers ? createSavesPanel(savesHandlers) : null;
  if (saves) {
    const savesTab = tab('Saves');
    tabs.append(savesTab);
    el.append(saves.el);
    panels.saves = [saves.el, savesTab];
  }
  const detach = Object.entries(panels).map(([name, [, button]]) => onTap(button, () => show(name)));
  if (leave) {
    const button = node('button', 'btn bld-leave');
    button.type = 'button';
    button.innerHTML = leave.icon;
    button.append(node('span', null, leave.label));
    button.setAttribute('aria-label', leave.label);
    tabs.append(button);
    detach.push(onTap(button, leave.onTap));
  }
  let mode = 'plans';
  let showing = 'parts';
  show('parts');

  function show(name) {
    showing = name;
    for (const [key, [panel, button]] of Object.entries(panels)) {
      panel.hidden = key !== name || (key === 'parts' && mode === 'hull');
      button.setAttribute('aria-selected', String(key === name));
    }
    look.el.hidden = name !== 'parts' || mode !== 'hull';
  }

  return {
    el,
    show,
    saves,
    // The board's look: the plans give the first tab to Parts, the hull to
    // Look.
    setMode(next) {
      if (next === mode) return;
      mode = next;
      firstTab.querySelector('span').textContent = mode === 'hull' ? 'Look' : 'Parts';
      show(showing);
    },
    setArmed(type) {
      parts.setArmed(defs.modules.has(type) ? type : null);
      look.setArmed(defs.styling.has(type) ? type : null);
    },
    setStock: parts.setStock,
    update(lines, totals, context) {
      ship.update(lines, totals, context);
      look.update(context.ship);
      const open = lines.filter((line) => line.ok !== true).length;
      badge.textContent = open ? String(open) : '✓';
      badge.dataset.tone = open ? 'bad' : 'good';
      badge.setAttribute('aria-label', open ? `${open} checks open` : 'ready to launch');
    },
    dispose() {
      for (const off of detach) off();
      parts.dispose();
      look.dispose();
      ship.dispose();
      saves?.dispose();
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
