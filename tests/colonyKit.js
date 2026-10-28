// A campaign that has settled a world, for the colony tests (M26): the
// launch tests' ship (launchKit.js) crosses to the system past the charts
// and settles world `id`, surveyed first or not. Its ship gives quarters,
// life support and a gun; its one reactor and the parts it flies on stay.
import { chooseAtColony, dayEvent } from '../src/sim/colonyEvents.js';
import { launch } from '../src/sim/launch.js';
import { settle } from '../src/sim/settle.js';
import { survey } from '../src/sim/survey.js';
import { beginRun, leaveSector } from '../src/sim/travel.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

export function settled(id = 1, { surveyFirst = false, flags = {}, heat = 10 } = {}) {
  const run = beginRun(launch(readyToLaunch({ heat }), rules).campaign, rules).campaign;
  const { sector } = run.run;
  // At the last sector's jump point, the sectors before it crossed.
  const sectors = rules.acts.get(2).sectors;
  const past = rules.sectors.names.sectors.filter((name) => name !== sector.name).slice(0, sectors - 1);
  const exit = { ...run, flags: { ...run.flags, ...flags }, run: { ...run.run, sector: { ...sector, index: sectors }, at: sector.exit, seen: [...run.run.seen, sector.exit], past } };
  const system = leaveSector(exit, rules).campaign;
  let there = { ...system, run: { ...system.run, at: id, seen: [...system.run.seen, id] } };
  if (surveyFirst) there = survey(there, rules).campaign;
  return settle(there, rules).campaign;
}

// The uid of the ship's first part of type.
export function uidOf(campaign, type) {
  return campaign.ship.modules.find((module) => module.type === type).uid;
}

// A companion's colony beat heard (M61), the first step of their loyalty
// quest: the event a day brings, its first choice made.
export function heard(campaign) {
  const day = dayEvent(campaign, rules);
  const open = day.colony.event;
  if (!open?.quest) throw new Error('no beat to hear');
  return chooseAtColony(day, rules, rules.events.get(open.id).choices[0].id).campaign;
}

// The rules with no colony event rolled (M61), for the tests of what else
// a day does: a companion's beat still comes.
export const calm = { ...rules, balance: { ...rules.balance, colonyEventChance: 0 } };
