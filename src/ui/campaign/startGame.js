// A new game's last screen (M41): how hard the game is, and whether death
// is permanent in it, after the background (background.js) and the captain
// (captain.js) are picked. Each is a row of choices, side by side, with
// what the one picked means (startText.js): Normal, and death not
// permanent, unless changed. Start begins the campaign, in place of any
// under way (the title asked first); Back goes back to the captain with
// nothing lost. Above them (M52), the ship's name: the one the new game
// would roll, which the player can type over, or swap for another from
// the list.
import { int, seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { MAX_NAME, nameProblem, rollIdentity, tidyName } from '../../sim/identity.js';
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
    // The ship's name (M52), typed or another from the list.
    const shipInput = node('input', 'cap-name sta-ship-name');
    Object.assign(shipInput, { type: 'text', maxLength: MAX_NAME, autocomplete: 'off', spellcheck: false, enterKeyHint: 'done' });
    shipInput.setAttribute('autocapitalize', 'words');
    shipInput.setAttribute('aria-label', 'Ship name');
    const anotherButton = toolButton('sta-another', icons.next, 'Another');
    const shipRow = node('div', 'sta-ship-row');
    shipRow.append(shipInput, anotherButton);
    const shipPanel = node('section', 'set-row hgr-panel sta-row sta-ship');
    shipPanel.append(node('h2', null, 'Your ship'), shipRow);
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
      onTap(anotherButton, another),
    ];
    const onInput = () => {
      newGameDraft.shipName = shipInput.value;
      render();
    };
    const onKey = (event) => {
      if (event.key === 'Enter') shipInput.blur();
    };
    shipInput.addEventListener('input', onInput);
    shipInput.addEventListener('keydown', onKey);
    cleanups.push(() => {
      shipInput.removeEventListener('input', onInput);
      shipInput.removeEventListener('keydown', onKey);
    });

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

    // The name the new game would roll: its seed is the next the game's
    // RNG gives (root.js campaign/new).
    function rolledName() {
      return rollIdentity(defs, int(game.getState().rng, 0, 0xffffffff).value).name;
    }

    // The next name on the list after the one in the box.
    function another() {
      if (!defs) return;
      const names = defs.shipNames;
      const at = names.indexOf(tidyName(shipInput.value));
      newGameDraft.shipName = names[(at + 1) % names.length];
      shipInput.value = newGameDraft.shipName;
      render();
    }

    function build() {
      shipInput.value = newGameDraft.shipName ?? rolledName();
      body.replaceChildren(
        shipPanel,
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
      const why = newGameDraft.shipName === null ? null : nameProblem(newGameDraft.shipName);
      startButton.disabled = !newGameDraft.captain || Boolean(why);
      setText(hint, !newGameDraft.captain ? 'Make your captain first: tap Back.' : why ?? text.hint.text);
      hint.dataset.tone = !newGameDraft.captain ? 'info' : why ? 'bad' : text.hint.tone;
    }

    function pick(key, value) {
      newGameDraft[key] = value;
      render();
    }

    function start() {
      if (!defs || startButton.disabled) return;
      const { background, captain, difficulty, permadeath, shipName } = newGameDraft;
      game.dispatch({ type: 'campaign/new', rules: defs, background, captain: { ...captain, name: captain.name.trim() }, difficulty, permadeath, shipName: shipName === null ? null : tidyName(shipName) });
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
