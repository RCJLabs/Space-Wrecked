// The builder: build a ship by touch anywhere on its hull frame's yard (the
// starter hull's, or since M39 another bought at a shipyard), and check it
// against the flight checklist. Which ship it builds, and where its
// changes go, is the source's business: the Builder sandbox (screen.js)
// builds the open one of the builder's slots, construction mode
// (../campaign/construction.js) the campaign's ship with the parts on hand.
// Input -> session action (src/sim/session.js) -> new session -> redraw.
// A drag or pinch in progress is input, so it lives here until it ends in
// an action; the session itself only changes through its store.
//
// The board shows the plans, where the rooms go, or the hull from outside,
// where it is styled (M23f's Look): the session's layer, rooms or styling.
// The Hull button and the drawer's Look tab change it.
import { createStore } from '../../core/store.js';
import { cue } from '../../platform/audio.js';
import { loadContent } from '../../platform/content.js';
import { HULL } from '../../render/exterior.js';
import { traceHull } from '../../render/hull.js';
import { lookOverlay, pieceBox } from '../../render/lookOverlay.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, project, turnOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { partIconSvg } from '../../render/parts/blueprint.js';
import { hitsGhost, pickBox, pickModule } from '../../render/pick.js';
import { pieceIconSvg } from '../../render/pieces.js';
import { BOARD_VIEW, boardBox, createBoard, yardBox } from '../../render/shipView.js';
import { applyCommand, layoutProblems, openings, placementError, removeModule } from '../../sim/builder.js';
import { canLaunch, flightChecklist, shipStats } from '../../sim/constraints.js';
import { baseOf, countOfAny, versionAtHand, versionsOf } from '../../sim/makers.js';
import { replay } from '../../sim/replay.js';
import { createSession, partsLeft, reduceSession, sizeOf, snapPiece, snapPlacement, tapOnGhost } from '../../sim/session.js';
import { hullSite, pieceError } from '../../sim/styling.js';
import { confirms, holdMode } from '../confirm.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { builderSounds } from '../sounds.js';
import { cardFor, pieceCard } from './card.js';
import { createDrawer } from './drawer.js';
import { flightSummary, hintFor } from './hints.js';
import { liveStatus, surface } from '../a11y.js';

export const FRAME = 'starter';
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
const PICK = 56; // the Parts tab's picker row and the space over it

// Mounts the builder in root and returns the screen's handle (resize, draw,
// unmount, frameStats). source:
//   open(defs)          once the content has loaded, what to build:
//                       { ship, log, stock, wrecked, rearrange? } (stock
//                       as in session.js, or null for endless parts;
//                       wrecked, the uids of parts that can't come off, as
//                       there; rearrange, true between jumps, M46), or
//                       { session } to pick up a session from an earlier
//                       visit; null if there is nothing to build. Either
//                       may carry pick: a part to arm, its ghost at the
//                       suggested spot (M44)
//   onSession(session, prev)   after every change to the session
//   crew()              the crew the flight checklist counts
//   liftOff()           optional: the thrust for each unit of mass lifting
//                       off takes (a campaign's act on a planet), or null
//   launch              true if the Ship tab has Launch, or what to do
//                       once the session clears it (construction mode in
//                       act 1, M44: the campaign launches)
//   ready               optional: what the hint says once every flight
//                       check passes, for a builder without Launch
//   cleared             optional: what the chip on the board says then
//                       ("Ready to launch" without it)
//   leave               null, or { icon, label, onTap }: the way out, at
//                       the end of the drawer's tabs
//   slots(api)          null, or the Saves tab: { handlers (savesPanel.js,
//                       but onReplay), view(), key() }. view() is what the
//                       tab shows, and it is shown again whenever key()
//                       changes. api: { session(), load(ship, log),
//                       replaying() }
//   watch(api)          null, or a subscription to ships that arrive from
//                       outside, returning its cleanup
export function mountBuilder(root, source) {
  const el = node('section', 'builder');
  el.setAttribute('aria-label', 'Builder');
  const board = surface(node('div', 'bld-board'), 'The ship, on the builder\'s grid: tap a cell to show the part there, tap again to put it down; drag to look around');
  const layoutChip = node('p', 'bld-layout');
  const card = node('div', 'bld-card');
  const status = liveStatus(node('p', 'bld-status'));
  const fitButton = toolButton('bld-fit', icons.fit, null, 'Reset the view');
  const hullButton = toolButton('bld-hull', icons.hull, 'Hull', 'Show the ship from outside');
  hullButton.setAttribute('aria-pressed', 'false');
  // Suggest (M44): with a part armed, its ghost where it fits best.
  const suggestButton = toolButton('bld-suggest', icons.build, 'Suggest', 'Show where the part fits best');
  layoutChip.hidden = card.hidden = fitButton.hidden = suggestButton.hidden = true;
  board.append(layoutChip, card, status, fitButton, hullButton, suggestButton);
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
  let slots = null; // the source's Saves tab, if it has one
  let derived = null; // per ship: { doors, hull, loose, flagged, problems, lines, totals, ready }
  let plans = null; // the 3D board's scenes
  let shown = { ship: null, ghost: null, hull: null, marks: null, saves: null }; // what the board and Saves tab were last given
  let boxes = null; // { ship, items }: where each styling piece stands, to pick it from outside
  let rect = null;
  let yard = null; // the whole frame: how far the camera pans
  let yardFit = null;
  let fit = null; // the view Fit returns to: the ship, refitted as it changes
  let limits = null;
  let camera = null;
  let drag = null; // { kind: 'part' | 'ghost' | 'placed' | 'run' | 'pan', piece?, ... }
  let pinch = null;
  let dirty = true;
  let alive = true;
  let deleteMode = 'delete';
  let look = 'plans'; // the board shows the plans, or the hull from outside (the session's layer)
  let flash = null; // a notice shown until NOTICE_MS passes or the session changes
  let flashTimer = 0;
  let settleTimer = 0;
  let replaying = null; // { ships, index, error, timer } while a replay plays
  const cleanups = [];

  loadContent()
    .then((content) => {
      if (!alive) return;
      defs = content;
      const opened = source.open(defs);
      if (!opened) {
        setStatus({ tone: 'info', text: 'Nothing to build here.' });
        return;
      }
      useFrame((opened.session ?? opened).ship.frame);
      store = createStore((session, action) => reduceSession(session, action, defs), opened.session ?? createSession(opened.ship, opened.log, opened.stock, opened.wrecked, { rearrange: Boolean(opened.rearrange) }));
      // Opened for one part (a checklist line at the hangar, M44): that
      // part armed, any maker's on hand, and its ghost at the suggested
      // spot.
      if (opened.pick) {
        const session = store.getState();
        store.dispatch({ type: 'build/arm', moduleType: versionAtHand(defs, opened.pick, session.stock && ((version) => partsLeft(session, version))), toggle: false });
        store.dispatch({ type: 'build/suggest' });
      }
      derived = derive(store.getState().ship);
      store.subscribe(onSession);
      const api = {
        session: () => store.getState(),
        // A ship that arrives from outside replaces the one being built.
        load(ship, log) {
          stopReplay();
          useFrame(ship.frame);
          store.dispatch({ type: 'build/load', ship, log });
          drawer.saves?.reset();
          if (rect) refit(true); // another ship, maybe elsewhere in the yard
          sync();
        },
        replaying: () => Boolean(replaying),
      };
      slots = source.slots?.(api) ?? null;
      const unwatch = source.watch?.(api);
      if (unwatch) cleanups.push(unwatch);
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
        look: {
          piece: {
            tap: (type) => {
              stopReplay();
              setLook('hull');
              act({ type: 'build/arm', moduleType: type });
            },
            longPress: (type) => openCard(pieceCard(defs.styling.get(type)), 'left'),
            dragStart: startPartDrag,
            dragMove: moveDrag,
            dragEnd: endDrag,
            dragCancel: cancelDrag,
          },
          onPaint: (color) => act({ type: 'build/paint', color }),
          onTrim: (color) => act({ type: 'build/trim', color }),
          onStyle: (style) => act({ type: 'build/hull', style }),
        },
        onLaunch: source.launch
          ? () => {
              act({ type: 'build/launch', crew: crew() });
              if (typeof source.launch === 'function' && store.getState().notice?.tone === 'good') source.launch();
            }
          : null,
        // A fix asks for a part, and any maker's version on hand will do.
        onFix: (type) => {
          drawer.show('parts');
          setLook('plans');
          const session = store.getState();
          act({ type: 'build/arm', moduleType: versionAtHand(defs, type, session.stock && ((version) => partsLeft(session, version))), toggle: false });
        },
        saves: slots && { ...slots.handlers, onReplay: () => (replaying ? stopReplay() : startReplay()) },
        leave: source.leave,
      });
      el.prepend(drawer.el);
      cleanups.push(() => drawer.dispose());
      followLayer(store.getState());
      updateDrawer();
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
        if (stopReplay() || !ready()) return;
        const point = pointAt(x, y);
        if (!point) return;
        // With holds confirming (M47), a tap on the ghost only says so.
        if (holdMode() && tapOnGhost(store.getState(), defs, point[0], point[1])) return setStatus({ tone: 'info', text: 'Hold the ghost to put it down.' });
        act({ type: 'build/tap', x: point[0], y: point[1] });
      },
      longPress(x, y) {
        if (stopReplay() || !ready()) return;
        const point = pointAt(x, y);
        if (holdMode() && point && tapOnGhost(store.getState(), defs, point[0], point[1])) return act({ type: 'build/tap', x: point[0], y: point[1] });
        openCardAt(x, y);
      },
      dragStart(x0, y0) {
        if (stopReplay() || !ready()) return false;
        closeCard();
        drag = startBoardDrag(x0, y0);
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
    onTap(suggestButton, () => {
      if (!ready()) return;
      setLook('plans');
      act({ type: 'build/suggest' });
    }),
  );
  // The next touch anywhere closes the card, and still does its own job.
  // (Not a click: lifting the finger after the long press must not.)
  // A touch on the card's own buttons (a maker's swap, M44) leaves it open
  // until the button's tap.
  const closeOnTouch = (event) => {
    if (!event.target.closest?.('.bld-card button')) closeCard();
  };
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
    builderSounds(session, prev).forEach(cue);
    let becameReady = false;
    if (session.ship !== prev.ship) {
      const wasReady = derived.ready;
      derived = derive(session.ship);
      becameReady = derived.ready && !wasReady;
      if (rect) refit(false);
    }
    if (session.ship !== prev.ship || session.stock !== prev.stock) updateDrawer();
    followLayer(session);
    source.onSession(session, prev);
    // A new notice shows for a while; any other change replaces it with
    // the hint for what is on screen now.
    clearTimeout(flashTimer);
    flash = null;
    const ready = source.ready ?? 'Every flight check passes: ready to launch.';
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
    const lines = flightChecklist(ship, defs, crew(), { liftOff: source.liftOff?.() ?? null });
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

  function crew() {
    return source.crew();
  }

  // The Parts and Ship tabs for the ship as it is: the checklist, totals,
  // and what is on hand (construction mode).
  function updateDrawer() {
    const session = store.getState();
    const onHand = (type) => partsLeft(session, type);
    // The checklist's fixes ask for a part: any maker's version will do.
    const ofAny = (type) => countOfAny(defs, type, onHand);
    drawer.update(derived.lines, derived.totals, { crew: crew(), maxModules: frame.maxModules, onHand: ofAny, ship: session.ship, cleared: source.cleared, frame });
    drawer.setStock(session.stock ? onHand : null);
  }

  // Brings the DOM in line with the session and asks for a redraw.
  function sync() {
    if (!store) return;
    const session = store.getState();
    drawer.setArmed(session.armed?.type ?? null);
    suggestButton.hidden = !session.armed || !defs.modules.has(session.armed.type);
    undoButton.disabled = !session.past.length;
    redoButton.disabled = !session.future.length;
    const target = session.armed?.type ?? selectedOf(session)?.type;
    const piece = defs.styling.get(target);
    turnButton.disabled = !target || !(piece ? piece.turns.length > 1 : defs.modules.get(target)?.rotates);
    const mode = session.armed ? 'done' : 'delete';
    if (mode !== deleteMode) {
      deleteMode = mode;
      setToolFace(deleteButton, mode === 'done' ? icons.done : icons.remove, mode === 'done' ? 'Done' : 'Delete');
    }
    deleteButton.disabled = mode === 'delete' && session.selected === null;
    const summary = flightSummary(session.ship, defs, derived.lines, (type) => countOfAny(defs, type, (version) => partsLeft(session, version)), source.cleared);
    layoutChip.hidden = !summary;
    if (summary) setText(layoutChip, summary);
    // The Saves tab only changes with the slots, the ship or the replay;
    // a drag's many syncs leave it alone.
    const savesKey = slots && [slots.key(), session.ship, Boolean(replaying)];
    if (slots && (!shown.saves || savesKey.some((v, i) => v !== shown.saves[i]))) {
      drawer.saves.update({ ...slots.view(), replaying: Boolean(replaying), canReplay: session.log.length > 0 });
      shown.saves = savesKey;
    }
    if (replaying) {
      setStatus({ tone: 'info', text: `Replaying the build: step ${replaying.index} of ${replaying.ships.length - 1}. Tap the board to stop.` });
      dirty = true;
      return;
    }
    setStatus(flash && !drag ? flash : hintFor(session, defs, drag));
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
    shown = { ship: null, ghost: undefined, hull: null, marks: null, saves: null };
    sync();
    return true;
  }

  function showReplayStep() {
    const ship = replaying.ships[replaying.index];
    const hull = traceHull(ship, defs);
    plans.setShip({ ship, defs, frame, doors: openings(ship, defs), hull, selected: null, lifted: null, flagged: new Set() });
    plans.setGhost(null);
    plans.setMarks(null);
    if (look === 'hull') plans.setHull({ ship, defs, hull, skin: skinFor('yard') });
  }

  // Shows the plans (where the rooms are built) or the hull from outside
  // (where it is styled): the session's layer, which lets go of what was
  // picked out on the other one. Picking a part comes back to the plans,
  // and a styling piece goes outside.
  function setLook(next) {
    store.dispatch({ type: 'build/layer', layer: next === 'hull' ? 'styling' : 'rooms' });
  }

  // Brings the board, the Hull button and the drawer's first tab in line
  // with the session's layer.
  function followLayer(session) {
    const next = session.layer === 'styling' ? 'hull' : 'plans';
    if (next === look) return;
    look = next;
    hullButton.setAttribute('aria-pressed', String(look === 'hull'));
    drawer.setMode(look);
    closeCard();
    if (replaying) showReplayStep(); // a replay carries on in either look
  }

  // Gives the board what changed in the look on show. On the plans: the
  // ship scene when the ship or what is picked out on it changes, the ghost
  // when the part being placed moves. Outside: the hull when the ship
  // changes, the marks when the piece being placed moves or another is
  // picked out.
  function showOnBoard(session) {
    if (look === 'hull') {
      if (shown.hull !== session.ship) {
        plans.setHull({ ship: session.ship, defs, hull: derived.hull, skin: skinFor('yard') });
        shown.hull = session.ship;
      }
      const ghost = ghostOf(session);
      const marks = [session.ship, session.selected, ghost && [ghost.placement.type, ghost.placement.x, ghost.placement.y, ghost.placement.rot, ghost.ok].join()];
      if (!shown.marks || marks.some((v, i) => v !== shown.marks[i])) {
        plans.setMarks(lookOverlay({ ship: session.ship, defs, hull: derived.hull, ghost, selected: session.selected }));
        shown.marks = marks;
      }
      return;
    }
    // A part being moved (dragged, or shown where a tap would put it) is
    // drawn as its dashed outline where it stands.
    const lifted = drag?.kind === 'placed' ? drag.uid : session.ghost?.uid ?? null;
    const ship = { ship: session.ship, derived, selected: session.selected, lifted };
    const before = shown.ship;
    if (!before || before.ship !== ship.ship || before.derived !== derived || before.selected !== ship.selected || before.lifted !== lifted) {
      plans.setShip({ ship: session.ship, defs, frame, doors: derived.doors, hull: derived.hull, selected: session.selected, lifted, flagged: derived.flagged, wrecked: new Set(session.wrecked ?? []) });
      shown.ship = ship;
    }
    const ghost = ghostOf(session);
    const key = ghost && [ghost.placement.type, ghost.placement.x, ghost.placement.y, ghost.placement.rot, ghost.ok, ghost.blockers.join(' ')].join();
    if (key !== shown.ghost || (ghost && before?.ship !== session.ship)) {
      plans.setGhost(ghost && { ship: session.ship, defs, ghost });
      shown.ghost = key;
    }
  }

  // The part or piece being placed or moved: the drag's, or the session's
  // ghost.
  function ghostOf(session) {
    if (drag?.kind === 'run') {
      const last = drag.run.at(-1);
      return { placement: last.placement, ok: last.ok, blockers: [], run: drag.run };
    }
    if (drag && drag.kind !== 'pan') {
      return drag.placement ? { placement: drag.placement, ok: !drag.error, blockers: drag.blockers } : null;
    }
    const { ghost } = session;
    if (!ghost) return null;
    const error = errorAt(session.ship, ghost, ghost.uid ?? null);
    return { placement: ghost, ok: !error, blockers: error?.uids ?? [] };
  }

  // Why a part or a styling piece can't go at a placement, or null if it
  // can. uid: one being moved, which doesn't block itself; site: hullSite,
  // for a piece, if the caller has it.
  function errorAt(ship, placement, uid, site = null) {
    if (defs.styling.has(placement.type)) return pieceError(ship, defs, placement, uid, site);
    return placementError(uid === null ? ship : removeModule(ship, uid), defs, placement);
  }

  // What is picked out on the session's layer: a module, or a piece.
  function selectedOf(session) {
    const items = session.layer === 'styling' ? session.ship.styling ?? [] : session.ship.modules;
    return items.find((item) => item.uid === session.selected) ?? null;
  }

  // The point on the grid a finger at (x, y) means. On the plans, it is
  // on the deck; outside, halfway up the hull's side, where pieces go. A
  // part being placed or a room under the finger counts even where the
  // deck under it is something else (a room's front wall stands over the
  // deck behind it), and outside, a piece.
  function pointAt(x, y) {
    const session = store.getState();
    const deck = deckAt(x, y);
    if (session.layer === 'styling') {
      if (session.ghost && onGhostPiece(session.ghost, x, y)) return on(session.ghost, deck);
      const uid = pickBox(camera, pieceBoxes(session.ship), x, y);
      if (uid !== null) return on(session.ship.styling.find((p) => p.uid === uid), deck);
      return deck;
    }
    if (session.ghost && hitsGhost(camera, defs, session.ghost, x, y)) return on(session.ghost, deck);
    const uid = pickModule(camera, defs, session.ship.modules, x, y);
    if (uid !== null) return on(session.ship.modules.find((m) => m.uid === uid), deck);
    return deck;
  }

  function deckAt(x, y) {
    return unproject(camera, x, y, look === 'hull' ? HULL / 2 : 0);
  }

  // The point if it is on the placement, else the placement's middle.
  function on(placement, deck) {
    const [w, h] = sizeOf(defs, placement);
    const { x, y } = placement;
    if (deck && deck[0] >= x && deck[1] >= y && deck[0] < x + w && deck[1] < y + h) return deck;
    return [x + w / 2, y + h / 2];
  }

  // Where each styling piece stands, worked out once a ship, and whether a
  // finger is on the piece being placed.
  function pieceBoxes(ship) {
    if (boxes?.ship !== ship) boxes = { ship, items: (ship.styling ?? []).map((piece) => ({ uid: piece.uid, box: pieceBox({ ship, defs, hull: derived.hull }, piece) })) };
    return boxes.items;
  }

  function onGhostPiece(ghost, x, y) {
    const ship = store.getState().ship;
    return pickBox(camera, [{ uid: 0, box: pieceBox({ ship, defs, hull: derived.hull }, ghost) }], x, y) !== null;
  }

  function setStatus(message) {
    setText(status, message);
  }

  // Camera

  function layout() {
    if (!alive) return;
    const height = el.clientHeight;
    // Three rows of tiles under the tabs and the picker: room for any one
    // category's parts, or for the sheet of categories; All scrolls.
    const tile = Math.max(48, Math.min(64, Math.floor((height - TABS - PICK - 16 - 2 * TILE_GAP) / 3)));
    el.style.setProperty('--tile', `${tile}px`);
    if (!frame || !derived) return;
    const r = board.getBoundingClientRect();
    if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
    if (rect && r.left === rect.x && r.top === rect.y && r.width === rect.w && r.height === rect.h) return;
    rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    yardFit = fitOrbit({ ...BOARD_VIEW, pivot: middle(yard) }, rect, yard, MARGIN);
    refit(true);
  }

  // The board for the ship's hull frame (M39: a shipyard sells others), or
  // the starter hull's for a frame this build doesn't know: its grid, the
  // yard the camera stays in, and the cap the drawer counts against. A new
  // board is given the ship and the rest anew.
  function useFrame(id) {
    const next = defs.frames.get(id) ?? defs.frames.get(FRAME);
    if (next === frame) return;
    frame = next;
    plans = createBoard(frame);
    yard = yardBox(frame);
    if (rect) yardFit = fitOrbit({ ...BOARD_VIEW, pivot: middle(yard) }, rect, yard, MARGIN);
    shown = { ...shown, ship: null, ghost: undefined, hull: null, marks: null };
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
    const deck = deckAt(x0, y0);
    const { ghost } = session;
    if (session.layer === 'styling') {
      // A piece fits itself to the hull wherever the finger is, so it isn't
      // held at a point the way a part is.
      const piece = selectedOf(session);
      const lift = (item) => ({ kind: item.uid === undefined ? 'ghost' : 'placed', piece: true, uid: item.uid, type: item.type, rot: item.rot, site: hullSite(session.ship, defs), placement: null });
      if (deck && ghost && onGhostPiece(ghost, x0, y0)) return lift(ghost);
      if (deck && piece && pickBox(camera, pieceBoxes(session.ship).filter((item) => item.uid === piece.uid), x0, y0) !== null) return lift(piece);
      return { kind: 'pan', x: x0, y: y0 };
    }
    if (deck && ghost && hitsGhost(camera, defs, ghost, x0, y0)) {
      const grab = [deck[0] - ghost.x, deck[1] - ghost.y];
      // A part being moved: dragging its ghost moves the part, turned as the ghost is.
      if (ghost.uid !== undefined) return { kind: 'placed', uid: ghost.uid, type: ghost.type, rot: ghost.rot, grab, placement: null };
      // A corridor's ghost (M44): a drag from it lays a run, one a cell.
      if (session.armed?.type === ghost.type && baseOf(defs.modules.get(ghost.type)) === 'corridor') return startRun(session, ghost);
      return { kind: 'ghost', type: ghost.type, rot: ghost.rot, grab, placement: null };
    }
    const module = selectedOf(session);
    if (deck && module && pickModule(camera, defs, [module], x0, y0) !== null) {
      const grab = [deck[0] - module.x, deck[1] - module.y];
      return { kind: 'placed', uid: module.uid, type: module.type, rot: module.rot, grab, placement: null };
    }
    return { kind: 'pan', x: x0, y: y0 };
  }

  // A part dragged from the Parts tab, or a styling piece from the Look
  // tab.
  function startPartDrag(type, x, y) {
    if (!ready()) return;
    closeCard();
    const piece = defs.styling.get(type);
    setLook(piece ? 'hull' : 'plans');
    const { armed, ship } = store.getState();
    const rot = armed?.type === type ? armed.rot : piece ? piece.turns[0] : 0;
    drag = { kind: 'part', type, rot, grab: null, placement: null, ...(piece ? { piece: true, site: hullSite(ship, defs) } : {}) };
    dragChip.innerHTML = piece ? pieceIconSvg(piece, Math.round(camera.scale)) : partIconSvg(defs.modules.get(type), Math.round(camera.scale));
    moveDrag(x, y);
  }

  // A run of corridors from the ghost's cell (M44): the cells the finger
  // crosses, one grid step at a time, each checked as if the ones before
  // it were placed, with the corridors on hand counted down.
  function startRun(session, ghost) {
    const run = { kind: 'run', type: ghost.type, rot: ghost.rot, cells: [[ghost.x, ghost.y]] };
    return { ...run, run: checkRun(session, run) };
  }

  function stepRun(x, y) {
    const deck = deckAt(x, y);
    if (!deck) return;
    const target = [Math.floor(deck[0]), Math.floor(deck[1])];
    let changed = false;
    for (let guard = 0; guard < 64; guard++) {
      const [lx, ly] = drag.cells.at(-1);
      const [dx, dy] = [target[0] - lx, target[1] - ly];
      if (!dx && !dy) break;
      const next = Math.abs(dx) >= Math.abs(dy) ? [lx + Math.sign(dx), ly] : [lx, ly + Math.sign(dy)];
      if (next[0] < 0 || next[1] < 0 || next[0] >= frame.width || next[1] >= frame.height) break;
      // Back over the cell before: the run gives the last one back.
      const before = drag.cells.at(-2);
      if (before && before[0] === next[0] && before[1] === next[1]) drag.cells.pop();
      else drag.cells.push(next);
      changed = true;
    }
    if (!changed) return;
    drag.run = checkRun(store.getState(), drag);
    sync();
  }

  function checkRun(session, run) {
    let ship = session.ship;
    let left = partsLeft(session, run.type);
    let going = true;
    return run.cells.map(([cx, cy]) => {
      const placement = { type: run.type, x: cx, y: cy, rot: run.rot };
      if (going && left > 0) {
        const result = applyCommand(ship, defs, { op: 'place', ...placement });
        if (result.ok) {
          ship = result.ship;
          left -= 1;
          return { placement, ok: true };
        }
      }
      going = false;
      return { placement, ok: false };
    });
  }

  function moveDrag(x, y) {
    if (!drag) return;
    if (drag.kind === 'run') {
      stepRun(x, y);
      return;
    }
    if (drag.kind === 'pan') {
      setCamera(panOrbit(camera, x - drag.x, y - drag.y));
      drag.x = x;
      drag.y = y;
      return;
    }
    const onBoard = x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
    const deck = onBoard ? deckAt(x, y) : null;
    const ship = store.getState().ship;
    const uid = drag.kind === 'placed' ? drag.uid : null;
    const next = !deck
      ? null
      : drag.piece
        ? snapPiece(ship, defs, drag.type, drag.rot, deck[0], deck[1], { ignore: uid, site: drag.site })
        : snapPlacement(defs, frame, drag.type, drag.rot, deck[0], deck[1], drag.grab);
    const prev = drag.placement;
    // Check and redraw only when the snapped spot changes.
    if (!drag.checked || (next === null) !== (prev === null) || (next && (next.x !== prev.x || next.y !== prev.y || next.rot !== prev.rot))) {
      drag.checked = true;
      drag.placement = next;
      const error = next && errorAt(ship, next, uid, drag.site);
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
    // A run lifted where it started is the ghost let go where it was.
    if (ended.kind === 'run') {
      if (ended.cells.length > 1) act({ type: 'build/run', cells: ended.cells });
      return;
    }
    if (ended.kind === 'pan' || !ended.placement) return;
    // A piece may have turned to fit where it was let go.
    const { x: px, y: py, rot } = ended.placement;
    if (ended.kind === 'placed') act({ type: 'build/move', uid: ended.uid, x: px, y: py, rot });
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
    if (session.layer === 'styling') {
      if (session.ghost && onGhostPiece(session.ghost, x, y)) {
        openCard(pieceCard(defs.styling.get(session.ghost.type)), side);
        return;
      }
      const uid = pickBox(camera, pieceBoxes(session.ship), x, y);
      const piece = (session.ship.styling ?? []).find((p) => p.uid === uid);
      if (piece) openCard(pieceCard(defs.styling.get(piece.type), piece), side);
      return;
    }
    if (session.ghost && hitsGhost(camera, defs, session.ghost, x, y)) {
      openCard(cardFor(defs, defs.modules.get(session.ghost.type)), side);
      return;
    }
    const uid = pickModule(camera, defs, session.ship.modules, x, y);
    const module = session.ship.modules.find((m) => m.uid === uid);
    if (!module) return;
    const noBridge = derived.problems.some((p) => p.rule === 'bridge');
    const joined = noBridge ? null : !derived.loose.has(uid);
    const wrecked = Boolean(session.wrecked?.includes(uid));
    openCard(cardFor(defs, defs.modules.get(module.type), { module, joined, wrecked }), side, session.rearrange ? [] : swapsFor(session, module, wrecked));
  }

  // Each other maker's version of a placed part with one on hand (M44): a
  // tap swaps it in where the part stands. A wrecked part is scrapped for
  // any version on hand, its own too (M46): that can't be undone, so the
  // first tap asks and the second scraps it.
  function swapsFor(session, module, wrecked) {
    return versionsOf(defs, module.type)
      .filter((type) => (wrecked || type !== module.type) && partsLeft(session, type) > 0)
      .map((type) => {
        const name = defs.modules.get(type).name;
        const label = wrecked ? `Scrap for ${name}` : `Swap for ${name}`;
        const button = node('button', `btn bld-swap${wrecked ? ' bld-scrap' : ''}`, label);
        button.type = 'button';
        onTap(
          button,
          (press) => {
            if (wrecked && !confirms(button.dataset.armed === 'true', press)) {
              button.dataset.armed = 'true';
              button.textContent = `Scrap the wreck? ${holdMode() ? 'Hold' : 'Tap again'} for the ${name}`;
              return;
            }
            closeCard();
            if (ready()) act({ type: 'build/swap', uid: module.uid, moduleType: type });
          },
          { confirm: wrecked },
        );
        return button;
      });
  }

  function openCard({ title, lines }, side, buttons = []) {
    card.replaceChildren(node('h3', null, title), ...lines.map((line) => node('p', null, line)), ...buttons);
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
    // For the dev overlay: how the board's frames were drawn.
    frameStats: () => plans?.frameStats(),
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
}

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
