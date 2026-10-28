// The new game being made, across its three screens (M30, M41): the
// background picked on the first (background.js), the captain made for it
// on the second (captain.js), and how hard the game is and whether death
// is permanent in it on the last (startGame.js), with the ship's name
// (M52: null keeps the name the new game rolls), and from M64 the run's
// modifiers and whether it is the week's run. It is the screens' draft,
// not the game's state: nothing is kept until Start begins the campaign.
// New game on the title clears it (clearDraft).
export const newGameDraft = { background: null, captain: null, difficulty: 'normal', permadeath: false, shipName: null, modifiers: [], weekly: false };

// The draft as a new game starts it: nothing picked, Normal, death not
// permanent, the ship's name rolled, no modifiers and a run of one's own.
export function clearDraft() {
  Object.assign(newGameDraft, { background: null, captain: null, difficulty: 'normal', permadeath: false, shipName: null, modifiers: [], weekly: false });
}
