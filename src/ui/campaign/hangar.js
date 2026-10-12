// The hangar: act 1's home, between fights. The half-built ship stands in
// the middle, seen from outside. Around it are the act's goal (the flight
// checklist, each fix saying whether the part is on hand), the crew with
// their hit points, and what the campaign holds. Build opens construction
// mode (construction.js) on the ship; Jobs opens the job board (jobs.js),
// where the parts still missing are earned. Everything the campaign holds
// is saved as it changes, so the hangar reopens as it was left.
import { loadContent } from '../../platform/content.js';
import { traceHull } from '../../render/hull.js';
import { fitOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { BOARD_VIEW, boardBox, createBoard } from '../../render/shipView.js';
import { openings } from '../../sim/builder.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { hangarText } from './hubText.js';

const MARGIN = 10; // pixels around the ship
const NO_MIN = [0, 0]; // the view fits the ship alone, however small

export const hangarScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hgr-home');
    head.append(actLine, homeLine);
    const goalLines = node('ul', 'hgr-goal');
    const crewList = node('ul', 'hgr-crew');
    const holdings = node('dl', 'hgr-hold');
    const shipArea = node('div', 'hgr-ship');
    const side = node('div', 'hgr-side');
    side.append(panel('Crew', crewList), panel('Hangar', holdings));
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const hint = node('p', 'hgr-hint', 'Loading…');
    const jobsButton = toolButton('hgr-jobs', icons.jobs, 'Jobs');
    const buildButton = toolButton('hgr-build', icons.build, 'Build');
    jobsButton.disabled = buildButton.disabled = true;
    foot.append(titleButton, hint, jobsButton, buildButton);
    el.append(head, panel('Goal: launch', goalLines), shipArea, side, foot);
    root.append(el);

    let defs = null;
    let board = null; // the ship seen from outside (shipView.js)
    let box = null; // what the view fits
    let camera = null;
    let alive = true;
    let shown = null; // the campaign the screen shows
    let dirty = true;
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(buildButton, () => game.dispatch({ type: 'screen/show', screen: 'construction' })),
      onTap(jobsButton, () => game.dispatch({ type: 'screen/show', screen: 'jobs' })),
      game.subscribe((state) => alive && render(state.campaign)),
    ];
    const observer = new ResizeObserver(() => layout());
    observer.observe(shipArea);
    cleanups.push(() => observer.disconnect());

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        // A campaign saved before there were jobs gets its first board.
        if (game.getState().campaign && !game.getState().campaign.board.length) game.dispatch({ type: 'campaign/board', rules: defs });
        render(game.getState().campaign);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    function render(campaign) {
      if (!defs || !campaign || campaign === shown) return;
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
      crewList.replaceChildren(
        ...text.crew.map(({ name, job, hp, max }) => {
          const row = node('li');
          row.dataset.wounded = String(hp < max);
          const bar = node('span', 'hgr-hp');
          const fill = node('span');
          fill.style.width = `${(100 * hp) / max}%`;
          bar.append(fill);
          row.append(node('span', 'hgr-name', job ? `${name}, ${job}` : name), bar, node('span', 'hgr-num', `${hp}/${max}`));
          return row;
        }),
      );
      holdings.replaceChildren(
        ...text.holdings.map(([label, value]) => {
          const row = node('div');
          if (value.length > 14) row.dataset.wide = '';
          row.append(node('dt', null, label), node('dd', null, value));
          return row;
        }),
      );
      jobsButton.disabled = buildButton.disabled = false;
      setText(hint, text.hint.text);
      hint.dataset.tone = text.hint.tone;
      if (shipChanged) showShip(campaign.ship);
    }

    // The ship as it stands, from outside, fitted to the middle.
    function showShip(ship) {
      const frame = defs.frames.get(ship.frame);
      if (!frame) return;
      const hull = traceHull(ship, defs);
      board = createBoard(frame);
      board.setShip({ ship, defs, frame, doors: openings(ship, defs), hull, selected: null, lifted: null, flagged: new Set() });
      board.setHull({ ship, defs, hull, skin: skinFor('yard') });
      box = boardBox(frame, hull, NO_MIN);
      camera = null;
      layout();
    }

    function layout() {
      if (!alive || !board) return;
      const r = shipArea.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      camera = fitOrbit({ ...BOARD_VIEW, pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, MARGIN);
      dirty = true;
    }

    return {
      resize() {
        layout();
        dirty = true;
      },
      // The ship stands still: it is drawn again only when it or the screen
      // changes.
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        const all = { x: 0, y: 0, w: view.width, h: view.height };
        if (!board || !camera) {
          ctx.fillStyle = palette.space;
          ctx.fillRect(0, 0, view.width, view.height);
          return;
        }
        board.draw(ctx, camera, all, 'hull');
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};

function panel(title, ...children) {
  const el = node('section', 'hgr-panel');
  el.append(node('h2', null, title), ...children);
  return el;
}
