// Construction mode: the builder on the campaign's ship, with only the parts
// the campaign has. The palette shows what is on hand; a part fitted comes
// out of the hangar and one taken off goes back (campaign.js refitShip).
// Every change is saved through the campaign at once. Hangar, at the end of
// the drawer's tabs, goes back to the hub. The board is ../builder/view.js's.
import { actOf, stockOf } from '../../sim/campaign.js';
import { mountBuilder } from '../builder/view.js';
import { icons } from '../icons.js';

// The session outlives the screen until the page reloads, so leaving for
// the hangar and coming back keeps the undo history, while the ship and the
// parts are still the campaign's.
let kept = null;

export const constructionScreen = {
  mount(root, { store: game }) {
    let defs = null;
    return mountBuilder(root, {
      launch: false,
      leave: { icon: icons.home, label: 'Hangar', onTap: () => game.dispatch({ type: 'screen/show', screen: 'hub' }) },
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
        if (!campaign || campaign.place !== 'hub') return null;
        const stock = stockOf(campaign);
        if (kept?.ship === campaign.ship && sameStock(kept.stock, stock)) return { session: kept };
        return { ship: campaign.ship, log: [], stock };
      },
      onSession(session, prev) {
        kept = session;
        if (session.ship !== prev.ship) game.dispatch({ type: 'campaign/ship', ship: session.ship });
      },
    });
  },
};

function sameStock(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b)]);
  return [...keys].every((key) => (a?.[key] ?? 0) === (b[key] ?? 0));
}
