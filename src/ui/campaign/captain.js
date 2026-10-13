// Making a captain, the first screen of a new campaign: New game on the
// title opens it. The background is fixed in v0.1, and only named under
// the title. The captain's look (M23c) starts rolled: a tap on a layer
// steps it to its next choice, and Roll rolls them all, the portrait
// showing it in the helmet of the job picked. The name comes filled in
// from the background's list, to keep or change; the job is one of the
// crew's three; and two traits are picked from data/traits.json, each tap
// showing what the trait is, and a third tap dropping the first. Start
// begins the campaign, in place of any under way (the title asked first);
// Title goes back with nothing changed.
import { seedFrom } from '../../core/rng.js';
import { loadContent } from '../../platform/content.js';
import { drawStars, makeStarfield, paintBackdrop } from '../../render/starfield.js';
import { crewColor } from '../../render/units.js';
import { CAPTAIN_TRAITS, firstBackground } from '../../sim/campaign.js';
import { rollLook, stepLook } from '../../sim/looks.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { portraitImg, portraitUrl } from '../portrait.js';
import { panel } from './hubParts.js';
import { captainText } from './captainText.js';

const field = makeStarfield(seedFrom('captain'));

export const captainScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'cap');
    const head = node('header', 'cap-head');
    const sub = node('p', 'cap-sub', 'Who leads the crew off this rock.');
    head.append(node('h1', null, 'Your captain'), sub);
    const face = portraitImg('cap-face', '');
    const layers = node('div', 'cap-layers');
    const look = node('div', 'cap-look');
    look.append(face, layers);
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
    el.append(head, panel('Look', look), panel('Captain', nameLabel, node('p', 'cap-label', 'Job'), jobRow, numbers), traitsPanel, foot);
    root.append(el);

    let alive = true;
    let defs = null;
    const draft = { name: '', job: null, traits: [], look: null };
    // Roll's own RNG, from the game's state as it stands: the game's
    // rolls don't move.
    let rolls = seedFrom(`captain look ${game.getState().rng}`);
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
        roll();
        nameInput.value = draft.name;
        build();
        render();
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // The look's, job and trait buttons, made once the content is in.
    function build() {
      const text = captainText(defs, draft);
      setText(sub, `${text.background.name}. After you: ${text.background.pursuer}.`);
      sub.title = text.background.blurb;
      const roller = toolButton('cap-roll', icons.again, 'Roll');
      cleanups.push(onTap(roller, () => {
        roll();
        render();
      }));
      layers.replaceChildren(
        ...text.look.map((layer) => {
          const button = node('button', 'btn cap-layer');
          button.type = 'button';
          button.dataset.key = layer.key;
          button.append(node('span', 'cap-layer-name', layer.label), node('span', 'cap-layer-value', layer.value));
          cleanups.push(onTap(button, () => {
            draft.look = stepLook(draft.look, layer.key);
            render();
          }));
          return button;
        }),
        roller,
      );
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
      const place = defs.backgrounds.get(firstBackground(defs)).start.crew.indexOf(draft.job);
      const url = portraitUrl(draft.look, defs.jobs.get(draft.job)?.look, crewColor(Math.max(0, place)), 'bust');
      if (face.getAttribute('src') !== url) face.src = url;
      face.alt = `${draft.name.trim() || 'Your captain'}'s portrait`;
      for (const button of layers.querySelectorAll('.cap-layer')) {
        const layer = text.look.find((each) => each.key === button.dataset.key);
        setText(button.querySelector('.cap-layer-value'), layer.value);
        button.setAttribute('aria-label', `${layer.label}: ${layer.value}. Tap for the next.`);
      }
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

    // A new look, every layer rolled.
    function roll() {
      const next = rollLook(rolls);
      draft.look = next.value;
      rolls = next.state;
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
