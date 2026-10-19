// Words carried from one screen to the next (M38f): what a tap came to,
// when the action it dispatches opens another screen, which mounts afresh
// (src/main.js) with a hint of its own. Fly out from the colony opens the
// chart, and Fly home or Fly to from the chart lands at a colony: what the
// flight came to, and the news there, would be gone with the screen that
// said it. The tapping screen carries them before it dispatches; the next
// screen takes them as it mounts, or, with no new screen, the tapping one
// takes them back. The UI's own state, never saved.
let carried = null;

// Carries words ({ text, tone }, or null for none) to whichever screen
// takes them next.
export function carry(words) {
  carried = words ?? null;
}

// The words carried, taken: they are gone once taken. Null with none.
export function takeCarried() {
  const words = carried;
  carried = null;
  return words;
}
