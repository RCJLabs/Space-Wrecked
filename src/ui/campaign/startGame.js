// A new game's last screen (M41): how hard the game is, and whether death
// is permanent in it, after the background (background.js) and the captain
// (captain.js) are picked. Each is a row of choices, side by side, with
// what the one picked means (startText.js): Normal, and death not
// permanent, unless changed. Start begins the campaign, in place of any
// under way (the title asked first); Back goes back to the captain with
// nothing lost.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { newGameDraft } from './newGame.js';
import { startText } from './startText.js';

const field = makeStarfield(seedFrom('start'));

export const startGameScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'sta');
    const head = node('header', 'cap-head');
    const sub = node('p', 'cap-sub', '');
    head.append(node('h1', null, 'Your game'), sub);
    const body = node('div', 'sta-rows');
    const foot = node('footer', 'cap-foot');
    const backButton = toolButton('cap-back', icons.prev, 'Back');
    const hint = node('p', 'cap-hint', 'Loading…');
    const startButton = toolButton('cap-start sta-start', icons.next, 'Start');
    startButton.disabled = true;
    foot.append(backButton, hint, startButton);
    el.append(head, body, foot);
    root.append(el);

    let alive = true;
    let defs = null;
    const shown = new Map(); // key -> { buttons, line }
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'captain' })),
      onTap(startButton, start),
    ];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        build();
        render();
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    function build() {
      body.replaceChildren(
        ...startText(defs, newGameDraft).rows.map((row) => {
          const item = node('section', 'set-row hgr-panel sta-row');
          const choices = node('div', 'set-choices');
          choices.setAttribute('role', 'group');
          choices.setAttribute('aria-label', row.title);
          const buttons = row.choices.map((choice) => {
            const button = node('button', 'btn set-choice', choice.label);
            button.type = 'button';
            cleanups.push(onTap(button, () => pick(row.key, choice.value)));
            return { button, value: choice.value };
          });
          choices.append(...buttons.map((b) => b.button));
          const line = node('p', 'set-line');
          item.append(node('h2', null, row.title), choices, line);
          shown.set(row.key, { buttons, line });
          return item;
        }),
      );
    }

    function render() {
      if (!defs) return;
      const text = startText(defs, newGameDraft, Boolean(game.getState().campaign));
      setText(sub, text.sub);
      for (const row of text.rows) {
        const { buttons, line } = shown.get(row.key);
        for (const { button, value } of buttons) button.setAttribute('aria-pressed', String(row.value === value));
        setText(line, row.line);
      }
      startButton.disabled = !newGameDraft.captain;
      setText(hint, newGameDraft.captain ? text.hint.text : 'Make your captain first: tap Back.');
      hint.dataset.tone = newGameDraft.captain ? text.hint.tone : 'info';
    }

    function pick(key, value) {
      newGameDraft[key] = value;
      render();
    }

    function start() {
      if (!defs || startButton.disabled) return;
      const { background, captain, difficulty, permadeath } = newGameDraft;
      game.dispatch({ type: 'campaign/new', rules: defs, background, captain: { ...captain, name: captain.name.trim() }, difficulty, permadeath });
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
