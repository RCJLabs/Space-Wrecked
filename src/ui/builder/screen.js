// The builder sandbox: build a ship on the starter frame by touch.
// Input -> session action (src/sim/session.js) -> new session -> redraw.
// A drag or pinch in progress is input, so it lives here until it ends in
// an action; the session itself only changes through the store.
import { createStore } from '../../core/store.js';
import { loadContent } from '../../platform/content.js';
import { clampCamera, fitCamera, panCamera, pinchCamera, toWorld, zoomCamera } from '../../render/camera.js';
import { palette } from '../../render/palette.js';
import { partIconSvg } from '../../render/parts.js';
import { drawBoard } from '../../render/shipView.js';
import { doorStates, layoutProblems, moduleAt, newShip, placementError, removeModule } from '../../sim/builder.js';
import { covers, createSession, reduceSession, snapPlacement } from '../../sim/session.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { cardFor } from './card.js';
import { hintFor, layoutSummary } from './hints.js';
import { createPalette } from './palette.js';

const FRAME = 'starter';
const MARGIN = 14; // pixels around the frame when it is fitted
const MAX_ZOOM = 3; // times the fitted scale
const NOTICE_MS = 2600;
const TILE_GAP = 6;

// The session outlives the screen until the page reloads, so leaving the
// sandbox and coming back keeps the ship. (Saving ships comes later.)
let kept = null;

export const builderScreen = {
  mount(root) {
    const el = node('section', 'builder');
    const board = node('div', 'bld-board');
    const layoutChip = node('p', 'bld-layout');
    const card = node('div', 'bld-card');
    const status = node('p', 'bld-status');
    const fitButton = toolButton('bld-fit', icons.fit, null, 'Show the whole hull');
    layoutChip.hidden = card.hidden = fitButton.hidden = true;
    board.append(layoutChip, card, status, fitButton);
    const tools = node('div', 'bld-tools');
    const undoButton = toolButton('bld-tool', icons.undo, 'Undo');
    const redoButton = toolButton('bld-tool', icons.redo, 'Redo');
    const turnButton = toolButton('bld-tool', icons.turn, 'Turn');
    const deleteButton = toolButton('bld-tool', icons.remove, 'Delete');
    tools.append(undoButton, redoButton, turnButton, deleteButton);
    const dragChip = node('div', 'bld-drag');
    dragChip.hidden = true;
    el.append(board, tools, dragChip);
    root.append(el);
    setStatus({ tone: 'info', text: 'Loading parts…' });

    let defs = null;
    let frame = null;
    let store = null;
    let parts = null; // the palette drawer
    let derived = null; // per ship: { doors, loose, problems }
    let rect = null;
    let fit = null;
    let limits = null;
    let camera = null;
    let drag = null; // { kind: 'part' | 'ghost' | 'module' | 'pan', ... }
    let pinch = null;
    let dirty = true;
    let alive = true;
    let deleteMode = 'delete';
    let noticeId = kept?.notice?.id ?? 0;
    let noticeUntil = 0;
    let noticeTimer = 0;
    const cleanups = [];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        frame = defs.frames.get(FRAME);
        store = createStore((session, action) => reduceSession(session, action, defs), kept ?? createSession(newShip(FRAME)));
        derived = derive(store.getState().ship);
        store.subscribe(onSession);
        parts = createPalette(defs, {
          tap: (type) => act({ type: 'build/arm', moduleType: type }),
          longPress: (type) => openCard(cardFor(defs, defs.modules.get(type)), 'left'),
          dragStart: startPartDrag,
          dragMove: moveDrag,
          dragEnd: endDrag,
          dragCancel: cancelDrag,
        });
        el.prepend(parts.el);
        cleanups.push(() => parts.dispose());
        layout();
        sync();
      })
      .catch((err) => {
        if (alive) setStatus({ tone: 'bad', text: `Couldn't load the parts list: ${err.message}` });
      });

    // Board input
    cleanups.push(
      attachGestures(board, {
        tap(x, y) {
          if (!ready()) return;
          const [wx, wy] = toWorld(camera, x, y);
          act({ type: 'build/tap', x: wx, y: wy });
        },
        longPress(x, y) {
          if (ready()) openCardAt(x, y);
        },
        dragStart(x0, y0) {
          if (!ready()) return false;
          closeCard();
          drag = startBoardDrag(x0, y0);
          return true;
        },
        dragMove: moveDrag,
        dragEnd: endDrag,
        dragCancel: cancelDrag,
        pinchStart(p) {
          if (!ready()) return;
          closeCard();
          pinch = { start: camera, from: p };
        },
        pinchMove(p) {
          if (pinch) setCamera(pinchCamera(pinch.start, pinch.from, p, limits));
        },
        pinchEnd() {
          pinch = null;
        },
      }, { ignore: 'button, .bld-card' }),
    );
    const onWheel = (event) => {
      event.preventDefault();
      if (ready()) setCamera(zoomCamera(camera, event.clientX, event.clientY, camera.scale * Math.exp(-event.deltaY * 0.0015), limits));
    };
    board.addEventListener('wheel', onWheel, { passive: false });
    cleanups.push(() => board.removeEventListener('wheel', onWheel));

    // Buttons
    cleanups.push(
      onTap(undoButton, () => act({ type: 'build/undo' })),
      onTap(redoButton, () => act({ type: 'build/redo' })),
      onTap(turnButton, () => act({ type: 'build/rotate' })),
      onTap(deleteButton, () => act({ type: deleteMode === 'done' ? 'build/cancel' : 'build/delete' })),
      onTap(fitButton, () => ready() && setCamera(fit)),
    );
    // The next touch anywhere closes the card, and still does its own job.
    // (Not a click: lifting the finger after the long press must not.)
    const closeOnTouch = () => closeCard();
    el.addEventListener('pointerdown', closeOnTouch, true);

    // Keys, for testing on a desktop.
    const onKey = (event) => {
      if (!ready() || event.target.closest?.('textarea, input')) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const action =
        mod && key === 'z' ? (event.shiftKey ? 'build/redo' : 'build/undo')
        : mod && key === 'y' ? 'build/redo'
        : !mod && key === 'r' ? 'build/rotate'
        : !mod && (key === 'delete' || key === 'backspace') ? 'build/delete'
        : !mod && key === 'escape' ? 'build/cancel'
        : null;
      if (!action) return;
      event.preventDefault();
      act({ type: action });
    };
    addEventListener('keydown', onKey);
    cleanups.push(() => removeEventListener('keydown', onKey));

    const observer = new ResizeObserver(() => layout());
    observer.observe(board);
    cleanups.push(() => observer.disconnect());

    function ready() {
      return Boolean(store && camera);
    }

    function act(action) {
      closeCard();
      store?.dispatch(action);
    }

    function onSession(session, prev) {
      kept = session;
      if (session.ship !== prev.ship) derived = derive(session.ship);
      // A new notice shows for a while; any other change replaces it with
      // the hint for what is on screen now.
      clearTimeout(noticeTimer);
      if (session.notice && session.notice.id !== noticeId) {
        noticeId = session.notice.id;
        noticeUntil = performance.now() + NOTICE_MS;
        noticeTimer = setTimeout(sync, NOTICE_MS + 20);
      } else {
        noticeUntil = 0;
      }
      sync();
    }

    function derive(ship) {
      const problems = layoutProblems(ship, defs);
      const loose = problems.find((p) => p.rule === 'connected')?.uids ?? [];
      return { doors: doorStates(ship, defs), loose: new Set(loose), problems };
    }

    // Brings the DOM in line with the session and asks for a redraw.
    function sync() {
      if (!store) return;
      const session = store.getState();
      parts.setArmed(session.armed?.type ?? null);
      undoButton.disabled = !session.past.length;
      redoButton.disabled = !session.future.length;
      const target = session.armed?.type ?? session.ship.modules.find((m) => m.uid === session.selected)?.type;
      turnButton.disabled = !target || !defs.modules.get(target).rotates;
      const mode = session.armed ? 'done' : 'delete';
      if (mode !== deleteMode) {
        deleteMode = mode;
        setToolFace(deleteButton, mode === 'done' ? icons.done : icons.remove, mode === 'done' ? 'Done' : 'Delete');
      }
      deleteButton.disabled = mode === 'delete' && session.selected === null;
      const summary = layoutSummary(session.ship, defs, derived.problems);
      layoutChip.hidden = !summary;
      if (summary) setText(layoutChip, summary);
      const showNotice = session.notice && !drag && performance.now() < noticeUntil;
      setStatus(showNotice ? session.notice : hintFor(session, defs, drag));
      dirty = true;
    }

    function setStatus(message) {
      setText(status, message);
    }

    // Camera

    function layout() {
      if (!alive) return;
      const height = el.clientHeight;
      const tile = Math.max(48, Math.min(64, Math.floor((height - 16 - 3 * TILE_GAP) / 4)));
      el.style.setProperty('--tile', `${tile}px`);
      if (!frame) return;
      const r = board.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      if (rect && r.left === rect.x && r.top === rect.y && r.width === rect.w && r.height === rect.h) return;
      rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      fit = fitCamera(rect, frame.width, frame.height, MARGIN);
      limits = { min: fit.scale, max: fit.scale * MAX_ZOOM };
      setCamera(fit);
    }

    function setCamera(next) {
      camera = clampCamera(next, rect, frame.width, frame.height, MARGIN);
      fitButton.hidden = camera.scale <= fit.scale * 1.01;
      dirty = true;
    }

    // Drags

    function startBoardDrag(x0, y0) {
      const session = store.getState();
      const [wx, wy] = toWorld(camera, x0, y0);
      const cx = Math.floor(wx);
      const cy = Math.floor(wy);
      const { ghost } = session;
      if (ghost && covers(defs, ghost, cx, cy)) {
        return { kind: 'ghost', type: ghost.type, rot: ghost.rot, grab: [wx - ghost.x, wy - ghost.y], placement: null };
      }
      const module = session.ship.modules.find((m) => m.uid === session.selected);
      if (module && covers(defs, module, cx, cy)) {
        const grab = [wx - module.x, wy - module.y];
        return { kind: 'module', uid: module.uid, type: module.type, rot: module.rot, grab, placement: null };
      }
      return { kind: 'pan', x: x0, y: y0 };
    }

    function startPartDrag(type, x, y) {
      if (!ready()) return;
      closeCard();
      const { armed } = store.getState();
      drag = { kind: 'part', type, rot: armed?.type === type ? armed.rot : 0, grab: null, placement: null };
      dragChip.innerHTML = partIconSvg(defs.modules.get(type), 24);
      moveDrag(x, y);
    }

    function moveDrag(x, y) {
      if (!drag) return;
      if (drag.kind === 'pan') {
        setCamera(panCamera(camera, x - drag.x, y - drag.y));
        drag.x = x;
        drag.y = y;
        return;
      }
      const [wx, wy] = toWorld(camera, x, y);
      const onBoard = x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
      const next = onBoard ? snapPlacement(defs, frame, drag.type, drag.rot, wx, wy, drag.grab) : null;
      const prev = drag.placement;
      // Check and redraw only when the snapped spot changes.
      if (!drag.checked || (next === null) !== (prev === null) || (next && (next.x !== prev.x || next.y !== prev.y))) {
        drag.checked = true;
        drag.placement = next;
        const ship = store.getState().ship;
        const error = next && placementError(drag.kind === 'module' ? removeModule(ship, drag.uid) : ship, defs, next);
        drag.error = error?.message ?? null;
        drag.blockers = error?.uids ?? [];
        sync();
      }
      dragChip.hidden = drag.kind !== 'part' || Boolean(drag.placement);
      if (!dragChip.hidden) dragChip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }

    function endDrag(x, y) {
      if (!drag) return;
      moveDrag(x, y);
      const ended = drag;
      drag = null;
      dragChip.hidden = true;
      sync();
      if (ended.kind === 'pan' || !ended.placement) return;
      const { x: px, y: py } = ended.placement;
      if (ended.kind === 'module') act({ type: 'build/move', uid: ended.uid, x: px, y: py });
      else act({ type: 'build/drop', placement: ended.placement });
    }

    function cancelDrag() {
      if (!drag) return;
      drag = null;
      dragChip.hidden = true;
      sync();
    }

    // Details card

    function openCardAt(x, y) {
      const session = store.getState();
      const [wx, wy] = toWorld(camera, x, y);
      const cx = Math.floor(wx);
      const cy = Math.floor(wy);
      // The card opens on the half of the board away from the finger.
      const side = x < rect.x + rect.w / 2 ? 'right' : 'left';
      if (session.ghost && covers(defs, session.ghost, cx, cy)) {
        openCard(cardFor(defs, defs.modules.get(session.ghost.type)), side);
        return;
      }
      const uid = moduleAt(session.ship, defs, cx, cy);
      const module = session.ship.modules.find((m) => m.uid === uid);
      if (!module) return;
      const noBridge = derived.problems.some((p) => p.rule === 'bridge');
      const joined = noBridge ? null : !derived.loose.has(uid);
      openCard(cardFor(defs, defs.modules.get(module.type), { module, joined }), side);
    }

    function openCard({ title, lines }, side) {
      card.replaceChildren(node('h3', null, title), ...lines.map((line) => node('p', null, line)));
      card.dataset.side = side;
      card.hidden = false;
    }

    function closeCard() {
      card.hidden = true;
    }

    return {
      resize() {
        layout();
        dirty = true;
      },
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        if (!ready()) return;
        // Zoomed in, the ship would run under the drawer and the tools.
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        drawBoard(ctx, scene(store.getState()));
        ctx.restore();
      },
      unmount() {
        alive = false;
        clearTimeout(noticeTimer);
        for (const cleanup of cleanups) cleanup();
        el.removeEventListener('pointerdown', closeOnTouch, true);
        el.remove();
      },
    };

    function scene(session) {
      let ghost = null;
      if (drag && drag.kind !== 'pan') {
        if (drag.placement) ghost = { placement: drag.placement, ok: !drag.error, blockers: drag.blockers };
      } else if (session.ghost) {
        const error = placementError(session.ship, defs, session.ghost);
        ghost = { placement: session.ghost, ok: !error, blockers: error?.uids ?? [] };
      }
      return {
        camera,
        frame,
        defs,
        ship: session.ship,
        doors: derived.doors,
        loose: derived.loose,
        selected: session.selected,
        lifted: drag?.kind === 'module' ? drag.uid : null,
        ghost,
      };
    }
  },
};

// Writes { tone, text } into a line only when it changed, so a drag doesn't
// restyle the page on every move.
function setText(el, { tone, text }) {
  if (el.textContent !== text) el.textContent = text;
  if (el.dataset.tone !== tone) el.dataset.tone = tone;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function toolButton(className, icon, label, title = label) {
  const button = node('button', `btn ${className}`);
  button.type = 'button';
  button.setAttribute('aria-label', title);
  setToolFace(button, icon, label);
  return button;
}

function setToolFace(button, icon, label) {
  button.innerHTML = icon;
  if (label) {
    button.append(node('span', null, label));
    button.setAttribute('aria-label', label);
  }
}
