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
// means, and which quests it would end (M33b), a second lifts off
// (launch.js), raid or no raid. Under the sides, the quests and where each
// stands (M33b). From M37 a tap on the crew opens the crew card
// (crewCard.js) over the goal and the ship, where a spare weapon is swapped
// in two taps. Everything the campaign holds is saved as it changes, so
// the hangar reopens as it was left.
import { loadContent } from '../../platform/content.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { confirms } from '../confirm.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { buildWith } from './construction.js';
import { createCrewCard } from './crewCard.js';
import { crewCardText, crewSaid } from './crewText.js';
import { createShipStand, crewRows, heatChip, listRows, panel, questRows, sideRows } from './hubParts.js';
import { hangarText } from './hubText.js';
import { liveStatus } from '../a11y.js';

const ARM_MS = 3000; // Pay, Launch and a swap on the crew card wait this long for a second tap

export const hangarScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr hgr-hangar');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hgr-home');
    const heat = heatChip();
    head.append(actLine, homeLine, heat.el);
    const launchButton = toolButton('hgr-launch', icons.launch, 'Launch');
    launchButton.hidden = true;
    const goalLines = node('ul', 'hgr-goal');
    const crewList = node('ul', 'hgr-crew');
    // The crew panel opens the crew card (M37): a button lies over the
    // whole panel, so a tap anywhere on it does.
    const crewTitle = node('h2');
    crewTitle.append(node('span', null, 'Crew'), node('b', null, '›'));
    crewTitle.setAttribute('aria-hidden', 'true');
    const crewOpener = node('button', 'sct-crew-open');
    crewOpener.type = 'button';
    crewOpener.setAttribute('aria-label', 'Crew');
    crewOpener.setAttribute('aria-expanded', 'false');
    const crewPanel = node('section', 'hgr-panel sct-crew-panel');
    crewPanel.append(crewTitle, crewList, crewOpener);
    const holdings = node('dl', 'hgr-hold');
    const sideList = node('ul', 'hgr-sides');
    const questList = node('ul', 'hgr-quests');
    const shipArea = node('div', 'hgr-ship');
    const side = node('div', 'hgr-side');
    side.append(crewPanel, panel('Hangar', holdings), panel('Sides', sideList), panel('Quests', questList));
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = liveStatus(node('p', 'hgr-hint', 'Loading…'));
    const payButton = toolButton('hgr-pay', icons.pay, 'Pay');
    const shopButton = toolButton('hgr-shop', icons.shop, 'Shop');
    const jobsButton = toolButton('hgr-jobs', icons.jobs, 'Jobs');
    const buildButton = toolButton('hgr-build', icons.build, 'Build');
    payButton.hidden = shopButton.hidden = true;
    jobsButton.disabled = buildButton.disabled = true;
    titleButton.setAttribute('aria-label', 'Title');
    foot.append(titleButton, hint, payButton, shopButton, jobsButton, buildButton);
    const goalPanel = panel('Goal: launch', launchButton, goalLines);
    goalPanel.classList.add('hgr-goal-panel');
    const crewCard = createCrewCard({ tap: tapCrew, done: () => toggleCrew(false) });
    el.append(head, goalPanel, shipArea, side, foot, crewCard.el);
    root.append(el);

    let defs = null;
    const stand = createShipStand(shipArea);
    let alive = true;
    let shown = null; // the campaign the screen shows
    let armed = null; // 'pay', 'launch' or a crew card swap's key ('arm:<id>:<weapon>') once it has had its first tap
    let crewOpen = false; // the crew card is up
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
      onTap(payButton, (press) => twoTaps('pay', payButton, () => game.dispatch({ type: 'campaign/pay', rules: defs }), press), { confirm: true }),
      onTap(launchButton, (press) => twoTaps('launch', launchButton, () => game.dispatch({ type: 'campaign/launch', rules: defs }), press), { confirm: true }),
      onTap(shopButton, () => game.dispatch({ type: 'screen/show', screen: 'shop' })),
      onTap(crewOpener, () => toggleCrew(!crewOpen)),
      () => crewCard.detach(),
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
        ...text.goal.lines.map(({ ok, text: line, fix, add }) => {
          const item = node('li');
          item.dataset.ok = String(ok);
          // A line whose part is on hand is a shortcut (M44): the builder
          // with that part armed, its ghost where it fits best.
          const body = add ? node('button', 'btn hgr-add') : item;
          body.append(node('span', 'hgr-line', line));
          if (fix) body.append(node('span', 'hgr-fix', fix));
          if (add) {
            body.type = 'button';
            onTap(body, () => buildWith(game, add));
            item.append(body);
          }
          return item;
        }),
      );
      crewList.replaceChildren(...crewRows(text.crew));
      // The crew card, over the goal and the ship, which take no taps under
      // it.
      const crew = crewOpen ? crewCardText(campaign, defs) : null;
      const swapping = typeof armed === 'string' && (armed.startsWith('arm:') || armed.startsWith('hire:'));
      const crewAsk = swapping ? crewSaid(crew, armed) : null;
      if (swapping && !crewAsk) disarm();
      crewCard.show(crew, armed);
      el.dataset.crew = String(crewOpen);
      crewOpener.setAttribute('aria-expanded', String(crewOpen));
      crewPanel.dataset.open = String(crewOpen);
      goalPanel.inert = crewOpen;
      shipArea.inert = crewOpen;
      holdings.replaceChildren(...listRows(text.holdings));
      sideList.replaceChildren(...sideRows(text.sides));
      questList.replaceChildren(...questRows(text.quests));
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
      const said = crewAsk ?? (ask ? { tone: 'warn', text: ask } : crew ? crew.hint : text.hint);
      setText(hint, said.text);
      hint.dataset.tone = said.tone;
      if (shipChanged) stand.show(campaign.ship, defs);
    }

    // Pay and Launch: the first tap says what it does, the second does it.
    function twoTaps(which, button, act, press) {
      if (!defs || button.disabled || button.hidden) return;
      if (!confirms(armed === which, press)) {
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

    // The crew card up or down: what had a first tap is put down either way.
    function toggleCrew(open) {
      if (!defs) return;
      crewOpen = open;
      disarm();
      rerender();
    }

    // A spare weapon's button on the crew card, or from M41 the hangar's
    // recruit's: the first tap says what the swap or the signing on does,
    // the second makes it.
    function tapCrew(key, press) {
      if (!defs) return;
      if (!confirms(armed === key, press)) {
        armed = key;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) rerender();
        }, ARM_MS);
        rerender();
        return;
      }
      disarm();
      const [kind, id, weapon] = key.split(':');
      if (kind === 'hire') game.dispatch({ type: 'campaign/hire', slot: Number(id), rules: defs });
      else game.dispatch({ type: 'campaign/arms/swap', id: Number(id), weapon, rules: defs });
      if (alive) rerender();
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
