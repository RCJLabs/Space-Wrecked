// The crew card (sector.js): who is aboard and, at a station, who is for
// hire, over the left panel and the chart, opened from the crew panel. Its
// words are crewText.js's. Signing a recruit on and letting someone go take
// two taps, as the map's other orders do: sector.js keeps which button has
// had its first tap and says in the foot what the second does. Since M37
// each row says what they carry, with a button for each spare weapon on
// hand they could take, two taps to swap, the first showing the spare's
// facts under the buttons; the card opens at the hangar and the colony too.
//
// Since M58 each crew member's row has a Look button: it opens the look
// editor in the card's place (the captain screen's layer buttons and Roll,
// with a callsign), and Keep saves both.
//
//   card.show(text, armed)   crewCardText's card, or null (the card hides);
//                            armed is the key of the button that has had
//                            its first tap, if any
//   card.detach()            lets go of the buttons
import { seedFrom } from '../../core/rng.js';
import { MAX_CALLSIGN, callsignProblem } from '../../sim/crewLook.js';
import { rollLook, stepLook } from '../../sim/looks.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { faceUrl, portraitImg, withRank } from '../portrait.js';
import { lookLayers } from './captainText.js';

// tap(key, press): a Sign on, Let go or spare weapon button's tap (press:
// { held }, M47); done(): Done; save(id, look, callsign): the look
// editor's Keep (M58), or none for no Look buttons.
export function createCrewCard({ tap, done, save = null }) {
  const el = node('section', 'sct-crew');
  el.setAttribute('aria-label', 'Crew');
  const title = node('h2');
  const text = node('p', 'sct-crew-text');
  const words = node('div', 'sct-crew-words');
  words.append(title, text);
  const doneButton = toolButton('sct-crew-done', icons.done, 'Done');
  const head = node('div', 'sct-crew-head');
  head.append(words, doneButton);
  const aboardRows = node('ul');
  const aboard = node('section', 'sct-crew-list');
  aboard.append(node('h3', null, 'Aboard'), aboardRows);
  const hireTitle = node('h3');
  const hireLine = node('p', 'sct-crew-line');
  const hireRows = node('ul');
  const hire = node('section', 'sct-crew-list');
  hire.append(hireTitle, hireLine, hireRows);
  // The lists scroll if they must; the head and Done stay put.
  const lists = node('div', 'sct-crew-lists');
  lists.append(aboard, hire);
  const editor = lookEditor();
  el.append(head, lists, editor.el);
  el.hidden = true;

  let buttons = [];
  // Who the look editor is open for: { id, name, look, callsign, face },
  // the look and callsign as edited so far; or null.
  let editing = null;
  let shownText = null;
  const offDone = onTap(doneButton, () => {
    editing = null;
    done();
  });

  const card = {
    el,
    show(shown, armed) {
      buttons.forEach((entry) => entry.detach());
      buttons = [];
      el.hidden = !shown;
      shownText = shown;
      if (!shown) {
        editing = null;
        return;
      }
      if (editing && !shown.members.some((member) => member.id === editing.id)) editing = null;
      editor.render();
      setText(title, shown.title);
      setText(text, shown.text);
      aboardRows.replaceChildren(...shown.members.map((member) => row(member, member.dismiss, armed, true)));
      hire.hidden = !shown.hire;
      if (shown.hire) {
        setText(hireTitle, shown.hire.title);
        setText(hireLine, shown.hire.line ?? '');
        hireLine.hidden = !shown.hire.line;
        hireRows.replaceChildren(...shown.hire.recruits.map((recruit) => row(recruit, recruit, armed)));
      }
      // A button that has had its first tap stays in sight for the second,
      // with a spare's facts under it as far as they fit: its longer words
      // can push it out of a short card's list (M37).
      el.querySelector('.crew-swap-facts')?.scrollIntoView({ block: 'nearest' });
      el.querySelector('button[data-armed="true"]')?.scrollIntoView({ block: 'nearest' });
    },
    detach() {
      offDone();
      editor.detach();
      buttons.forEach((entry) => entry.detach());
      buttons = [];
    },
  };

  // The look editor (M58): a crew member's portrait, a button for each
  // layer stepping it to its next choice, Roll, a callsign, and Keep and
  // Cancel. It takes the lists' place in the card while it is open.
  function lookEditor() {
    const box = node('section', 'crew-edit');
    const face = portraitImg('crew-edit-face', '');
    const layers = node('div', 'cap-layers crew-edit-layers');
    const input = node('input', 'cap-name crew-edit-call');
    Object.assign(input, { type: 'text', maxLength: MAX_CALLSIGN, autocomplete: 'off', spellcheck: false, enterKeyHint: 'done', placeholder: 'Callsign: none' });
    input.setAttribute('autocapitalize', 'words');
    input.setAttribute('aria-label', 'Callsign');
    const label = node('label', 'cap-label crew-edit-label');
    label.append(node('span', 'crew-edit-label-text', 'Callsign'), input);
    const roll = toolButton('cap-roll crew-edit-roll', icons.again, 'Roll');
    const keep = toolButton('crew-edit-keep', icons.done, 'Keep');
    const cancel = toolButton('crew-edit-cancel', icons.prev, 'Cancel');
    const actions = node('div', 'crew-edit-actions');
    actions.append(label, cancel, keep);
    // Why a callsign won't do, under the field, until it is fixed.
    const why = node('p', 'crew-edit-why');
    why.setAttribute('role', 'status');
    const heading = node('h3', 'crew-edit-name');
    const look = node('div', 'crew-edit-look');
    look.append(face, layers);
    box.append(heading, look, actions, why);
    box.hidden = true;
    let rolls = 0;
    const offs = [
      onTap(roll, () => {
        if (!editing) return;
        editing.look = rollLook(seedFrom(`look edit ${editing.id} ${++rolls}`)).value;
        render();
      }),
      onTap(cancel, () => {
        editing = null;
        render();
      }),
      onTap(keep, () => {
        if (!editing) return;
        const problem = callsignProblem(input.value);
        setText(why, problem ?? '');
        if (problem) return;
        const { id, look: kept } = editing;
        editing = null;
        render();
        save?.(id, kept, input.value);
      }),
    ];
    const onInput = () => {
      if (editing) editing.callsign = input.value;
      setText(why, '');
    };
    input.addEventListener('input', onInput);
    let built = false;
    function render() {
      box.hidden = !editing;
      lists.hidden = Boolean(editing);
      el.dataset.editing = String(Boolean(editing));
      if (!editing) return;
      const layered = lookLayers(editing.look);
      if (!built) {
        layers.replaceChildren(
          ...layered.map((layer) => {
            const button = node('button', 'btn cap-layer');
            button.type = 'button';
            button.dataset.key = layer.key;
            button.append(node('span', 'cap-layer-name', layer.label), node('span', 'cap-layer-value', layer.value));
            offs.push(onTap(button, () => {
              if (!editing) return;
              editing.look = stepLook(editing.look, layer.key);
              render();
            }));
            return button;
          }),
          roll,
        );
        built = true;
      }
      setText(heading, `${editing.name}'s look`);
      const url = faceUrl({ ...editing.face, look: editing.look }, 'bust');
      if (face.getAttribute('src') !== url) face.src = url;
      face.alt = `${editing.name}'s portrait`;
      for (const button of layers.querySelectorAll('.cap-layer')) {
        const layer = layered.find((each) => each.key === button.dataset.key);
        setText(button.querySelector('.cap-layer-value'), layer.value);
        button.setAttribute('aria-label', `${layer.label}: ${layer.value}. Tap for the next.`);
      }
      if (input.value !== editing.callsign) input.value = editing.callsign;
    }
    return {
      el: box,
      render,
      open(member) {
        editing = { id: member.id, name: member.name, look: { ...member.look }, callsign: member.callsign ?? '', face: member.face };
        setText(why, '');
        render();
      },
      detach() {
        offs.forEach((off) => off());
        input.removeEventListener('input', onInput);
      },
    };
  }

  // A row: their portrait with a chevron for each rank, the name, what they
  // are, a recruit's or a companion's past, their rank and fights (M32b), a
  // companion's loyalty (M33c), their traits and what their job brings
  // (M32), what they carry (M37), hit points, and a button for what can be
  // done with them here, if anything; under it, a button for each spare
  // weapon they could take, and once one has had its first tap, its facts,
  // so the foot's hint need only say what the swap does.
  function row(member, action, armed, aboard = false) {
    const { name, about, past, rank, rankLine, loyalty, traits, brief, weapon, hp, max, face } = member;
    const item = node('li');
    item.dataset.wounded = String(hp < max);
    item.append(withRank(portraitImg('crew-face', faceUrl(face, 'face')), rank));
    const who = node('span', 'hgr-name');
    who.append(node('span', null, name));
    if (about) who.append(node('small', null, about));
    if (past) who.append(node('small', 'crew-past', past));
    if (rankLine) who.append(node('small', 'crew-rank', rankLine));
    if (loyalty) who.append(node('small', 'crew-loyal', loyalty));
    if (traits) who.append(node('small', null, traits));
    if (brief) who.append(node('small', 'crew-brief', brief));
    if (weapon) who.append(node('small', 'crew-arms', weapon.line));
    const health = node('span', 'sct-crew-hp');
    const bar = node('span', 'hgr-hp');
    const fill = node('span');
    fill.style.width = `${(100 * hp) / max}%`;
    bar.append(fill);
    health.append(node('span', 'hgr-num', `${hp}/${max}`), bar);
    health.setAttribute('aria-label', `${hp} of ${max} hit points`);
    item.append(who, health);
    // Their look and callsign (M58), for anyone aboard, beside what can be
    // done with them here.
    const acts = node('span', 'crew-acts');
    if (aboard && save && member.look) {
      const button = toolButton('crew-look', icons.look, 'Look');
      button.setAttribute('aria-label', `${name}: change their look or callsign`);
      buttons.push({ detach: onTap(button, () => editor.open(member)) });
      acts.append(button);
    }
    if (acts.childElementCount) item.append(acts);
    if (action) {
      const on = armed === action.key;
      const button = node('button', 'btn sct-crew-act', on ? action.ask : action.label);
      button.type = 'button';
      button.disabled = !action.ok;
      button.dataset.armed = String(on);
      button.setAttribute('aria-label', action.ok ? `${name}: ${on ? action.ask : action.label}` : `${name}: ${action.why}`);
      buttons.push({ detach: onTap(button, (press) => tap(action.key, press), { confirm: true }) });
      acts.append(button);
      if (acts.parentNode !== item) item.append(acts);
    }
    if (weapon?.swaps.length) {
      const swaps = node('div', 'crew-swaps');
      swaps.append(node('span', 'crew-swaps-label', 'Swap for'));
      for (const swap of weapon.swaps) {
        const on = armed === swap.key;
        const button = node('button', 'btn crew-swap', on ? `${swap.label}: ${swap.ask}` : swap.label);
        button.type = 'button';
        button.disabled = !swap.ok;
        button.dataset.armed = String(on);
        button.setAttribute('aria-label', swap.ok ? `${name}: swap for the ${swap.label.toLowerCase()}` : `${name}: ${swap.why}`);
        buttons.push({ detach: onTap(button, (press) => tap(swap.key, press), { confirm: true }) });
        swaps.append(button);
      }
      item.append(swaps);
      // Lines, not a list: the card's list items are its rows.
      const shown = weapon.swaps.find((swap) => armed === swap.key);
      if (shown) {
        const facts = node('div', 'crew-swap-facts');
        facts.append(...shown.facts.map((fact) => node('p', null, fact)));
        item.append(facts);
      }
    }
    return item;
  }

  return card;
}
