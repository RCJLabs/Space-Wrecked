// Jobs at the stations (M38c): on the run every station posts a board of
// work, as the hangar did in act 1 (contracts.js). Its jobs are the
// stations' (data/contracts.json, at the sites of data/docks.json: the
// station's docks and the rocks nearby) whose clients include one of the
// station's side, or at one of nobody's a client of no side, and the
// client is one of those. The board is up to docks.board of them, rolled
// afresh at each visit from a seed of the campaign, the sector, the
// station and the jumps made so far, as the recruits and racks are seeded
// (recruits.js, racks.js): the same however often it is looked at during a
// visit, and the campaign's RNG never moves for it. A job taken is gone
// from it until the ship leaves: run.jobbed keeps the contracts taken at
// the station this visit (travel.js).
//
// An offer is act 1's with the station's name, for its pitch and for its
// end (contracts.js endJob): { contract, client, site, twist, seed,
// credits, part, station }. Taking one sends a squad of up to squadSize,
// picked as a boarding's is (crew.js), while nothing holds the ship (an
// event or an approach). No hunters join the fight: the station is safe.
// At a station of the pursuer's side a job is a trade, so they log the
// ship (travel.js dockShip). Pure.
import { seedFrom } from '../core/rng.js';
import { beginJob, rollOffers } from './contracts.js';
import { defaultSquad, squadMembers, squadProblem } from './crew.js';
import { fightSetup } from './difficulty.js';
import { stationSide } from './standing.js';
import { dockShip, hereOf, holdOf, onTheRun } from './travel.js';

// The station the ship is at, whose board it can take work from: its node,
// or null (off the run, or anywhere else).
export function stationHere(campaign, rules) {
  if (!onTheRun(campaign, rules) || campaign.run.sector.system) return null;
  const node = hereOf(campaign);
  return node?.type === 'station' ? node : null;
}

// The clients of `side` (null: of no side) a station contract's board can
// name.
export function stationClients(contract, rules, side) {
  return contract.clients.filter((id) => rules.docks.clients.includes(id) && (rules.clients.get(id)?.side ?? null) === side);
}

// The contracts a station of `side` (null: nobody's) posts, in data order:
// those at the stations' sites with a client of that side.
export function stationContracts(rules, side) {
  const sites = new Set(rules.docks.sites);
  return [...rules.contracts.jobs.values()].filter((contract) => !contract.quest && contract.sites.every((site) => sites.has(site)) && stationClients(contract, rules, side).length > 0);
}

// The board at the station the ship is at, this visit: up to docks.board
// offers, without those taken this visit. [] anywhere else.
export function stationBoard(campaign, rules) {
  const node = stationHere(campaign, rules);
  if (!node) return [];
  const { sector, jobbed } = campaign.run;
  const side = stationSide(node, rules);
  const rng = seedFrom(`jobs ${campaign.seed} ${sector.index} ${sector.name} ${node.id} ${campaign.flags.jumps ?? 0}`);
  const { board } = rollOffers(rules, rng, stationContracts(rules, side), rules.docks.board, (contract) => stationClients(contract, rules, side));
  return board.filter((offer) => !jobbed.includes(offer.contract)).map((offer) => ({ ...offer, station: node.name }));
}

// Takes the job at `index` on the station's board (stationBoard), with the
// squad `squad` (crew ids; null: the healthiest, crew.js defaultSquad).
// setup is what the settings make of the fight (settings.js
// fightSettings), with the campaign's difficulty and permanent death (M41,
// difficulty.js fightSetup). Returns { ok: true, campaign } with the fight
// on, or { ok: false, error } saying why it can't.
export function takeStationJob(campaign, rules, index, squad = null, setup = {}) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  if (!stationHere(campaign, rules)) return { ok: false, error: 'Work on the run is taken at a station.' };
  const held = holdOf(campaign, rules);
  if (held) return { ok: false, error: held };
  const job = stationBoard(campaign, rules)[index];
  if (!job) return { ok: false, error: 'That job is gone.' };
  const ids = squad ?? defaultSquad(campaign.crew, rules);
  const why = squadProblem(campaign.crew, ids, rules);
  if (why) return { ok: false, error: why };
  const docked = dockShip(campaign, rules);
  const taken = { ...docked, run: { ...docked.run, jobbed: [...docked.run.jobbed, job.contract] } };
  return beginJob(taken, rules, job, squadMembers(campaign.crew, ids), { ...fightSetup(campaign, setup), hunters: [] });
}
