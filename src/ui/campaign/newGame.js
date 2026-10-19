// The new game being made, across its three screens (M30, M41): the
// background picked on the first (background.js), the captain made for it
// on the second (captain.js), and how hard the game is and whether death
// is permanent in it on the last (startGame.js). It is the screens' draft,
// not the game's state: nothing is kept until Start begins the campaign.
// New game on the title clears it (clearDraft).
export const newGameDraft = { background: null, captain: null, difficulty: 'normal', permadeath: false };

// The draft as a new game starts it: nothing picked, Normal, and death not
// permanent.
export function clearDraft() {
  Object.assign(newGameDraft, { background: null, captain: null, difficulty: 'normal', permadeath: false });
}
