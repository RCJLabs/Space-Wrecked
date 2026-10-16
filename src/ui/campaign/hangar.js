// The hangar: act 1's home, between fights. The half-built ship stands in
// the middle, seen from outside. Around it are the act's goal (the flight
// checklist, each fix saying whether the part is on hand), the crew with
// their hit points, and what the campaign holds. Build opens construction
// mode (construction.js) on the ship; Jobs opens the job board (jobs.js),
// where the parts still missing are earned, and Shop the district's shop
// (shop.js), where they are bought. Under them, the crew's standing with
// each side (M33). Heat shows by the act, with
// Pay to buy some off (a tap shows the price, a second pays); once heat
// brings a raid, Defend takes the place of Jobs. Once every flight check
// passes, Launch shows at the top of the goal: a tap says what launching
// means, a second lifts off (launch.js), raid or no raid. Everything the
// campaign holds is saved as it changes, so the hangar reopens as it was
// left.
import { loadContent } from '../../platform/content.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { createShipStand, crewRows, heatChip, listRows, panel, sideRows } from './hubParts.js';
import { hangarText } from './hubText.js';

const ARM_MS = 3000; // Pay and Launch wait this long for a second tap

export const hangarScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hgr-home');
    const heat = heatChip();
    head.append(actLine, homeLine, heat.el);
    const launchButton = toolButton('hgr-launch', icons.launch, 'Launch');
    launchButton.hidden = true;
    const goalLines = node('ul', 'hgr-goal');
    const crewList = node('ul', 'hgr-crew');
    const holdings = node('dl', 'hgr-hold');
    const sideList = node('ul', 'hgr-sides');
    const shipArea = node('div', 'hgr-ship');
    const side = node('div', 'hgr-side');
    side.append(panel('Crew', crewList), panel('Hangar', holdings), panel('Sides', sideList));
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = node('p', 'hgr-hint', 'Loading…');
    const payButton = toolButton('hgr-pay', icons.pay, 'Pay');
    const shopButton = toolButton('hgr-shop', icons.shop, 'Shop');
    const jobsButton = toolButton('hgr-jobs', icons.jobs, 'Jobs');
    const buildButton = toolButton('hgr-build', icons.build, 'Build');
    payButton.hidden = shopButton.hidden = true;
    jobsButton.disabled = buildButton.disabled = true;
    titleButton.setAttribute('aria-label', 'Title');
    foot.append(titleButton, hint, payButton, shopButton, jobsButton, buildButton);
    el.append(head, panel('Goal: launch', launchButton, goalLines), shipArea, side, foot);
    root.append(el);

    let defs = null;
    const stand = createShipStand(shipArea);
    let alive = true;
    let shown = null; // the campaign the screen shows
    let armed = null; // 'pay' or 'launch' once it has had its first tap
    let armTimer = 0;
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(buildButton, () => game.dispatch({ type: 'screen/show', screen: 'construction' })),
      onTap(jobsButton, () => {
        if (!defs) return;
        const { campaign } = game.getState();
        if (hangarText(campaign, defs).raid) game.dispatch({ type: 'campaign/raid/begin', rules: defs });
        else game.dispatch({ type: 'screen/show', screen: 'jobs' });
      }),
      onTap(payButton, () => twoTaps('pay', payButton, () => game.dispatch({ type: 'campaign/pay', rules: defs }))),
      onTap(launchButton, () => twoTaps('launch', launchButton, () => game.dispatch({ type: 'campaign/launch', rules: defs }))),
      onTap(shopButton, () => game.dispatch({ type: 'screen/show', screen: 'shop' })),
      () => clearTimeout(armTimer),
      game.subscribe((state) => alive && render(state.campaign)),
    ];
    const observer = new ResizeObserver(() => stand.layout());
    observer.observe(shipArea);
    cleanups.push(() => observer.disconnect());

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        // A campaign saved before there were jobs or a shop gets its first
        // board and stock.
        const saved = game.getState().campaign;
        if (saved && (!saved.board.length || saved.shop === null)) game.dispatch({ type: 'campaign/board', rules: defs });
        render(game.getState().campaign);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // force: draw the panels again though the campaign hasn't changed.
    function render(campaign, force = false) {
      if (!defs || !campaign || (campaign === shown && !force)) return;
      const shipChanged = campaign.ship !== shown?.ship;
      shown = campaign;
      const text = hangarText(campaign, defs);
      setText(actLine, text.act);
      setText(homeLine, text.home);
      goalLines.replaceChildren(
        ...text.goal.lines.map(({ ok, text: line, fix }) => {
          const item = node('li');
          item.dataset.ok = String(ok);
          item.append(node('span', 'hgr-line', line));
          if (fix) item.append(node('span', 'hgr-fix', fix));
          return item;
        }),
      );
      crewList.replaceChildren(...crewRows(text.crew));
      holdings.replaceChildren(...listRows(text.holdings));
      sideList.replaceChildren(...sideRows(text.sides));
      // Heat, and the payment that buys some off.
      const { raid } = text;
      heat.show(text.heat);
      const { payment } = text.heat;
      payButton.hidden = !payment;
      if (payment) {
        payButton.disabled = !payment.ok;
        if (!payment.ok && armed === 'pay') disarm();
        setText(payButton.querySelector('span'), armed === 'pay' ? payment.ask : payment.label);
        payButton.dataset.armed = String(armed === 'pay');
        payButton.setAttribute('aria-label', payment.text);
      }
      // Launch, once every flight check passes.
      const { launch } = text;
      if (!launch.ok && armed === 'launch') disarm();
      launchButton.hidden = !launch.ok;
      el.dataset.ready = String(launch.ok);
      setText(launchButton.querySelector('span'), armed === 'launch' ? 'Launch?' : 'Launch');
      launchButton.dataset.armed = String(armed === 'launch');
      // A raid at the door: Defend in place of Jobs.
      const raiding = String(Boolean(raid));
      if (jobsButton.dataset.raid !== raiding) {
        jobsButton.dataset.raid = raiding;
        jobsButton.querySelector('svg').outerHTML = raid ? icons.shoot : icons.jobs;
      }
      setText(jobsButton.querySelector('span'), raid ? 'Defend' : 'Jobs');
      jobsButton.disabled = Boolean(raid && !raid.ok);
      shopButton.hidden = !text.shop;
      buildButton.disabled = false;
      const ask = armed === 'pay' ? payment?.text : armed === 'launch' ? launch.ask : null;
      setText(hint, ask ?? text.hint.text);
      hint.dataset.tone = ask ? 'warn' : text.hint.tone;
      if (shipChanged) stand.show(campaign.ship, defs);
    }

    // Pay and Launch: the first tap says what it does, the second does it.
    function twoTaps(which, button, act) {
      if (!defs || button.disabled || button.hidden) return;
      if (armed !== which) {
        armed = which;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) rerender();
        }, ARM_MS);
        rerender();
        return;
      }
      disarm();
      act();
      if (alive) rerender();
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
    }

    // Draws the panels again, the campaign unchanged (the two taps).
    function rerender() {
      render(game.getState().campaign, true);
    }

    return {
      resize() {
        stand.layout();
      },
      // The ship stands still: it is drawn again only when it or the screen
      // changes.
      draw(ctx, view) {
        stand.draw(ctx, view);
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
