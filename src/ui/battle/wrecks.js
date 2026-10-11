// The rooms wrecked on the Battle map sandbox, kept for the ship they were
// made on until the page reloads. A fight on the same ship starts with them.
// Only for trying things: nothing here is saved.
let kept = { ship: null, wrecked: {} };

// { [uid]: 'fire' | 'vacuum' | 'rubble' } for this ship; another ship's are
// forgotten.
export function wrecksOf(ship) {
  if (kept.ship !== ship) kept = { ship, wrecked: {} };
  return kept.wrecked;
}

export function keepWrecks(ship, wrecked) {
  kept = { ship, wrecked };
}
