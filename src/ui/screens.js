// Maps state.screen to a screen module: the title, the campaign's screens
// (src/sim/root.js CAMPAIGN_SCREENS) and the dev sandboxes.
import { constructionScreen } from './campaign/construction.js';
import { campaignFightScreen } from './campaign/fight.js';
import { hangarScreen } from './campaign/hangar.js';
import { jobsScreen } from './campaign/jobs.js';
import { sandboxes } from './dev/sandboxes.js';
import { titleScreen } from './title.js';

const screens = { title: titleScreen, hub: hangarScreen, construction: constructionScreen, jobs: jobsScreen, 'campaign-fight': campaignFightScreen };

export function screenFor(id) {
  return screens[id] ?? sandboxes.find((s) => s.id === id)?.screen ?? titleScreen;
}
