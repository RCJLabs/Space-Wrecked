// Making a captain, the second screen of a new campaign: Next on the
// background's screen (background.js, M30) opens it for the background
// picked there, which is named under the title. The captain's look (M23c)
// starts rolled: a tap on a layer steps it to its next choice, and Roll
// rolls them all, the portrait showing it in the helmet of the job picked.
// The name comes filled in from the background's list, to keep or change;
// the job is one of the start crew's; and two traits are picked from
// data/traits.json (20 since M32b, scrolling in their panel), each tap
// showing what the trait is, and a third tap dropping the first. Next goes
// on to how hard the game is (startGame.js, M41), the captain kept in the
// draft (newGame.js) and made again from it on coming back; Back goes back
// to the backgrounds with nothing changed.
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
import { newGameDraft } from './newGame.js';

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
    // What the job picked brings (M32): its order, aboard, at the colony.
    const does = node('div', 'cap-does');
    const traitGrid = node('div', 'cap-traits');
    const flavor = node('p', 'cap-flavor');
    const foot = node('footer', 'cap-foot');
    const backButton = toolButton('cap-back', icons.prev, 'Back');
    const hint = node('p', 'cap-hint', 'Loading…');
    const startButton = toolButton('cap-start', icons.next, 'Next');
    startButton.disabled = true;
    foot.append(backButton, hint, startButton);
    // The 20 traits scroll in their panel, with the last one tapped in words
    // under them (M32b).
    const traitsPanel = panel(`Traits · pick ${CAPTAIN_TRAITS}`, traitGrid, flavor);
    traitsPanel.classList.add('cap-traits-panel');
    el.append(head, panel('Look', look), panel('Captain', nameLabel, node('p', 'cap-label', 'Job'), jobRow, numbers, does), traitsPanel, foot);
    root.append(el);

    let alive = true;
    let defs = null;
    let background = null; // the id of the background picked (background.js)
    const draft = { name: '', job: null, traits: [], look: null };
    // Roll's own RNG, from the game's state as it stands: the game's
    // rolls don't move.
    let rolls = seedFrom(`captain look ${game.getState().rng}`);
    const cleanups = [
      onTap(backButton, () => game.dispatch({ type: 'screen/show', screen: 'background' })),
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
        background = defs.backgrounds.has(newGameDraft.background) ? newGameDraft.background : firstBackground(defs);
        const { captains, start } = defs.backgrounds.get(background);
        const kept = newGameDraft.captain;
        if (kept && start.crew.includes(kept.job)) {
          // Back from how hard the game is (M41): the captain as made.
          Object.assign(draft, { name: kept.name, job: kept.job, traits: [...kept.traits], look: { ...kept.look } });
        } else {
          // A name from the background's list, picked by the game's RNG
          // state as it stands (nothing is rolled).
          draft.name = captains[game.getState().rng % captains.length];
          draft.job = start.crew[0];
          roll();
        }
        nameInput.value = draft.name;
        build();
        render();
      })
      .catch((err) => {
        if (alive) setText(hint, `Couldn't load the game data: ${err.message}`);
      });

    // The look's, job and trait buttons, made once the content is in.
    function build() {
      const text = captainText(defs, draft, background);
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
      const text = captainText(defs, draft, background);
      const place = defs.backgrounds.get(background).start.crew.indexOf(draft.job);
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
      if (does.textContent !== text.does.join('')) does.replaceChildren(...text.does.map((line) => node('p', null, line)));
      startButton.disabled = !text.ready;
      setText(hint, text.hint.text);
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

    // On to how hard the game is (M41), the captain kept in the draft.
    function start() {
      if (!defs || startButton.disabled) return;
      newGameDraft.captain = { ...draft, traits: [...draft.traits], look: { ...draft.look }, name: draft.name.trim() };
      game.dispatch({ type: 'screen/show', screen: 'start' });
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
