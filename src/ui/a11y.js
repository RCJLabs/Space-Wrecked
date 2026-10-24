// What a screen reader finds (M49). The boards, scenes and ships drawn on the
// canvas take pan, zoom, tap and hold; they are named as a group saying what
// they are and how they are worked, and the words they need are in the
// panels and the status line beside them. The status lines are live, so
// what a tap did is read out as it shows.

// Names a touch surface: role group, with label as its name.
export function surface(el, label) {
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', label);
  return el;
}

// Makes a line of text a polite live status, read out when it changes.
export function liveStatus(el) {
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  return el;
}
