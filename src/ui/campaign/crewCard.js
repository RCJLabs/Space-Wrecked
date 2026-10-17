// The crew card (sector.js): who is aboard and, at a station, who is for
// hire, over the left panel and the chart, opened from the crew panel. Its
// words are crewText.js's. Signing a recruit on and letting someone go take
// two taps, as the map's other orders do: sector.js keeps which button has
// had its first tap and says in the foot what the second does. Since M37
// each row says what they carry, with a button for each spare weapon on
// hand they could take, two taps to swap; the card opens at the hangar and
// the colony too.
//
//   card.show(text, armed)   crewCardText's card, or null (the card hides);
//                            armed is the key of the button that has had
//                            its first tap, if any
//   card.detach()            lets go of the buttons
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { faceUrl, portraitImg, withRank } from '../portrait.js';

// tap(key): a Sign on, Let go or spare weapon button's tap; done(): Done.
export function createCrewCard({ tap, done }) {
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
  el.append(head, lists);
  el.hidden = true;

  let buttons = [];
  const offDone = onTap(doneButton, () => done());

  const card = {
    el,
    show(shown, armed) {
      buttons.forEach((entry) => entry.detach());
      buttons = [];
      el.hidden = !shown;
      if (!shown) return;
      setText(title, shown.title);
      setText(text, shown.text);
      aboardRows.replaceChildren(...shown.members.map((member) => row(member, member.dismiss, armed)));
      hire.hidden = !shown.hire;
      if (shown.hire) {
        setText(hireTitle, shown.hire.title);
        setText(hireLine, shown.hire.line ?? '');
        hireLine.hidden = !shown.hire.line;
        hireRows.replaceChildren(...shown.hire.recruits.map((recruit) => row(recruit, recruit, armed)));
      }
    },
    detach() {
      offDone();
      buttons.forEach((entry) => entry.detach());
      buttons = [];
    },
  };

  // A row: their portrait with a chevron for each rank, the name, what they
  // are, a recruit's or a companion's past, their rank and fights (M32b), a
  // companion's loyalty (M33c), their traits and what their job brings
  // (M32), what they carry (M37), hit points, and a button for what can be
  // done with them here, if anything; under it, a button for each spare
  // weapon they could take.
  function row({ name, about, past, rank, rankLine, loyalty, traits, brief, weapon, hp, max, face }, action, armed) {
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
    if (action) {
      const on = armed === action.key;
      const button = node('button', 'btn sct-crew-act', on ? action.ask : action.label);
      button.type = 'button';
      button.disabled = !action.ok;
      button.dataset.armed = String(on);
      button.setAttribute('aria-label', action.ok ? `${name}: ${on ? action.ask : action.label}` : `${name}: ${action.why}`);
      buttons.push({ detach: onTap(button, () => tap(action.key)) });
      item.append(button);
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
        buttons.push({ detach: onTap(button, () => tap(swap.key)) });
        swaps.append(button);
      }
      item.append(swaps);
    }
    return item;
  }

  return card;
}
