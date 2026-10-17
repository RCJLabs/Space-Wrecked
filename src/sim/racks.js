// The weapons rack at every station on the run (ROADMAP §4.6, M37). A
// station sells rackSize weapons (data/balance.json), the same on every
// visit: rolled from the campaign's seed, the sector and the station, not
// the campaign's RNG, as its recruits are (recruits.js), from its side's
// table (`arms` on the side in data/factions.json) or, at a station of
// nobody's, the stations' own (`arms` in data/factions.json). Each is at
// its price (economy.js weaponPrice), at the station's share of it (M33,
// standing.js). One bought is gone from the rack (run.racked), and buying
// docks the ship as any trade does (travel.js dockShip). Pure.
import { seedFrom } from '../core/rng.js';
import { pickSeveral } from './drops.js';
import { weaponPrice } from './economy.js';
import { withArms } from './loadout.js';
import { costAt, priceShare, stationSide } from './standing.js';
import { tally } from './flags.js';
import { dockShip, hereOf, holdOf, onTheRun, tradeHeat } from './travel.js';

// The rack at station `nodeId` in the ship's sector, bought or not:
// [{ slot, weapon (its id), price }].
export function rackAt(campaign, rules, nodeId) {
  const { sector } = campaign.run;
  const node = sector.nodes[nodeId];
  const table = tableOf(node, rules);
  if (!table) return [];
  const picked = pickSeveral(seedFrom(`rack ${campaign.seed} ${sector.index} ${sector.name} ${nodeId}`), table, rules.balance.rackSize ?? 0);
  const share = priceShare(campaign, rules, node);
  return picked.value.map((weapon, slot) => ({ slot, weapon, price: costAt(1, weaponPrice(weapon, rules), share) }));
}

// The weapons for sale where the ship is: the rack of the station it is at,
// those not bought yet, or [] away from one.
export function rackHere(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return [];
  const { at, racked = [] } = campaign.run;
  return rackAt(campaign, rules, at).filter((item) => !racked.some((r) => r.node === at && r.slot === item.slot));
}

// What buying the weapon in `slot` takes: { ok: true, item, dock (the heat
// it adds) } or { ok: false, error }.
export function rackPlan(campaign, rules, slot) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'Weapons are sold at stations.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const item = rackHere(campaign, rules).find((i) => i.slot === slot);
  if (!item) return { ok: false, error: "That one's gone from the rack." };
  if (campaign.credits < item.price) return { ok: false, error: `The ${rules.weapons.get(item.weapon)?.name.toLowerCase() ?? 'weapon'} is ${item.price} credits.` };
  return { ok: true, item, dock: tradeHeat(campaign, rules) };
}

// Buys the weapon in `slot`: on hand, its price off the credits, and gone
// from the rack. Returns { ok: true, campaign, plan } or { ok: false,
// error }.
export function buyFromRack(campaign, rules, slot) {
  const plan = rackPlan(campaign, rules, slot);
  if (!plan.ok) return plan;
  const { item } = plan;
  const docked = dockShip(campaign, rules);
  const { run } = docked;
  return {
    ok: true,
    plan,
    campaign: {
      ...docked,
      credits: docked.credits - item.price,
      arms: withArms(docked.arms ?? {}, item.weapon),
      flags: tally(docked.flags, { armsBought: 1 }),
      run: { ...run, racked: [...(run.racked ?? []), { node: run.at, slot: item.slot }] },
    },
  };
}

// The table a station's rack rolls from: its side's, or the stations' own
// for nobody's; null for a node that isn't a station, or none at all.
function tableOf(node, rules) {
  if (node?.type !== 'station') return null;
  const side = stationSide(node, rules);
  const table = side ? rules.factions.sides.get(side)?.arms : rules.factions.arms;
  return table && Object.keys(table).length ? table : null;
}
