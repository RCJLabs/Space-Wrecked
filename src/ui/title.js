// The title screen: the title over a seeded starfield, with Continue for a
// campaign under way and New game. A new game over a campaign takes a
// second tap, since it can't be undone. The game always reopens here, and
// Continue goes back to where the campaign was.
import { config } from '../config.js';
import { seedFrom } from '../core/rng.js';
import { loadContent } from '../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../render/starfield.js';
import { continueText } from './campaign/hubText.js';
import { onTap } from './gestures.js';

// A fixed seed, so the title sky is the same on every launch.
const field = makeStarfield(seedFrom('title'));
const ARM_MS = 3000; // New game waits this long for its second tap

export const titleScreen = {
  mount(root, { store: game }) {
    const el = document.createElement('section');
    el.className = 'title';
    const heading = document.createElement('h1');
    heading.textContent = config.title;
    const tag = document.createElement('p');
    tag.className = 'tag';
    tag.textContent = 'Early build: act 1, the hangar and its jobs.';
    const actions = document.createElement('div');
    actions.className = 'title-actions';
    const continueButton = button('btn title-continue');
    const continueLabel = document.createElement('span');
    continueLabel.textContent = 'Continue';
    const where = document.createElement('small');
    continueButton.append(continueLabel, where);
    const newButton = button('btn title-new');
    newButton.textContent = 'New game';
    actions.append(continueButton, newButton);
    const note = document.createElement('p');
    note.className = 'title-note';
    note.setAttribute('role', 'status');
    el.append(heading, tag, actions, note);
    root.append(el);

    let alive = true;
    let defs = null;
    let armed = false;
    let armTimer = 0;
    let starting = false;
    const cleanups = [
      onTap(continueButton, () => game.dispatch({ type: 'campaign/continue' })),
      onTap(newButton, newGame),
      game.subscribe(() => alive && sync()),
    ];
    loadContent()
      .then((content) => {
        defs = content;
        if (alive) sync();
      })
      .catch(() => {}); // New game says so if it still can't load

    sync();

    function sync() {
      const { campaign } = game.getState();
      continueButton.hidden = !campaign;
      if (campaign) where.textContent = continueText(campaign, defs);
      newButton.classList.toggle('title-primary', !campaign);
      newButton.textContent = armed ? 'Start over?' : 'New game';
    }

    function newGame() {
      if (starting) return;
      if (game.getState().campaign && !armed) {
        armed = true;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          armed = false;
          note.textContent = '';
          if (alive) sync();
        }, ARM_MS);
        note.textContent = 'Tap again to start a new game. The campaign under way will be lost.';
        sync();
        return;
      }
      armed = false;
      clearTimeout(armTimer);
      starting = true;
      note.textContent = '';
      loadContent()
        .then((content) => {
          if (alive) game.dispatch({ type: 'campaign/new', rules: content });
        })
        .catch((err) => {
          if (alive) note.textContent = `Couldn't load the game data: ${err.message}`;
        })
        .finally(() => {
          starting = false;
          if (alive) sync();
        });
    }

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let backdrop = null;
    return {
      resize(view) {
        backdrop = paintBackdrop(field, view);
      },
      draw(ctx, view, timeMs) {
        backdrop ??= paintBackdrop(field, view);
        ctx.drawImage(backdrop, 0, 0, view.width, view.height);
        drawStars(ctx, field, view, still.matches ? 0 : timeMs);
      },
      unmount() {
        alive = false;
        clearTimeout(armTimer);
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};

function button(className) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  return b;
}
