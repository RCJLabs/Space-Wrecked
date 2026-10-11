// The builder sandbox: build a ship on the starter frame by touch, and check
// it against the flight checklist.
// Input -> session action (src/sim/session.js) -> new session -> redraw.
// A drag or pinch in progress is input, so it lives here until it ends in
// an action; the session itself only changes through its store. Every new
// ship goes to the game store (ship/set), which saves it.
import { createStore } from '../../core/store.js';
import { loadContent } from '../../platform/content.js';
import { traceHull } from '../../render/hull.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, turnOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { partIconSvg } from '../../render/parts/blueprint.js';
import { hitsGhost, pickModule } from '../../render/pick.js';
import { BOARD_VIEW, boardBox, createBoard } from '../../render/shipView.js';
import { doorStates, layoutProblems, newShip, placementError, removeModule } from '../../sim/builder.js';
import { canLaunch, flightChecklist, shipStats } from '../../sim/constraints.js';
import { footprint } from '../../sim/modules.js';
import { createSession, reduceSession, snapPlacement } from '../../sim/session.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { cardFor } from './card.js';
import { createDrawer } from './drawer.js';
import { flightSummary, hintFor } from './hints.js';

const FRAME = 'starter';
const MARGIN = 14; // pixels around the frame when it is fitted
const MAX_ZOOM = 3; // times the fitted scale
const MIN_ZOOM = 0.7; // room to see a turned ship whole
const TURN_SLOP = 0.17; // radians of twist before a pinch turns the ship
const KEY_TURN = Math.PI / 12; // Q and E on a keyboard
const NOTICE_MS = 2600;
const SETTLE_MS = 150; // still this long after a camera move, the board sharpens
const TILE_GAP = 6;
const TABS = 56; // the drawer's tab row and the space under it

// The session outlives the screen until the page reloads, so leaving the
// sandbox and coming back keeps the undo history. The ship itself is saved.
let kept = null;

export const builderScreen = {
  // game: the game's store, which holds (and saves) the ship.
  mount(root, { store: game }) {
    const el = node('section', 'builder');
    const board = node('div', 'bld-board');
    const layoutChip = node('p', 'bld-layout');
    const card = node('div', 'bld-card');
    const status = node('p', 'bld-status');
    const fitButton = toolButton('bld-fit', icons.fit, null, 'Reset the view');
    const hullButton = toolButton('bld-hull', icons.hull, 'Hull', 'Show the ship from outside');
    hullButton.setAttribute('aria-pressed', 'false');
    layoutChip.hidden = card.hidden = fitButton.hidden = true;
    board.append(layoutChip, card, status, fitButton, hullButton);
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
    let drawer = null;
    let derived = null; // per ship: { doors, hull, loose, flagged, problems, lines, totals, ready }
    let plans = null; // the 3D board's scenes
    let shown = { ship: null, ghost: null, hull: null }; // what the board was last given
    let rect = null;
    let box = null;
    let fit = null;
    let limits = null;
    let camera = null;
    let drag = null; // { kind: 'part' | 'ghost' | 'module' | 'pan', ... }
    let pinch = null;
    let dirty = true;
    let alive = true;
    let deleteMode = 'delete';
    let look = 'plans'; // the board shows the plans, or the hull from outside
    let flash = null; // a notice shown until NOTICE_MS passes or the session changes
    let flashTimer = 0;
    let settleTimer = 0;
    const cleanups = [];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        frame = defs.frames.get(FRAME);
        plans = createBoard(frame);
        box = boardBox(frame);
        // Keep this page's session (and its undo history) if it still holds
        // the saved ship; otherwise start from the save.
        const saved = usable(game.getState().ship);
        store = createStore((session, action) => reduceSession(session, action, defs), kept?.ship === saved ? kept : createSession(saved));
        derived = derive(store.getState().ship);
        store.subscribe(onSession);
        // A ship that arrives from outside (a save imported from the dev menu)
        // replaces the one being built. Only a change to the saved ship
        // counts, not every change to the game state.
        let gameShip = game.getState().ship;
        cleanups.push(
          game.subscribe((state) => {
            if (!alive || state.ship === gameShip) return;
            gameShip = state.ship;
            if (state.ship !== store.getState().ship) store.dispatch({ type: 'build/load', ship: usable(state.ship) });
          }),
        );
        drawer = createDrawer(defs, {
          palette: {
            tap: (type) => {
              setLook('plans');
              act({ type: 'build/arm', moduleType: type });
            },
            longPress: (type) => openCard(cardFor(defs, defs.modules.get(type)), 'left'),
            dragStart: startPartDrag,
            dragMove: moveDrag,
            dragEnd: endDrag,
            dragCancel: cancelDrag,
          },
          onLaunch: () => act({ type: 'build/launch', crew: crew() }),
          onFix: (type) => {
            drawer.show('parts');
            setLook('plans');
            act({ type: 'build/arm', moduleType: type, toggle: false });
          },
        });
        el.prepend(drawer.el);
        cleanups.push(() => drawer.dispose());
        drawer.update(derived.lines, derived.totals, { crew: crew(), maxModules: frame.maxModules });
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
          if (!ready() || look === 'hull') return;
          const point = pointAt(x, y);
          if (point) act({ type: 'build/tap', x: point[0], y: point[1] });
        },
        longPress(x, y) {
          if (ready() && look === 'plans') openCardAt(x, y);
        },
        dragStart(x0, y0) {
          if (!ready()) return false;
          closeCard();
          drag = look === 'hull' ? { kind: 'pan', x: x0, y: y0 } : startBoardDrag(x0, y0);
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
          if (pinch) setCamera(pinchOrbit(pinch.start, pinch.from, p, limits, TURN_SLOP));
        },
        pinchEnd() {
          pinch = null;
        },
      }, { ignore: 'button, .bld-card' }),
    );
    const onWheel = (event) => {
      event.preventDefault();
      if (ready()) setCamera(zoomOrbit(camera, event.clientX, event.clientY, camera.scale * Math.exp(-event.deltaY * 0.0015), limits));
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
      onTap(hullButton, () => ready() && setLook(look === 'hull' ? 'plans' : 'hull')),
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
      if (!mod && (key === 'q' || key === 'e')) {
        const turn = key === 'q' ? -KEY_TURN : KEY_TURN;
        setCamera(turnOrbit(camera, rect.x + rect.w / 2, rect.y + rect.h / 2, camera.yaw + turn));
        return;
      }
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
      let becameReady = false;
      if (session.ship !== prev.ship) {
        const wasReady = derived.ready;
        derived = derive(session.ship);
        becameReady = derived.ready && !wasReady;
        drawer.update(derived.lines, derived.totals, { crew: crew(), maxModules: frame.maxModules });
        game.dispatch({ type: 'ship/set', ship: session.ship });
      }
      // A new notice shows for a while; any other change replaces it with
      // the hint for what is on screen now.
      clearTimeout(flashTimer);
      flash = null;
      const ready = 'Every flight check passes: ready to launch.';
      if (session.notice && session.notice !== prev.notice) {
        flash = becameReady ? { tone: 'good', text: `${session.notice.text} ${ready}` } : session.notice;
      } else if (becameReady) {
        flash = { tone: 'good', text: ready };
      }
      if (flash) flashTimer = setTimeout(() => ((flash = null), sync()), NOTICE_MS);
      sync();
    }

    function derive(ship) {
      const problems = layoutProblems(ship, defs);
      const loose = problems.find((p) => p.rule === 'connected')?.uids ?? [];
      const lines = flightChecklist(ship, defs, crew());
      return {
        doors: doorStates(ship, defs),
        hull: traceHull(ship, defs),
        loose: new Set(loose),
        flagged: new Set(problems.flatMap((p) => p.uids)),
        problems,
        lines,
        totals: shipStats(ship, defs),
        ready: canLaunch(lines),
      };
    }

    // Until there is a campaign with real crew, the ship carries the starting crew.
    function crew() {
      return defs.balance.startingCrew;
    }

    // A saved ship on a frame this build doesn't know can't be drawn; build a
    // new one instead (the saved one stays until the first change).
    function usable(ship) {
      return ship && defs.frames.has(ship.frame) ? ship : newShip(FRAME);
    }

    // Brings the DOM in line with the session and asks for a redraw.
    function sync() {
      if (!store) return;
      const session = store.getState();
      drawer.setArmed(session.armed?.type ?? null);
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
      const summary = flightSummary(session.ship, defs, derived.lines);
      layoutChip.hidden = !summary;
      if (summary) setText(layoutChip, summary);
      const hint = look === 'hull' ? { tone: 'info', text: 'The ship from outside. Tap Hull to go back to the plans.' } : hintFor(session, defs, drag);
      setStatus(flash && !drag ? flash : hint);
      showOnBoard(session);
      dirty = true;
    }

    // Shows the plans (where the ship is built) or the hull from outside.
    // The hull is only to look at: going there puts down the part in hand
    // and the selection, and picking a part comes back to the plans.
    function setLook(next) {
      if (next === look) return;
      look = next;
      hullButton.setAttribute('aria-pressed', String(look === 'hull'));
      if (look === 'hull') {
        closeCard();
        store.dispatch({ type: 'build/cancel' });
      }
      sync();
    }

    // Gives the board what changed: the ship scene when the ship or what is
    // picked out on it changes, the ghost when the part being placed moves.
    function showOnBoard(session) {
      const lifted = drag?.kind === 'module' ? drag.uid : null;
      const ship = { ship: session.ship, derived, selected: session.selected, lifted };
      const before = shown.ship;
      if (!before || before.ship !== ship.ship || before.derived !== derived || before.selected !== ship.selected || before.lifted !== lifted) {
        plans.setShip({ ship: session.ship, defs, frame, doors: derived.doors, hull: derived.hull, selected: session.selected, lifted, flagged: derived.flagged });
        shown.ship = ship;
      }
      if (look === 'hull' && shown.hull !== session.ship) {
        plans.setHull({ ship: session.ship, defs, hull: derived.hull, skin: skinFor('yard') });
        shown.hull = session.ship;
      }
      const ghost = ghostOf(session);
      const key = ghost && [ghost.placement.type, ghost.placement.x, ghost.placement.y, ghost.placement.rot, ghost.ok, ghost.blockers.join(' ')].join();
      if (key !== shown.ghost || (ghost && before?.ship !== session.ship)) {
        plans.setGhost(ghost && { ship: session.ship, defs, ghost });
        shown.ghost = key;
      }
    }

    // The part being placed: the drag's, or the session's tap-placed ghost.
    function ghostOf(session) {
      if (drag && drag.kind !== 'pan') {
        return drag.placement ? { placement: drag.placement, ok: !drag.error, blockers: drag.blockers } : null;
      }
      if (!session.ghost) return null;
      const error = placementError(session.ship, defs, session.ghost);
      return { placement: session.ghost, ok: !error, blockers: error?.uids ?? [] };
    }

    // The deck point a finger at (x, y) means. A part being placed or a room
    // under the finger counts even where the deck under it is something else
    // (a room's front wall stands over the deck behind it).
    function pointAt(x, y) {
      const session = store.getState();
      const deck = unproject(camera, x, y);
      if (session.ghost && hitsGhost(camera, defs, session.ghost, x, y)) return on(session.ghost, deck);
      const uid = pickModule(camera, defs, session.ship.modules, x, y);
      if (uid !== null) return on(session.ship.modules.find((m) => m.uid === uid), deck);
      return deck;
    }

    // The deck point if it is on the placement, else the placement's middle.
    function on(placement, deck) {
      const [w, h] = footprint(defs.modules.get(placement.type), placement.rot);
      const { x, y } = placement;
      if (deck && deck[0] >= x && deck[1] >= y && deck[0] < x + w && deck[1] < y + h) return deck;
      return [x + w / 2, y + h / 2];
    }

    function setStatus(message) {
      setText(status, message);
    }

    // Camera

    function layout() {
      if (!alive) return;
      const height = el.clientHeight;
      const tile = Math.max(48, Math.min(64, Math.floor((height - TABS - 16 - 3 * TILE_GAP) / 4)));
      el.style.setProperty('--tile', `${tile}px`);
      if (!frame) return;
      const r = board.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      if (rect && r.left === rect.x && r.top === rect.y && r.width === rect.w && r.height === rect.h) return;
      rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      fit = fitOrbit({ ...BOARD_VIEW, pivot: [frame.width / 2, frame.height / 2] }, rect, box, MARGIN);
      limits = { min: fit.scale * MIN_ZOOM, max: fit.scale * MAX_ZOOM };
      setCamera(fit);
    }

    function setCamera(next) {
      camera = clampOrbit(next, rect, box, MARGIN);
      const turned = Math.abs(Math.atan2(Math.sin(camera.yaw - fit.yaw), Math.cos(camera.yaw - fit.yaw))) > 0.01;
      const moved = Math.hypot(camera.x - fit.x, camera.y - fit.y) > 2;
      fitButton.hidden = !turned && !moved && Math.abs(camera.scale - fit.scale) <= fit.scale * 0.01;
      dirty = true;
    }

    // Drags

    function startBoardDrag(x0, y0) {
      const session = store.getState();
      const deck = unproject(camera, x0, y0);
      const { ghost } = session;
      if (deck && ghost && hitsGhost(camera, defs, ghost, x0, y0)) {
        return { kind: 'ghost', type: ghost.type, rot: ghost.rot, grab: [deck[0] - ghost.x, deck[1] - ghost.y], placement: null };
      }
      const module = session.ship.modules.find((m) => m.uid === session.selected);
      if (deck && module && pickModule(camera, defs, [module], x0, y0) !== null) {
        const grab = [deck[0] - module.x, deck[1] - module.y];
        return { kind: 'module', uid: module.uid, type: module.type, rot: module.rot, grab, placement: null };
      }
      return { kind: 'pan', x: x0, y: y0 };
    }

    function startPartDrag(type, x, y) {
      if (!ready()) return;
      closeCard();
      setLook('plans');
      const { armed } = store.getState();
      drag = { kind: 'part', type, rot: armed?.type === type ? armed.rot : 0, grab: null, placement: null };
      dragChip.innerHTML = partIconSvg(defs.modules.get(type), Math.round(camera.scale));
      moveDrag(x, y);
    }

    function moveDrag(x, y) {
      if (!drag) return;
      if (drag.kind === 'pan') {
        setCamera(panOrbit(camera, x - drag.x, y - drag.y));
        drag.x = x;
        drag.y = y;
        return;
      }
      const onBoard = x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
      const deck = onBoard ? unproject(camera, x, y) : null;
      const next = deck ? snapPlacement(defs, frame, drag.type, drag.rot, deck[0], deck[1], drag.grab) : null;
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
      // The card opens on the half of the board away from the finger.
      const side = x < rect.x + rect.w / 2 ? 'right' : 'left';
      if (session.ghost && hitsGhost(camera, defs, session.ghost, x, y)) {
        openCard(cardFor(defs, defs.modules.get(session.ghost.type)), side);
        return;
      }
      const uid = pickModule(camera, defs, session.ship.modules, x, y);
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
        // A frame drawn while the camera moved is a rough one; once it has
        // been still for a moment, the board is drawn again in full.
        if (plans.draw(ctx, camera, rect, look)) {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => (dirty = true), SETTLE_MS);
        }
        ctx.restore();
      },
      unmount() {
        alive = false;
        clearTimeout(flashTimer);
        clearTimeout(settleTimer);
        for (const cleanup of cleanups) cleanup();
        el.removeEventListener('pointerdown', closeOnTouch, true);
        el.remove();
      },
    };
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
