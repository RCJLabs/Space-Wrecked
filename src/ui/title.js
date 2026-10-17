// The title screen: the title over the hangar (render/scenes/hangar.js,
// M34), its bay door open on a seeded starfield, with Continue for a
// campaign under way, New game and Settings (settings.js). New game opens
// the backgrounds (campaign/background.js), then the captain's screen, over
// a campaign only after a second tap, since starting one can't be undone.
// The game always reopens here, and Continue goes back to where the
// campaign was.
import { config } from '../config.js';
import { seedFrom } from '../core/rng.js';
import { loadContent } from '../platform/content.js';
import { paintCover } from '../render/scenes/paint.js';
import { titlePicture } from '../render/scenes/scenes.js';
import { drawStars, makeStarfield, paintBackdrop } from '../render/starfield.js';
import { continueText } from './campaign/hubText.js';
import { newGameDraft } from './campaign/newGame.js';
import { onTap } from './gestures.js';
import { motionReduced } from './motion.js';

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
    tag.textContent = 'Early build: from the hangar to the colony.';
    const actions = document.createElement('div');
    actions.className = 'title-actions';
    const continueButton = button('btn title-continue');
    const continueLabel = document.createElement('span');
    continueLabel.textContent = 'Continue';
    const where = document.createElement('small');
    continueButton.append(continueLabel, where);
    const newButton = button('btn title-new');
    newButton.textContent = 'New game';
    const settingsButton = button('btn title-settings');
    settingsButton.textContent = 'Settings';
    actions.append(continueButton, newButton, settingsButton);
    const note = document.createElement('p');
    note.className = 'title-note';
    note.setAttribute('role', 'status');
    el.append(heading, tag, actions, note);
    root.append(el);

    let alive = true;
    let defs = null;
    let armed = false;
    let armTimer = 0;
    const cleanups = [
      onTap(continueButton, () => game.dispatch({ type: 'campaign/continue' })),
      onTap(newButton, newGame),
      onTap(settingsButton, () => game.dispatch({ type: 'screen/show', screen: 'settings' })),
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
      if (game.getState().campaign && !armed) {
        armed = true;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          armed = false;
          note.textContent = '';
          if (alive) sync();
        }, ARM_MS);
        note.textContent = 'Tap again to start a new game. The campaign under way will be lost once you start.';
        sync();
        return;
      }
      armed = false;
      clearTimeout(armTimer);
      newGameDraft.background = null;
      game.dispatch({ type: 'screen/show', screen: 'background' });
    }

    let backdrop = null; // the sky
    let hangar = null; // the hangar over it, the door's sky cut out
    return {
      resize(view) {
        backdrop = paintBackdrop(field, view);
        hangar = paintCover(titlePicture(), view.width, view.height, view.dpr);
      },
      draw(ctx, view, timeMs) {
        backdrop ??= paintBackdrop(field, view);
        hangar ??= paintCover(titlePicture(), view.width, view.height, view.dpr);
        ctx.drawImage(backdrop, 0, 0, view.width, view.height);
        drawStars(ctx, field, view, motionReduced(game.getState().settings) ? 0 : timeMs);
        ctx.drawImage(hangar, 0, 0, view.width, view.height);
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
