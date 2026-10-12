// The campaign's fight: the battle in the save, picked up where it was left
// and saved after every order (src/sim/campaign.js), so quitting mid-fight
// loses nothing. Title leaves it as it is, for Continue; once it is won or
// lost, Continue takes the crew home. The board is ../fight/view.js's.
import { mountFight } from '../fight/view.js';
import { icons } from '../icons.js';

export const campaignFightScreen = {
  mount(root, { store: game }) {
    return mountFight(root, {
      over: { icon: icons.home, label: 'Continue' },
      tools: [{ icon: icons.leave, label: 'Title', onTap: () => game.dispatch({ type: 'screen/show', screen: 'title' }) }],
      start(defs, fights) {
        const fight = game.getState().campaign?.fight;
        if (!fight) return fights.stop('No fight on. Tap Title to go back.');
        try {
          fights.show({ map: fight.battle.map, battle: fight.battle, log: fight.log, seed: fight.seed });
        } catch (err) {
          // A save from before the content changed under it.
          fights.stop(`This fight can't be picked up: ${err.message}`);
        }
      },
      onChange(fight, prev) {
        if (fight.battle !== prev.battle) game.dispatch({ type: 'campaign/fight/save', battle: fight.battle, log: fight.log });
      },
      onOver() {
        game.dispatch({ type: 'campaign/fight/end' });
      },
    });
  },
};
