// Hold to confirm (M47). With the Confirm setting at Hold (<html
// data-confirm="hold">, look.js), whatever a second tap confirms takes a
// hold instead: a first tap still arms a button or shows a move, a shot or a
// ghost on a board, and a hold (the long press, gestures.js) does it. A
// second tap only arms again. With Two taps nothing changes.
//
// A button that arms takes onTap(button, handler, { confirm: true }): its
// handler gets { held } and asks confirms(armed, press) whether to act.
export function holdMode() {
  return typeof document !== 'undefined' && document.documentElement.dataset.confirm === 'hold';
}

// Whether a press on a button that arms acts now: a hold always does, a tap
// when the button is armed and taps confirm.
export function confirms(armed, press, hold = holdMode()) {
  return Boolean(press?.held) || (Boolean(armed) && !hold);
}

// The words for the second step: "Tap End turn again" or "Hold End turn".
export function again(what, hold = holdMode()) {
  return hold ? `Hold ${what}` : `Tap ${what} again`;
}

// The game's words for a second tap, said for a hold when holds confirm:
// "Tap again to fly." becomes "Hold to fly.", "Tap Launch again." "Hold
// Launch.", "tap it again to give it" "hold it to give it". Every screen's
// words go through it as they are set (fight/panels.js setText), so the text
// modules stay as they are.
export function holdWords(text, hold = holdMode()) {
  if (!hold || typeof text !== 'string' || !/again/.test(text)) return text;
  return text
    .replace(/\b([Tt])ap (it )?again\b/g, (_, t, it) => `${t === 'T' ? 'H' : 'h'}old${it ? ' it' : ''}`)
    .replace(/\b([Tt])ap ((?:[A-Z][\w']*)(?: [a-z]+)?) again\b/g, (_, t, what) => `${t === 'T' ? 'H' : 'h'}old ${what}`)
    .replace(/\band again to\b/g, 'and hold to');
}
