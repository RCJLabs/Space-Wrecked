// The colony: act 3's home (M26, M27). The world's ground fills the middle,
// the ship landed at the edge of the colony's grid and each building
// standing on it (render/colonyScene.js); a drag pans the view, a pinch
// zooms it and a twist turns it (colonyStand.js). On the left, the colony's
// power, beds and air against what the crew needs, its food and materials
// against its stores, its buildings, the crew, the world and how the run
// went, and the crew's standing with each side (M33). On the right, what can
// be built: a farm or a mine from materials,
// a spare part from the hold or one of the ship's parts, each with what it
// costs and gives, and why not for the rest. A tap on one shows it as a
// ghost on the grid, in the first spot that fits; a tap on the grid moves
// the ghost there, or says why it can't stand there; Turn turns it; a
// second tap on it, or Build here, builds it (src/sim/colonyBuild.js). A tap
// on a building looks at it: Move and Turn take it up as a ghost the same
// way, and Take down takes it down in two taps. In the foot, Next day
// passes a day in two taps (src/sim/days.js), with the day's report in the
// hint, and Refit opens construction mode on the landed ship. From M28 the
// places within reach head the right-hand panel, and a trip is planned and
// flown from there (colonyTrip.js); while the ship is away its pad stands
// empty, the panel is where the squad is, and Refit and Next day wait for
// it to come home. From M29 heat shows in the head, with the pursuer's
// words for it, and the raid's line closes the needs: the day's odds of
// the colony being found, or the days until the lander comes. While it is
// down, Defend takes the place of Next day: the first tap says what the
// guns will fire and at what odds, the second fires them and opens the
// fight on the colony's grid (src/sim/raids.js), or says what came of the
// landing without one. From M33c a tap on the crew opens the crew card
// (crewCard.js) over the panel and the ground: each one's face, rank and
// what they bring, a companion's past and loyalty, and from M37 what they
// carry, a spare weapon swapped in two taps. From M38d Voyage heads the
// right-hand panel: a voyage is planned and flown from there
// (colonyVoyage.js), and the chart takes over while the ship is away. From
// M38f its citizens are a line of the needs, and landed again, the hint
// tells what happened while the ship was away (newsText.js), till the
// first day passes. From M53 Heat follows them: Lie low and a payment to
// the pursuer, and the friendly side's trader when one is here
// (colonyLevers.js). The campaign is saved after every change, so Continue
// on the title comes back here.
import { loadContent } from '../../platform/content.js';
import { buildPlan, build, movePlan, takeDown, takeDownPlan, turnedSpot } from '../../sim/colonyBuild.js';
import { buildingName, siteDef } from '../../sim/colony.js';
import { dayPlan, nextDay } from '../../sim/days.js';
import { faceRaid, raidDown } from '../../sim/raids.js';
import { fightSettings } from '../../sim/settings.js';
import { footprint } from '../../sim/modules.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { confirms, holdMode } from '../confirm.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { buildingInfo, builtText, colonyText, dayReport, dayText, givenText, placeText, takeDownText, takenText, whyNotText } from './colonyText.js';
import { createStand } from './colonyStand.js';
import { aboardAt, landingTimeline, paintLanding, shotsBetween } from '../../render/raidLanding.js';
import { START_COLUMNS } from '../../sim/colonyMap.js';
import { cue } from '../../platform/audio.js';
import { createTrips } from './colonyTrip.js';
import { takeCarried } from './carried.js';
import { createVoyages } from './colonyVoyage.js';
import { createLevers } from './colonyLevers.js';
import { ghostNearText } from './neighbourText.js';
import { createCrewCard } from './crewCard.js';
import { crewCardText, crewSaid } from './crewText.js';
import { crewRows, heatChip, listRows, questRows, sideRows } from './hubParts.js';
import { createSidePager } from './sidePager.js';
import { easedSaid } from './questText.js';
import { defendText, landingReport, raidHint } from './raidText.js';
import { liveStatus, surface } from '../a11y.js';

const ARM_MS = 4000; // a first tap on Next day, Defend or Take down waits this long for its second

export const colonyScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr cln');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hgr-home');
    const heat = heatChip();
    const shipLine = node('p', 'hgr-ship');
    head.append(actLine, homeLine, shipLine, heat.el);
    // The colony, its buildings, the crew and the world, in one panel.
    const info = node('section', 'hgr-panel cln-info');
    const needs = node('dl', 'hgr-hold cln-needs');
    const powerLine = node('p', 'cln-note');
    const storesLine = node('p', 'cln-note');
    const buildingList = node('ul', 'cln-buildings');
    const crewList = node('ul', 'hgr-crew');
    // The crew opens the crew card (M33c): a button lies over the heading
    // and the list, so a tap anywhere on them does.
    const crewTitle = node('h2');
    crewTitle.append(node('span', null, 'Crew'), node('b', null, '›'));
    crewTitle.setAttribute('aria-hidden', 'true');
    const crewOpener = node('button', 'sct-crew-open');
    crewOpener.type = 'button';
    crewOpener.setAttribute('aria-label', 'Crew');
    crewOpener.setAttribute('aria-expanded', 'false');
    const crewBox = node('div', 'cln-crew');
    crewBox.append(crewTitle, crewList, crewOpener);
    const sideList = node('ul', 'hgr-sides');
    const questList = node('ul', 'hgr-quests');
    const worldTitle = node('h2', 'cln-world');
    const worldLines = node('ul', 'cln-lines');
    const recordTitle = node('h2');
    const record = node('dl', 'hgr-hold');
    // Each heading with what is under it in a group of its own, so on a
    // folded screen the panel shows one group at a time (M57, sidePager.js).
    const group = (...children) => {
      const box = node('div', 'cln-group');
      box.append(...children);
      return box;
    };
    info.append(
      group(node('h2', null, 'The colony'), needs, powerLine, storesLine),
      group(node('h2', null, 'Buildings'), buildingList),
      crewBox,
      group(node('h2', null, 'Sides'), sideList),
      group(node('h2', null, 'Quests'), questList),
      group(worldTitle, worldLines),
      group(recordTitle, record),
    );
    const pager = createSidePager(info);
    const sceneArea = surface(node('div', 'hgr-ship cln-scene'), 'The colony\'s ground: tap a building for its details; with one picked to build, tap where it goes');
    // What can be built, or the ghost's controls, or the building looked at.
    const side = node('section', 'hgr-panel cln-parts');
    const partsPager = createSidePager(side, { pages: '.cln-group' });
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = liveStatus(node('p', 'hgr-hint', 'Loading…'));
    const refitButton = toolButton('hgr-tool cln-refit', icons.build, 'Refit');
    const dayButton = toolButton('hgr-tool cln-day', icons.day, 'Next day');
    // In Next day's place while a raid's lander is down (M29).
    const defendButton = toolButton('hgr-tool cln-defend', icons.shoot, 'Defend');
    foot.append(titleButton, hint, refitButton, dayButton, defendButton);
    const crewCard = createCrewCard({ tap: tapCrew, done: () => toggleCrew(false) });
    el.append(head, info, sceneArea, side, foot, crewCard.el);
    root.append(el);

    let defs = null;
    let alive = true;
    let shown = null; // the campaign last drawn
    // What the player is doing: { kind: 'browse' }; { kind: 'place', what,
    // type, placement, uid } (uid: the building being moved, else null);
    // or { kind: 'look', uid }.
    let mode = { kind: 'browse' };
    let armed = null; // 'day', 'defend' or 'down', a trip's, 'voyage' (M38d), or a crew card swap's ('arm:<id>:<weapon>', M37): a first tap waiting for its second
    // { text, tone }: what the last tap came to, until the next; first what a
    // flight that landed here from the chart came to (M38f, carried.js).
    let said = takeCarried();
    let landing = null; // { skip } while a raid's landing plays (M51)
    let marked = null; // the ship's parts a refusal is about
    let armTimer = 0;
    let rowButtons = [];
    let drawn = null; // { campaign, whole, mark }: what the stand last showed
    let asked = null; // the campaign the places within reach were asked for
    let crewOpen = false; // the crew card is up
    const trips = createTrips({
      game,
      defs: () => defs,
      rowButton,
      actionRow,
      list,
      keep: (detach) => rowButtons.push(detach),
      armed: () => armed,
      arm,
      disarm,
      say: (words) => {
        said = words;
      },
      refresh: () => alive && render(true),
    });
    const voyages = createVoyages({
      game,
      defs: () => defs,
      rowButton,
      actionRow,
      list,
      keep: (detach) => rowButtons.push(detach),
      armed: () => armed,
      arm,
      disarm,
      say: (words) => {
        said = words;
      },
      refresh: () => alive && render(true),
      cancelTrips: () => trips.cancel(),
    });
    const levers = createLevers({
      game,
      defs: () => defs,
      rowButton,
      list,
      armed: () => armed,
      arm,
      disarm,
      say: (words) => {
        said = words;
      },
      refresh: () => alive && render(true),
    });
    const stand = createStand(sceneArea, { onTap: tapScene, onHold: holdScene });
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(refitButton, () => game.dispatch({ type: 'screen/show', screen: 'construction' })),
      onTap(dayButton, tapDay, { confirm: true }),
      onTap(defendButton, tapDefend, { confirm: true }),
      onTap(crewOpener, () => toggleCrew(!crewOpen)),
      () => crewCard.detach(),
      () => clearTimeout(armTimer),
      () => rowButtons.forEach((detach) => detach()),
      () => stand.dispose(),
      game.subscribe(() => alive && render()),
    ];
    const observer = new ResizeObserver(() => stand.layout());
    observer.observe(sceneArea);
    cleanups.push(() => observer.disconnect());
    // While the landing plays, a tap anywhere skips to its end.
    const skipLanding = (event) => {
      if (!landing) return;
      event.preventDefault();
      event.stopPropagation();
      landing.skip();
    };
    el.addEventListener('pointerdown', skipLanding, true);
    cleanups.push(() => el.removeEventListener('pointerdown', skipLanding, true));

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        render(true);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // force: draw again though the campaign hasn't changed (a tap).
    function render(force = false) {
      const { campaign } = game.getState();
      // While the ship is away on a voyage (M38d) the chart is the screen.
      if (!defs || !campaign?.colony || campaign.colony.voyage || (campaign === shown && !force)) return;
      // The places within reach, rolled the first time they are wanted.
      if (!campaign.colony.trip && !campaign.colony.places.length && asked !== campaign) {
        asked = campaign;
        game.dispatch({ type: 'campaign/places', rules: defs });
        render(true);
        return;
      }
      shown = campaign;
      const away = Boolean(campaign.colony.trip);
      if (away) {
        trips.cancel();
        voyages.cancel();
        mode = { kind: 'browse' };
      }
      const text = colonyText(campaign, defs);
      setText(actLine, text.act);
      setText(homeLine, text.home);
      setText(shipLine, text.ship);
      heat.show(text.heat);
      needs.replaceChildren(...text.needs.map(({ label, value, ok }) => {
        const row = node('div');
        row.dataset.ok = String(ok);
        row.append(node('dt', null, label), node('dd', null, value));
        return row;
      }));
      setText(powerLine, `Power: ${text.power}.`);
      setText(storesLine, `Stores: ${text.stores}.`);
      buildingList.replaceChildren(...(text.buildings.length ? text.buildings.map(buildingRow) : [node('li', 'cln-none', 'None yet: build a farm or a mine, or give the colony a part of the ship.')]));
      const where = (row) => (row.away ? 'away' : row.rough ? 'no bed or air' : row.aboard ? 'sleeps aboard' : null);
      crewList.replaceChildren(...crewRows(text.crew.map((row) => (where(row) ? { ...row, job: [row.job, where(row)].filter(Boolean).join(' · ') } : row))));
      // The crew card, over the panel and the ground, which take no taps
      // under it.
      const crew = crewOpen ? crewCardText(campaign, defs) : null;
      const swapping = typeof armed === 'string' && armed.startsWith('arm:');
      const crewAsk = swapping ? crewSaid(crew, armed) : null;
      if (swapping && !crewAsk) disarm();
      crewCard.show(crew, armed);
      el.dataset.crew = String(crewOpen);
      crewOpener.setAttribute('aria-expanded', String(crewOpen));
      info.inert = crewOpen;
      sceneArea.inert = crewOpen;
      sideList.replaceChildren(...sideRows(text.sides));
      questList.replaceChildren(...questRows(text.quests));
      setText(worldTitle, text.world.title);
      worldLines.replaceChildren(...text.world.lines.map((line) => node('li', null, line)));
      setText(recordTitle, text.record.title);
      record.replaceChildren(...listRows(text.record.lines));

      // A building looked at that is gone, or a ghost whose part is: back
      // to the list.
      if (mode.kind === 'look' && !campaign.colony.buildings.some((b) => b.uid === mode.uid)) mode = { kind: 'browse' };
      if (mode.kind === 'place' && mode.uid !== null && !campaign.colony.buildings.some((b) => b.uid === mode.uid)) mode = { kind: 'browse' };
      const plan = mode.kind === 'place' ? planOf(campaign) : null;
      sideFor(text, campaign, plan);
      const down = raidDown(campaign);
      if (!down && armed === 'defend') disarm();
      dayButton.dataset.armed = String(armed === 'day');
      dayButton.disabled = away;
      dayButton.hidden = down;
      defendButton.hidden = !down;
      defendButton.dataset.armed = String(armed === 'defend');
      refitButton.disabled = away;

      const tripArmed = armed !== null && !['day', 'defend', 'down', 'voyage'].includes(armed) && !armed.startsWith('arm:') && !levers.owns(armed);
      const defend = armed === 'defend' ? defendText(campaign, defs) : null;
      const words = crewAsk ? crewAsk
        : armed === null && crew ? crew.hint
        : armed === 'day' ? dayText(dayPlan(campaign, defs), easedSaid(campaign, defs))
        : defend ? (defend.ok ? { text: defend.ask, tone: 'warn' } : { text: defend.why, tone: 'bad' })
        : armed === 'down' ? takeDownText(takeDownPlan(campaign, defs, mode.uid))
        : armed === 'voyage' ? voyages.hint(campaign)
        : levers.owns(armed) ? levers.hint(campaign) ?? { text: '', tone: 'info' }
        : (tripArmed ? trips.hint(campaign) : null) ?? said ?? (down ? raidHint(campaign, defs) : null) ?? voyages.hint(campaign) ?? trips.hint(campaign) ?? (plan?.same ? { text: `Tap the grid where the ${lowerFirst(buildingName(mode.type, defs))} should go, or turn it.`, tone: 'info' }
          : plan ? placeText(plan, { moving: mode.uid !== null, near: plan.ok ? ghostNearText(campaign, defs, { uid: mode.uid, type: mode.type, ...mode.placement }) : '' })
          : mode.kind === 'look' ? buildingInfo(text.buildings.find((b) => b.uid === mode.uid))
          : raidHint(campaign, defs) ?? text.news ?? text.next);
      setText(hint, words.text);
      hint.dataset.tone = words.tone;

      const ghost = plan ? { type: mode.type, ...mode.placement, ok: plan.ok || plan.same === true } : null;
      const uids = mode.kind === 'place' && mode.what?.uid !== undefined ? [mode.what.uid] : marked ?? [];
      const mark = { uids, ghost, selected: mode.kind === 'look' ? mode.uid : mode.kind === 'place' ? mode.uid : null };
      const whole = mode.kind === 'place';
      el.dataset.mode = away ? 'away' : trips.planning() || voyages.planning() ? 'trip' : mode.kind;
      if (!drawn || campaign !== drawn.campaign || whole !== drawn.whole || JSON.stringify(mark) !== JSON.stringify(drawn.mark)) {
        drawn = { campaign, whole, mark };
        stand.show(campaign, defs, mark, whole);
      }
    }

    // The crew card up or down (M33c).
    function toggleCrew(open) {
      crewOpen = open;
      disarm();
      render(true);
    }

    // A spare weapon's button on the crew card (M37): the first tap says
    // what the swap does, the second makes it.
    function tapCrew(key, press) {
      if (!defs) return;
      if (!confirms(armed === key, press)) {
        said = null;
        arm(key);
        return;
      }
      disarm();
      const [, id, weapon] = key.split(':');
      game.dispatch({ type: 'campaign/arms/swap', id: Number(id), weapon, rules: defs });
      if (alive) render(true);
    }

    // The ghost's plan where it stands: buildPlan's, or movePlan's for a
    // building being moved (same: true where it already stands).
    function planOf(campaign) {
      if (mode.uid === null) return buildPlan(campaign, defs, mode.what, mode.placement);
      const building = campaign.colony.buildings.find((b) => b.uid === mode.uid);
      const same = building && building.x === mode.placement.x && building.y === mode.placement.y && building.rot === mode.placement.rot;
      return { ...movePlan(campaign, defs, mode.uid, mode.placement), same };
    }

    function buildingRow(building) {
      const row = node('li');
      row.dataset.powered = String(building.powered);
      row.append(node('span', 'cln-name', building.name), node('small', null, building.gives));
      return row;
    }

    // The right-hand panel for what the player is doing.
    function sideFor(text, campaign, plan) {
      for (const detach of rowButtons) detach();
      rowButtons = [];
      if (campaign.colony.trip) {
        side.replaceChildren(...trips.awayPanel(campaign));
        return;
      }
      if (trips.planning()) {
        side.replaceChildren(...trips.planPanel(campaign));
        return;
      }
      if (voyages.planning()) {
        side.replaceChildren(...voyages.planPanel(campaign));
        return;
      }
      if (mode.kind === 'place') {
        const moving = mode.uid !== null;
        const confirm = moving ? 'Move here' : mode.what.uid !== undefined ? 'Give here' : mode.what.part ? 'Set down here' : 'Build here';
        const about = node('p', 'cln-placing', buildingName(mode.type, defs));
        about.append(node('small', null, placingLine(text, campaign)));
        side.replaceChildren(
          node('h2', null, moving ? 'Moving' : 'Placing'),
          about,
          actionRow([
            [confirm, icons.done, confirmPlace, 'cln-confirm', plan.ok],
            ['Turn', icons.turn, turnGhost, null, true],
            ['Cancel', icons.leave, cancelPlace, null, true],
          ]),
        );
        return;
      }
      if (mode.kind === 'look') {
        const building = text.buildings.find((b) => b.uid === mode.uid);
        side.replaceChildren(
          node('h2', null, building.name),
          node('p', 'cln-placing', building.gives),
          actionRow([
            ['Move', icons.move, () => startMove(false), null, true],
            ['Turn', icons.turn, () => startMove(true), null, true],
            ['Take down', icons.remove, tapDown, armed === 'down' ? 'cln-down cln-armed' : 'cln-down', true],
            ['Back', icons.prev, () => leaveLook(), null, true],
          ]),
        );
        return;
      }
      // Build first, the colony's first work (M43); then the places and the
      // voyage out.
      const sections = [node('h2', null, 'Build'), list(text.builds.map((row) => rowButton(row.name, row.ok ? `${row.cost} materials · ${row.makes}` : row.why, row.ok, () => tapRow(row, 'build'))), 'cln-builds'), ...trips.placesSection(campaign), ...voyages.section(campaign), ...levers.section(campaign)];
      if (text.hold.length) sections.push(node('h2', null, 'From the hold'), list(text.hold.map((row) => rowButton(row.name, row.ok ? `${row.building} · ${row.gives}` : row.why, row.ok, () => tapRow(row, 'hold'), row.count))));
      sections.push(node('h2', null, 'From the ship'), list(text.parts.map((row) => rowButton(row.name, row.ok ? `${row.building} · ${row.gives}` : row.why, row.ok, () => tapRow(row, 'ship'), row.count))));
      side.replaceChildren(...byHeading(sections));
    }

    // The sections a group each, from each heading to the next (M57), so on
    // a folded screen the panel shows one at a time.
    function byHeading(nodes) {
      const groups = [];
      for (const item of nodes) {
        if (item.tagName === 'H2' || !groups.length) groups.push(node('div', 'cln-group'));
        groups.at(-1).append(item);
      }
      return groups;
    }

    // A day's report, and what's next after it (M43): another day, unless
    // the report says what to do.
    function onward(report) {
      return /\bTap\b|Defend/.test(report.text) ? report : { ...report, text: `${report.text} Tap Next day for the next.` };
    }

    // What the ghost costs, makes or gives, under its name.
    function placingLine(text, campaign) {
      if (mode.uid !== null) return text.buildings.find((b) => b.uid === mode.uid)?.gives ?? '';
      if (mode.what.build) {
        const row = text.builds.find((b) => b.id === mode.what.build);
        return `${row.cost} materials of ${campaign.colony.materials} · ${row.makes}`;
      }
      const row = mode.what.part ? text.hold.find((r) => r.type === mode.what.part) : text.parts.find((r) => r.uids?.includes(mode.what.uid));
      return row?.gives ?? '';
    }

    function list(items, className = null) {
      const ul = node('ul', className);
      ul.append(...items);
      return ul;
    }

    // A row of the build list as a button of 48 px or more: its name (and
    // count), and what it costs and gives or why it can't be built.
    function rowButton(name, detail, ok, handler, count = null) {
      const item = node('li');
      const button = node('button', 'btn cln-part');
      button.type = 'button';
      button.dataset.ok = String(ok);
      const title = node('span', 'cln-name', name);
      if (ok && count > 1) title.append(node('small', null, ` ×${count}`));
      button.append(title, node('small', null, detail));
      button.setAttribute('aria-label', `${name}: ${detail}`);
      item.append(button);
      // A handler that takes the press arms on its first tap (M47).
      rowButtons.push(onTap(button, handler, { confirm: handler.length > 0 }));
      return item;
    }

    // Buttons side by side, each 48 px or more: [label, icon, handler,
    // class, enabled].
    function actionRow(actions) {
      const row = node('div', 'cln-actions');
      for (const [label, icon, handler, className, enabled] of actions) {
        const button = toolButton(`hgr-tool cln-act${className ? ` ${className}` : ''}`, icon, label);
        button.disabled = !enabled;
        // A handler that takes the press arms on its first tap (M47).
        rowButtons.push(onTap(button, handler, { confirm: handler.length > 0 }));
        row.append(button);
      }
      return row;
    }

    // A tap on a row: one that can be built becomes a ghost in the first
    // spot that fits; one that can't says why.
    function tapRow(row, from) {
      const { campaign } = game.getState();
      if (!defs || !campaign) return;
      disarm();
      trips.cancel();
      voyages.cancel();
      if (!row.ok) {
        said = whyNotText(row, { build: 'built', hold: 'set down', ship: 'given' }[from]);
        marked = from === 'ship' ? row.uids : null;
        render(true);
        return;
      }
      const what = from === 'ship' ? { uid: row.uid } : row.what;
      const plan = buildPlan(campaign, defs, what);
      said = plan.ok ? null : { text: plan.error, tone: 'warn' };
      marked = null;
      if (plan.ok) mode = { kind: 'place', what, type: plan.type, placement: plan.placement, uid: null };
      render(true);
    }

    // A tap on the colony: on the ghost, the second tap that builds it; on
    // the grid, the ghost moves there; otherwise the building under the
    // finger is looked at, or none.
    function tapScene(x, y) {
      const { campaign } = game.getState();
      // While the ship is away, the colony waits for it.
      if (!defs || !campaign || campaign.colony?.trip) return;
      disarm();
      said = null;
      marked = null;
      trips.cancel();
      voyages.cancel();
      if (mode.kind === 'place') {
        if (stand.onGhost(x, y)) {
          if (!holdMode()) return confirmPlace();
          said = { text: 'Hold the ghost to put it there.', tone: 'info' };
          render(true);
          return;
        }
        const cell = stand.cellAt(x, y);
        if (!cell) said = { text: "Tap the colony's grid where it should go.", tone: 'warn' };
        else mode = { ...mode, placement: centered(mode.type, cell, mode.placement.rot) };
        render(true);
        return;
      }
      const uid = stand.buildingAt(x, y);
      mode = uid === null ? { kind: 'browse' } : { kind: 'look', uid };
      render(true);
    }

    // A hold on the colony (M47): with holds confirming, one on the ghost
    // builds it, as a second tap does otherwise.
    function holdScene(x, y) {
      const { campaign } = game.getState();
      if (!defs || !campaign || campaign.colony?.trip || !holdMode()) return;
      if (mode.kind === 'place' && stand.onGhost(x, y)) confirmPlace();
    }

    // The placement with a building of type centered on cell [i, j], kept
    // on the grid.
    function centered(type, [i, j], rot) {
      const [w, h] = footprint(siteDef(type, defs), rot);
      const { width, height } = defs.colony.site;
      return { x: clamp(i - Math.floor((w - 1) / 2), 0, width - w), y: clamp(j - Math.floor((h - 1) / 2), 0, height - h), rot };
    }

    function turnGhost() {
      disarm();
      said = null;
      mode = { ...mode, placement: turnedSpot(defs, mode.type, mode.placement) };
      render(true);
    }

    function cancelPlace() {
      disarm();
      said = null;
      mode = mode.uid !== null ? { kind: 'look', uid: mode.uid } : { kind: 'browse' };
      render(true);
    }

    // The second tap: builds the ghost, or moves the building, where it
    // stands; or says why it can't.
    function confirmPlace() {
      const { campaign } = game.getState();
      if (!defs || !campaign || mode.kind !== 'place') return;
      disarm();
      const plan = planOf(campaign);
      if (!plan.ok) {
        said = plan.same ? { text: `${plan.error} Tap the grid where it should go.`, tone: 'warn' } : placeText(plan, { moving: mode.uid !== null });
        render(true);
        return;
      }
      if (mode.uid !== null) {
        const uid = mode.uid;
        said = { text: `The ${lowerFirst(plan.name)} stands in its new place.`, tone: 'good' };
        mode = { kind: 'look', uid };
        game.dispatch({ type: 'campaign/move', uid, placement: plan.placement, rules: defs });
      } else {
        const result = build(campaign, defs, mode.what, mode.placement);
        said = !result.ok ? { text: result.error, tone: 'bad' } : result.plan.from === 'ship' ? givenText(result, defs) : builtText(result, defs);
        const action = { type: 'campaign/build', what: mode.what, placement: mode.placement, rules: defs };
        mode = { kind: 'browse' };
        game.dispatch(action);
      }
      if (alive) render(true);
    }

    // Move or Turn on the building looked at: it is taken up as a ghost
    // where it stands, turned a quarter for Turn.
    function startMove(turn) {
      const { campaign } = game.getState();
      const building = campaign?.colony.buildings.find((b) => b.uid === mode.uid);
      if (!defs || !building) return;
      disarm();
      said = null;
      const placement = { x: building.x, y: building.y, rot: building.rot };
      mode = { kind: 'place', what: null, type: building.type, placement: turn ? turnedSpot(defs, building.type, placement) : placement, uid: building.uid };
      render(true);
    }

    function leaveLook() {
      disarm();
      said = null;
      mode = { kind: 'browse' };
      render(true);
    }

    // Take down: the first tap says what comes back and what goes dark;
    // the second takes it down.
    function tapDown(press) {
      const { campaign } = game.getState();
      if (!defs || !campaign || mode.kind !== 'look') return;
      if (!confirms(armed === 'down', press)) {
        arm('down');
        return;
      }
      disarm();
      const result = takeDown(campaign, defs, mode.uid);
      said = result.ok ? takenText(result) : { text: result.error, tone: 'bad' };
      const uid = mode.uid;
      mode = { kind: 'browse' };
      game.dispatch({ type: 'campaign/takedown', uid, rules: defs });
      if (alive) render(true);
    }

    // Next day: the first tap says what the day will bring; the second
    // passes it, and the hint gives the day's report.
    function tapDay(press) {
      const { campaign } = game.getState();
      if (!defs || !campaign || campaign.colony?.trip) return;
      if (!confirms(armed === 'day', press)) {
        said = null;
        arm('day');
        return;
      }
      disarm();
      const result = nextDay(campaign, defs);
      said = result.ok ? onward(dayReport(result, defs)) : { text: result.error, tone: 'bad' };
      game.dispatch({ type: 'campaign/day', rules: defs });
      if (alive) render(true);
    }

    // Defend, while the raid's lander is down: the first tap says what the
    // guns will fire, at what odds, and who fights; the second fires them.
    // With raiders left and someone home, the fight's screen opens;
    // otherwise the hint says what came of the landing.
    function tapDefend(press) {
      if (landing) return;
      const { campaign } = game.getState();
      if (!defs || !campaign || !raidDown(campaign)) return;
      if (!confirms(armed === 'defend', press)) {
        said = null;
        trips.cancel();
        voyages.cancel();
        arm('defend');
        return;
      }
      disarm();
      const result = faceRaid(campaign, defs, fightSettings(game.getState().settings));
      said = result.ok ? landingReport(result, campaign, defs) : { text: result.error, tone: 'bad' };
      mode = { kind: 'browse' };
      // The landing played over the colony first (M51), unless it is
      // elsewhere or motion is reduced; a tap anywhere skips it.
      const here = result.ok && (result.colony === undefined || result.colony === campaign.colony.id);
      if (here && document.documentElement.dataset.motion !== 'reduce') playLanding(result, campaign);
      else faced();
    }

    function faced() {
      landing = null;
      stand.stop();
      game.dispatch({ type: 'campaign/raid/face', rules: defs });
      if (alive) render(true);
    }

    // Where the lander is seen to come down: on the colony's middle row, at
    // the raiders' edge, or as near it as the ground shows between the
    // panels (the Build panel can cover that edge on a narrow screen).
    function landingSpot(site) {
      const y = site.height / 2;
      const left = info.getBoundingClientRect().right + 40;
      const right = side.getBoundingClientRect().left - 40;
      for (let x = site.width - START_COLUMNS / 2; x > site.width / 2; x -= 0.5) {
        const at = stand.screenOf(x, y, 1);
        if (at && at[0] > left && at[0] < right) return [x, y];
      }
      return [site.width / 2, y];
    }

    // The lander coming down to the raiders' edge, the guns firing up at
    // it as they rolled, the raiders aboard counted down in the hint.
    function playLanding(result, campaign) {
      const { site } = defs.colony;
      const guns = campaign.colony.buildings.map((b) => {
        const [w, h] = footprint(siteDef(b.type, defs), b.rot);
        return { uid: b.uid, x: b.x + w / 2, y: b.y + h / 2 };
      });
      const raiders = result.landing.landed.length + result.landing.hits;
      const timeline = landingTimeline(result.landing, guns, landingSpot(site), raiders);
      const start = performance.now();
      let heard = -1;
      let aboard = null;
      landing = { skip: faced };
      cue('alarm');
      stand.play((ctx, cam) => {
        const t = performance.now() - start;
        for (const { shot, lands } of shotsBetween(timeline, heard, t)) cue(lands ? (shot.hit ? 'hit' : 'miss') : 'burst');
        heard = t;
        paintLanding(ctx, cam, timeline, t);
        const now = aboardAt(timeline, t);
        if (now !== aboard) {
          aboard = now;
          setText(hint, `The lander comes down: ${now} raider${now === 1 ? '' : 's'} aboard.`);
        }
        if (t >= timeline.ms + 300 && landing) {
          landing = null;
          queueMicrotask(faced);
        }
      });
    }

    function arm(what) {
      armed = what;
      clearTimeout(armTimer);
      armTimer = setTimeout(() => {
        disarm();
        if (alive) render(true);
      }, ARM_MS);
      render(true);
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
    }

    return {
      resize() {
        stand.layout();
      },
      // The colony stands still: it is drawn again only when it changes.
      draw(ctx, view) {
        stand.draw(ctx, view);
      },
      unmount() {
        alive = false;
        pager();
        partsPager();
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
