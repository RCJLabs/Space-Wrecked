// Construction mode: the builder on the campaign's ship, with only the parts
// the campaign has, at the hangar (act 1), at a station on the run (M23h)
// or a shipyard (M37b), or at the colony, where the ship has landed (M27). The palette shows what is
// on hand; a part fitted comes out of the parts on hand and one taken off
// goes back, for nothing (campaign.js refitShip). Every change is saved
// through the campaign at once. On the run, the parts an approach wrecked
// stay on until the station repairs them: they move and turn with their
// damage, and the plans mark them; or one is scrapped for a spare on hand
// in its place (M46), on its card. Between jumps (M46, rearrange.js) the
// mode opens on the parts aboard alone, which move and turn but don't come
// off. The way out, at the end of the drawer's
// tabs, goes home: Hangar to the hangar, where Launch is once every flight
// check passes (and in the Ship tab here too, M44); Map to the sector map, where the ship can't jump until they
// all do; or Colony to the colony, the flight checks counting a full squad
// aboard (M28: what a trip needs, berths and air for each). The board is
// ../builder/view.js's.
import { actOf, canRefit, crewAboard, fullSquad, stockOf, wreckedUids } from '../../sim/campaign.js';
import { nameProblem, withIdentity } from '../../sim/identity.js';
import { canRearrange } from '../../sim/rearrange.js';
import { mountBuilder } from '../builder/view.js';
import { icons } from '../icons.js';

// The session outlives the screen until the page reloads, so leaving for
// home and coming back keeps the undo history, while the ship, the parts
// and the wrecks are still the campaign's.
let kept = null;
// A part to arm on the way in: a checklist line tapped at the hangar (M44).
let pick = null;

// Opens construction mode with a part of `type` armed, its ghost where it
// fits best.
export function buildWith(game, type) {
  pick = type;
  game.dispatch({ type: 'screen/show', screen: 'construction' });
}

export const constructionScreen = {
  mount(root, { store: game }) {
    let defs = null;
    // In act 1 the ship refits at the hangar; on the run (act 2) at a
    // station or a shipyard, and goes back to the sector map; in act 3 at
    // the colony, and on a voyage from it (M38d) at a station or a shipyard
    // again.
    const campaign = game.getState().campaign;
    const home = campaign?.colony && !campaign.colony.voyage ? 'colony' : campaign?.run ? 'run' : 'hangar';
    const leave = {
      hangar: { icon: icons.home, label: 'Hangar', screen: 'hub' },
      run: { icon: icons.map, label: 'Map', screen: 'sector' },
      colony: { icon: icons.settle, label: 'Colony', screen: 'colony' },
    }[home];
    return mountBuilder(root, {
      // In act 1, Launch in the Ship tab too (M44), two taps as at the
      // hangar.
      launch: home === 'hangar' && (() => game.dispatch({ type: 'campaign/launch', rules: defs })),
      ready: {
        hangar: 'Every flight check passes: tap Launch in the Ship tab, or Hangar.',
        run: 'Every flight check passes: the ship can jump. Tap Map.',
        colony: 'Every flight check passes with a full squad aboard: the ship can fly out. Tap Colony.',
      }[home],
      cleared: { hangar: 'Ready to launch', run: 'Ready to jump', colony: 'Ready to fly' }[home],
      leave: { icon: leave.icon, label: leave.label, onTap: () => game.dispatch({ type: 'screen/show', screen: leave.screen }) },
      // At the colony, a full squad: what a trip from it needs aboard.
      crew: () => {
        const now = game.getState().campaign;
        if (!now) return 0;
        return now.colony && !now.colony.voyage && defs ? fullSquad(now, defs) : crewAboard(now);
      },
      // The ship's name, number and emblem (M52): renamed and her emblem
      // picked in the Look tab. A save from before has hers rolled.
      identity: {
        get: () => {
          const now = game.getState().campaign;
          return now && defs ? withIdentity(now, defs).identity : null;
        },
        rename(name) {
          const why = nameProblem(name);
          if (why) return why;
          game.dispatch({ type: 'campaign/rename', name, rules: defs });
          return null;
        },
        emblem(emblem) {
          game.dispatch({ type: 'campaign/emblem', emblem, rules: defs });
        },
        // The crew's suits in the ship's paint or their own (M58).
        suits(suits) {
          game.dispatch({ type: 'campaign/suits', suits, rules: defs });
        },
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
        // Between jumps (M46) the stock is the parts aboard alone: they move
        // and turn, and none comes off.
        const rearrange = Boolean(campaign) && canRearrange(campaign, content);
        if (!campaign || (!rearrange && !canRefit(campaign, content))) return null;
        const stock = rearrange ? aboard(campaign.ship) : stockOf(campaign);
        const wrecked = wreckedUids(campaign);
        const picked = rearrange ? null : pick;
        pick = null;
        if (kept?.ship === campaign.ship && Boolean(kept.rearrange) === rearrange && sameStock(kept.stock, stock) && sameList(kept.wrecked, wrecked)) return { session: kept, pick: picked };
        return { ship: campaign.ship, log: [], stock, wrecked, rearrange, pick: picked };
      },
      onSession(session, prev) {
        kept = session;
        if (session.ship !== prev.ship) game.dispatch({ type: 'campaign/ship', ship: session.ship, rules: defs });
      },
    });
  },
};

// { [type]: count } of the parts on `ship`.
function aboard(ship) {
  const stock = {};
  for (const module of ship.modules) stock[module.type] = (stock[module.type] ?? 0) + 1;
  return stock;
}

function sameStock(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b)]);
  return [...keys].every((key) => (a?.[key] ?? 0) === (b[key] ?? 0));
}

function sameList(a = [], b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
