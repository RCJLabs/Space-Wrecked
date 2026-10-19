// The game's end (M41): where death is permanent and no one is left
// aboard (campaign.js gameOver), in place of the campaign's screens; the
// title's Continue comes back to it. The fallen, each with their job and
// the act they fell in, and how far the game came (overText.js). Title
// goes back; New game starts another, as the title's does, in place of
// this one.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { panel } from './hubParts.js';
import { clearDraft } from './newGame.js';
import { overText } from './overText.js';

const field = makeStarfield(seedFrom('over'));

export const overScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'ovr');
    const head = node('header', 'cap-head');
    const title = node('h1', null, 'The end');
    const sub = node('p', 'cap-sub', '');
    head.append(title, sub);
    const fallen = node('ul', 'ovr-fallen');
    const record = node('dl', 'bkg-facts');
    const body = node('div', 'sta-rows');
    body.append(panel('The fallen', fallen), panel('The game', record));
    const foot = node('footer', 'cap-foot');
    const titleButton = toolButton('cap-back ovr-title', icons.leave, 'Title');
    const hint = node('p', 'cap-hint', 'Tap New game to start another.');
    const newButton = toolButton('cap-start ovr-new', icons.next, 'New game');
    foot.append(titleButton, hint, newButton);
    el.append(head, body, foot);
    root.append(el);

    let alive = true;
    const cleanups = [
      onTap(titleButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(newButton, () => {
        clearDraft();
        game.dispatch({ type: 'screen/show', screen: 'background' });
      }),
    ];

    loadContent()
      .then((defs) => {
        const { campaign } = game.getState();
        if (!alive || !campaign) return;
        const text = overText(campaign, defs);
        setText(title, text.title);
        setText(sub, text.line);
        fallen.replaceChildren(...text.fallen.map((member) => {
          const item = node('li');
          item.append(node('strong', null, member.name), node('span', null, ` · ${member.about}`));
          return item;
        }));
        record.replaceChildren(...text.record.flatMap(([label, value]) => [node('dt', null, label), node('dd', null, value)]));
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
