// Construction mode: the builder on the campaign's ship, with only the parts
// the campaign has, at the hangar (act 1) or at a station on the run (M23h).
// The palette shows what is on hand; a part fitted comes out of the parts on
// hand and one taken off goes back, for nothing (campaign.js refitShip).
// Every change is saved through the campaign at once. On the run, the parts
// an approach wrecked stay on until the station repairs them: they move and
// turn with their damage, and the plans mark them. The way out, at the end
// of the drawer's tabs, goes home: Hangar to the hangar, where Launch is
// once every flight check passes, or Map to the sector map, where the ship
// can't jump until they all do. The board is ../builder/view.js's.
import { actOf, canRefit, stockOf, wreckedUids } from '../../sim/campaign.js';
import { mountBuilder } from '../builder/view.js';
import { icons } from '../icons.js';

// The session outlives the screen until the page reloads, so leaving for
// home and coming back keeps the undo history, while the ship, the parts
// and the wrecks are still the campaign's.
let kept = null;

export const constructionScreen = {
  mount(root, { store: game }) {
    let defs = null;
    // On the run (act 2) the ship refits at a station, and goes back to the
    // sector map; in act 1, at the hangar.
    const onRun = Boolean(game.getState().campaign?.run);
    return mountBuilder(root, {
      launch: false,
      ready: onRun ? 'Every flight check passes: the ship can jump. Tap Map.' : 'Every flight check passes. Launch is at the hangar: tap Hangar.',
      cleared: onRun ? 'Ready to jump' : 'Ready to launch',
      leave: onRun
        ? { icon: icons.map, label: 'Map', onTap: () => game.dispatch({ type: 'screen/show', screen: 'sector' }) }
        : { icon: icons.home, label: 'Hangar', onTap: () => game.dispatch({ type: 'screen/show', screen: 'hub' }) },
      crew: () => game.getState().campaign?.crew.length ?? 0,
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
