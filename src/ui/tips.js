// The first-run tips (tipSteps.js; their words are data/tips.json), one at
// a time: a card beside the control it is about, with that control ringed.
// Got it puts the tip away, and so does using the control. Either way it is
// saved as seen (settings tipsSeen) and never shows again. Settings turns
// tips off, or shows them all again. A tip never covers its control: the
// card sits above it, below it, or beside it, wherever it fits.
import { loadContent } from '../platform/content.js';
import { node, setText } from './fight/panels.js';
import { onTap } from './gestures.js';
import { TIP_STEPS } from './tipSteps.js';

const CHECK_MS = 250; // how often the screen is looked at for a tip
const GAP = 12; // pixels between the card and its control
const EDGE = 8; // pixels the card keeps from the screen's edges

export function startTips(root, store) {
  const ring = node('div', 'tip-ring');
  const card = node('div', 'tip');
  const words = node('p', 'tip-text');
  const ok = node('button', 'btn tip-ok', 'Got it');
  ok.type = 'button';
  card.append(words, ok);
  card.setAttribute('role', 'status');
  ring.hidden = card.hidden = true;
  root.append(ring, card);

  let rules = null;
  let shown = null; // { step, anchor, done }
  loadContent()
    .then((content) => {
      rules = content;
      check();
    })
    .catch(() => {}); // no content, no tips
  onTap(ok, () => shown && putAway(shown.step.id));
  // Using the control a tip is about puts it away too.
  document.addEventListener('pointerdown', (event) => shown?.done?.contains(event.target) && putAway(shown.step.id), true);
  store.subscribe(check);
  setInterval(check, CHECK_MS);

  function check() {
    const state = store.getState();
    const { tips, tipsSeen } = state.settings;
    const at = (s) => (typeof s.at === 'function' ? s.at(state, rules) : s.at);
    const step = rules && tips && state.campaign ? TIP_STEPS.find((s) => s.screen === state.screen && !tipsSeen.includes(s.id) && find(at(s)) && s.when(state, rules, find)) : null;
    if (!step) return hide();
    const anchor = find(at(step));
    if (shown?.step !== step) {
      setText(words, rules.tips.get(step.id)?.text ?? '');
      card.dataset.tip = step.id;
    }
    shown = { step, anchor, done: step.done ? find(step.done) : anchor };
    ring.hidden = card.hidden = false;
    place(anchor.getBoundingClientRect());
  }

  function putAway(id) {
    hide();
    store.dispatch({ type: 'settings/tip/seen', id });
  }

  function hide() {
    shown = null;
    ring.hidden = card.hidden = true;
    delete card.dataset.tip;
  }

  // The ring around the control, and the card where it fits best: above,
  // below, right or left of it, kept on screen. root's box is the screen's
  // safe area, which the coordinates are taken from.
  function place(rect) {
    const area = root.getBoundingClientRect();
    const r = { left: rect.left - area.left, top: rect.top - area.top, right: rect.right - area.left, bottom: rect.bottom - area.top };
    Object.assign(ring.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.right - r.left + 6}px`, height: `${r.bottom - r.top + 6}px` });
    const [w, h] = [card.offsetWidth, card.offsetHeight];
    const centerX = clamp((r.left + r.right) / 2 - w / 2, EDGE, area.width - w - EDGE);
    const centerY = clamp((r.top + r.bottom) / 2 - h / 2, EDGE, area.height - h - EDGE);
    const spots = [
      ['above', centerX, r.top - GAP - h, r.top - GAP - h >= EDGE],
      ['below', centerX, r.bottom + GAP, r.bottom + GAP + h <= area.height - EDGE],
      ['right', r.right + GAP, centerY, r.right + GAP + w <= area.width - EDGE],
      ['left', r.left - GAP - w, centerY, r.left - GAP - w >= EDGE],
    ];
    // A control too big to sit beside (the board) gets the card at its
    // bottom left, inside it.
    const [side, x, y] = spots.find(([, , , fits]) => fits) ?? ['inside', r.left + EDGE, r.bottom - h - EDGE];
    card.dataset.side = side;
    Object.assign(card.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px` });
  }

  // The first element matching selector that is on screen, or null.
  function find(selector) {
    for (const el of document.querySelectorAll(`#screen ${selector}`)) {
      if (el.closest('[hidden]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth) return el;
    }
    return null;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
