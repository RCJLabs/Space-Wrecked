// The event card (sector.js): the event open where the ship is, over the
// left panel and the chart. Its words are eventText.js's. A choice takes
// two taps: the first shows its odds and what each outcome does, the
// second makes it; a choice that can't be paid says what it needs. Once a
// choice is made, the card shows what happened, the roll against the odds
// and what it came to, until Carry on. A companion a choice would sign on
// (M33c) shows under the words with their face, name, side, job and past,
// and stays there once they have.
//
//   card.show(event, result)   eventText's event, or else resultText's
//                              result, or neither (the card hides)
//   card.disarm()              puts a first tap down
//   card.detach()              lets go of the buttons and the timer
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { portraitImg, portraitUrl } from '../portrait.js';

const ARM_MS = 3000; // a choice waits this long for its second tap

// choose(id): makes choice id; close(): Carry on.
export function createEventCard({ choose, close }) {
  const el = node('section', 'sct-event');
  el.setAttribute('aria-live', 'polite');
  const where = node('p', 'sct-event-where');
  const title = node('h2');
  const text = node('p', 'sct-event-text');
  const said = node('p', 'sct-event-said');
  // Who a choice would sign on (M33c).
  const who = node('div', 'sct-event-who');
  who.hidden = true;
  // The words scroll if they must; the choices under them stay whole.
  const words = node('div', 'sct-event-words');
  words.append(where, title, text, who, said);
  const choices = node('div', 'sct-event-choices');
  el.append(words, choices);
  el.hidden = true;

  let buttons = [];
  let armed = null; // the choice that has had its first tap
  let timer = 0;
  let last = null; // what was shown last: [event, result]
  let whoShown = null; // the companion shown, and in what trim

  const card = {
    el,
    show(event, result) {
      last = [event, result];
      buttons.forEach((entry) => entry.detach());
      buttons = [];
      el.hidden = !event && !result;
      if (event) showEvent(event);
      else if (result) showResult(result);
      else card.disarm();
    },
    disarm() {
      armed = null;
      clearTimeout(timer);
    },
    detach() {
      card.disarm();
      buttons.forEach((entry) => entry.detach());
      buttons = [];
    },
  };

  function showEvent(event) {
    el.dataset.state = 'event';
    if (armed && !event.choices.some((choice) => choice.id === armed && choice.ok)) card.disarm();
    setText(where, event.where);
    setText(title, event.title);
    setText(text, event.text);
    showWho(event.companion);
    const picked = event.choices.find((choice) => choice.id === armed);
    setText(said, picked ? picked.ask : 'Tap a choice to see its odds.');
    said.dataset.tone = picked ? 'warn' : 'info';
    buttons = event.choices.map((choice) => {
      const button = node('button', 'btn sct-choice');
      button.type = 'button';
      button.disabled = !choice.ok;
      button.dataset.armed = String(armed === choice.id);
      button.append(node('span', null, armed === choice.id ? `${choice.label}?` : choice.label));
      const small = choice.why ?? [choice.odds, choice.berth].filter(Boolean).join(' · ');
      if (small) button.append(node('small', null, small));
      button.setAttribute('aria-label', choice.ok ? `${choice.label}. ${choice.outcomes.map((o) => `${o.chance}%: ${o.says}`).join('. ')}` : `${choice.label}. ${choice.why}`);
      return { button, detach: onTap(button, () => tap(choice)) };
    });
    choices.replaceChildren(...buttons.map((entry) => entry.button));
    // A first tap's odds, last in the words, always in view.
    words.scrollTop = picked ? words.scrollHeight : 0;
  }

  function showResult(result) {
    el.dataset.state = 'result';
    card.disarm();
    setText(where, result.where);
    setText(title, result.title);
    setText(text, result.text);
    showWho(result.companion);
    setText(said, [result.roll, result.changes, result.quest].filter(Boolean).join(' '));
    said.dataset.tone = 'good';
    const button = toolButton('sct-choice sct-carry', icons.done, 'Carry on');
    buttons = [{ button, detach: onTap(button, close) }];
    choices.replaceChildren(button);
    // The roll and what changed, last in the words, in view.
    words.scrollTop = words.scrollHeight;
  }

  // A companion's face, name, what they are and their past, or nothing.
  function showWho(companion) {
    who.hidden = !companion;
    const key = companion ? `${companion.id} ${companion.face.trim}` : null;
    if (key === whoShown) return;
    whoShown = key;
    if (!companion) {
      who.replaceChildren();
      who.removeAttribute('aria-label');
      return;
    }
    const { face } = companion;
    const named = node('span', 'hgr-name');
    named.append(node('span', null, companion.name), node('small', null, companion.about), node('small', 'crew-past', companion.past));
    who.replaceChildren(portraitImg('crew-face', portraitUrl(face.look, face.job, face.trim, 'face')), named);
    who.setAttribute('role', 'group');
    who.setAttribute('aria-label', companion.line);
  }

  // The first tap shows the odds; the second chooses.
  function tap(choice) {
    if (!choice.ok) return;
    if (armed !== choice.id) {
      armed = choice.id;
      clearTimeout(timer);
      timer = setTimeout(() => {
        armed = null;
        if (last) card.show(...last);
      }, ARM_MS);
      card.show(...last);
      return;
    }
    card.disarm();
    choose(choice.id);
  }

  return card;
}
