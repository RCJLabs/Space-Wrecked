// A campaign ready to launch, for the launch tests: the miner's start with
// its quarters and life support fitted and three engines at the stern, so
// every flight check passes, lifting off included.
import { applyCommand } from '../src/sim/builder.js';
import { newCampaign, refitShip } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { rules } from './battleKit.js';

export function readyToLaunch(extra = {}) {
  let campaign = { ...withBoard(newCampaign(rules, 5), rules), parts: { quarters: 1, lifesupport: 1, engine: 3, corridor: 2 }, credits: 140, heat: 30 };
  let { ship } = campaign;
  const commands = [
    { op: 'place', type: 'quarters', x: 9, y: 5, rot: 0 },
    { op: 'place', type: 'lifesupport', x: 9, y: 8, rot: 0 },
    ...[4, 6, 8].map((y) => ({ op: 'place', type: 'engine', x: 7, y, rot: 0 })),
  ];
  for (const command of commands) ship = applyCommand(ship, rules, command).ship;
  campaign = refitShip(campaign, ship);
  return { ...campaign, ...extra };
}
