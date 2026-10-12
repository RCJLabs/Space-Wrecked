// Maps state.screen to a screen module: the title, the campaign's screens
// (one for each place a campaign can be: src/sim/root.js PLACE_SCREENS),
// and the dev sandboxes.
import { campaignFightScreen } from './campaign/fight.js';
import { hubScreen } from './campaign/hub.js';
import { sandboxes } from './dev/sandboxes.js';
import { titleScreen } from './title.js';

const screens = { title: titleScreen, hub: hubScreen, 'campaign-fight': campaignFightScreen };

export function screenFor(id) {
  return screens[id] ?? sandboxes.find((s) => s.id === id)?.screen ?? titleScreen;
}
