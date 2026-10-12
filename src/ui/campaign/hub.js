// The hub: home between fights. A stand-in until M13's hangar: what the
// campaign holds (the act and its home, the crew, the ship, credits, heat,
// parts and fights) and, for now, one thing to do: fight off boarders.
// Everything the campaign holds is saved as it changes, so the hub reopens
// as it was left.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { beginFight } from '../../sim/campaign.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { hubText } from './hubText.js';

const field = makeStarfield(seedFrom('hub'));

export const hubScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hub');
    const head = node('header', 'hub-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hub-home');
    head.append(actLine, homeLine);
    const crewList = node('ul', 'hub-crew');
    const shipSize = node('p', 'hub-size');
    const shipLines = node('ul', 'hub-check');
    const holdings = node('dl', 'hub-hold');
    const panels = node('div', 'hub-panels');
    panels.append(panel('Crew', crewList), panel('Ship', shipSize, shipLines), panel('Holdings', holdings));
    const foot = node('footer', 'hub-foot');
    const titleButton = toolButton('hub-tool', icons.leave, 'Title');
    const note = node('p', 'hub-note', 'Loading…');
    const fightButton = toolButton('hub-fight', icons.shoot, 'Repel boarders');
    fightButton.disabled = true;
    foot.append(titleButton, note, fightButton);
    el.append(head, panels, foot);
    root.append(el);

    let defs = null;
    let alive = true;
    let shown = null; // the campaign the panels show
    let backdrop = null;
    let dirty = true;
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(fightButton, () => defs && game.dispatch({ type: 'campaign/fight/begin', rules: defs })),
      game.subscribe((state) => alive && render(state.campaign)),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        render(game.getState().campaign);
      })
      .catch((err) => {
        if (alive) setText(note, `Couldn't load the game data: ${err.message}`);
      });

    function render(campaign) {
      if (!defs || !campaign || campaign === shown) return;
      shown = campaign;
      const text = hubText(campaign, defs);
      setText(actLine, text.act);
      setText(homeLine, text.home);
      crewList.replaceChildren(
        ...text.crew.map(({ name, job, hp, max }) => {
          const row = node('li');
          row.dataset.wounded = String(hp < max);
          const bar = node('span', 'hub-hp');
          const fill = node('span');
          fill.style.width = `${(100 * hp) / max}%`;
          bar.append(fill);
          row.append(node('span', 'hub-name', job ? `${name}, ${job}` : name), bar, node('span', 'hub-num', `${hp}/${max}`));
          return row;
        }),
      );
      setText(shipSize, text.ship.ready ? `${text.ship.size}. Ready to launch.` : `${text.ship.size}. To launch:`);
      shipLines.replaceChildren(...text.ship.lines.map((line) => node('li', null, line)));
      holdings.replaceChildren(
        ...text.holdings.map(([label, value]) => {
          const row = node('div');
          row.append(node('dt', null, label), node('dd', null, value));
          return row;
        }),
      );
      const fight = beginFight(campaign, defs);
      fightButton.disabled = !fight.ok;
      setText(note, fight.ok ? 'A stand-in for the hangar: building, jobs and raids come next.' : fight.error);
    }

    return {
      resize(view) {
        backdrop = paintBackdrop(field, view);
        dirty = true;
      },
      // Still stars: the sky is drawn again only when the screen changes size.
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        backdrop ??= paintBackdrop(field, view);
        ctx.drawImage(backdrop, 0, 0, view.width, view.height);
        drawStars(ctx, field, view, 0);
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
  const el = node('section', 'hub-panel');
  el.append(node('h2', null, title), ...children);
  return el;
}
