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
// fixes what an approach wrecked and Patch up heals the crew; Scan shows
// what nodes within reach hold, and at the jump point Jump on leads into
// the next sector, each two taps, the first saying what it costs; past the
// act's last jump point the charts end, for now. The crew and the holds are
// on the right, heat by the act; a tap on the crew opens the crew card
// (crewCard.js) over the chart, where recruits sign on at a station and
// crew are let go, two taps each. The run begins, its first sector rolled,
// the first time the map opens.
//
// Each node's button is its share of its column, so no two overlap and
// each stays 48 px or more on the screens the game is for; its mark sits
// where the sector puts the node. The words are sectorText.js's,
// eventText.js's and crewText.js's.
import { loadContent } from '../../platform/content.js';
import { palette } from '../../render/palette.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { createCrewCard } from './crewCard.js';
import { crewCardText, crewHeading, crewSaid } from './crewText.js';
import { createEventCard } from './eventCard.js';
import { eventText, resultText } from './eventText.js';
import { crewRows, heatChip, listRows, panel } from './hubParts.js';
import { jumpText, sectorText } from './sectorText.js';

const ARM_MS = 3000; // Jump on, Buy, Repair, Patch up, Scan, Sign on and Let go wait this long for a second tap
const SVG = 'http://www.w3.org/2000/svg';
const MARKS = {
  start: icons.wayIn,
  exit: icons.jumpPoint,
  station: icons.station,
  derelict: icons.derelict,
  distress: icons.distress,
  trader: icons.tag,
  hazard: icons.hazard,
  hostile: icons.hostile,
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
    info.append(infoTitle, infoName, infoKind, infoLines, infoText);
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
    const side = node('div', 'hgr-side');
    side.append(crewPanel, panel('Ship', hold));
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = node('p', 'hgr-hint', 'Loading…');
    const buys = node('div', 'sct-buys');
    const scanButton = toolButton('sct-scan', icons.scan, 'Scan');
    const jumpButton = toolButton('sct-jump', icons.jump, 'Jump');
    const onButton = toolButton('sct-on', icons.jumpPoint, 'Jump on');
    scanButton.hidden = jumpButton.hidden = onButton.hidden = true;
    foot.append(titleButton, hint, buys, scanButton, jumpButton, onButton);
    const card = createEventCard({
      choose: (choice) => game.dispatch({ type: 'campaign/event/choose', choice, rules: defs }),
      close: () => {
        closed = resultKey(game.getState().campaign);
        render(true);
      },
    });
    const crewCard = createCrewCard({
      tap: (key) => twoTaps(key, () => crewOrder(key)),
      done: () => toggleCrew(false),
    });
    el.append(head, info, map, side, card.el, crewCard.el, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let picked = null; // the node picked on the map: its jump shows
    let armed = null; // 'on', 'scan', 'repair', 'patch', the supplies a Buy is for, or a crew card button's key, after its first tap
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
      onTap(onButton, () => twoTaps('on', () => game.dispatch({ type: 'campaign/sector/leave', rules: defs }))),
      onTap(scanButton, () => twoTaps('scan', () => game.dispatch({ type: 'campaign/scan', rules: defs }))),
      onTap(crewOpener, () => toggleCrew(!crewOpen)),
      () => clearTimeout(armTimer),
      () => card.detach(),
      () => crewCard.detach(),
      () => nodeButtons.forEach((entry) => entry.detach()),
      () => buyButtons.forEach((entry) => entry.detach()),
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
      if (typeof armed === 'string' && armed.includes(':') && !crewAsk) disarm();
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
      onButton.hidden = !leave || leave.last || covered;
      if (covered) buys.hidden = true;
      onButton.disabled = !leave?.ok;
      setText(onButton.querySelector('span'), armed === 'on' ? leave.ask : 'Jump on');
      onButton.dataset.armed = String(armed === 'on');

      const buy = typeof armed === 'number' ? text.offer?.buys.find((entry) => entry.count === armed) : null;
      if (typeof armed === 'number' && !buy) disarm();
      if (armed === 'repair' && !text.repair?.ok) disarm();
      if (armed === 'patch' && !text.patch?.ok) disarm();
      const said = crew ? (crewAsk ?? crew.hint)
        : armed === 'on' ? { tone: leave.tone === 'bad' ? 'bad' : 'warn', text: `${leave.lines.join(' ')} Tap Jump on again.` }
        : armed === 'scan' ? { tone: 'warn', text: scan.text }
        : armed === 'repair' ? { tone: 'warn', text: text.repair.text }
        : armed === 'patch' ? { tone: 'warn', text: text.patch.text }
        : buy ? { tone: 'warn', text: buy.text }
        : plan ? planHint(plan)
        : result ? { tone: 'info', text: 'Carry on to the chart.' }
        : text.hint;
      setText(hint, said.text);
      hint.dataset.tone = said.tone;
    }

    // What the foot says of the jump picked.
    function planHint(plan) {
      if (!plan.ok) return { tone: 'info', text: plan.lines[0] };
      const again = `Tap it again, or ${plan.label}, to go.`;
      return plan.tone === 'bad' ? { tone: 'bad', text: `Short of supplies: the crew goes hungry. ${again}` } : { tone: 'good', text: again };
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
          return { id: n.id, button, dot, detach: onTap(button, () => tapNode(n.id)) };
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
        button.setAttribute('aria-pressed', String(id === picked));
        const where = n.here ? 'the ship is here' : n.links === 1 ? 'a jump away' : n.links === 2 ? 'a long jump away' : 'out of reach';
        const kind = n.known ? (defs.nodeTypes.get(n.type)?.name ?? n.type) : 'unknown';
        button.setAttribute('aria-label', [n.name, kind === n.name ? null : kind, where].filter(Boolean).join(', '));
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
        setText(infoTitle, plan.ok ? plan.label : 'Out of reach');
        setText(infoName, plan.node.name);
        setText(infoKind, plan.node.kind);
        infoLines.replaceChildren(...plan.lines.map((line) => lineItem(line, plan.tone)));
        buys.replaceChildren();
        buys.hidden = true;
        setText(infoText, plan.node.text);
        return;
      }
      const { here, offer, leave } = text;
      setText(infoTitle, 'Here');
      setText(infoName, here.name);
      setText(infoKind, here.kind);
      const said = leave ? [leave.title, ...leave.lines].map((line, i) => lineItem(line, i ? leave.tone : 'head')) : offer ? [offer.line, offer.why].filter(Boolean).map((line) => lineItem(line, 'info')) : [];
      infoLines.replaceChildren(...said);
      buyButtons = (offer?.buys ?? []).map((entry) => {
        const button = toolButton('sct-buy', icons.supplies, armed === entry.count ? entry.ask : entry.label);
        button.dataset.armed = String(armed === entry.count);
        button.setAttribute('aria-label', `Buy ${entry.count} supplies`);
        return { button, detach: onTap(button, () => twoTaps(entry.count, () => game.dispatch({ type: 'campaign/supplies', count: entry.count, rules: defs }))) };
      });
      // Repairs, for what an approach wrecked.
      const { repair } = text;
      if (repair) {
        const button = toolButton('sct-buy sct-repair', icons.build, armed === 'repair' ? repair.ask : repair.label);
        button.dataset.armed = String(armed === 'repair');
        button.disabled = !repair.ok;
        button.setAttribute('aria-label', repair.ok ? repair.text.replace(' Tap again to repair.', '') : repair.why);
        buyButtons.push({ button, detach: onTap(button, () => twoTaps('repair', () => game.dispatch({ type: 'campaign/repair', rules: defs }))) });
        if (!repair.ok) infoLines.append(lineItem(repair.why, 'bad'));
      }
      // Patching up, for the crew's wounds.
      const { patch } = text;
      if (patch) {
        const button = toolButton('sct-buy sct-patch', icons.stabilize, armed === 'patch' ? patch.ask : patch.label);
        button.dataset.armed = String(armed === 'patch');
        button.disabled = !patch.ok;
        button.setAttribute('aria-label', patch.ok ? patch.text.replace(' Tap again to patch up.', '') : patch.why);
        buyButtons.push({ button, detach: onTap(button, () => twoTaps('patch', () => game.dispatch({ type: 'campaign/patch', rules: defs }))) });
        if (!patch.ok) infoLines.append(lineItem(patch.why, 'bad'));
      }
      buys.replaceChildren(...buyButtons.map((entry) => entry.button));
      buys.hidden = !buyButtons.length;
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
    function tapNode(id) {
      const campaign = game.getState().campaign;
      if (!defs || !campaign?.run) return;
      disarm();
      if (id === picked) {
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
    // 'let:<id>' lets a crew member go.
    function crewOrder(key) {
      const [kind, n] = key.split(':');
      if (kind === 'hire') game.dispatch({ type: 'campaign/hire', slot: Number(n), rules: defs });
      if (kind === 'let') game.dispatch({ type: 'campaign/dismiss', id: Number(n), rules: defs });
    }

    // Jump on, Buy and the crew card's buttons: the first tap says what it
    // costs, the second does it.
    function twoTaps(which, act) {
      if (!defs) return;
      if (armed !== which) {
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
