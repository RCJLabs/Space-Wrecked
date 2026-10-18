// A campaign ready to launch, for the launch tests: the miner's start with
// its quarters and life support fitted and three engines at the stern, so
// every flight check passes, lifting off included.
import { applyCommand } from '../src/sim/builder.js';
import { newCampaign, refitShip } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { rules } from './battleKit.js';

// The pirate cutter (data/ships.json) the approach and boarding tests meet:
// preset seed 3, with two guns and one reactor, so the start ship's one gun
// can disable her. Seed 1's had those until M23e's light engines changed
// what the cutter rolls; its seed 1 now has three guns and two reactors.
export const CUTTER_SEED = 3;

// The campaign's RNG once seed 5's board and shop are rolled, as it was
// before M38's jobs: the launch, run and colony tests were written against
// the sectors and worlds it rolls, and act 1's content shouldn't move them.
// A board's shuffle takes a roll for every job in the district.
export const LAUNCH_RNG = 3975261316;

export function readyToLaunch(extra = {}) {
  let campaign = { ...withBoard(newCampaign(rules, 5), rules), parts: { quarters: 1, lifesupport: 1, engine: 3, corridor: 2 }, credits: 140, heat: 30, rng: LAUNCH_RNG };
  let { ship } = campaign;
  const commands = [
    { op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 },
    { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 },
    ...[4, 6, 8].map((y) => ({ op: 'place', type: 'engine', x: 7, y, rot: 0 })),
  ];
  for (const command of commands) ship = applyCommand(ship, rules, command).ship;
  campaign = refitShip(campaign, ship, rules);
  return { ...campaign, ...extra };
}
