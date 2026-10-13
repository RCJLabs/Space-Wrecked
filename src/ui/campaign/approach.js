// The approach screen (ROADMAP §4.2): a hostile ship met on the run, played
// round by round (src/sim/encounter.js). The two ships stand side by side,
// each drawn as its boarding map, so a wrecked room shows its fire, vacuum
// or rubble the moment it happens; the player's on the left, the other
// turned to face it. The right-hand column is words only, so it can scroll
// on a short screen without hiding a button: what the other ship will do
// this round, what the order tapped would do, and what the last round came
// to, roll by roll. The orders run along the bottom, each with its odds:
// fire at their guns, engines, shields or reactor, evade, flee, or board.
// A tap shows what an order does and its odds in full, a second gives it;
// an order that can't be given says why. Once it is over, the column says
// how it ended and what it came to, the boarded ship's map is marked, and
// Carry on, in the orders' place, goes back to the chart. Every round is
// saved as it is played.
import { loadContent } from '../../platform/content.js';
import { battleBoxes } from '../../render/battleScene.js';
import { BATTLE_VIEW, createBattleBoard } from '../../render/battleView.js';
import { fitOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { mapFromShip } from '../../sim/mapFromShip.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { approachText } from './approachText.js';
import { heatChip } from './hubParts.js';

const ARM_MS = 3000; // an order waits this long for its second tap
const MARGIN = 8; // pixels around each ship
const SETTLE_MS = 150;
const SIDES = ['you', 'them'];
// The other ship is seen from the far side, so the two face each other.
const YAWS = { you: BATTLE_VIEW.yaw, them: BATTLE_VIEW.yaw + Math.PI };

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
        return [side, { area, name, stats, hole, board: createBattleBoard(), wrecked: null, map: null, camera: null, rect: null }];
      }),
    );

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
    carryButton.hidden = true;
    foot.append(titleButton, fireLabel, fire, moves, carryButton);
    el.append(head, ships.you.area, ships.them.area, column, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let shown = null;
    let armed = null; // the key of the order that has had its first tap
    let armTimer = 0;
    let settleTimer = 0;
    let dirty = true;
    let buttons = [];
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(carryButton, () => game.dispatch({ type: 'campaign/approach/close' })),
      () => clearTimeout(armTimer),
      () => clearTimeout(settleTimer),
      () => buttons.forEach((entry) => entry.detach()),
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

    // force: draw again though the campaign hasn't changed (a first tap).
    function render(campaign, force = false) {
      if (!defs || !campaign || (campaign === shown && !force)) return;
      shown = campaign;
      const text = approachText(campaign, defs);
      if (!text) {
        // Nothing to face: back to the chart.
        game.dispatch({ type: 'screen/show', screen: 'sector' });
        return;
      }
      setText(actLine, text.act);
      setText(whereLine, text.where);
      setText(roundLine, text.round);
      heat.show(text.heat);
      const approach = campaign.run.approach;
      showShip('you', text.you, campaign.ship);
      showShip('them', text.them, approach.them.ship);

      // Their order, and the player's.
      intentHead.hidden = intent.hidden = !text.intent;
      if (text.intent) setText(intent, text.intent.text);
      if (armed && !text.orders.some((order) => order.key === armed && order.ok)) disarm();
      showOrders(text.orders);
      fireLabel.hidden = fire.hidden = moves.hidden = Boolean(text.outcome);
      carryButton.hidden = !text.outcome;

      // How it ended.
      out.hidden = !text.outcome;
      for (const side of SIDES) ships[side].area.dataset.boarded = String(text.outcome?.board === side);
      if (text.outcome) {
        setText(outTitle, text.outcome.title);
        outLines.replaceChildren(...text.outcome.lines.map((line) => node('li', null, line)));
      }
      logHead.hidden = !text.last.length;
      log.replaceChildren(...text.last.map((line) => node('li', null, line)));

      const picked = text.orders.find((order) => order.key === armed);
      setText(hint, picked ? picked.text : text.hint.text);
      hint.dataset.tone = picked ? 'warn' : text.hint.tone;
      hint.hidden = !hint.textContent;
    }

    function showShip(side, words, ship) {
      const view = ships[side];
      setText(view.name, words.name);
      setText(view.stats, words.stats.map(([label, value]) => `${label} ${value}`).join(' · '));
      const key = JSON.stringify(words.wrecked);
      if (view.wrecked === key && view.ship === ship) return;
      view.wrecked = key;
      view.ship = ship;
      view.map = mapFromShip(ship, defs, { wrecked: words.wrecked });
      view.board.setMap({ map: view.map, skin: skinFor('yard') });
      fitSide(side);
      dirty = true;
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
        return { button, detach: onTap(button, () => tap(order)) };
      });
      const isFire = (entry) => entry.button.dataset.key.startsWith('fire-');
      fire.replaceChildren(...buttons.filter(isFire).map((entry) => entry.button));
      moves.replaceChildren(...buttons.filter((entry) => !isFire(entry)).map((entry) => entry.button));
    }

    // The first tap shows what an order does; the second gives it. One that
    // can't be given says why.
    function tap(order) {
      if (!defs) return;
      if (!order.ok) {
        disarm();
        setText(hint, order.why);
        hint.dataset.tone = 'bad';
        hint.hidden = false;
        return;
      }
      if (armed !== order.key) {
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
      dirty = true;
    }

    // Fits a ship's map to its hole.
    function fitSide(side) {
      const view = ships[side];
      const r = view.hole.getBoundingClientRect();
      if (!view.map || r.width < 48 || r.height < 48) {
        view.camera = null;
        return;
      }
      view.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      const { fit } = battleBoxes(view.map);
      view.camera = fitOrbit({ ...BATTLE_VIEW, yaw: YAWS[side], pivot: [(fit.x0 + fit.x1) / 2, (fit.y0 + fit.y1) / 2] }, view.rect, fit, MARGIN);
    }

    return {
      resize() {
        layout();
      },
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        let rough = false;
        for (const side of SIDES) {
          const { board, camera, rect } = ships[side];
          if (!camera || !rect) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(rect.x, rect.y, rect.w, rect.h);
          ctx.clip();
          rough = board.draw(ctx, camera, rect) || rough;
          ctx.restore();
        }
        if (rough) {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => (dirty = true), SETTLE_MS);
        }
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
