// The Fight screen's side panels: the crew down the left, a button each
// with End turn under them, and down the right the tools (Title, Log, Fit)
// at the top and the selected unit's orders at the bottom (Skip in their
// place while a turn plays out). Buttons are 48 px or more, and none sit
// over the board, where Chrome would take a tap on a tile beside one for
// the button. The orders stack from the bottom: Shoot, Overwatch and
// Reload always in the same place, and the orders that come and go over
// them. On a screen too short for it all, the orders stay in sight and the
// tools scroll away; too short for the orders alone, what scrolls away is
// Reload, not a job's Grab or Hack.
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { stateText } from './hints.js';

// onSelect(id), onEnd()
export function createCrewBar({ onSelect, onEnd }) {
  const el = node('div', 'fgt-crew');
  const list = node('div', 'fgt-units');
  const end = toolButton('fgt-end', icons.endTurn, 'End turn');
  el.append(list, end);
  const cleanups = [onTap(end, onEnd)];
  let rows = new Map(); // id -> { button, fill, state }
  return {
    el,
    // units: the crew as the board shows them; colors: Map id -> trim;
    // selected: the id giving orders.
    update(units, colors, selected) {
      if (units.map((u) => u.id).join() !== [...rows.keys()].join()) build(units, colors);
      for (const unit of units) {
        const row = rows.get(unit.id);
        row.button.setAttribute('aria-pressed', String(unit.id === selected));
        row.button.dataset.state = unit.status;
        row.fill.style.width = `${(100 * unit.hp) / unit.maxHp}%`;
        setText(row.state, stateText(unit));
      }
    },
    // 'ready', 'armed' (tap again to end) or 'off'.
    setEnd(state) {
      end.disabled = state === 'off';
      end.dataset.state = state;
      setText(end.querySelector('span'), state === 'armed' ? 'End turn?' : 'End turn');
    },
    dispose() {
      for (const cleanup of cleanups) cleanup();
    },
  };

  function build(units, colors) {
    for (const row of rows.values()) row.detach();
    rows = new Map();
    list.replaceChildren();
    for (const unit of units) {
      const button = node('button', 'btn fgt-unit');
      button.type = 'button';
      button.style.setProperty('--trim', colors.get(unit.id));
      const bar = node('span', 'fgt-hp');
      const fill = node('span');
      bar.append(fill);
      const state = node('span', 'fgt-state');
      button.append(node('span', 'fgt-name', unit.name), bar, state);
      button.setAttribute('aria-label', `${unit.name} ${unit.id}`);
      list.append(button);
      rows.set(unit.id, { button, fill, state, detach: onTap(button, () => onSelect(unit.id)) });
    }
  }
}

// handlers: { shoot, overwatch, reload, stabilize, open, grab, hack, skip }.
// Stabilize, Open door, Grab and Hack show only when there is someone,
// a door, a crate or the terminal to do it to. tools: the buttons for the
// top of the column, made and wired by the caller.
export function createActionBar(handlers, tools = []) {
  const el = node('div', 'fgt-actions');
  const top = node('div', 'fgt-tools');
  top.append(...tools);
  const buttons = {
    grab: toolButton('fgt-act fgt-job', icons.grab, 'Grab'),
    hack: toolButton('fgt-act fgt-job', icons.hack, 'Hack'),
    stabilize: toolButton('fgt-act', icons.stabilize, 'Stabilize'),
    open: toolButton('fgt-act', icons.door, 'Open door'),
    shoot: toolButton('fgt-act', icons.shoot, 'Shoot'),
    overwatch: toolButton('fgt-act', icons.overwatch, 'Overwatch'),
    reload: toolButton('fgt-act', icons.reload, 'Reload'),
    skip: toolButton('fgt-act fgt-skip', icons.skip, 'Skip'),
  };
  el.append(top, ...Object.values(buttons));
  const cleanups = Object.entries(buttons).map(([name, button]) => onTap(button, () => handlers[name]()));
  // The column scrolls into place when the orders shown change or its size
  // does, never while the player is scrolling it. An edge with more past
  // it fades (data-more).
  let shown = '';
  const sized = new ResizeObserver(anchor);
  sized.observe(el);
  el.addEventListener('scroll', edges, { passive: true });
  cleanups.push(() => el.removeEventListener('scroll', edges));
  return {
    el,
    // orders: fight.js ordersFor (null when no one can act); playing: a
    // turn is playing out.
    update(orders, playing) {
      buttons.skip.hidden = !playing;
      for (const name of ['shoot', 'overwatch', 'reload']) buttons[name].hidden = playing;
      buttons.shoot.disabled = !orders?.targets.length;
      buttons.overwatch.disabled = !orders?.overwatch;
      buttons.reload.disabled = !orders?.reload;
      buttons.stabilize.hidden = playing || !orders?.stabilize;
      buttons.open.hidden = playing || !orders?.door;
      buttons.grab.hidden = playing || !orders?.grab;
      buttons.hack.hidden = playing || !orders?.hack;
      const now = Object.values(buttons).map((button) => (button.hidden ? '-' : '+')).join('');
      if (now !== shown) {
        shown = now;
        anchor();
      }
    },
    dispose() {
      sized.disconnect();
      for (const cleanup of cleanups) cleanup();
    },
  };

  // A column too short for everything shows all the orders and as much of
  // the tools above them as fits; one too short for the orders alone shows
  // them from the top.
  function anchor() {
    const showing = Object.values(buttons).filter((button) => !button.hidden);
    if (showing.length && el.scrollHeight > el.clientHeight) {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const top = showing[0].getBoundingClientRect().top - box.top + el.scrollTop - parseFloat(style.paddingTop);
      const bottom = showing.at(-1).getBoundingClientRect().bottom - box.top + el.scrollTop + parseFloat(style.paddingBottom);
      el.scrollTop = bottom - top <= el.clientHeight ? bottom - el.clientHeight : top;
    }
    edges();
  }

  function edges() {
    const more = [];
    if (el.scrollTop > 1) more.push('above');
    if (el.scrollTop < el.scrollHeight - el.clientHeight - 1) more.push('below');
    el.dataset.more = more.join(' ');
  }
}

export function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function toolButton(className, icon, label) {
  const button = node('button', `btn ${className}`);
  button.type = 'button';
  button.innerHTML = icon;
  button.append(node('span', null, label));
  button.setAttribute('aria-label', label);
  return button;
}

// Writes text into an element only when it changed.
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
