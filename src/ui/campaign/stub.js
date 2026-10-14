// The stub: what stands in for an act not built yet (act 3, the colony,
// until v0.3). The ship stands in the middle as it came down, the world
// settled under it (M25); around it are how the run went, the crew, and
// the act's words for what is to come (data/campaign.json). The campaign
// is saved as it is, so Continue on the title comes back here, and the act
// picks up from it once it is built.
import { loadContent } from '../../platform/content.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { createShipStand, crewRows, listRows, panel } from './hubParts.js';
import { stubText } from './launchText.js';

export const stubScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'hgr stub');
    const head = node('header', 'hgr-head');
    const actLine = node('h1');
    const homeLine = node('p', 'hgr-home');
    head.append(actLine, homeLine);
    const record = node('dl', 'hgr-hold');
    const recordPanel = panel('', record);
    const crewList = node('ul', 'hgr-crew');
    const shipArea = node('div', 'hgr-ship');
    // The world settled, under the ship.
    const world = node('section', 'hgr-panel stb-world');
    const worldTitle = node('h2');
    const worldLines = node('ul', 'stb-lines');
    world.append(worldTitle, worldLines);
    world.hidden = true;
    const side = node('div', 'hgr-side');
    side.append(panel('Crew', crewList));
    const foot = node('footer', 'hgr-foot');
    const titleButton = toolButton('hgr-tool', icons.leave, 'Title');
    const words = node('p', 'hgr-hint', 'Loading…');
    foot.append(titleButton, words);
    el.append(head, recordPanel, shipArea, world, side, foot);
    root.append(el);

    let alive = true;
    const stand = createShipStand(shipArea);
    const cleanups = [onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' }))];
    const observer = new ResizeObserver(() => stand.layout());
    observer.observe(shipArea);
    cleanups.push(() => observer.disconnect());

    loadContent()
      .then((defs) => {
        const { campaign } = game.getState();
        if (!alive || !campaign) return;
        const text = stubText(campaign, defs);
        setText(actLine, text.act);
        setText(homeLine, text.home);
        setText(recordPanel.querySelector('h2'), text.record.title);
        record.replaceChildren(...listRows(text.record.lines));
        crewList.replaceChildren(...crewRows(text.crew));
        world.hidden = !text.world;
        if (text.world) {
          setText(worldTitle, text.world.title);
          worldLines.replaceChildren(...text.world.lines.map((line) => node('li', null, line)));
        }
        setText(words, text.text);
        words.dataset.tone = 'info';
        stand.show(campaign.ship, defs);
      })
      .catch((err) => {
        if (alive) setText(words, `Couldn't load the game data: ${err.message}`);
      });

    return {
      resize() {
        stand.layout();
      },
      // The ship stands still: it is drawn again only when the screen
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
