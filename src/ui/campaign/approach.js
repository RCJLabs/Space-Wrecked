// The approach screen (ROADMAP §4.2): a hostile ship met on the run, played
// round by round (src/sim/encounter.js). Since M38b the two ships stand side
// by side seen from outside (render/approachView.js), as the hangar shows a
// ship: the player's on the left, nose right, the other turned to face it,
// each scarred where it was hit and showing a wrecked part's fire, vacuum
// or rubble on its hull. The inside is for a boarding's fight. The
// right-hand column is words only, so it can scroll on a short screen
// without hiding a button: what the other ship will do this round, what the
// order tapped would do, and what the last round came to, roll by roll. The
// orders run along the bottom, each with its odds: fire at their guns,
// engines, shields or reactor, evade, flee, or board. A tap shows what an
// order does and its odds in full (a Fire order marks the parts it aims at
// on her hull), a second gives it; an order that can't be given says why.
// A round given is played out (render/approachPlayback.js): the shots fly,
// the column's lines follow them, and its sounds play with them; a tap on a
// ship or an order skips to its end, and with reduced motion it ends at
// once. Once it is over, the column says how it ended and what it came to,
// and a boarding brings the ships together, the boarded one marked. In the
// orders' place, Carry on goes back to the chart; or, for a boarding (M22),
// Board her begins the fight and Leave her goes, each two taps, or Fight
// them off begins it when she is the one boarding. With more aboard than a
// squad takes (M23), Squad opens the squad card (squadCard.js) over the
// ships, to pick who goes; the healthiest go unless the player picks.
// Every round is saved as it is played.
import { cue } from '../../platform/audio.js';
import { buzz } from '../../platform/haptics.js';
import { loadContent } from '../../platform/content.js';
import { frameAt, restingPose, roundCues, roundTimeline, shipGeometry } from '../../render/approachPlayback.js';
import { createApproachView } from '../../render/approachView.js';
import { traceHull } from '../../render/hull.js';
import { fitOrbit } from '../../render/orbit.js';
import { skinFor } from '../../render/palette.js';
import { BOARD_VIEW, boardBox } from '../../render/shipView.js';
import { squadProblem } from '../../sim/crew.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { confirms } from '../confirm.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { motionReduced, playbackSpeed } from '../motion.js';
import { roundSounds } from '../sounds.js';
import { roundBuzz, roundBuzzes } from '../vibrations.js';
import { approachText } from './approachText.js';
import { squadText } from './crewText.js';
import { heatChip } from './hubParts.js';
import { createSquadCard } from './squadCard.js';

const ARM_MS = 3000; // an order waits this long for its second tap
const MARGIN = 8; // pixels around each ship
const SIDES = ['you', 'them'];
// The other ship is seen from the far side, so the two face each other.
const YAWS = { you: BOARD_VIEW.yaw, them: BOARD_VIEW.yaw + Math.PI };
const NO_MIN = [0, 0]; // each view fits its ship alone, however small
const now = () => performance.now();

export const approachScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr apr');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const whereLine = node('p', 'hgr-home');
    const roundLine = node('p', 'apr-round');
    const heat = heatChip();
    head.append(actLine, whereLine, roundLine, heat.el);

    // The two ships: a name, their numbers, and a hole the canvas shows
    // through.
    const ships = Object.fromEntries(
      SIDES.map((side) => {
        const area = node('div', `apr-ship apr-${side}`);
        const name = node('p', 'apr-name');
        const stats = node('p', 'apr-stats');
        const hole = node('div', 'apr-hole');
        area.append(name, stats, hole);
        return [side, { area, name, stats, hole, ship: null, hull: null, box: null }];
      }),
    );
    const picture = createApproachView();

    // The words: their order, what the order tapped would do, how it ended,
    // and the last round.
    const column = node('section', 'hgr-panel apr-side');
    const intentHead = node('h2', null, 'Their order');
    const intent = node('p', 'apr-intent');
    const hint = node('p', 'apr-said', 'Loading…');
    const out = node('div', 'apr-out');
    const outTitle = node('h2', 'apr-out-title');
    const outLines = node('ul', 'apr-out-lines');
    out.append(outTitle, outLines);
    out.hidden = true;
    const logHead = node('h2', null, 'Last round');
    const log = node('ul', 'apr-log');
    column.append(intentHead, intent, hint, out, logHead, log);

    // The orders along the bottom, or Carry on once it is over.
    const foot = node('footer', 'apr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const fireLabel = node('span', 'apr-fire-label', 'Fire at');
    const fire = node('div', 'apr-fire');
    const moves = node('div', 'apr-moves');
    const carryButton = toolButton('apr-carry', icons.done, 'Carry on');
    const squadButton = toolButton('apr-squad-open', icons.crew, 'Squad');
    const boardButton = toolButton('apr-board', icons.door, 'Board her');
    const leaveButton = toolButton('apr-leave', icons.jump, 'Leave her');
    carryButton.hidden = squadButton.hidden = boardButton.hidden = leaveButton.hidden = true;
    foot.append(titleButton, fireLabel, fire, moves, squadButton, boardButton, leaveButton, carryButton);
    const squadCard = createSquadCard({ toggle: pickMember, done: () => openSquad(false) });
    el.append(head, ships.you.area, ships.them.area, column, squadCard.el, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let shown = null;
    let armed = null; // the key of the order (or 'board', 'leave') that has had its first tap
    let stakes = null; // the boarding that is due, as the column says it
    let squad = null; // the crew ids picked to go, or null for the healthiest
    let squadOpen = false; // the squad card is up
    let squadWhy = null; // why the last pick changed nothing
    let armTimer = 0;
    let dirty = true;
    let buttons = [];
    // The round being played out: { timeline, start, heard (ms played so
    // far), lines (of the round's shown) }, or null.
    let playing = null;
    let resting = restingPose(null); // where the ships stand when nothing plays
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(carryButton, () => game.dispatch({ type: 'campaign/approach/close' })),
      onTap(squadButton, () => openSquad(!squadOpen)),
      onTap(boardButton, (press) => decide('board', () => game.dispatch({ type: 'campaign/boarding/begin', rules: defs, squad }), press), { confirm: true }),
      onTap(leaveButton, (press) => decide('leave', () => game.dispatch({ type: 'campaign/approach/close' }), press), { confirm: true }),
      ...SIDES.map((side) => attachGestures(ships[side].area, { tap: skip })),
      () => clearTimeout(armTimer),
      () => buttons.forEach((entry) => entry.detach()),
      () => squadCard.detach(),
      game.subscribe((state) => alive && render(state.campaign)),
    ];
    const observer = new ResizeObserver(() => layout());
    for (const side of SIDES) observer.observe(ships[side].hole);
    cleanups.push(() => observer.disconnect());

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        render(game.getState().campaign, true);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // force: draw again though the campaign hasn't changed (a first tap, a
    // line of the round played).
    function render(campaign, force = false) {
      if (!defs || !campaign || (campaign === shown && !force)) return;
      const before = shown;
      shown = campaign;
      const text = approachText(campaign, defs);
      if (!text) {
        // Nothing to face: back to the chart.
        game.dispatch({ type: 'screen/show', screen: 'sector' });
        return;
      }
      const approach = campaign.run.approach;
      showShip('you', text.you, campaign.ship);
      showShip('them', text.them, approach.them.ship);
      if (campaign !== before) played(before?.run?.approach, approach);
      setText(actLine, text.act);
      setText(whereLine, text.where);
      setText(roundLine, playing ? `Round ${playing.round}` : text.round);
      // Tips wait while a round plays (tipSteps.js, M43).
      el.dataset.playing = String(Boolean(playing));
      heat.show(text.heat);

      // Their order, and the player's.
      intentHead.hidden = intent.hidden = !text.intent;
      if (text.intent) setText(intent, text.intent.text);
      stakes = playing ? null : text.outcome?.boarding ?? null;
      const choosing = armed === 'board' || armed === 'leave';
      if (armed && (choosing ? !stakes || (armed === 'leave' && !stakes.leave) : !text.orders.some((order) => order.key === armed && order.ok))) disarm();
      showOrders(text.orders);
      fireLabel.hidden = fire.hidden = moves.hidden = Boolean(text.outcome) && !playing;
      carryButton.hidden = !text.outcome || Boolean(stakes) || Boolean(playing);
      boardButton.hidden = !stakes;
      leaveButton.hidden = !stakes?.leave;
      if (stakes) {
        setButton(boardButton, armed === 'board' ? stakes.begin.ask : stakes.begin.label, armed === 'board');
        if (stakes.leave) setButton(leaveButton, armed === 'leave' ? stakes.leave.ask : stakes.leave.label, armed === 'leave');
      }

      // Who goes, when a boarding is due and not all can.
      const pick = stakes ? squadText(campaign, defs, squad) : null;
      if (!pick?.show) squadOpen = false;
      squadButton.hidden = !pick?.show;
      if (pick?.show) setText(squadButton.querySelector('span'), pick.label);
      squadButton.setAttribute('aria-expanded', String(squadOpen));
      squadButton.setAttribute('aria-label', pick?.show ? `${pick.label}: who goes` : 'Squad');
      squadCard.show(squadOpen ? pick : null, squadWhy);

      // How it ended, once the round that ended it has played.
      const ended = text.outcome && !playing;
      out.hidden = !ended;
      for (const side of SIDES) ships[side].area.dataset.boarded = String(Boolean(ended) && text.outcome.board === side);
      if (ended) {
        setText(outTitle, text.outcome.title);
        const lines = pick?.show ? [...text.outcome.lines, pick.line] : text.outcome.lines;
        outLines.replaceChildren(...lines.map((line) => node('li', null, line)));
      }
      const last = playing ? text.last.slice(0, playing.lines) : text.last;
      logHead.hidden = !last.length;
      setText(logHead, text.lastHead);
      log.replaceChildren(...last.map((line) => node('li', null, line)));

      const picked = armed === 'board' ? stakes.begin : armed === 'leave' ? stakes.leave : text.orders.find((order) => order.key === armed);
      setText(hint, playing ? '' : picked ? picked.text : text.hint.text);
      hint.dataset.tone = picked ? 'warn' : text.hint.tone;
      hint.hidden = !hint.textContent;

      // The ships as they stand, and the parts a Fire order armed aims at.
      resting = restingPose(approach.outcome);
      if (!playing) {
        picture.setMarks('you', approach.you);
        picture.setMarks('them', { ...approach.them, target: picked?.targets ?? null });
      }
      dirty = true;
    }

    // A round just given, after the one shown: played out from the ships
    // as they stood, unless motion is reduced, when its sounds play at
    // once. A patrol's or a trap's opening volley comes before the screen.
    function played(was, approach) {
      const last = approach.last;
      if (!was || !last || last === was.last || last.order === null || was.node !== approach.node) return;
      if (motionReduced(game.getState().settings ?? {})) {
        roundSounds(last).forEach(cue);
        buzz(roundBuzz(last));
        return;
      }
      const geometry = Object.fromEntries(SIDES.map((side) => [side, shipGeometry({ ship: ships[side].ship, defs, hull: ships[side].hull, wrecked: was[side].wrecked })]));
      const timeline = roundTimeline({ events: last.events, before: { you: was.you, them: was.them }, outcome: approach.outcome, geometry });
      playing = { timeline, start: now(), speed: playbackSpeed(), heard: -1, lines: 0, round: was.round };
      disarm();
      squadOpen = false;
    }

    // A tap while a round plays: on to its end.
    function skip() {
      if (!playing) return false;
      playing = null;
      render(game.getState().campaign, true);
      return true;
    }

    // The squad card up or down.
    function openSquad(open) {
      if (!defs) return;
      squadOpen = open;
      squadWhy = null;
      render(game.getState().campaign, true);
    }

    // A tap on someone in the squad card: takes them, or leaves them aboard,
    // unless that would leave no one going or more than a squad takes.
    function pickMember(id) {
      const campaign = game.getState().campaign;
      if (!defs || !campaign) return;
      const going = squadText(campaign, defs, squad).members.filter((member) => member.going).map((member) => member.id);
      const next = going.includes(id) ? going.filter((each) => each !== id) : [...going, id];
      squadWhy = squadProblem(campaign.crew, next, defs);
      if (!squadWhy) squad = next;
      render(campaign, true);
    }

    // A tool button's words, and whether it waits for its second tap.
    function setButton(button, label, waiting) {
      setText(button.querySelector('span'), label);
      button.dataset.armed = String(waiting);
    }

    // Board her or leave her: the first tap says what it means, the second
    // does it. With no choice (she is boarding), one tap begins the fight.
    function decide(key, act, press) {
      if (!defs || !stakes || skip()) return;
      if (key === 'board' && !stakes.leave) {
        act();
        return;
      }
      if (!confirms(armed === key, press)) {
        armed = key;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) render(game.getState().campaign, true);
        }, ARM_MS);
        render(game.getState().campaign, true);
        return;
      }
      disarm();
      act();
    }

    // A ship's name and numbers, and her picture when she changes.
    function showShip(side, words, ship) {
      const view = ships[side];
      setText(view.name, words.name);
      setText(view.stats, words.stats.map(([label, value]) => `${label} ${value}`).join(' · '));
      if (view.ship === ship) return;
      view.ship = ship;
      view.hull = traceHull(ship, defs);
      view.box = boardBox(defs.frames.get(ship.frame) ?? { width: 1, height: 1 }, view.hull, NO_MIN);
      picture.setShip(side, { ship, defs, hull: view.hull, skin: skinFor('yard') });
      fitSide(side);
    }

    // The order buttons, made again each time: fire's four, then evade,
    // flee and board.
    function showOrders(orders) {
      buttons.forEach((entry) => entry.detach());
      buttons = orders.map((order) => {
        const button = node('button', 'btn apr-order');
        button.type = 'button';
        button.dataset.key = order.key;
        button.dataset.ok = String(order.ok);
        button.dataset.armed = String(armed === order.key);
        button.append(node('span', null, armed === order.key ? order.ask : order.label));
        if (order.small) button.append(node('small', null, order.small));
        button.setAttribute('aria-label', order.ok ? order.text.replace(' Tap again to fire.', '') : `${order.label}: ${order.why}`);
        return { button, detach: onTap(button, (press) => tap(order, press), { confirm: true }) };
      });
      const isFire = (entry) => entry.button.dataset.key.startsWith('fire-');
      fire.replaceChildren(...buttons.filter(isFire).map((entry) => entry.button));
      moves.replaceChildren(...buttons.filter((entry) => !isFire(entry)).map((entry) => entry.button));
    }

    // The first tap shows what an order does; the second gives it. One that
    // can't be given says why. A tap while a round plays skips it.
    function tap(order, press) {
      if (!defs || skip()) return;
      if (!order.ok) {
        disarm();
        setText(hint, order.why);
        hint.dataset.tone = 'bad';
        hint.hidden = false;
        return;
      }
      if (!confirms(armed === order.key, press)) {
        armed = order.key;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) render(game.getState().campaign, true);
        }, ARM_MS);
        render(game.getState().campaign, true);
        return;
      }
      disarm();
      game.dispatch({ type: 'campaign/approach/order', order: order.order, rules: defs });
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
    }

    function layout() {
      if (!alive) return;
      for (const side of SIDES) fitSide(side);
    }

    // Fits a ship's camera to her hole.
    function fitSide(side) {
      const view = ships[side];
      const r = view.hole.getBoundingClientRect();
      if (!view.box || r.width < 48 || r.height < 48) {
        picture.place(side, null, null, null);
        return;
      }
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      const { box } = view;
      const cam = fitOrbit({ ...BOARD_VIEW, yaw: YAWS[side], pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, MARGIN);
      picture.place(side, cam, rect, box);
      dirty = true;
    }

    return {
      resize() {
        layout();
      },
      draw(ctx, view) {
        if (!dirty && !playing) return;
        dirty = false;
        let frame = resting;
        if (playing) {
          const t = (now() - playing.start) * playing.speed;
          frame = frameAt(playing.timeline, t);
          roundCues(playing.timeline, playing.heard, t).forEach(cue);
          roundBuzzes(playing.timeline, playing.heard, t).forEach(buzz);
          playing.heard = t;
          picture.setMarks('you', frame.marks.you);
          picture.setMarks('them', frame.marks.them);
          if (frame.done) {
            playing = null;
            render(game.getState().campaign, true);
            frame = resting;
          } else if (frame.lines !== playing.lines) {
            playing.lines = frame.lines;
            render(game.getState().campaign, true);
          }
        }
        picture.draw(ctx, view, frame);
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
