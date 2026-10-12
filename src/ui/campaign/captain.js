// Making a captain, the first screen of a new campaign: New game on the
// title opens it. The background is fixed in v0.1 and only shown. The
// captain's name comes filled in from the background's list, to keep or
// change; their job is one of the crew's three; and two traits are picked
// from data/traits.json, each tap showing what the trait is, and a third
// tap dropping the first. Start begins the campaign, in place of any under
// way (the title asked first); Title goes back with nothing changed.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { CAPTAIN_TRAITS, firstBackground } from '../../sim/campaign.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { panel } from './hubParts.js';
import { captainText } from './captainText.js';

const field = makeStarfield(seedFrom('captain'));

export const captainScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'cap');
    const head = node('header', 'cap-head');
    head.append(node('h1', null, 'Your captain'), node('p', 'cap-sub', 'Who leads the crew off this rock.'));
    const bgName = node('p', 'cap-bg-name');
    const bgBlurb = node('p', 'cap-bg-blurb');
    const bgPursuer = node('p', 'cap-bg-pursuer');
    const nameInput = node('input', 'cap-name');
    Object.assign(nameInput, { type: 'text', maxLength: 24, autocomplete: 'off', spellcheck: false, enterKeyHint: 'done' });
    nameInput.setAttribute('autocapitalize', 'words');
    nameInput.setAttribute('aria-label', 'Name');
    const nameLabel = node('label', 'cap-label', 'Name');
    nameLabel.append(nameInput);
    const jobRow = node('div', 'cap-jobs');
    const numbers = node('p', 'cap-numbers');
    const traitGrid = node('div', 'cap-traits');
    const flavor = node('p', 'cap-flavor');
    const foot = node('footer', 'cap-foot');
    const backButton = toolButton('cap-back', icons.leave, 'Title');
    const hint = node('p', 'cap-hint', 'Loading…');
    const startButton = toolButton('cap-start', icons.next, 'Start');
    startButton.disabled = true;
    foot.append(backButton, hint, startButton);
    const traitsPanel = panel(`Traits · pick ${CAPTAIN_TRAITS}`, traitGrid, flavor);
    el.append(head, panel('Background', bgName, bgBlurb, bgPursuer), panel('Captain', nameLabel, node('p', 'cap-label', 'Job'), jobRow, numbers), traitsPanel, foot);
    root.append(el);

    let alive = true;
    let defs = null;
    const draft = { name: '', job: null, traits: [] };
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'title' })),
      onTap(startButton, start),
    ];
    const onInput = () => {
      draft.name = nameInput.value;
      render();
    };
    const onKey = (event) => {
      if (event.key === 'Enter') nameInput.blur();
    };
    nameInput.addEventListener('input', onInput);
    nameInput.addEventListener('keydown', onKey);
    cleanups.push(() => {
      nameInput.removeEventListener('input', onInput);
      nameInput.removeEventListener('keydown', onKey);
    });

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        const background = defs.backgrounds.get(firstBackground(defs));
        // A name from the background's list, picked by the game's RNG state
        // as it stands (nothing is rolled).
        draft.name = background.captains[game.getState().rng % background.captains.length];
        draft.job = background.start.crew[0];
        nameInput.value = draft.name;
        build();
        render();
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // The job and trait buttons, made once the content is in.
    function build() {
      const text = captainText(defs, draft);
      setText(bgName, text.background.name);
      setText(bgBlurb, text.background.blurb);
      setText(bgPursuer, `After you: ${text.background.pursuer}.`);
      jobRow.replaceChildren(
        ...text.jobs.map((job) => {
          const button = node('button', 'btn cap-job', job.name);
          button.type = 'button';
          button.dataset.id = job.id;
          cleanups.push(onTap(button, () => pickJob(job.id)));
          return button;
        }),
      );
      traitGrid.replaceChildren(
        ...text.traits.map((trait) => {
          const button = node('button', 'btn cap-trait');
          button.type = 'button';
          button.dataset.id = trait.id;
          button.append(node('span', 'cap-trait-name', trait.name), node('span', 'cap-trait-effect', trait.effect));
          button.setAttribute('aria-label', `${trait.name}: ${trait.effect}`);
          cleanups.push(onTap(button, () => toggleTrait(trait.id)));
          return button;
        }),
      );
    }

    function render() {
      if (!defs) return;
      const text = captainText(defs, draft);
      for (const button of jobRow.children) button.setAttribute('aria-pressed', String(button.dataset.id === draft.job));
      for (const button of traitGrid.children) button.setAttribute('aria-pressed', String(draft.traits.includes(button.dataset.id)));
      setText(numbers, text.captain);
      startButton.disabled = !text.ready;
      const replaces = text.ready && game.getState().campaign ? ' This replaces the campaign under way.' : '';
      setText(hint, text.hint.text + replaces);
      hint.dataset.tone = text.hint.tone;
    }

    function pickJob(id) {
      draft.job = id;
      render();
    }

    // A third trait drops the first picked.
    function toggleTrait(id) {
      draft.traits = draft.traits.includes(id) ? draft.traits.filter((t) => t !== id) : [...draft.traits, id].slice(-CAPTAIN_TRAITS);
      const trait = defs.traits.get(id);
      setText(flavor, `${trait.name}: ${trait.text}`);
      render();
    }

    function start() {
      if (!defs || startButton.disabled) return;
      game.dispatch({ type: 'campaign/new', rules: defs, captain: { ...draft, name: draft.name.trim() } });
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
