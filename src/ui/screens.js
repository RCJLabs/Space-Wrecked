// Maps state.screen to a screen module.
import { sandboxes } from './dev/sandboxes.js';
import { titleScreen } from './title.js';

export function screenFor(id) {
  if (id === 'title') return titleScreen;
  return sandboxes.find((s) => s.id === id)?.screen ?? titleScreen;
}
