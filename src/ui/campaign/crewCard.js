// The crew card (sector.js): who is aboard and, at a station, who is for
// hire, over the left panel and the chart, opened from the crew panel. Its
// words are crewText.js's. Signing a recruit on and letting someone go take
// two taps, as the map's other orders do: sector.js keeps which button has
// had its first tap and says in the foot what the second does.
//
//   card.show(text, armed)   crewCardText's card, or null (the card hides);
//                            armed is the key of the button that has had
//                            its first tap, if any
//   card.detach()            lets go of the buttons
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { portraitImg, portraitUrl, withRank } from '../portrait.js';

// tap(key): a Sign on or Let go button's tap; done(): Done.
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
  // are, a recruit's past, their rank and fights (M32b), their traits and
  // what their job brings (M32), hit points, and a button for what can be
  // done with them here, if anything.
  function row({ name, about, past, rank, rankLine, traits, brief, hp, max, face }, action, armed) {
    const item = node('li');
    item.dataset.wounded = String(hp < max);
    item.append(withRank(portraitImg('crew-face', portraitUrl(face.look, face.job, face.trim, 'face')), rank));
    const who = node('span', 'hgr-name');
    who.append(node('span', null, name));
    if (about) who.append(node('small', null, about));
    if (past) who.append(node('small', 'crew-past', past));
    if (rankLine) who.append(node('small', 'crew-rank', rankLine));
    if (traits) who.append(node('small', null, traits));
    if (brief) who.append(node('small', 'crew-brief', brief));
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
    return item;
  }

  return card;
}
