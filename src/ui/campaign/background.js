// Picking a background, the first screen of a new game (M30): New game on
// the title opens it. A card for each background, in data/backgrounds.json's
// order, and beside them the one picked in full: its words, who is after it
// and on what terms, its district, and what its start gives. A tap on a card
// picks it; Next goes on to make the captain for it (captain.js), and Title
// goes back with nothing changed.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { firstBackground } from '../../sim/campaign.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { backgroundText } from './backgroundText.js';
import { newGameDraft } from './newGame.js';

const field = makeStarfield(seedFrom('background'));

export const backgroundScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'bkg');
    const head = node('header', 'cap-head');
    head.append(node('h1', null, 'Your background'), node('p', 'cap-sub', 'Who you were, and who wants you back.'));
    const cards = node('div', 'bkg-cards');
    const detail = node('section', 'hgr-panel bkg-detail');
    const name = node('h2', null, '');
    const blurb = node('p', 'bkg-blurb');
    const facts = node('dl', 'bkg-facts');
    detail.append(name, blurb, facts);
    const foot = node('footer', 'cap-foot');
    const backButton = toolButton('cap-back bkg-back', icons.leave, 'Title');
    const hint = node('p', 'cap-hint', 'Loading…');
    const nextButton = toolButton('cap-start bkg-next', icons.next, 'Next');
    nextButton.disabled = true;
    foot.append(backButton, hint, nextButton);
    el.append(head, cards, detail, foot);
    root.append(el);

    let alive = true;
    let defs = null;
    let picked = null;
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(nextButton, next),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        // Back from the captain, the pick is kept.
        picked = defs.backgrounds.has(newGameDraft.background) ? newGameDraft.background : firstBackground(defs);
        cards.replaceChildren(
          ...backgroundText(defs, picked).cards.map((card) => {
            const button = node('button', 'btn bkg-card');
            button.type = 'button';
            button.dataset.id = card.id;
            button.append(node('span', 'bkg-name', card.name), node('span', 'bkg-pursuer', card.pursuer));
            cleanups.push(onTap(button, () => pick(card.id)));
            return button;
          }),
        );
        render();
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    function pick(id) {
      picked = id;
      detail.scrollTop = 0;
      render();
    }

    function render() {
      if (!defs) return;
      const text = backgroundText(defs, picked);
      for (const button of cards.children) button.setAttribute('aria-pressed', String(button.dataset.id === picked));
      setText(name, text.name);
      setText(blurb, text.blurb);
      facts.replaceChildren(...text.facts.flatMap(([label, value]) => [node('dt', null, label), node('dd', null, value)]));
      setText(hint, text.hint);
      hint.dataset.tone = 'good';
      nextButton.disabled = false;
    }

    function next() {
      if (!defs || nextButton.disabled) return;
      newGameDraft.background = picked;
      game.dispatch({ type: 'screen/show', screen: 'captain' });
    }

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
