// The sector map: act 2's home, on the run (src/sim/travel.js). The
// sector's nodes stand on a chart in the middle, linked column to column
// from the way in to the jump point, each marked with what it holds once
// that is known (stations, derelicts, distress calls, traders, hazards,
// hostile ships), and with a ? until then. The ship's node is marked, and
// the nodes a jump reaches are ringed: solid for a jump, dashed for a long
// one. A tap on a node shows on the left what the jump there takes, and a
// second tap, or Jump, makes it: one tap never moves the ship. An event
// where the ship arrives opens its card (eventCard.js) over the chart, and
// nothing moves until a choice is made; a hostile ship there opens the
// approach screen (approach.js). At a station Buy sells supplies, Repair
// fixes what an approach wrecked, Patch up heals the crew and, since M37,
// its weapons rack sells a weapon or two, put on hand; Scan shows
// what nodes within reach hold, and at the jump point Jump on leads into
// the next sector, each two taps, the first saying what it costs; from the
// act's last, into the system past the charts (M25), whose worlds stand on
// the chart with their kinds, solid once surveyed. At a world, Survey shows
// what it is worth and Settle here ends the run, each two taps; settling
// plays the landing (landing.js). The crew and the holds are
// on the right, heat by the act; a tap on the crew opens the crew card
// (crewCard.js) over the chart, where recruits sign on at a station and
// crew are let go, two taps each. At a station a tap on the ship's panel
// is Refit: construction mode (construction.js), with the parts on hand
// (M23h). A ship that fails a flight check there can't jump until a refit
// fixes it, and the chart says so. Elsewhere on the run, with nothing to
// deal with first, it is Rearrange (M46): the same mode, the parts aboard
// moving and turning, and a ship whose joins fail waits for them. Since M24 a jump's plan says the chance
// the pursuer's hunters wait where it comes out, and the nodes they may
// wait at are ringed in red; Regroup, away from stations, rests the crew a
// day (Hide, in a nebula, sheds heat), and at a station the transponder is
// swapped once a sector, from the left panel, each two taps. Since M33 the
// crew's standing with each side shows under the ship's panel, a station of
// a side wears its color on the chart and says its prices, and at a station
// of the pursuer's side the panel and each service's first tap say the heat
// the first trade there adds (M33's fix; a jump's plan says so ahead).
// Since M37b each sector has a shipyard, charted as stations are, in its
// own pink: there Yard opens the shop screen (shop.js) on the parts it
// sells and buys, one tap, as the hangar's Shop does, and the ship's panel
// is Refit, as at a station; it wears its side's color as a station does,
// and says its prices. From M38d the chart is the ship's on a voyage from
// the colony too (src/sim/voyage.js): the systems it crosses stand on it
// as sectors do, with their worlds to survey; the colony's panel, on the
// right, says its day, its food, who is home and the raid coming; Fly home,
// in the left panel wherever the ship is, takes two taps, the first saying
// what the flight takes (Fly on, once a lander stopped it); and while a
// lander is down at the colony, Defend in the foot faces it, two taps, as
// the colony's does. The run begins, its first sector rolled, the first
// time the map opens.
//
// Each node's button is its share of its column, so no two overlap and
// each stays 48 px or more on the screens the game is for; its mark sits
// where the sector puts the node. The words are sectorText.js's,
// eventText.js's and crewText.js's.
import { loadContent } from '../../platform/content.js';
import { palette } from '../../render/palette.js';
import { faceRaid } from '../../sim/raids.js';
import { fightSettings } from '../../sim/settings.js';
import { flyTo, voyageHome } from '../../sim/voyage.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { confirms } from '../confirm.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { createCrewCard } from './crewCard.js';
import { crewCardText, crewHeading, crewSaid } from './crewText.js';
import { createEventCard } from './eventCard.js';
import { eventText, resultText } from './eventText.js';
import { crewRows, heatChip, listRows, panel, questRows, sideRows } from './hubParts.js';
import { carry, takeCarried } from './carried.js';
import { flightReport } from './colonyListText.js';
import { landingReport } from './raidText.js';
import { jumpText, sectorText } from './sectorText.js';
import { voyageReport } from './voyageText.js';

const ARM_MS = 3000; // Jump on, Buy, Repair, Patch up, Scan, Regroup, the swap, Survey, Settle here, Fly home, Defend, Sign on and Let go wait this long for a second tap
const SVG = 'http://www.w3.org/2000/svg';
const MARKS = {
  start: icons.wayIn,
  exit: icons.jumpPoint,
  station: icons.station,
  shipyard: icons.shipyard,
  derelict: icons.derelict,
  distress: icons.distress,
  trader: icons.tag,
  hazard: icons.hazard,
  hostile: icons.hostile,
  nebula: icons.nebula,
  world: icons.world,
  unknown: icons.unknown,
};

export const sectorScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr sct');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const whereLine = node('p', 'hgr-home');
    const heat = heatChip();
    head.append(actLine, whereLine, heat.el);
    // The left panel: the node the ship is at, or the jump picked.
    const info = node('section', 'hgr-panel sct-info');
    const infoTitle = node('h2', null, 'Here');
    const infoName = node('p', 'sct-name');
    const infoKind = node('p', 'sct-kind');
    const infoLines = node('ul', 'sct-lines');
    const infoText = node('p', 'sct-text');
    // At a station, the transponder swap and the weapons rack (M37) sit
    // here, under its kind, with what the station offers: in the foot,
    // beside Buy, Repair and Patch up, they would leave the hint no room at
    // 821 × 283.
    const swapButton = toolButton('sct-swap', icons.transponder, 'Transponder');
    swapButton.hidden = true;
    // A station's job board (M38c): opening it changes nothing, so it takes
    // one tap.
    const jobsButton = toolButton('sct-jobs', icons.jobs, 'Jobs');
    jobsButton.hidden = true;
    const rackList = node('div', 'sct-rack-list');
    rackList.hidden = true;
    // Fly home, on a voyage from the colony (M38d): wherever the ship is,
    // so in this panel, in view on the shortest screen.
    const homeButton = toolButton('sct-home', icons.home, 'Fly home');
    homeButton.hidden = true;
    info.append(infoTitle, infoName, infoKind, jobsButton, swapButton, homeButton, rackList, infoLines, infoText);
    const map = node('div', 'sct-map');
    const links = document.createElementNS(SVG, 'svg');
    links.setAttribute('class', 'sct-links');
    links.setAttribute('viewBox', '0 0 100 100');
    links.setAttribute('preserveAspectRatio', 'none');
    links.setAttribute('aria-hidden', 'true');
    const ship = node('span', 'sct-ship');
    ship.innerHTML = icons.shipMark;
    const crewList = node('ul', 'hgr-crew');
    // The crew panel opens the crew card: a button lies over the whole
    // panel, so a tap anywhere on it does.
    const crewHead = node('span', null, 'Crew');
    const chevron = node('b', null, '›');
    const crewTitle = node('h2');
    crewTitle.append(crewHead, chevron);
    crewTitle.setAttribute('aria-hidden', 'true');
    const crewOpener = node('button', 'sct-crew-open');
    crewOpener.type = 'button';
    crewOpener.setAttribute('aria-expanded', 'false');
    const crewPanel = node('section', 'hgr-panel sct-crew-panel');
    crewPanel.append(crewTitle, crewList, crewOpener);
    const hold = node('dl', 'hgr-hold');
    // The ship's panel: at a station or a shipyard a button over the whole
    // of it is Refit, as the crew's opens the crew card.
    const shipHead = node('span', null, 'Ship');
    const shipChevron = node('b', null, '›');
    const shipTitle = node('h2');
    shipTitle.append(shipHead, shipChevron);
    shipTitle.setAttribute('aria-hidden', 'true');
    const shipOpener = node('button', 'sct-ship-open');
    shipOpener.type = 'button';
    shipOpener.hidden = true;
    const shipPanel = node('section', 'hgr-panel sct-ship-panel');
    shipPanel.append(shipTitle, hold, shipOpener);
    // The colony's panel while the ship is away on a voyage (M38d).
    const colonyTitle = node('h2');
    const colonyRows = node('dl', 'hgr-hold');
    const colonyLine = node('p', 'sct-colony-line');
    const colonyPanel = node('section', 'hgr-panel sct-colony-panel');
    colonyPanel.append(colonyTitle, colonyRows, colonyLine);
    colonyPanel.hidden = true;
    // The other colonies (M38e), a panel each with Fly to, under it.
    const othersBox = node('div', 'sct-others');
    // The crew's standing with each side (M33), and the quests (M33b).
    const sideList = node('ul', 'hgr-sides');
    const questList = node('ul', 'hgr-quests');
    const side = node('div', 'hgr-side');
    side.append(crewPanel, shipPanel, colonyPanel, othersBox, panel('Sides', sideList), panel('Quests', questList));
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = node('p', 'hgr-hint', 'Loading…');
    const buys = node('div', 'sct-buys');
    const restButton = toolButton('sct-rest', icons.regroup, 'Regroup');
    const scanButton = toolButton('sct-scan', icons.scan, 'Scan');
    const jumpButton = toolButton('sct-jump', icons.jump, 'Jump');
    const onButton = toolButton('sct-on', icons.jumpPoint, 'Jump on');
    // At a world in the system past the charts (M25).
    const surveyButton = toolButton('sct-survey', icons.survey, 'Survey');
    const settleButton = toolButton('sct-settle', icons.settle, 'Settle here');
    // A lander down at the colony while the ship is away (M38d).
    const defendButton = toolButton('sct-defend', icons.shoot, 'Defend');
    restButton.hidden = scanButton.hidden = jumpButton.hidden = onButton.hidden = surveyButton.hidden = settleButton.hidden = defendButton.hidden = true;
    foot.append(titleButton, hint, buys, restButton, scanButton, surveyButton, settleButton, jumpButton, onButton, defendButton);
    const card = createEventCard({
      choose: (choice) => game.dispatch({ type: 'campaign/event/choose', choice, rules: defs }),
      close: () => {
        closed = resultKey(game.getState().campaign);
        render(true);
      },
    });
    const crewCard = createCrewCard({
      tap: (key, press) => twoTaps(key, () => crewOrder(key), press),
      done: () => toggleCrew(false),
    });
    el.append(head, info, map, side, card.el, crewCard.el, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let picked = null; // the node picked on the map: its jump shows
    let armed = null; // 'on', 'scan', 'rest', 'swap', 'repair', 'patch', 'survey', 'settle', 'home', 'defend', the supplies a Buy is for, a rack's weapon ('rack:<slot>'), a colony's Fly to ('fly:<id>', M38e), or a crew card button's key, after its first tap
    let others = new Map(); // the other colonies' panels (M38e), by number: { panel, title, rows, line, button, detach }
    let othersShown = null; // the numbers of those drawn
    // { campaign, words }: what Defend or Fly home came to, shown until the
    // campaign moves on; or what Fly out from the colony came to, carried
    // over as the chart opened (M38f, carried.js).
    let report = carried(game.getState().campaign);
    let crewOpen = false; // the crew card is up
    let closed = null; // the result put away with Carry on (resultKey)
    let armTimer = 0;
    let shown = null; // the campaign last drawn
    let sectorShown = null; // the sector the map's buttons are for
    let nodeButtons = [];
    let buyButtons = [];
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(jumpButton, makeJump),
      onTap(onButton, (press) => twoTaps('on', () => game.dispatch({ type: 'campaign/sector/leave', rules: defs }), press), { confirm: true }),
      onTap(scanButton, (press) => twoTaps('scan', () => game.dispatch({ type: 'campaign/scan', rules: defs }), press), { confirm: true }),
      onTap(restButton, (press) => twoTaps('rest', () => game.dispatch({ type: 'campaign/regroup', rules: defs }), press), { confirm: true }),
      onTap(swapButton, (press) => twoTaps('swap', () => game.dispatch({ type: 'campaign/swap', rules: defs }), press), { confirm: true }),
      onTap(jobsButton, openJobs),
      onTap(surveyButton, (press) => twoTaps('survey', () => game.dispatch({ type: 'campaign/survey', rules: defs }), press), { confirm: true }),
      onTap(settleButton, (press) => twoTaps('settle', () => game.dispatch({ type: 'campaign/settle', rules: defs }), press), { confirm: true }),
      onTap(homeButton, (press) => twoTaps('home', flyHome, press), { confirm: true }),
      onTap(defendButton, (press) => twoTaps('defend', defend, press), { confirm: true }),
      onTap(crewOpener, () => toggleCrew(!crewOpen)),
      onTap(shipOpener, refit),
      () => clearTimeout(armTimer),
      () => card.detach(),
      () => crewCard.detach(),
      () => nodeButtons.forEach((entry) => entry.detach()),
      () => buyButtons.forEach((entry) => entry.detach()),
      () => others.forEach((entry) => entry.detach()),
      game.subscribe(() => alive && render()),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        // The run begins the first time the map opens after launch.
        if (game.getState().campaign && !game.getState().campaign.run) game.dispatch({ type: 'campaign/run/begin', rules: defs });
        render(true);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // force: draw again though the campaign hasn't changed (a pick, a tap).
    function render(force = false) {
      const { campaign } = game.getState();
      if (!defs || !campaign || (campaign === shown && !force)) return;
      shown = campaign;
      if (!campaign.run) {
        setText(hint, 'The run starts once the ship has launched.');
        return;
      }
      const { run } = campaign;
      if (picked !== null && (picked === run.at || !run.sector.nodes[picked] || sectorShown !== run.sector)) picked = null;
      const text = sectorText(campaign, defs);
      const plan = picked === null ? null : jumpText(campaign, defs, picked);
      setText(actLine, text.act);
      setText(whereLine, text.where);
      heat.show(text.heat);
      crewList.replaceChildren(...crewRows(text.crew));
      hold.replaceChildren(...listRows(text.hold));
      sideList.replaceChildren(...sideRows(text.sides));
      questList.replaceChildren(...questRows(text.quests));
      drawMap(run, text, plan);
      showInfo(text, plan);
      // A station selling three things or more crowds the foot: its buttons
      // go without icons there, so the hint keeps room.
      foot.dataset.crowded = String((text.offer?.buys.length ?? 0) + (text.repair ? 1 : 0) + (text.patch ? 1 : 0) >= 3);

      // An event open here takes the card, and holds everything else; once
      // settled, the card shows what happened until Carry on.
      const event = eventText(campaign, defs);
      const result = event || resultKey(campaign) === closed ? null : resultText(campaign, defs);
      card.show(event, result);
      const carded = Boolean(event || result);
      el.dataset.card = String(carded);
      // The crew card, unless an event's is up; the crew panel opens it.
      if (carded) crewOpen = false;
      const crew = crewOpen ? crewCardText(campaign, defs) : null;
      const crewAsk = crewSaid(crew, armed);
      if (typeof armed === 'string' && /^(hire|let|arm):/.test(armed) && !crewAsk) disarm();
      crewCard.show(crew, armed);
      el.dataset.crew = String(crewOpen);
      const heading = crewHeading(campaign, defs);
      setText(crewHead, heading.text);
      crewOpener.setAttribute('aria-label', heading.text);
      crewOpener.disabled = carded;
      crewOpener.setAttribute('aria-expanded', String(crewOpen));
      crewPanel.dataset.open = String(crewOpen);
      crewPanel.dataset.hire = String(heading.hire);
      // Under either card, the panel and the chart take no taps or focus.
      const covered = carded || crewOpen;
      info.inert = covered;
      map.inert = covered;
      if (carded) disarm();

      // Refit, at a station or a shipyard, or Rearrange between jumps
      // (M46): the ship's panel opens construction mode.
      const { refit: station } = text;
      const refitting = Boolean(station) && !covered;
      shipOpener.hidden = !refitting;
      shipPanel.dataset.refit = String(refitting);
      shipPanel.dataset.broken = String(Boolean(station?.broken));
      shipChevron.hidden = !refitting;
      setText(shipHead, station ? `Ship · ${station.label}` : 'Ship');
      shipOpener.setAttribute('aria-label', station ? `${station.label}. ${station.broken ?? station.line}` : 'Ship');

      // A day's rest: Regroup, or Hide in a nebula, where one can be taken.
      const { rest } = text;
      if (!rest && armed === 'rest') disarm();
      restButton.hidden = !rest || covered || Boolean(plan);
      if (rest) {
        if (restButton.dataset.kind !== rest.kind) {
          restButton.dataset.kind = rest.kind;
          restButton.querySelector('svg').outerHTML = rest.kind === 'hide' ? icons.nebula : icons.regroup;
        }
        setText(restButton.querySelector('span'), armed === 'rest' ? rest.ask : rest.label);
        restButton.setAttribute('aria-label', rest.text.replace(/ Tap again to \w+\.$/, ''));
      }
      restButton.dataset.armed = String(armed === 'rest');

      // Scan, while it would show something.
      const { scan } = text;
      if (!scan && armed === 'scan') disarm();
      scanButton.hidden = !scan || covered;
      setText(scanButton.querySelector('span'), armed === 'scan' ? scan.ask : 'Scan');
      scanButton.dataset.armed = String(armed === 'scan');

      // Jump, for the node picked; Jump on, at the jump point.
      jumpButton.hidden = !plan || covered;
      if (plan) {
        jumpButton.disabled = !plan.ok;
        const mode = plan.long ? 'long' : 'jump';
        if (jumpButton.dataset.mode !== mode) {
          jumpButton.dataset.mode = mode;
          jumpButton.querySelector('svg').outerHTML = plan.long ? icons.longJump : icons.jump;
        }
        setText(jumpButton.querySelector('span'), plan.label);
        jumpButton.setAttribute('aria-label', plan.title);
      }
      const { leave } = text;
      if (!leave?.ok && armed === 'on') disarm();
      onButton.hidden = !leave || covered;
      if (covered) buys.hidden = true;
      onButton.disabled = !leave?.ok;
      setText(onButton.querySelector('span'), armed === 'on' ? leave.ask : 'Jump on');
      onButton.dataset.armed = String(armed === 'on');

      // At a world (M25): Survey, until it is surveyed, and Settle here.
      const { survey, settle } = text;
      if (!survey?.ok && armed === 'survey') disarm();
      surveyButton.hidden = !survey || covered || Boolean(plan);
      surveyButton.disabled = !survey?.ok;
      setText(surveyButton.querySelector('span'), armed === 'survey' ? survey.ask : 'Survey');
      surveyButton.dataset.armed = String(armed === 'survey');
      if (survey) surveyButton.setAttribute('aria-label', survey.ok ? survey.text.replace(' Tap again to survey.', '') : survey.why);
      if (!settle && armed === 'settle') disarm();
      settleButton.hidden = !settle || covered || Boolean(plan);
      setText(settleButton.querySelector('span'), armed === 'settle' ? settle.ask : 'Settle here');
      settleButton.dataset.armed = String(armed === 'settle');
      if (settle) settleButton.setAttribute('aria-label', settle.text.replace(' Tap again to settle.', ''));

      // On a voyage (M38d): the colony's panel, Fly home, and Defend while
      // a lander is down there.
      const { colony, home, defend } = text;
      colonyPanel.hidden = !colony;
      if (colony) {
        setText(colonyTitle, colony.title);
        colonyRows.replaceChildren(...listRows(colony.rows));
        setText(colonyLine, colony.line);
        colonyPanel.dataset.tone = colony.tone;
      }
      if (!home?.ok && armed === 'home') disarm();
      homeButton.hidden = !home || covered || Boolean(plan);
      homeButton.disabled = !home?.ok;
      if (home) {
        setText(homeButton.querySelector('span'), armed === 'home' ? `${home.label}?` : home.label);
        homeButton.setAttribute('aria-label', home.ok ? home.ask.replace(' Tap again to fly.', '') : `${home.label}. ${home.why}`);
      }
      homeButton.dataset.armed = String(armed === 'home');
      showOthers(text.colonies, covered || Boolean(plan));
      if (!defend?.ok && armed === 'defend') disarm();
      defendButton.hidden = !defend || covered;
      defendButton.disabled = !defend?.ok;
      setText(defendButton.querySelector('span'), armed === 'defend' ? 'Defend?' : 'Defend');
      defendButton.dataset.armed = String(armed === 'defend');
      if (report && report.campaign !== campaign) report = null;

      const buy = typeof armed === 'number' ? text.offer?.buys.find((entry) => entry.count === armed) : null;
      if (typeof armed === 'number' && !buy) disarm();
      if (armed === 'repair' && !text.repair?.ok) disarm();
      if (armed === 'patch' && !text.patch?.ok) disarm();
      if (armed === 'swap' && !text.swap?.ok) disarm();
      const racked = typeof armed === 'string' && armed.startsWith('rack:') ? text.rack?.items.find((item) => item.key === armed && item.ok) : null;
      if (typeof armed === 'string' && armed.startsWith('rack:') && !racked) disarm();
      const flying = typeof armed === 'string' && armed.startsWith('fly:') ? text.colonies.find((colony) => `fly:${colony.id}` === armed && colony.fly.ok) : null;
      if (typeof armed === 'string' && armed.startsWith('fly:') && !flying) disarm();
      const said = crew ? (crewAsk ?? crew.hint)
        : armed === 'on' ? { tone: leave.tone === 'bad' ? 'bad' : 'warn', text: `${leave.lines.join(' ')} Tap Jump on again.` }
        : armed === 'scan' ? { tone: 'warn', text: scan.text }
        : armed === 'rest' ? { tone: rest.tone === 'bad' ? 'bad' : 'warn', text: rest.text }
        : armed === 'swap' ? { tone: 'warn', text: text.swap.text }
        : armed === 'survey' ? { tone: survey.tone === 'bad' ? 'bad' : 'warn', text: survey.text }
        : armed === 'settle' ? { tone: settle.tone, text: settle.text }
        : armed === 'repair' ? { tone: 'warn', text: text.repair.text }
        : armed === 'patch' ? { tone: 'warn', text: text.patch.text }
        : armed === 'home' ? { tone: 'warn', text: home.ask }
        : flying ? { tone: 'warn', text: flying.fly.ask }
        : armed === 'defend' ? { tone: 'warn', text: defend.ask }
        : buy ? { tone: 'warn', text: buy.text }
        : racked ? { tone: 'warn', text: racked.text }
        : plan ? planHint(plan)
        : report ? report.words
        : result ? { tone: 'info', text: 'Carry on to the chart.' }
        : text.hint;
      setText(hint, said.text);
      hint.dataset.tone = said.tone;
    }

    // What the foot says of the jump picked.
    function planHint(plan) {
      if (!plan.ok) return { tone: plan.tone === 'bad' ? 'bad' : 'info', text: plan.lines[0] };
      const again = `Tap it again, or ${plan.label}, to go.`;
      if (plan.hungry) return { tone: 'bad', text: `Short of supplies: the crew goes hungry. ${again}` };
      if (plan.hunt >= 100) return { tone: 'bad', text: `The hunters will be waiting there. ${again}` };
      if (plan.hunt) return { tone: 'warn', text: `Hunters: ${plan.hunt}% they wait there. ${again}` };
      if (plan.left) return { tone: 'warn', text: `${plan.left} supplies stay behind: the holds are smaller now. ${again}` };
      return { tone: 'good', text: again };
    }

    // The chart: its links, and a button for each node, made again for
    // each new sector; marks for where the ship is, what it reaches and
    // the jump picked.
    function drawMap(run, text, plan) {
      const { sector } = run;
      if (sectorShown !== sector) {
        sectorShown = sector;
        nodeButtons.forEach((entry) => entry.detach());
        const columns = Math.max(...text.nodes.map((n) => n.col)) + 1;
        links.replaceChildren(
          ...text.links.map(({ a, b }) => {
            const line = document.createElementNS(SVG, 'line');
            const [from, to] = [sector.nodes[a], sector.nodes[b]];
            line.setAttribute('x1', String(from.x * 100));
            line.setAttribute('y1', String(from.y * 100));
            line.setAttribute('x2', String(to.x * 100));
            line.setAttribute('y2', String(to.y * 100));
            return line;
          }),
        );
        nodeButtons = text.nodes.map((n) => {
          const button = node('button', 'sct-node');
          button.type = 'button';
          Object.assign(button.style, {
            left: `${(100 * n.col) / columns}%`,
            top: `${(100 * n.row) / n.rows}%`,
            width: `${100 / columns}%`,
            height: `${100 / n.rows}%`,
          });
          const dot = node('span', 'sct-dot');
          dot.style.left = `${(n.x * columns - n.col) * 100}%`;
          dot.style.top = `${(n.y * n.rows - n.row) * 100}%`;
          button.append(dot);
          // A station of a side (M33) wears the side's color by its mark.
          if (n.side) {
            const pip = node('i', 'sct-side', n.side.initial);
            Object.assign(pip.style, { left: dot.style.left, top: dot.style.top, background: n.side.color });
            button.append(pip);
          }
          // A quest's node (M33b) wears a diamond by its mark until its
          // event is settled (data-quest, below).
          if (run.sector.nodes[n.id].quest) {
            const ring = node('i', 'sct-quest');
            Object.assign(ring.style, { left: dot.style.left, top: dot.style.top });
            button.append(ring);
          }
          // A world in the system past the charts (M25) is named on the
          // chart, with its kind. On a voyage's busier charts (M38d) its
          // mark alone shows, and a tap names it.
          if (n.world && run.sector.system) {
            const label = node('span', 'sct-label');
            label.append(node('b', null, n.name), node('span', null, n.world));
            Object.assign(label.style, { left: dot.style.left, top: dot.style.top });
            button.append(label);
          }
          return { id: n.id, button, dot, detach: onTap(button, (press) => tapNode(n.id, press), { confirm: true }) };
        });
        map.replaceChildren(links, ...nodeButtons.map((entry) => entry.button), ship);
      }
      const way = new Set();
      for (let i = 1; i < (plan?.way.length ?? 0); i++) way.add([plan.way[i - 1], plan.way[i]].sort((x, y) => x - y).join('-'));
      [...links.children].forEach((line, i) => {
        const { a, b, near } = text.links[i];
        line.dataset.near = String(near);
        line.dataset.way = String(way.has(`${a}-${b}`));
      });
      for (const { id, button, dot } of nodeButtons) {
        const n = text.nodes[id];
        // What it holds, as known: its mark changes as it is made out.
        if (button.dataset.type !== n.type) {
          button.dataset.type = n.type;
          dot.innerHTML = MARKS[n.type] ?? '';
        }
        button.dataset.here = String(n.here);
        button.dataset.seen = String(n.seen);
        button.dataset.done = String(n.done);
        button.dataset.reach = String(n.links);
        button.dataset.hunt = String(n.hunt > 0);
        button.dataset.surveyed = String(n.surveyed);
        button.dataset.quest = String(Boolean(n.quest));
        button.setAttribute('aria-pressed', String(id === picked));
        const where = n.here ? 'the ship is here' : n.links === 1 ? 'a jump away' : n.links === 2 ? 'a long jump away' : 'out of reach';
        const kind = n.world ?? (n.known ? (defs.nodeTypes.get(n.type)?.name ?? n.type) : 'unknown');
        const surveyed = n.world ? (n.surveyed ? 'surveyed' : 'not surveyed') : null;
        const hunters = n.hunt ? `hunters ${n.hunt}%` : null;
        const whose = n.side ? `${n.side.name}'s` : null;
        const quest = n.quest ? `a step of ${n.quest}` : null;
        button.setAttribute('aria-label', [n.name, kind === n.name ? null : kind, whose, quest, surveyed, where, hunters].filter(Boolean).join(', '));
      }
      const here = sector.nodes[run.at];
      ship.style.left = `${here.x * 100}%`;
      ship.style.top = `${here.y * 100}%`;
    }

    // The left panel: the jump picked, or the node the ship is at, with
    // what its station sells or where its jump point leads. A station's Buy
    // buttons stand in the foot while no jump is picked.
    function showInfo(text, plan) {
      buyButtons.forEach((entry) => entry.detach());
      buyButtons = [];
      if (plan) {
        setText(infoTitle, plan.ok ? plan.label : plan.head);
        setText(infoName, plan.node.name);
        setText(infoKind, plan.node.kind);
        // A world's numbers, once surveyed, under what the jump takes.
        infoLines.replaceChildren(...plan.lines.map((line) => lineItem(line, plan.tone)), ...(plan.world ?? []).map((line) => lineItem(line, 'info')));
        buys.replaceChildren();
        buys.hidden = true;
        jobsButton.hidden = true;
        swapButton.hidden = true;
        rackList.replaceChildren();
        rackList.hidden = true;
        setText(infoText, plan.node.text);
        return;
      }
      const { here, offer, leave, refit: station, yard } = text;
      setText(infoTitle, 'Here');
      setText(infoName, here.name);
      setText(infoKind, here.kind);
      const said = leave ? [leave.title, ...leave.lines].map((line, i) => lineItem(line, i ? leave.tone : 'head')) : offer ? [offer.line, offer.why, text.rack?.line].filter(Boolean).map((line) => lineItem(line, 'info')) : yard ? [lineItem(yard.line, 'info')] : [];
      // A side's station (M33): whose it is, and what it charges the crew;
      // at one of the pursuer's side, what trading there adds (M33's fix).
      if (text.station?.dock) said.unshift(lineItem(text.station.dock.line, text.station.dock.tone));
      if (text.station) said.unshift(lineItem(text.station.line, text.station.tone));
      // A world's numbers once surveyed, or that a survey shows them; and
      // why a survey can't be made.
      for (const line of text.world ?? []) said.push(lineItem(line, 'info'));
      if (text.survey && !text.survey.ok) said.push(lineItem(text.survey.why, 'bad'));
      // The station's or yard's refits: what Refit, on the ship's panel,
      // would fit, or the flight check that keeps the ship here; between
      // jumps, only the check.
      if (station && (!station.rearrange || station.broken)) said.push(lineItem(station.broken ?? station.line, station.broken ? 'bad' : station.parts ? 'good' : 'info'));
      infoLines.replaceChildren(...said);
      buyButtons = (offer?.buys ?? []).map((entry) => {
        const button = toolButton('sct-buy', icons.supplies, armed === entry.count ? entry.ask : entry.label);
        button.dataset.armed = String(armed === entry.count);
        button.setAttribute('aria-label', `Buy ${entry.count} supplies`);
        return { button, detach: onTap(button, (press) => twoTaps(entry.count, () => game.dispatch({ type: 'campaign/supplies', count: entry.count, rules: defs }), press), { confirm: true }) };
      });
      // A shipyard's Yard (M37b): the shop screen on its parts. Opening it
      // changes nothing, so it takes one tap.
      if (yard) {
        const button = toolButton('sct-buy sct-yard', icons.shipyard, yard.label);
        button.setAttribute('aria-label', `${yard.label}: ${yard.line}`);
        buyButtons.push({ button, detach: onTap(button, openYard) });
      }
      // Repairs, for what an approach wrecked.
      const { repair } = text;
      if (repair) {
        const button = toolButton('sct-buy sct-repair', icons.build, armed === 'repair' ? repair.ask : repair.label);
        button.dataset.armed = String(armed === 'repair');
        button.disabled = !repair.ok;
        button.setAttribute('aria-label', repair.ok ? repair.text.replace(' Tap again to repair.', '') : repair.why);
        buyButtons.push({ button, detach: onTap(button, (press) => twoTaps('repair', () => game.dispatch({ type: 'campaign/repair', rules: defs }), press), { confirm: true }) });
        if (!repair.ok) infoLines.append(lineItem(repair.why, 'bad'));
      }
      // The station's job board (M38c): in this panel, over the swap.
      const { jobs } = text;
      jobsButton.hidden = !jobs;
      if (jobs) {
        setText(jobsButton.querySelector('span'), jobs.label);
        jobsButton.setAttribute('aria-label', `${jobs.label}: ${jobs.line}`);
      }
      // The transponder swap, once a sector, for heat: in this panel.
      const { swap } = text;
      swapButton.hidden = !swap;
      if (swap) {
        setText(swapButton.querySelector('span'), armed === 'swap' ? swap.ask : swap.label);
        swapButton.dataset.armed = String(armed === 'swap');
        swapButton.disabled = !swap.ok;
        swapButton.setAttribute('aria-label', swap.ok ? swap.text.replace(' Tap again to swap.', '') : swap.why);
        if (!swap.ok) infoLines.append(lineItem(swap.why, 'bad'));
      }
      // Patching up, for the crew's wounds.
      const { patch } = text;
      if (patch) {
        const button = toolButton('sct-buy sct-patch', icons.stabilize, armed === 'patch' ? patch.ask : patch.label);
        button.dataset.armed = String(armed === 'patch');
        button.disabled = !patch.ok;
        button.setAttribute('aria-label', patch.ok ? patch.text.replace(' Tap again to patch up.', '') : patch.why);
        buyButtons.push({ button, detach: onTap(button, (press) => twoTaps('patch', () => game.dispatch({ type: 'campaign/patch', rules: defs }), press), { confirm: true }) });
        if (!patch.ok) infoLines.append(lineItem(patch.why, 'bad'));
      }
      // The weapons rack (M37): each weapon on it, put on hand. In this
      // panel, under the transponder swap; once one has had its first tap,
      // its facts under it, so the foot's hint need only say what buying
      // does.
      const rackButtons = (text.rack?.items ?? []).map((item) => {
        const button = toolButton('sct-rack', icons.shoot, armed === item.key ? item.ask : item.label);
        button.dataset.armed = String(armed === item.key);
        button.disabled = !item.ok;
        button.setAttribute('aria-label', item.ok ? `Buy the ${item.name.toLowerCase()}: ${item.label.split(' · ').at(-1)} credits` : item.why);
        const facts = armed === item.key ? node('ul', 'sct-lines sct-rack-facts') : null;
        facts?.append(...item.facts.map((fact) => node('li', null, fact)));
        return { button, facts, detach: onTap(button, (press) => twoTaps(item.key, () => game.dispatch({ type: 'campaign/arms/rack', slot: item.slot, rules: defs }), press), { confirm: true }) };
      });
      buys.replaceChildren(...buyButtons.map((entry) => entry.button));
      buys.hidden = !buyButtons.length;
      rackList.replaceChildren(...rackButtons.flatMap((entry) => (entry.facts ? [entry.button, entry.facts] : [entry.button])));
      rackList.hidden = !rackButtons.length;
      buyButtons.push(...rackButtons);
      // The button tapped stays in sight for the second tap, with its facts
      // as far as they fit.
      rackList.querySelector('.sct-rack-facts')?.scrollIntoView({ block: 'nearest' });
      rackList.querySelector('button[data-armed="true"]')?.scrollIntoView({ block: 'nearest' });
      setText(infoText, here.text);
    }

    // Which result Carry on put away: the sector and the node.
    function resultKey(campaign) {
      const result = campaign?.run?.result;
      return result ? `${campaign.run.sector.index}:${campaign.run.sector.name}:${result.node}` : null;
    }

    function lineItem(text, tone) {
      const item = node('li', null, text);
      item.dataset.tone = tone;
      return item;
    }

    // A tap on a node picks it, showing its jump; a second tap on it jumps.
    // A tap on the ship's own node puts the pick down.
    // A second tap on the node picked jumps there; with holds confirming
    // (M47), a hold on it does, and a tap only picks it.
    function tapNode(id, press) {
      const campaign = game.getState().campaign;
      if (!defs || !campaign?.run) return;
      disarm();
      if (id === picked && confirms(true, press)) {
        makeJump();
        return;
      }
      picked = id === campaign.run.at ? null : id;
      render(true);
    }

    function makeJump() {
      const campaign = game.getState().campaign;
      if (!defs || picked === null || !campaign?.run || !jumpText(campaign, defs, picked).ok) return;
      const to = picked;
      picked = null;
      disarm();
      game.dispatch({ type: 'campaign/jump', to, rules: defs });
      render(true);
    }

    // Refit: construction mode on the ship, at a station or a shipyard, or
    // to rearrange it between jumps (M46). Opening it changes nothing, so
    // it takes one tap.
    function refit() {
      const { campaign } = game.getState();
      if (!defs || !campaign || !sectorText(campaign, defs).refit) return;
      disarm();
      game.dispatch({ type: 'screen/show', screen: 'construction' });
    }

    // Jobs: the station's job board (M38c, jobs.js), one tap.
    function openJobs() {
      const { campaign } = game.getState();
      if (!defs || !campaign || !sectorText(campaign, defs).jobs) return;
      disarm();
      game.dispatch({ type: 'screen/show', screen: 'jobs' });
    }

    // Yard: the shop screen on the shipyard's parts (M37b), one tap.
    function openYard() {
      const { campaign } = game.getState();
      if (!defs || !campaign || !sectorText(campaign, defs).yard) return;
      disarm();
      game.dispatch({ type: 'screen/show', screen: 'shop' });
    }

    // Fly home's second tap (M38d): the flight's days pass, and the ship
    // lands at the colony, whose screen opens with what the flight came to
    // (carried.js), or a lander stops it and the hint says so.
    function flyHome() {
      const { campaign } = game.getState();
      if (!defs || !campaign) return;
      const result = voyageHome(campaign, defs);
      carry(result.ok ? voyageReport(result, campaign, defs) : { tone: 'bad', text: result.error });
      game.dispatch({ type: 'campaign/voyage/home', rules: defs });
      report = carried(game.getState().campaign);
    }

    // The other colonies' panels (M38e): made again when which colonies
    // there are changes, else their words brought up to date; each with Fly
    // to in two taps, hidden while hidden is.
    function showOthers(list, hidden) {
      const ids = list.map((colony) => colony.id).join();
      if (ids !== othersShown) {
        others.forEach((entry) => entry.detach());
        others = new Map(list.map((colony) => {
          const title = node('h2');
          const rows = node('dl', 'hgr-hold');
          const line = node('p', 'sct-colony-line');
          const button = toolButton('sct-fly', icons.home, 'Fly to');
          const box = node('section', 'hgr-panel sct-colony-panel sct-other');
          box.dataset.colony = String(colony.id);
          box.append(title, rows, line, button);
          return [colony.id, { panel: box, title, rows, line, button, detach: onTap(button, (press) => twoTaps(`fly:${colony.id}`, () => flyThere(colony.id), press), { confirm: true }) }];
        }));
        othersBox.replaceChildren(...[...others.values()].map((entry) => entry.panel));
        othersShown = ids;
      }
      for (const colony of list) {
        const entry = others.get(colony.id);
        const key = `fly:${colony.id}`;
        setText(entry.title, colony.title);
        entry.rows.replaceChildren(...listRows(colony.rows));
        setText(entry.line, colony.line);
        entry.panel.dataset.tone = colony.tone;
        entry.button.hidden = hidden;
        entry.button.disabled = !colony.fly.ok;
        setText(entry.button.querySelector('span'), armed === key ? 'Fly to?' : 'Fly to');
        entry.button.dataset.armed = String(armed === key);
        entry.button.setAttribute('aria-label', colony.fly.ok ? colony.fly.ask.replace(' Tap again to fly.', '') : `Fly to ${colony.name}. ${colony.fly.why}`);
      }
    }

    // Fly to's second tap (M38e): the flight's days pass, and the ship
    // lands at that colony, whose screen opens with what the flight came to,
    // or a lander stops it and the hint says so.
    function flyThere(id) {
      const { campaign } = game.getState();
      if (!defs || !campaign) return;
      const result = flyTo(campaign, defs, id);
      carry(result.ok ? flightReport(result, campaign, defs) : { tone: 'bad', text: result.error });
      game.dispatch({ type: 'campaign/voyage/to', id, rules: defs });
      report = carried(game.getState().campaign);
    }

    // Defend's second tap (M38d): the colony's guns fire at the lander, and
    // those at home fight what lands on the fight's screen; without a fight
    // the hint says what came of the landing.
    function defend() {
      const { campaign } = game.getState();
      if (!defs || !campaign) return;
      const result = faceRaid(campaign, defs, fightSettings(game.getState().settings));
      game.dispatch({ type: 'campaign/raid/face', rules: defs });
      report = { campaign: game.getState().campaign, words: result.ok ? landingReport(result, campaign, defs) : { tone: 'bad', text: result.error } };
    }

    // The crew card up or down: what was picked or had a first tap is put
    // down either way.
    function toggleCrew(open) {
      if (!defs || !game.getState().campaign?.run) return;
      crewOpen = open;
      picked = null;
      disarm();
      render(true);
    }

    // A crew card button's second tap: 'hire:<slot>' signs a recruit on,
    // 'let:<id>' lets a crew member go, 'arm:<id>:<weapon>' gives them a
    // spare weapon (M37).
    function crewOrder(key) {
      const [kind, n, weapon] = key.split(':');
      if (kind === 'hire') game.dispatch({ type: 'campaign/hire', slot: Number(n), rules: defs });
      if (kind === 'let') game.dispatch({ type: 'campaign/dismiss', id: Number(n), rules: defs });
      if (kind === 'arm') game.dispatch({ type: 'campaign/arms/swap', id: Number(n), weapon, rules: defs });
    }

    // Jump on, Buy and the crew card's buttons: the first tap says what it
    // costs, the second does it.
    function twoTaps(which, act, press) {
      if (!defs) return;
      if (!confirms(armed === which, press)) {
        armed = which;
        picked = null;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) render(true);
        }, ARM_MS);
        render(true);
        return;
      }
      disarm();
      act();
      if (alive) render(true);
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
    }

    let painted = false;
    return {
      resize() {
        painted = false;
      },
      // Nothing on the canvas: the chart is all panels.
      draw(ctx, view) {
        if (painted) return;
        painted = true;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};

// The words carried to this screen (carried.js), as the report shown until
// the campaign moves on, or null.
function carried(campaign) {
  const words = takeCarried();
  return words ? { campaign, words } : null;
}
