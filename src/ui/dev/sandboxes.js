// Sandboxes the ?dev=1 menu can jump to. Each entry is { id, name, screen },
// where screen has the same shape as titleScreen in ../title.js:
// mount(root) returns { resize(view), draw(ctx, view, timeMs), unmount() },
// and a screen with a 3D board adds frameStats() for the dev overlay.
import { battleScreen } from '../battle/screen.js';
import { builderScreen } from '../builder/screen.js';

export const sandboxes = [
  { id: 'builder', name: 'Builder', screen: builderScreen },
  { id: 'battle', name: 'Battle map', screen: battleScreen },
];
