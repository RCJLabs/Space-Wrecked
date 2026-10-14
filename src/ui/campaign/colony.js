// The colony: act 3's home (M26). The world's ground fills the middle, the
// ship landed at the edge of the colony's grid and each building standing
// on it as the part it was (render/colonyScene.js). On the left, the
// colony's power, beds and air against what the crew needs, its buildings
// (the dark ones marked), the crew, the world and how the run went; on the
// right, the ship's
// parts: those that can be given, each with what it would give, and the
// rest with why not. A part is given in two taps (src/sim/colony.js): the
// first shows what it becomes, glows on the ship and marks out where it
// would stand; the second gives it. The act's words say what is still to
// come. The campaign is saved after every change, so Continue on the title
// comes back here.
import { loadContent } from '../../platform/content.js';
import { colonyScene } from '../../render/colonyScene.js';
import { drawColony, prepareColony } from '../../render/colonyView.js';
import { traceHull } from '../../render/hull.js';
import { fitOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { BOARD_VIEW } from '../../render/shipView.js';
import { colonyStats, donate, donatePlan } from '../../sim/colony.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { colonyText, givenText, giveText } from './colonyText.js';
import { crewRows, listRows } from './hubParts.js';

const ARM_MS = 4000; // a part's first tap waits this long for its second
const MARGIN = 10; // pixels round the colony in its place

export const colonyScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr cln');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hgr-home');
    head.append(actLine, homeLine);
    // The colony, its buildings, the crew and the world, in one panel.
    const info = node('section', 'hgr-panel cln-info');
    const needs = node('dl', 'hgr-hold cln-needs');
    const powerLine = node('p', 'cln-note');
    const buildingList = node('ul', 'cln-buildings');
    const crewList = node('ul', 'hgr-crew');
    const worldTitle = node('h2', 'cln-world');
    const worldLines = node('ul', 'cln-lines');
    const recordTitle = node('h2');
    const record = node('dl', 'hgr-hold');
    info.append(node('h2', null, 'The colony'), needs, powerLine, node('h2', null, 'Buildings'), buildingList, node('h2', null, 'Crew'), crewList, worldTitle, worldLines, recordTitle, record);
    const sceneArea = node('div', 'hgr-ship');
    const partsPanel = node('section', 'hgr-panel cln-parts');
    const partList = node('ul');
    partsPanel.append(node('h2', null, "The ship's parts"), partList);
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = node('p', 'hgr-hint', 'Loading…');
    foot.append(titleButton, hint);
    el.append(head, info, sceneArea, partsPanel, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let shown = null; // the campaign last drawn
    let armed = null; // the uid a part's first tap armed
    let said = null; // { text, tone }: what the last tap came to, until the next
    let marked = null; // { uids, spot }: what the scene marks for a refusal
    let armTimer = 0;
    let partButtons = [];
    const stand = createStand(sceneArea);
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      () => clearTimeout(armTimer),
      () => partButtons.forEach((entry) => entry.detach()),
      game.subscribe(() => alive && render()),
    ];
    const observer = new ResizeObserver(() => stand.layout());
    observer.observe(sceneArea);
    cleanups.push(() => observer.disconnect());

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
      if (!defs || !campaign?.colony || (campaign === shown && !force)) return;
      const changed = campaign !== shown;
      shown = campaign;
      const text = colonyText(campaign, defs);
      setText(actLine, text.act);
      setText(homeLine, text.home);
      needs.replaceChildren(...text.needs.map(({ label, value, ok }) => {
        const row = node('div');
        row.dataset.ok = String(ok);
        row.append(node('dt', null, label), node('dd', null, value));
        return row;
      }));
      setText(powerLine, `Power: ${text.power}.`);
      buildingList.replaceChildren(...(text.buildings.length ? text.buildings.map(buildingRow) : [node('li', 'cln-none', 'None yet: give the colony a part of the ship.')]));
      crewList.replaceChildren(...crewRows(text.crew.map((row) => (row.aboard ? { ...row, job: [row.job, 'sleeps aboard'].filter(Boolean).join(' · ') } : row))));
      setText(worldTitle, text.world.title);
      worldLines.replaceChildren(...text.world.lines.map((line) => node('li', null, line)));
      setText(recordTitle, text.record.title);
      record.replaceChildren(...listRows(text.record.lines));

      // The ship's parts, as buttons. One armed that can't be given any
      // more is disarmed.
      const armedRow = text.parts.find((row) => row.ok && row.uid === armed);
      if (armed !== null && !armedRow) disarm();
      for (const entry of partButtons) entry.detach();
      partButtons = text.parts.map((row) => partButton(row));
      partList.replaceChildren(...partButtons.map((entry) => entry.item));

      const words = armedRow ? giveText(armedRow) : said ?? { text: text.ahead, tone: 'info' };
      setText(hint, words.text);
      hint.dataset.tone = words.tone;

      const mark = armedRow ? markFor(campaign, armedRow.uid) : marked;
      if (changed || JSON.stringify(mark) !== JSON.stringify(stand.mark)) stand.show(campaign, defs, mark);
    }

    function buildingRow(building) {
      const row = node('li');
      row.dataset.powered = String(building.powered);
      row.append(node('span', 'cln-name', building.name), node('small', null, building.gives));
      return row;
    }

    // A part's row as a button of 48 px or more: its name and count, and
    // the building it would be with what that gives; or the parts a reason
    // holds back, and the reason.
    function partButton(row) {
      const item = node('li');
      const button = node('button', 'btn cln-part');
      button.type = 'button';
      button.dataset.ok = String(row.ok);
      button.dataset.armed = String(row.ok && row.uid === armed);
      const name = node('span', 'cln-name', row.name);
      if (row.ok && row.count > 1) name.append(node('small', null, ` ×${row.count}`));
      const what = node('small', null, row.ok ? `${row.building} · ${row.gives}` : row.why);
      button.append(name, what);
      button.setAttribute('aria-label', row.ok ? `${row.name}: give it to the colony as the ${row.building}. ${row.gives}.` : `${row.name}: ${row.why}`);
      item.append(button);
      return { item, detach: onTap(button, () => tapPart(row)) };
    }

    // The first tap on a part that can be given arms it; the second gives
    // it. A tap on one that can't says why.
    function tapPart(row) {
      const { campaign } = game.getState();
      if (!defs || !campaign) return;
      if (!row.ok) {
        disarm();
        said = giveText(row);
        marked = { uids: row.uids, spot: null };
        render(true);
        return;
      }
      if (armed !== row.uid) {
        armed = row.uid;
        said = null;
        marked = null;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          disarm();
          if (alive) render(true);
        }, ARM_MS);
        render(true);
        return;
      }
      disarm();
      const result = donate(campaign, defs, row.uid);
      said = result.ok ? givenText(result, defs) : { text: result.error, tone: 'bad' };
      marked = null;
      game.dispatch({ type: 'campaign/donate', uid: row.uid, rules: defs });
      if (alive) render(true);
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
    }

    // What the scene marks for a part armed: it on the ship, and where it
    // would stand.
    function markFor(campaign, uid) {
      const plan = donatePlan(campaign, defs, uid);
      return { uids: [uid], spot: plan.ok ? { type: plan.type, ...plan.placement } : null };
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
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};

// The colony in its place on the screen, fitted to it:
//   stand.show(campaign, defs, mark)   when the colony or the mark changes
//   stand.layout()                     when the place may have moved
//   stand.draw(ctx, view)              every frame; draws after a change
//   stand.mark                         the mark last shown
function createStand(area) {
  let scene = null;
  let box = null;
  let camera = null;
  let dirty = true;
  const stand = {
    mark: null,
    show(campaign, defs, mark) {
      stand.mark = mark;
      const { ship, colony } = campaign;
      const stats = colonyStats(campaign, defs);
      const powered = new Map(stats.buildings.map((b) => [b.uid, b.powered]));
      const built = colonyScene({
        ship,
        hull: traceHull(ship, defs),
        buildings: colony.buildings.map((b) => ({ ...b, powered: powered.get(b.uid) ?? false })),
        site: defs.colony.site,
        kind: colony.world.kind,
        defs,
        skin: skinFor('yard'),
        mark,
      });
      scene = prepareColony(built, colony.world.kind);
      // The view keeps its fit while only the mark changes.
      if (!box || box.x0 !== built.box.x0 || box.y0 !== built.box.y0 || box.x1 !== built.box.x1 || box.y1 !== built.box.y1) {
        box = built.box;
        camera = null;
      }
      stand.layout();
    },
    layout() {
      dirty = true;
      if (!box) return;
      const r = area.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      camera = fitOrbit({ ...BOARD_VIEW, pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, MARGIN);
    },
    draw(ctx, view) {
      if (!dirty) return;
      dirty = false;
      if (!scene || !camera) {
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        return;
      }
      drawColony(ctx, { x: 0, y: 0, w: view.width, h: view.height }, camera, scene);
    },
  };
  return stand;
}
