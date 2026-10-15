// The campaign's fight: the battle in the save, picked up where it was left
// and saved after every order (src/sim/campaign.js), so quitting mid-fight
// loses nothing. A job's fight shows its objective and, at the end, its pay
// and heat (jobText.js); a raid shows the raiders left and, at the end,
// what it cost: the hangar's (jobText.js) or, from M29, the colony's
// (raidText.js), which opens with the landing's report and counts the
// raiders the guns stopped. A boarding (M22) shows hers left and, at the
// end, what it came to (boardingText.js); a fight at home is the
// boarders'. Title leaves it as it is, for Continue; once it is won or
// lost, Continue takes the crew home, or back to the run. The board is
// ../fight/view.js's.
import { mountFight } from '../fight/view.js';
import { icons } from '../icons.js';
import { boardingObjective, boardingOutcome } from './boardingText.js';
import { jobOutcome, objectiveText, raidObjective, raidOutcome } from './jobText.js';
import { colonyRaidObjective, colonyRaidOutcome, landingNotice } from './raidText.js';

export const campaignFightScreen = {
  mount(root, { store: game }) {
    let defs = null;
    const fightOn = () => game.getState().campaign?.fight ?? null;
    const job = () => fightOn()?.job ?? null;
    return mountFight(root, {
      over: { icon: icons.home, label: 'Continue' },
      tools: [{ icon: icons.leave, label: 'Title', onTap: () => game.dispatch({ type: 'screen/show', screen: 'title' }) }],
      start(content, fights) {
        defs = content;
        const fight = game.getState().campaign?.fight;
        if (!fight) return fights.stop('No fight on. Tap Title to go back.');
        try {
          fights.show({ map: fight.battle.map, battle: fight.battle, log: fight.log, seed: fight.seed });
        } catch (err) {
          // A save from before the content changed under it.
          fights.stop(`This fight can't be picked up: ${err.message}`);
        }
      },
      objective(battle) {
        if (!defs) return null;
        if (fightOn()?.raid) return game.getState().campaign.colony ? colonyRaidObjective(battle, fightOn(), defs) : raidObjective(battle);
        if (fightOn()?.boarding) return boardingObjective(battle, game.getState().campaign);
        return job() ? objectiveText(battle, job(), defs) : null;
      },
      // A raid on the colony opens with what the guns did, until the crew's
      // first order.
      opening(battle) {
        const { campaign } = game.getState();
        if (!defs || !fightOn()?.raid || !campaign.colony || !unmoved(battle, defs)) return null;
        return landingNotice(battle, fightOn(), campaign, defs);
      },
      lookOf(unit, index) {
        const id = fightOn()?.crew[index];
        return game.getState().campaign?.crew.find((member) => member.id === id)?.look ?? null;
      },
      ending(battle, log) {
        if (!defs) return null;
        const { campaign } = game.getState();
        if (fightOn()?.raid) return campaign.colony ? colonyRaidOutcome(battle, campaign, defs) : raidOutcome(battle, campaign, defs);
        if (fightOn()?.boarding) return boardingOutcome(battle, game.getState().campaign, defs);
        return job() ? jobOutcome(battle, job(), defs, log) : null;
      },
      onChange(fight, prev) {
        if (fight.battle !== prev.battle) game.dispatch({ type: 'campaign/fight/save', battle: fight.battle, log: fight.log });
      },
      onOver() {
        if (defs) game.dispatch({ type: 'campaign/fight/end', rules: defs });
      },
    });
  },
};

// True before the crew's first order: round 1, the crew's turn, every one
// of them with every action left.
function unmoved(battle, rules) {
  return battle.round === 1 && battle.side === 'crew' && !battle.winner && battle.units.every((unit) => unit.side !== 'crew' || unit.ap === rules.balance.actionPoints);
}
