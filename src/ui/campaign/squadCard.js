// The squad card (approach.js): who goes when a boarding is due and more
// are aboard than a squad takes, over the two ships. Its words are
// crewText.js squadText's. A tap on someone takes them or leaves them
// aboard; a pick spends nothing, and the fight begins only with Board her
// (or Fight them off), so one tap makes it.
//
//   card.show(text, said)   squadText's picker, or null (the card hides);
//                           said: why the last tap changed nothing, or null
//   card.detach()           lets go of the buttons
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { shortNames } from '../names.js';
import { faceUrl, portraitImg, withRank } from '../portrait.js';

// toggle(id): take crew member id, or leave them aboard; done(): Done.
export function createSquadCard({ toggle, done }) {
  const el = node('section', 'apr-squad');
  el.setAttribute('aria-label', 'Squad');
  const title = node('h2');
  const text = node('p', 'sct-crew-text');
  const said = node('p', 'apr-squad-said');
  said.dataset.tone = 'warn';
  const words = node('div', 'sct-crew-words');
  words.append(title, text, said);
  const doneButton = toolButton('sct-crew-done', icons.done, 'Done');
  const head = node('div', 'sct-crew-head');
  head.append(words, doneButton);
  const list = node('div', 'apr-squad-list');
  el.append(head, list);
  el.hidden = true;

  let buttons = [];
  const offDone = onTap(doneButton, () => done());

  return {
    el,
    show(shown, why) {
      buttons.forEach((entry) => entry.detach());
      buttons = [];
      el.hidden = !shown;
      if (!shown) return;
      setText(title, shown.title);
      setText(text, shown.text);
      setText(said, why ?? '');
      said.hidden = !why;
      const short = shortNames(shown.members.map((member) => member.name));
      buttons = shown.members.map((member, i) => {
        const button = node('button', 'btn apr-pick');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(member.going));
        const box = node('span', 'apr-pick-box', member.going ? '✓' : '');
        box.setAttribute('aria-hidden', 'true');
        const who = node('span', 'hgr-name');
        who.append(node('span', null, short[i]));
        who.title = member.name;
        if (member.about) who.append(node('small', null, member.about));
        button.dataset.wounded = String(member.hp < member.max);
        // A chevron for each rank over the portrait's corner (M32b): the
        // card is too narrow on the cover screen for it in words.
        const face = withRank(portraitImg('crew-face', faceUrl(member.face, 'face')), member.rank);
        button.append(box, face, who, node('span', 'hgr-num', `${member.hp}/${member.max}`));
        const rank = member.rank ? `, rank ${member.rank}` : '';
        button.setAttribute('aria-label', `${member.name}${rank}, ${member.hp} of ${member.max} hit points: ${member.going ? 'going' : 'staying aboard'}`);
        return { button, detach: onTap(button, () => toggle(member.id)) };
      });
      list.replaceChildren(...buttons.map((entry) => entry.button));
    },
    detach() {
      offDone();
      buttons.forEach((entry) => entry.detach());
      buttons = [];
    },
  };
}
