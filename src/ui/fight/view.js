// A fight on a battle map: the board, the crew down the left, the selected
// unit's orders down the right with Log, Fit and the source's tools above
// them, and the cards over the board. The player
// gives the crew orders; the enemy AI (src/sim/ai.js) plays the other side.
// Where its battles come from, and where they go, is the source's
// business: the Fight sandbox (screen.js) fights boarders on the builder's
// open ship from a new seed each time; the campaign (../campaign/fight.js)
// fights the battle in its save, a job's or one at home, and saves every
// order. A job's objective shows under the round, its crates and terminal
// are marked on the board, and Grab and Hack join the orders.
// Input -> fight action (src/sim/fight.js) -> new fight -> playback -> redraw.
// What an order set off is shown happening (src/render/playback.js) before
// the board takes the next; Skip goes to the end at once.
import { createStore } from '../../core/store.js';
import { loadContent } from '../../platform/content.js';
import { battleBoxes } from '../../render/battleScene.js';
import { createBattleBoard, FIGHT_VIEW } from '../../render/battleView.js';
import { paintFightLabels } from '../../render/fightLabels.js';
import { steppedPose } from '../../render/figures/sprites.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, project, turnOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { objectiveDone } from '../../sim/battle.js';
import { convexHull, inside } from '../../render/pick.js';
import { frameAt, makeTimeline, poseAt } from '../../render/playback.js';
import { crewColor, LYING_TOP, ordersScene, UNIT_TOP, unitsScene } from '../../render/units.js';
import { describeEvent } from '../../sim/battleLog.js';
import { canAct, createFight, ordersFor, reduceFight, selectedUnit } from '../../sim/fight.js';
import { crewLook } from '../../sim/looks.js';
import { tileText } from '../battle/tileText.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { portraitUrl } from '../portrait.js';
import { chipFor, endingFor, eventText, hintFor, oddsText, unitText } from './hints.js';
import { createActionBar, createCrewBar, node, setText, toolButton } from './panels.js';

// A ship's insides in the yard's skin; a job's site on the ground.
const skinOf = (map) => skinFor(map.site ? 'ground' : 'yard');
const MARGIN = 14; // pixels around the ship when the view is fitted
const MAX_ZOOM = 3; // times the fitted scale
const MIN_ZOOM = 0.6; // times the fitted scale, or of the whole map's if that is further out
const TURN_SLOP = 0.17; // radians of twist before a pinch turns the map
const KEY_TURN = Math.PI / 12; // Q and E on a keyboard
const SETTLE_MS = 150; // still this long after a camera move, the map sharpens
const NOTICE_MS = 2600;
const OPENING_MS = 8000; // a fight's opening words stay this long, or until a tap
const ARM_MS = 3000; // End turn waits this long for its second tap
const LOG_LINES = 16;

// Mounts a fight in root and returns the screen's handle (resize, draw,
// unmount, frameStats). source:
//   over       { icon, label }: the button on the end panel
//   tools      [{ icon, label, onTap }]: more buttons, above Log and Fit
//   start(defs, fights)   once the content has loaded: shows the first
//              fight with fights.show({ map, battle, log, seed }), or says
//              why there is none with fights.stop(why); may return a
//              cleanup
//   onChange(fight, prev)   after every change to the fight
//   onOver()   the end panel's button was tapped
//   objective(battle)   optional: the objective's line under the round,
//              { title, progress, deadline, done }, or null for none
//   ending(battle, log)   optional: how the fight ended, { tone, title,
//              text }, for the end panel and the hint; boarders' words if
//              not given
//   lookOf(unit, index)   optional: the look (src/sim/looks.js) of the
//              crew unit at `index` among the crew, for its portrait; one
//              is rolled if not given
//   opening(battle)   optional: { tone, text } to say as a fight is shown,
//              in place of the hint until the first tap on the board or
//              OPENING_MS, or null for nothing
export function mountFight(root, source) {
  const el = node('section', 'fight');
  const board = node('div', 'fgt-board');
  const chip = node('p', 'fgt-chip');
  const goal = node('p', 'fgt-goal');
  const status = node('p', 'fgt-status');
  const card = node('div', 'fgt-card');
  const over = node('div', 'fgt-over');
  const overText = node('p');
  const overNote = node('p', 'fgt-over-note');
  const overButton = toolButton('fgt-again', source.over.icon, source.over.label);
  over.append(overText, overNote, overButton);
  const logButton = toolButton('fgt-tool', icons.log, 'Log');
  const fitButton = toolButton('fgt-tool', icons.fit, 'Fit');
  const extraTools = (source.tools ?? []).map((tool) => ({ ...tool, button: toolButton('fgt-tool', tool.icon, tool.label) }));
  chip.hidden = goal.hidden = card.hidden = over.hidden = true;
  board.append(chip, goal, status, card, over);
  const crewBar = createCrewBar({ onSelect: (id) => order({ type: 'fight/select', unit: id }), onEnd: endTurn });
  // The tools head the orders' column, off the board: the source's own
  // (Title) at the top, the least used in a fight and the first to scroll
  // away on a short screen.
  const actionBar = createActionBar(
    {
      shoot: () => order({ type: 'fight/aim' }),
      overwatch: () => order({ type: 'fight/overwatch' }),
      reload: () => order({ type: 'fight/reload' }),
      stabilize: () => order({ type: 'fight/stabilize' }),
      open: () => order({ type: 'fight/open' }),
      job: () => order({ type: 'fight/order' }),
      grab: () => order({ type: 'fight/grab' }),
      hack: () => order({ type: 'fight/hack' }),
      skip,
    },
    [...extraTools.map((tool) => tool.button), logButton, fitButton],
  );
  el.append(crewBar.el, board, actionBar.el);
  root.append(el);
  setStatus({ tone: 'info', text: 'Loading parts…' });

  const mapView = createBattleBoard();
  let defs = null;
  let map = null;
  let seed = 0;
  let store = null; // the fight (fight.js)
  let rect = null;
  let boxes = null;
  let fit = null;
  let limits = null;
  let camera = null;
  let drag = null;
  let pinch = null;
  let dirty = true;
  let alive = true;
  let playing = null; // { timeline, start, frame, done } while what an order set off plays out
  let labels = {}; // what paintFightLabels draws over the board
  let doorsShown = null; // the open doors the map was last drawn with
  let actorsKey = null; // what the figures and marks on the board were made from
  let flash = null; // a notice shown for NOTICE_MS
  let flashTimer = 0;
  let endArmed = false;
  let endTimer = 0;
  let settleTimer = 0;
  let cardKind = null; // what the card shows: 'odds', 'unit', 'tile' or 'log'
  let cardCleanups = [];
  const colors = new Map(); // crew id -> trim
  const faces = new Map(); // crew id -> portrait URL
  const cleanups = [() => crewBar.dispose(), () => actionBar.dispose()];

  loadContent()
    .then((content) => {
      if (!alive) return;
      defs = content;
      const cleanup = source.start(defs, { show, stop });
      if (cleanup) cleanups.push(cleanup);
    })
    .catch((err) => {
      if (alive) setStatus({ tone: 'bad', text: `Couldn't load the parts list: ${err.message}` });
    });

  cleanups.push(
    attachGestures(board, {
      tap(x, y) {
        if (busy()) return;
        const at = tileAt(x, y);
        order(at ? { type: 'fight/tap', x: at[0], y: at[1] } : { type: 'fight/cancel' });
      },
      longPress(x, y) {
        if (!store || busy()) return;
        const unit = unitUnder(x, y);
        if (unit) return openCard('unit', unitText(unit, defs), x);
        const at = tileAt(x, y);
        if (at) openCard('tile', tileText(map, at[0], at[1], defs, store.getState().battle.doors), x);
      },
      dragStart(x0, y0) {
        if (!camera) return false;
        drag = { x: x0, y: y0 };
        return true;
      },
      dragMove(x, y) {
        if (!drag) return;
        setCamera(panOrbit(camera, x - drag.x, y - drag.y));
        drag = { x, y };
      },
      dragEnd() {
        drag = null;
      },
      dragCancel() {
        drag = null;
      },
      pinchStart(p) {
        if (camera) pinch = { start: camera, from: p };
      },
      pinchMove(p) {
        if (pinch) setCamera(pinchOrbit(pinch.start, pinch.from, p, limits, TURN_SLOP));
      },
      pinchEnd() {
        pinch = null;
      },
    }, { ignore: 'button, .fgt-card' }),
  );
  const onWheel = (event) => {
    event.preventDefault();
    if (camera) setCamera(zoomOrbit(camera, event.clientX, event.clientY, camera.scale * Math.exp(-event.deltaY * 0.0015), limits));
  };
  board.addEventListener('wheel', onWheel, { passive: false });
  cleanups.push(() => board.removeEventListener('wheel', onWheel));
  // Keys, for testing on a desktop.
  const onKey = (event) => {
    const key = event.key.toLowerCase();
    if (!camera || event.ctrlKey || event.metaKey) return;
    if (key === 'q' || key === 'e') setCamera(turnOrbit(camera, rect.x + rect.w / 2, rect.y + rect.h / 2, camera.yaw + (key === 'q' ? -KEY_TURN : KEY_TURN)));
    else if (key === 'escape') order({ type: 'fight/cancel' });
    else if (key === 'enter') order({ type: 'fight/confirm' });
  };
  addEventListener('keydown', onKey);
  cleanups.push(() => removeEventListener('keydown', onKey));

  cleanups.push(
    onTap(overButton, () => store && !busy() && source.onOver()),
    onTap(fitButton, () => fit && setCamera(fit)),
    onTap(logButton, () => (cardKind === 'log' ? closeCard() : store && openLog())),
    ...extraTools.map((tool) => onTap(tool.button, tool.onTap)),
  );
  // The next touch outside a card closes it, and still does its own job.
  // A shot's card stays while the shot is shown.
  const closeOnTouch = (event) => {
    if (cardKind && cardKind !== 'odds' && !card.contains(event.target) && !logButton.contains(event.target)) closeCard();
  };
  el.addEventListener('pointerdown', closeOnTouch, true);

  const observer = new ResizeObserver(() => layout());
  observer.observe(board);
  cleanups.push(() => observer.disconnect());

  // Shows a fight: a battle on its map, every event so far, and the seed
  // it was rolled from. The camera opens on the map when it is a new one.
  function show(next) {
    const moved = next.map !== map;
    map = next.map;
    seed = next.seed;
    if (moved) boxes = battleBoxes(map);
    const { battle, log } = next;
    colors.clear();
    faces.clear();
    const looks = [];
    battle.units.filter((u) => u.side === 'crew').forEach((u, i) => {
      colors.set(u.id, crewColor(i));
      // The crew member's look, or one rolled for a fight with no campaign
      // behind it (the Fight sandbox), the same every time.
      const look = source.lookOf?.(u, i) ?? crewLook('sandbox', i + 1, looks);
      looks.push(look);
      faces.set(u.id, portraitUrl(look, defs.jobs.get(u.kind)?.look, colors.get(u.id), 'face'));
    });
    playing = null;
    doorsShown = null;
    disarmEnd();
    closeCard();
    if (store) {
      store.dispatch({ type: 'fight/load', battle, events: log });
    } else {
      store = createStore((fight, action) => reduceFight(fight, action, defs), createFight(battle, defs, log));
      store.subscribe(onFight);
      sync();
    }
    if (moved) {
      if (rect) refit();
      else layout();
    }
    const opening = source.opening?.(battle) ?? null;
    if (opening) {
      clearTimeout(flashTimer);
      flash = opening;
      flashTimer = setTimeout(() => ((flash = null), sync()), OPENING_MS);
      sync();
    }
  }

  // Says why there is no fight, and clears the board.
  function stop(why) {
    store = null;
    map = null;
    playing = null;
    closeCard();
    mapView.setMap(null);
    mapView.setActors(null);
    actorsKey = null;
    labels = {};
    chip.hidden = goal.hidden = over.hidden = true;
    crewBar.update([], colors, null);
    crewBar.setEnd('off');
    actionBar.update(null, false);
    setStatus({ tone: 'info', text: why });
    dirty = true;
  }

  function onFight(fight, prev) {
    source.onChange?.(fight, prev);
    if (fight.played !== prev.played && fight.played.length) {
      playing = { timeline: makeTimeline(prev.battle, fight.played), start: performance.now(), frame: null, done: false };
      closeCard();
    }
    if (fight.notice && fight.notice !== prev.notice) {
      clearTimeout(flashTimer);
      flash = fight.notice;
      flashTimer = setTimeout(() => ((flash = null), sync()), NOTICE_MS);
    } else if (fight.battle !== prev.battle || fight.preview !== prev.preview) {
      flash = null;
    }
    // A shot's odds, or a dart's (a Sedate, M32), on the card.
    if (fight.preview?.type === 'shoot' || fight.preview?.odds) openOdds(fight);
    else if (cardKind === 'odds') closeCard();
    sync();
  }

  // True while an order's results are playing out: the board takes no
  // orders until they have.
  function busy() {
    return Boolean(playing && !playing.done);
  }

  function order(action) {
    if (!store || busy()) return;
    if (action.type !== 'fight/end') disarmEnd();
    store.dispatch(action);
  }

  // End turn takes two taps while anyone still has an action left.
  function endTurn() {
    if (!store || busy()) return;
    const { battle } = store.getState();
    if (battle.winner || battle.side !== 'crew') return;
    if (battle.units.some((u) => canAct(battle, u)) && !endArmed) {
      endArmed = true;
      clearTimeout(endTimer);
      endTimer = setTimeout(() => (disarmEnd(), sync()), ARM_MS);
      setStatus({ tone: 'warn', text: 'Tap End turn again to end it: the crew still has actions left.' });
      crewBar.setEnd('armed');
      return;
    }
    disarmEnd();
    store.dispatch({ type: 'fight/end' });
  }

  function disarmEnd() {
    endArmed = false;
    clearTimeout(endTimer);
  }

  // Goes straight to the end of what is playing out.
  function skip() {
    if (!playing) return;
    playing = null;
    sync();
  }

  // Brings the panels and the board in line with the fight.
  function sync() {
    if (!store) return;
    const fight = store.getState();
    // While a playback runs, the battle as it stands in it (before its
    // first frame, as it was), never the end it is heading for.
    const shown = playing ? playing.frame?.view ?? playing.timeline.before : fight.battle;
    const orders = busy() ? null : ordersFor(fight, defs);
    crewBar.update(shown.units.filter((u) => u.side === 'crew'), colors, busy() ? null : fight.selected, faces);
    crewBar.setEnd(busy() || !orders ? 'off' : endArmed ? 'armed' : 'ready');
    actionBar.update(orders, busy());
    setLine(chip, chipFor(shown));
    chip.hidden = false;
    showGoal(shown);
    const ending = fight.battle.winner ? source.ending?.(fight.battle, fight.log) ?? endingFor(fight.battle) : null;
    if (!busy() && !endArmed) setStatus(flash ?? hintFor(fight, orders, ending));
    over.hidden = busy() || !ending;
    if (ending) {
      setText(overText, ending.title);
      setText(overNote, ending.text);
      overNote.hidden = !ending.text;
      over.dataset.tone = ending.tone;
    }
    if (!busy()) showBoard(fight, orders, playing?.frame ?? null);
  }

  // The objective's line under the round, as the battle shown stands.
  function showGoal(battle) {
    const objective = source.objective?.(battle) ?? null;
    goal.hidden = !objective;
    if (objective) setLine(goal, { tone: objective.done ? 'good' : 'info', text: [objective.title, objective.progress, objective.deadline].filter(Boolean).join(' · ') });
  }

  // Moves a playback on to `now`.
  function advance(now) {
    const t = Math.max(0, now - playing.start);
    const frame = frameAt(playing.timeline, t);
    const before = playing.frame;
    playing.frame = frame;
    if (t >= playing.timeline.tail) {
      playing = null;
      sync();
      return;
    }
    if (frame.done && !playing.done) {
      playing.done = true;
      sync();
      return;
    }
    if (frame.done) {
      showBoard(store.getState(), ordersFor(store.getState(), defs), frame);
      return;
    }
    if (frame.view !== before?.view) {
      crewBar.update(frame.view.units.filter((u) => u.side === 'crew'), colors, null, faces);
      showGoal(frame.view);
    }
    if (frame.event && frame.event !== before?.event) {
      setStatus(eventText(frame.event, frame.view));
      // A new turn shows as its banner goes up.
      const { side, round } = frame.event.type === 'turn' ? frame.event : frame.view;
      setLine(chip, chipFor({ ...frame.view, side, round }));
    }
    showBoard(store.getState(), null, frame);
  }

  // Gives the board the units as they stand (or walk), the selected unit's
  // orders, and what goes over them.
  function showBoard(fight, orders, frame) {
    const battle = frame ? frame.view : fight.battle;
    if (battle.doors !== doorsShown) {
      mapView.setMap({ map, skin: skinOf(map), open: battle.doors });
      doorsShown = battle.doors;
    }
    const figures = battle.units.map((u) => figure(u, battle, frame));
    const { preview } = fight;
    const aimed = preview?.type === 'shoot' ? battle.units.find((u) => u.id === preview.target) : null;
    // An order shown (M32): the unit it reaches, or the door it welds.
    const ordered = preview?.type === 'order' ? battle.units.find((u) => u.id === preview.at) ?? null : null;
    const welding = preview?.type === 'order' && preview.kind === 'weld' ? preview.at : null;
    // The figures and marks are made again only when something in them
    // changed: a banner or words rising leave the board's last frame as
    // it was.
    const key = [battle, orders ? fight : null, frame?.moving?.id, ...(frame?.moving?.at ?? []), frame?.shot?.shooter, frame?.shot?.target, frame?.hit, ...figures.map((f) => `${f.pose.aim},${f.pose.fall}`)];
    if (!actorsKey || key.length !== actorsKey.length || key.some((value, i) => value !== actorsKey[i])) {
      actorsKey = key;
      const marks = orders
        ? ordersScene({
          reach: orders.reach,
          preview: fight.preview,
          battle,
          rules: defs,
          selected: [orders.unit.x, orders.unit.y],
          targets: orders.targets.map(({ target }) => [target.x, target.y]),
          aimed: aimed && [aimed.x, aimed.y],
          ordered: ordered && [ordered.x, ordered.y],
          welding,
        })
        : { faces: [] };
      mapView.setActors({ faces: marks.faces, glows: [], figures: unitsScene(figures).figures });
    }
    labels = {
      units: battle.units.map((u, i) => ({ at: figures[i].at, status: u.status, hp: u.hp, maxHp: u.maxHp, color: colors.get(u.id) ?? palette.enemyTrim, overwatch: u.overwatch, bleed: u.bleed, selected: u.id === orders?.unit.id, marked: Boolean(u.mark), suppressed: Boolean(u.suppressed), asleep: u.asleep })),
      badges: [
        ...(orders?.targets ?? []).filter(({ target }) => target.id !== ordered?.id).map(({ target, odds }) => ({ at: [target.x, target.y], text: `${odds.hit}%`, strong: target.id === aimed?.id })),
        ...orderBadge(preview, orders, ordered),
      ],
      marks: objectiveMarks(battle.objective),
      welds: weldLabels(battle),
      floats: frame?.floats ?? [],
      shot: frame?.done ? null : frame?.shot ?? null,
      banner: frame?.event?.type === 'turn' ? { text: frame.event.side === 'crew' ? 'YOUR TURN' : 'ENEMY TURN', progress: frame.progress } : null,
    };
    dirty = true;
  }

  // A unit as the board draws it: where it stands (or walks), the way it
  // faces, its look and weapon, and its pose (playback.js). Falling, it
  // turns as it goes to the way it will lie.
  function figure(u, battle, frame) {
    const walking = frame?.moving?.id === u.id ? frame.moving : null;
    const shooting = frame?.shot?.shooter === u.id ? frame.shot : null;
    const at = walking ? walking.at : [u.x + 0.5, u.y + 0.5];
    // In the steps it is drawn in, so frames between steps reuse the last.
    const pose = steppedPose(poseAt(u, frame));
    let facing = walking ? walking.facing : shooting ? [shooting.to[0] - shooting.from[0], shooting.to[1] - shooting.from[1]] : lookOf(u, battle);
    if (pose.fall > 0) facing = turned(facing, lookOf({ ...u, status: 'down' }, battle), pose.fall);
    const length = Math.hypot(...facing) || 1;
    const kind = defs.jobs.get(u.kind) ?? defs.enemies.get(u.kind);
    return { id: u.id, side: u.side, status: u.status, at, facing: [facing[0] / length, facing[1] / length], trim: colors.get(u.id) ?? palette.enemyTrim, flash: frame?.hit === u.id, look: kind?.look, held: defs.weapons.get(u.weapon)?.held, pose };
  }

  // A way t of the turn from `from` to `to`, the short way round.
  function turned(from, to, t) {
    const [a, b] = [Math.atan2(from[1], from[0]), Math.atan2(to[1], to[0])];
    const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return [Math.cos(a + turn * t), Math.sin(a + turn * t)];
  }

  // Standing, a unit looks at the nearest enemy still up; lying down, it
  // lies along the ship (crew) or across it (boarders).
  function lookOf(u, battle) {
    const rest = u.side === 'crew' ? [1, 0] : [0, 1];
    if (u.status !== 'active') return rest;
    let best = null;
    for (const other of battle.units) {
      if (other.side === u.side || other.status !== 'active') continue;
      const d = (other.x - u.x) ** 2 + (other.y - u.y) ** 2;
      if (!best || d < best.d) best = { d, look: [other.x - u.x, other.y - u.y] };
    }
    return best?.look ?? rest;
  }

  // The tile a finger at (x, y) means: a unit's, if it is on one (a unit
  // stands up from the deck, over the tile behind it), else the deck's.
  function tileAt(x, y) {
    if (!map || !camera) return null;
    const unit = unitUnder(x, y);
    if (unit) return [unit.x, unit.y];
    const deck = unproject(camera, x, y);
    if (!deck) return null;
    const [tx, ty] = [Math.floor(deck[0]), Math.floor(deck[1])];
    return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height ? [tx, ty] : null;
  }

  // The front-most unit (not dead) under screen point (sx, sy), or null.
  function unitUnder(sx, sy) {
    if (!store || !camera) return null;
    let best = null;
    let nearest = Infinity;
    for (const u of store.getState().battle.units) {
      if (u.status === 'dead') continue;
      const corners = [];
      for (const x of [u.x + 0.22, u.x + 0.78]) for (const y of [u.y + 0.22, u.y + 0.78]) for (const z of [0, u.status === 'active' ? UNIT_TOP : LYING_TOP]) corners.push(project(camera, x, y, z));
      if (!inside(convexHull(corners), sx, sy)) continue;
      const depth = Math.min(...corners.map((c) => c[2]));
      if (depth < nearest) {
        nearest = depth;
        best = u;
      }
    }
    return best;
  }

  // Cards

  // The shot shown: its odds part by part, Fire, and the next target. A
  // dart (Sedate, M32) shows as a shot does, with its order to give.
  function openOdds(fight) {
    const shooter = selectedUnit(fight);
    const { preview } = fight;
    const dart = preview.type === 'order';
    const target = fight.battle.units.find((u) => u.id === (dart ? preview.at : preview.target));
    const text = oddsText(shooter, target, preview.odds, defs);
    const head = node('h3');
    head.append(node('span', null, text.title), node('b', 'fgt-hit', `${text.hit}%`));
    const rows = node('dl', 'fgt-odds');
    for (const [label, value] of text.rows) {
      const row = node('div');
      row.append(node('dt', null, label), node('dd', null, value));
      rows.append(row);
    }
    const lines = [text.note, text.crit, text.damage].filter(Boolean).map((line) => node('p', null, line));
    const job = dart ? ordersFor(fight, defs).order : null;
    const fire = job ? toolButton('fgt-fire', icons[job.kind] ?? icons.shoot, job.name) : toolButton('fgt-fire', icons.shoot, 'Fire');
    const buttons = node('div', 'fgt-card-row');
    buttons.append(fire);
    const others = !dart && ordersFor(fight, defs).targets.length > 1;
    const next = others && toolButton('fgt-next', icons.skip, 'Next');
    if (next) buttons.append(next);
    for (const cleanup of cardCleanups) cleanup();
    cardCleanups = [onTap(fire, () => order({ type: 'fight/confirm' }))];
    if (next) cardCleanups.push(onTap(next, () => order({ type: 'fight/aim' })));
    card.replaceChildren(head, rows, ...lines, buttons);
    showCard('odds', camera ? project(camera, target.x + 0.5, target.y + 0.5, 0)[0] : 0);
  }

  function openCard(kind, { title, lines }, fingerX) {
    for (const cleanup of cardCleanups) cleanup();
    cardCleanups = [];
    card.replaceChildren(node('h3', null, title), ...lines.map((line) => node('p', null, line)));
    showCard(kind, fingerX);
  }

  // The log: what has happened lately, newest last, and the seed.
  function openLog() {
    const fight = store.getState();
    const lines = fight.log.slice(-LOG_LINES).map((event) => describeEvent(event, fight.battle));
    openCard('log', { title: 'Log', lines: [...lines, `Seed ${seed}.`] }, rect.x + rect.w);
    card.scrollTop = card.scrollHeight;
  }

  // Opens the card on the half of the board away from x.
  function showCard(kind, x) {
    cardKind = kind;
    card.dataset.kind = kind;
    card.dataset.side = rect && x < rect.x + rect.w / 2 ? 'right' : 'left';
    card.hidden = false;
  }

  function closeCard() {
    for (const cleanup of cardCleanups) cleanup();
    cardCleanups = [];
    cardKind = null;
    card.hidden = true;
  }

  function setStatus(message) {
    setLine(status, message);
  }

  // Camera

  function layout() {
    if (!alive) return;
    const r = board.getBoundingClientRect();
    if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
    if (rect && r.left === rect.x && r.top === rect.y && r.width === rect.w && r.height === rect.h) return;
    rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    if (boxes) refit();
    dirty = true;
  }

  // Opens the view on the ship, square to it and as large as fits;
  // zooming out stops a little past the whole map.
  function refit() {
    const { fit: onShip, all } = boxes;
    fit = clampOrbit(fitOrbit({ ...FIGHT_VIEW, pivot: middle(onShip) }, rect, onShip, MARGIN), rect, all, MARGIN);
    const whole = fitOrbit({ ...FIGHT_VIEW, pivot: middle(all) }, rect, all, MARGIN);
    limits = { min: Math.min(fit.scale, whole.scale) * MIN_ZOOM, max: fit.scale * MAX_ZOOM };
    setCamera(fit);
  }

  function setCamera(next) {
    if (!boxes) return;
    camera = clampOrbit(next, rect, boxes.all, MARGIN);
    dirty = true;
  }

  return {
    resize() {
      layout();
      dirty = true;
    },
    // For the dev overlay: how the map's frames were drawn.
    frameStats: () => mapView.frameStats(),
    draw(ctx, view) {
      if (playing && store) {
        advance(performance.now());
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;
      ctx.fillStyle = palette.space;
      ctx.fillRect(0, 0, view.width, view.height);
      if (!rect || !camera) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      // A frame drawn while the camera moved is a rough one; once it has
      // been still for a moment, the map is drawn again in full.
      // While a unit walks, a phone too slow for full frames gets rough
      // ones, as while the camera moves.
      const animating = Boolean(playing?.frame?.moving);
      if (mapView.draw(ctx, camera, rect, (g) => paintFightLabels(g, camera, rect, labels), { animating })) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => (dirty = true), SETTLE_MS);
      }
      ctx.restore();
    },
    unmount() {
      alive = false;
      clearTimeout(settleTimer);
      clearTimeout(flashTimer);
      clearTimeout(endTimer);
      for (const cleanup of [...cleanups, ...cardCleanups]) cleanup();
      el.removeEventListener('pointerdown', closeOnTouch, true);
      el.remove();
    },
  };
}

// The objective on the board: a tag over each crate to grab, and over the
// terminal, saying how far along it is.
function objectiveMarks(objective) {
  if (objective?.type === 'grab') {
    return objective.crates.map(([x, y]) => {
      const done = objective.taken.some(([tx, ty]) => tx === x && ty === y);
      return { at: [x, y], text: done ? 'GOT IT' : 'GRAB', done };
    });
  }
  if (objective?.type === 'hack') return [{ at: objective.at, text: `HACK ${Math.min(objective.progress, objective.turns)}/${objective.turns}`, done: objectiveDone(objective) }];
  return [];
}

// Each welded door (M32): the middle of its edge, and the rounds it still
// holds, this one counted.
function weldLabels(battle) {
  return (battle.welds ?? []).map(({ key, until }) => {
    const [x, y, side] = key.split(',').map((part, i) => (i < 2 ? Number(part) : part));
    return { at: side === 'n' ? [x + 0.5, y] : [x, y + 0.5], text: `WELDED ${until - battle.round + 1}` };
  });
}

// The badge over what an order shown reaches (M32): the unit, filled, with
// the order's name (and a dart's odds); or a weld's door. None without one.
function orderBadge(preview, orders, ordered) {
  if (preview?.type !== 'order' || !orders?.order) return [];
  const name = orders.order.name.toUpperCase();
  if (ordered) return [{ at: [ordered.x, ordered.y], text: preview.odds ? `${name} ${preview.odds.hit}%` : name, strong: true, tone: 'order' }];
  const { x, y } = orders.unit;
  const edge = { n: [0, -0.5], e: [0.5, 0], s: [0, 0.5], w: [-0.5, 0] }[preview.at];
  return edge ? [{ at: [x + edge[0], y + edge[1]], text: name, strong: true, tone: 'order' }] : [];
}

function middle(box) {
  return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
}

// Writes { tone, text } into a line only when it changed.
function setLine(el, { tone, text }) {
  setText(el, text);
  if (el.dataset.tone !== tone) el.dataset.tone = tone;
}
