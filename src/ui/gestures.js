// Touch gestures: tap, long press, one-finger drag and two-finger pinch.
// createRecognizer is plain logic fed with pointer positions and times, so
// its rules can be tested in Node; attachGestures feeds it pointer events
// from an element.
//
// Rules that keep a gesture from being misread:
// - A finger has to move more than SLOP pixels to be a drag. Lifted before
//   that, it is a tap, at the point it first touched.
// - Holding still for LONG_PRESS ms is a long press, and no tap follows it.
// - A second finger turns the gesture into a pinch. A drag in progress is
//   cancelled (so nothing is placed), and no tap follows.
// - After a pinch, nothing happens until every finger is up.
//
// Handlers (all optional): tap(x, y), longPress(x, y), dragStart(x0, y0, x, y)
// (return false to refuse the drag), dragMove(x, y), dragEnd(x, y),
// dragCancel(), pinchStart(p), pinchMove(p), pinchEnd(), where p is the
// fingers' midpoint, spread and twist, { x, y, spread, angle }: angle is the
// direction from the first finger to the second, in radians, growing
// clockwise on screen.
import { cue } from '../platform/audio.js';

export const SLOP = 10;
export const LONG_PRESS = 450;

export function createRecognizer(handlers) {
  const pointers = new Map(); // id -> { x, y, x0, y0, t0 }
  let mode = 'idle'; // idle | pending | drag | held | pinch | spent
  let lead = null; // the finger that started a one-finger gesture
  let pair = null; // the two fingers of a pinch

  const call = (name, ...args) => handlers[name]?.(...args);

  function midpoint() {
    const a = pointers.get(pair[0]);
    const b = pointers.get(pair[1]);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, spread: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function settle() {
    mode = pointers.size ? 'spent' : 'idle';
    lead = null;
    pair = null;
  }

  return {
    get mode() {
      return mode;
    },

    down(id, x, y, t) {
      pointers.set(id, { x, y, x0: x, y0: y, t0: t });
      if (mode === 'idle') {
        mode = 'pending';
        lead = id;
      } else if (mode === 'pending' || mode === 'drag' || mode === 'held') {
        if (mode === 'drag') call('dragCancel');
        mode = 'pinch';
        pair = [lead, id];
        lead = null;
        call('pinchStart', midpoint());
      }
    },

    move(id, x, y) {
      const p = pointers.get(id);
      if (!p) return;
      p.x = x;
      p.y = y;
      if (mode === 'pending' && id === lead) {
        if (Math.hypot(x - p.x0, y - p.y0) <= SLOP) return;
        if (call('dragStart', p.x0, p.y0, x, y) === false) {
          mode = 'spent';
          return;
        }
        mode = 'drag';
        call('dragMove', x, y);
      } else if (mode === 'drag' && id === lead) {
        call('dragMove', x, y);
      } else if (mode === 'pinch' && pair.includes(id)) {
        call('pinchMove', midpoint());
      }
    },

    up(id, x, y) {
      const p = pointers.get(id);
      if (!p) return;
      if (mode === 'pending' && id === lead) {
        pointers.delete(id);
        settle();
        call('tap', p.x0, p.y0);
      } else if (mode === 'drag' && id === lead) {
        pointers.delete(id);
        settle();
        call('dragEnd', x, y);
      } else if (mode === 'pinch' && pair.includes(id)) {
        pointers.delete(id);
        settle();
        call('pinchEnd');
      } else {
        pointers.delete(id);
        if (!pointers.size) settle();
      }
    },

    // The browser or the system took the pointer (a scroll, a system
    // gesture). Whatever was in progress ends without effect.
    cancel(id) {
      if (!pointers.has(id)) return;
      pointers.delete(id);
      if (mode === 'drag' && id === lead) call('dragCancel');
      else if (mode === 'pinch' && pair.includes(id)) call('pinchEnd');
      else if (mode !== 'pending' && mode !== 'held' && pointers.size) return;
      settle();
    },

    // Called by a timer LONG_PRESS ms after a finger goes down.
    hold(t) {
      if (mode !== 'pending') return;
      const p = pointers.get(lead);
      if (t - p.t0 < LONG_PRESS) return;
      mode = 'held';
      call('longPress', p.x0, p.y0);
    },
  };
}

// Calls handler when a button is tapped. Taps are read from pointer events
// rather than click, because Chrome drops the click of a tap that comes
// right after a fast drag (it takes the tap as stopping a fling). Keyboard
// activation still arrives as a click. A tap sounds (M35): its own sound,
// unless what it did makes another (audio.js cue), and a button that
// can't be used now refuses. Returns a function that detaches.
export function onTap(button, handler) {
  const press = () => {
    if (button.disabled) return cue('refuse');
    cue('tap');
    handler();
  };
  const detach = attachGestures(button, { tap: press });
  const onKeyClick = (event) => {
    if (event.detail === 0) press();
  };
  button.addEventListener('click', onKeyClick);
  return () => {
    detach();
    button.removeEventListener('click', onKeyClick);
  };
}

// Feeds pointer events on `element` to a recognizer. Coordinates are client
// (viewport) pixels, the same as the full-screen canvas. Touches that start
// on a child matching the `ignore` selector (its own buttons, say) are left
// to that child. Returns a function that detaches everything.
export function attachGestures(element, handlers, { ignore } = {}) {
  const recognizer = createRecognizer(handlers);
  let timer = 0;

  const onDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (ignore && event.target !== element && event.target.closest?.(ignore)) return;
    element.setPointerCapture?.(event.pointerId);
    recognizer.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
    clearTimeout(timer);
    if (recognizer.mode === 'pending') {
      timer = setTimeout(() => recognizer.hold(performance.now()), LONG_PRESS + 20);
    }
  };
  const onMove = (event) => recognizer.move(event.pointerId, event.clientX, event.clientY);
  const onUp = (event) => {
    clearTimeout(timer);
    recognizer.up(event.pointerId, event.clientX, event.clientY);
  };
  const onCancel = (event) => {
    clearTimeout(timer);
    recognizer.cancel(event.pointerId);
  };
  const noMenu = (event) => event.preventDefault(); // a long press must not open the browser's menu

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onCancel);
  element.addEventListener('contextmenu', noMenu);
  return () => {
    clearTimeout(timer);
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onCancel);
    element.removeEventListener('contextmenu', noMenu);
  };
}
