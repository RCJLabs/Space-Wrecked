// The epilogue (M56): the reckoning won, the pursuit over (reckoning.js),
// in place of the campaign's screens until Carry on; the title's Continue
// comes back to it until then. The background's own words, the colony, the
// crew and the fallen, and how far the run came (epilogueText.js). Carry
// on goes back to the colony, no more of the pursuer's raids to come; New
// game starts another, as the title's does.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { panel } from './hubParts.js';
import { clearDraft } from './newGame.js';
import { epilogueText } from './epilogueText.js';

const field = makeStarfield(seedFrom('epilogue'));

export const epilogueScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'ovr epl');
    const head = node('header', 'cap-head');
    const title = node('h1', null, 'The pursuit is over');
    const sub = node('p', 'cap-sub', '');
    head.append(title, sub);
    const words = node('p', 'epl-words', '');
    const colony = node('dl', 'bkg-facts');
    const crew = node('ul', 'ovr-fallen epl-crew');
    const fallen = node('ul', 'ovr-fallen');
    const record = node('dl', 'bkg-facts');
    const body = node('div', 'sta-rows');
    const fallenPanel = panel('The fallen', fallen);
    body.append(panel('After', words), panel('The colony', colony), panel('The crew', crew), fallenPanel, panel('The run', record));
    const foot = node('footer', 'cap-foot');
    const newButton = toolButton('cap-back epl-new', icons.leave, 'New game');
    const hint = node('p', 'cap-hint', 'Carry on at the colony, or start another.');
    const onButton = toolButton('cap-start epl-on', icons.next, 'Carry on');
    foot.append(newButton, hint, onButton);
    el.append(head, body, foot);
    root.append(el);

    let alive = true;
    const cleanups = [
      onTap(onButton, () => game.dispatch({ type: 'campaign/epilogue/close' })),
      onTap(newButton, () => {
        clearDraft();
        game.dispatch({ type: 'screen/show', screen: 'background' });
      }),
    ];

    const list = (target, people) => target.replaceChildren(...people.map((member) => {
      const item = node('li');
      item.append(node('strong', null, member.name), node('span', null, ` · ${member.about}`));
      return item;
    }));
    const facts = (target, rows) => target.replaceChildren(...rows.flatMap(([label, value]) => [node('dt', null, label), node('dd', null, value)]));

    loadContent()
      .then((defs) => {
        const { campaign } = game.getState();
        if (!alive || !campaign) return;
        const text = epilogueText(campaign, defs);
        setText(title, text.title);
        setText(sub, text.line);
        setText(words, text.words);
        facts(colony, text.colony);
        list(crew, text.crew);
        list(fallen, text.fallen);
        fallenPanel.hidden = !text.fallen.length;
        facts(record, text.record);
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    let backdrop = null;
    let dirty = true;
    return {
      resize(view) {
        backdrop = paintBackdrop(field, view);
        dirty = true;
      },
      // A still sky: drawn again only when the screen changes.
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
