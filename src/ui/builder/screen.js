// The builder sandbox: build a ship by touch anywhere on the starter yard,
// and check it against the flight checklist.
// Input -> session action (src/sim/session.js) -> new session -> redraw.
// A drag or pinch in progress is input, so it lives here until it ends in
// an action; the session itself only changes through its store. The ship
// being built is the open one of the game's saved slots (builds.js): every
// change goes to the game store (builds/save) with its build log, which
// saves it.
import { decodeBlueprint, encodeBlueprint } from '../../core/blueprint.js';
import { createStore } from '../../core/store.js';
import { loadContent } from '../../platform/content.js';
import { traceHull } from '../../render/hull.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, project, turnOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { partIconSvg } from '../../render/parts/blueprint.js';
import { hitsGhost, pickModule } from '../../render/pick.js';
import { BOARD_VIEW, boardBox, createBoard, yardBox } from '../../render/shipView.js';
import { layoutProblems, newShip, openings, placementError, removeModule } from '../../sim/builder.js';
import { activeSlot, MAX_SLOTS, nextSlotName } from '../../sim/builds.js';
import { canLaunch, flightChecklist, shipStats } from '../../sim/constraints.js';
import { footprint } from '../../sim/modules.js';
import { logFor, openBuild, replay } from '../../sim/replay.js';
import { createSession, reduceSession, snapPlacement } from '../../sim/session.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { cardFor } from './card.js';
import { createDrawer } from './drawer.js';
import { flightSummary, hintFor } from './hints.js';

const FRAME = 'starter';
const MARGIN = 14; // pixels around the ship when it is fitted
const MAX_ZOOM = 3; // times the fitted scale
const MIN_ZOOM = 0.7; // room to see a turned ship whole (or the whole yard, if that is further out)
const TURN_SLOP = 0.17; // radians of twist before a pinch turns the ship
const KEY_TURN = Math.PI / 12; // Q and E on a keyboard
const NOTICE_MS = 2600;
const SETTLE_MS = 150; // still this long after a camera move, the board sharpens
const REPLAY_MS = 9000; // a replay's steps share this long, each kept to 60-320 ms
const REPLAY_HOLD_MS = 900; // the finished ship stays this long before the replay ends
const TILE_GAP = 6;
const TABS = 56; // the drawer's tab row and the space under it

// The session outlives the screen until the page reloads, so leaving the
// sandbox and coming back keeps the undo history. The ship itself is saved.
let kept = null;

export const builderScreen = {
  // game: the game's store, which holds (and saves) the builder's ships.
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
    let shown = { ship: null, ghost: null, hull: null, saves: null }; // what the board and Saves tab were last given
    let rect = null;
    let yard = null; // the whole frame: how far the camera pans
    let yardFit = null;
    let fit = null; // the view Fit returns to: the ship, refitted as it changes
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
    let replaying = null; // { ships, index, error, timer } while a replay plays
    const cleanups = [];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        frame = defs.frames.get(FRAME);
        plans = createBoard(frame);
        yard = yardBox(frame);
        // With no saved ships yet, start one. Keep this page's session (and
        // its undo history) if it still holds the open ship; otherwise start
        // from the save.
        if (!activeSlot(game.getState().builds)) addSlot(newShip(FRAME), []);
        const opened = openSlot();
        store = createStore((session, action) => reduceSession(session, action, defs), kept?.ship === opened.ship ? kept : createSession(opened.ship, opened.log));
        derived = derive(store.getState().ship);
        store.subscribe(onSession);
        // A ship that arrives from outside (another slot opened, a pasted
        // code, a save imported from the dev menu) replaces the one being
        // built. Only a change to the open slot counts.
        let gameSlot = activeSlot(game.getState().builds);
        cleanups.push(
          game.subscribe((state) => {
            if (!alive) return;
            const slot = activeSlot(state.builds);
            if (slot === gameSlot) return;
            gameSlot = slot;
            if (!slot) {
              addSlot(newShip(FRAME), []);
              return;
            }
            const session = store.getState();
            if (slot.ship === session.ship && slot.log === session.log) return; // our own save
            stopReplay();
            const next = openSlot();
            store.dispatch({ type: 'build/load', ship: next.ship, log: next.log });
            drawer.saves.reset();
            if (rect) refit(true); // another ship, maybe elsewhere in the yard
            sync();
          }),
        );
        drawer = createDrawer(defs, {
          palette: {
            tap: (type) => {
              stopReplay();
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
          saves: {
            onOpen: (index) => game.dispatch({ type: 'builds/open', index }),
            onNew: () => addSlot(newShip(FRAME), []),
            onCopy: () => encodeBlueprint(store.getState().ship),
            onPaste: (text) => {
              const result = decodeBlueprint(text, defs);
              if (!result.ok) return result;
              if (game.getState().builds.slots.length >= MAX_SLOTS) {
                return { ok: false, error: `Delete a ship first: there's room for ${MAX_SLOTS}.` };
              }
              const name = addSlot(result.ship, logFor(result.ship));
              return { ok: true, name };
            },
            onReplay: () => (replaying ? stopReplay() : startReplay()),
            onDelete: () => game.dispatch({ type: 'builds/delete', index: game.getState().builds.active }),
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
          if (stopReplay() || !ready() || look === 'hull') return;
          const point = pointAt(x, y);
          if (point) act({ type: 'build/tap', x: point[0], y: point[1] });
        },
        longPress(x, y) {
          if (!stopReplay() && ready() && look === 'plans') openCardAt(x, y);
        },
        dragStart(x0, y0) {
          if (stopReplay() || !ready()) return false;
          closeCard();
          drag = look === 'hull' ? { kind: 'pan', x: x0, y: y0 } : startBoardDrag(x0, y0);
          return true;
        },
        dragMove: moveDrag,
        dragEnd: endDrag,
        dragCancel: cancelDrag,
        pinchStart(p) {
          if (stopReplay() || !ready()) return;
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
      stopReplay();
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
        if (rect) refit(false);
      }
      if (session.ship !== prev.ship || session.log !== prev.log) {
        game.dispatch({ type: 'builds/save', ship: session.ship, log: session.log });
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
        doors: openings(ship, defs),
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

    // The open slot's ship and a log that replays to it (openBuild repairs a
    // damaged or overlong log). A ship on a frame this build doesn't know
    // can't be drawn; a new one stands in (the saved one stays until the
    // first change).
    function openSlot() {
      const slot = activeSlot(game.getState().builds);
      if (!defs.frames.has(slot.ship.frame)) return { ship: newShip(FRAME), log: [] };
      return openBuild(slot.ship, slot.log, defs);
    }

    // Adds a slot holding ship and log, opens it, and returns its name.
    function addSlot(ship, log) {
      const name = nextSlotName(game.getState().builds);
      game.dispatch({ type: 'builds/add', slot: { name, ship, log } });
      return name;
    }

    // What the Saves tab shows: every slot, and whether the replay runs.
    function savesView() {
      const builds = game.getState().builds;
      const slots = builds.slots.map((slot) => {
        const ship = slot === activeSlot(builds) ? store.getState().ship : slot.ship;
        const known = ship.modules.every((m) => defs.modules.has(m.type)) && defs.frames.has(ship.frame);
        return { name: slot.name, parts: ship.modules.length, ready: known && canLaunch(flightChecklist(ship, defs, crew())) };
      });
      return { slots, active: builds.active, replaying: Boolean(replaying), canReplay: store.getState().log.length > 0 };
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
      // The Saves tab only changes with the slots, the ship or the replay;
      // a drag's many syncs leave it alone.
      const savesKey = [game.getState().builds, session.ship, Boolean(replaying)];
      if (!shown.saves || savesKey.some((v, i) => v !== shown.saves[i])) {
        drawer.saves.update(savesView());
        shown.saves = savesKey;
      }
      if (replaying) {
        setStatus({ tone: 'info', text: `Replaying the build: step ${replaying.index} of ${replaying.ships.length - 1}. Tap the board to stop.` });
        dirty = true;
        return;
      }
      const hint = look === 'hull' ? { tone: 'info', text: 'The ship from outside. Tap Hull to go back to the plans.' } : hintFor(session, defs, drag);
      setStatus(flash && !drag ? flash : hint);
      showOnBoard(session);
      dirty = true;
    }

    // The build replayed on the board, a step at a time, from the empty
    // frame to the ship as it is. It only shows: the session doesn't change.
    function startReplay() {
      const session = store.getState();
      const { ships, error } = replay(session.log, defs, session.ship.frame);
      if (ships.length < 2) return;
      closeCard();
      store.dispatch({ type: 'build/cancel' });
      replaying = { ships, error, index: 0, timer: 0 };
      const stepMs = Math.max(60, Math.min(320, REPLAY_MS / (ships.length - 1)));
      const finish = () => {
        const failed = replaying?.error;
        stopReplay();
        if (failed) setStatus({ tone: 'bad', text: `The replay stops at step ${failed.index + 1}: ${failed.message}` });
      };
      // index is always the step on the board.
      const advance = (step) => {
        if (!replaying) return;
        replaying.index = step;
        showReplayStep();
        sync();
        replaying.timer = step < ships.length - 1 ? setTimeout(() => advance(step + 1), stepMs) : setTimeout(finish, REPLAY_HOLD_MS);
      };
      advance(0);
    }

    // Ends a replay, if one is playing, and shows the ship being built
    // again. True if it was playing.
    function stopReplay() {
      if (!replaying) return false;
      clearTimeout(replaying.timer);
      replaying = null;
      shown = { ship: null, ghost: undefined, hull: null, saves: null };
      sync();
      return true;
    }

    function showReplayStep() {
      const ship = replaying.ships[replaying.index];
      const hull = traceHull(ship, defs);
      plans.setShip({ ship, defs, frame, doors: openings(ship, defs), hull, selected: null, lifted: null, flagged: new Set() });
      plans.setGhost(null);
      if (look === 'hull') plans.setHull({ ship, defs, hull, skin: skinFor('yard') });
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
      if (replaying) showReplayStep(); // a replay carries on in either look
      sync();
    }

    // Gives the board what changed: the ship scene when the ship or what is
    // picked out on it changes, the ghost when the part being placed moves.
    function showOnBoard(session) {
      // A part being moved (dragged, or shown where a tap would put it) is
      // drawn as its dashed outline where it stands.
      const lifted = drag?.kind === 'module' ? drag.uid : session.ghost?.uid ?? null;
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

    // The part being placed or moved: the drag's, or the session's ghost (a
    // part being moved doesn't block itself).
    function ghostOf(session) {
      if (drag && drag.kind !== 'pan') {
        return drag.placement ? { placement: drag.placement, ok: !drag.error, blockers: drag.blockers } : null;
      }
      const { ghost } = session;
      if (!ghost) return null;
      const error = placementError(ghost.uid === undefined ? session.ship : removeModule(session.ship, ghost.uid), defs, ghost);
      return { placement: ghost, ok: !error, blockers: error?.uids ?? [] };
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
      yardFit = fitOrbit({ ...BOARD_VIEW, pivot: middle(yard) }, rect, yard, MARGIN);
      refit(true);
    }

    // Works out the fitted view of the ship as it is now (boardBox), kept
    // inside the yard like any other view, and moves the camera there only
    // if `move`: building never moves the view by itself, but the Fit button
    // shows once the view is off the fit.
    function refit(move) {
      const box = boardBox(frame, derived.hull);
      fit = clampOrbit(fitOrbit({ ...BOARD_VIEW, pivot: middle(box) }, rect, box, MARGIN), rect, yard, MARGIN);
      limits = { min: Math.min(fit.scale * MIN_ZOOM, yardFit.scale), max: fit.scale * MAX_ZOOM };
      setCamera(move || !camera ? fit : camera);
    }

    function setCamera(next) {
      camera = clampOrbit(next, rect, yard, MARGIN);
      const turned = Math.abs(Math.atan2(Math.sin(camera.yaw - fit.yaw), Math.cos(camera.yaw - fit.yaw))) > 0.01;
      // Off the fit if its middle isn't where the fit puts it (the fit's
      // middle moves as the ship grows, not just the camera).
      const [ax, ay] = project(camera, ...fit.pivot, 0);
      const [bx, by] = project(fit, ...fit.pivot, 0);
      const moved = Math.hypot(ax - bx, ay - by) > 2;
      fitButton.hidden = !turned && !moved && Math.abs(camera.scale - fit.scale) <= fit.scale * 0.01;
      dirty = true;
    }

    // Drags

    function startBoardDrag(x0, y0) {
      const session = store.getState();
      const deck = unproject(camera, x0, y0);
      const { ghost } = session;
      if (deck && ghost && hitsGhost(camera, defs, ghost, x0, y0)) {
        const grab = [deck[0] - ghost.x, deck[1] - ghost.y];
        // A part being moved: dragging its ghost moves the part, turned as the ghost is.
        if (ghost.uid !== undefined) return { kind: 'module', uid: ghost.uid, type: ghost.type, rot: ghost.rot, grab, placement: null };
        return { kind: 'ghost', type: ghost.type, rot: ghost.rot, grab, placement: null };
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
      if (ended.kind === 'module') act({ type: 'build/move', uid: ended.uid, x: px, y: py, rot: ended.rot });
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
        if (replaying) clearTimeout(replaying.timer);
        for (const cleanup of cleanups) cleanup();
        el.removeEventListener('pointerdown', closeOnTouch, true);
        el.remove();
      },
    };
  },
};

function middle(box) {
  return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
}

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
