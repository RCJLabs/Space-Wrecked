// Maps state.screen to a screen module: the title and its settings, a new
// game's background, captain and how hard it is (M41), the campaign's
// screens (src/sim/root.js CAMPAIGN_SCREENS) and the dev sandboxes.
import { approachScreen } from './campaign/approach.js';
import { backgroundScreen } from './campaign/background.js';
import { captainScreen } from './campaign/captain.js';
import { colonyScreen } from './campaign/colony.js';
import { constructionScreen } from './campaign/construction.js';
import { campaignFightScreen } from './campaign/fight.js';
import { hangarScreen } from './campaign/hangar.js';
import { jobsScreen } from './campaign/jobs.js';
import { landingScreen } from './campaign/landing.js';
import { launchScreen } from './campaign/launch.js';
import { overScreen } from './campaign/over.js';
import { sectorScreen } from './campaign/sector.js';
import { shopScreen } from './campaign/shop.js';
import { startGameScreen } from './campaign/startGame.js';
import { sandboxes } from './dev/sandboxes.js';
import { settingsScreen } from './settings.js';
import { titleScreen } from './title.js';

const screens = {
  title: titleScreen,
  settings: settingsScreen,
  background: backgroundScreen,
  captain: captainScreen,
  start: startGameScreen,
  hub: hangarScreen,
  construction: constructionScreen,
  jobs: jobsScreen,
  shop: shopScreen,
  'campaign-fight': campaignFightScreen,
  launch: launchScreen,
  sector: sectorScreen,
  approach: approachScreen,
  landing: landingScreen,
  colony: colonyScreen,
  over: overScreen,
};

export function screenFor(id) {
  return screens[id] ?? sandboxes.find((s) => s.id === id)?.screen ?? titleScreen;
}
