// Construction mode: the builder on the campaign's ship, with only the parts
// the campaign has, at the hangar (act 1), at a station on the run (M23h)
// or a shipyard (M37b), or at the colony, where the ship has landed (M27). The palette shows what is
// on hand; a part fitted comes out of the parts on hand and one taken off
// goes back, for nothing (campaign.js refitShip). Every change is saved
// through the campaign at once. On the run, the parts an approach wrecked
// stay on until the station repairs them: they move and turn with their
// damage, and the plans mark them. The way out, at the end of the drawer's
// tabs, goes home: Hangar to the hangar, where Launch is once every flight
// check passes; Map to the sector map, where the ship can't jump until they
// all do; or Colony to the colony, the flight checks counting a full squad
// aboard (M28: what a trip needs, berths and air for each). The board is
// ../builder/view.js's.
import { actOf, canRefit, crewAboard, fullSquad, stockOf, wreckedUids } from '../../sim/campaign.js';
import { mountBuilder } from '../builder/view.js';
import { icons } from '../icons.js';

// The session outlives the screen until the page reloads, so leaving for
// home and coming back keeps the undo history, while the ship, the parts
// and the wrecks are still the campaign's.
let kept = null;

export const constructionScreen = {
  mount(root, { store: game }) {
    let defs = null;
    // In act 1 the ship refits at the hangar; on the run (act 2) at a
    // station or a shipyard, and goes back to the sector map; in act 3 at
    // the colony.
    const campaign = game.getState().campaign;
    const home = campaign?.colony ? 'colony' : campaign?.run ? 'run' : 'hangar';
    const leave = {
      hangar: { icon: icons.home, label: 'Hangar', screen: 'hub' },
      run: { icon: icons.map, label: 'Map', screen: 'sector' },
      colony: { icon: icons.settle, label: 'Colony', screen: 'colony' },
    }[home];
    return mountBuilder(root, {
      launch: false,
      ready: {
        hangar: 'Every flight check passes. Launch is at the hangar: tap Hangar.',
        run: 'Every flight check passes: the ship can jump. Tap Map.',
        colony: 'Every flight check passes with a full squad aboard: the ship can fly out. Tap Colony.',
      }[home],
      cleared: { hangar: 'Ready to launch', run: 'Ready to jump', colony: 'Ready to fly' }[home],
      leave: { icon: leave.icon, label: leave.label, onTap: () => game.dispatch({ type: 'screen/show', screen: leave.screen }) },
      // At the colony, a full squad: what a trip from it needs aboard.
      crew: () => {
        const now = game.getState().campaign;
        if (!now) return 0;
        return now.colony && defs ? fullSquad(now, defs) : crewAboard(now);
      },
      liftOff: () => {
        const { campaign } = game.getState();
        return (campaign && defs && actOf(campaign, defs)?.liftOff) ?? null;
      },
      // The campaign keeps no build log (nothing replays it), so a session
      // starts with none.
      open(content) {
        defs = content;
        const { campaign } = game.getState();
        if (!campaign || !canRefit(campaign, content)) return null;
        const stock = stockOf(campaign);
        const wrecked = wreckedUids(campaign);
        if (kept?.ship === campaign.ship && sameStock(kept.stock, stock) && sameList(kept.wrecked, wrecked)) return { session: kept };
        return { ship: campaign.ship, log: [], stock, wrecked };
      },
      onSession(session, prev) {
        kept = session;
        if (session.ship !== prev.ship) game.dispatch({ type: 'campaign/ship', ship: session.ship, rules: defs });
      },
    });
  },
};

function sameStock(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b)]);
  return [...keys].every((key) => (a?.[key] ?? 0) === (b[key] ?? 0));
}

function sameList(a = [], b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
