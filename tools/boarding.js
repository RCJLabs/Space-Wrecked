// Boardings, played by the AI (M22): the harness behind `node tools/sim.js
// --boardings`, and the test player's boarding fights in tools/voyage.js:
// on the run, and from M28 at the colony's places the scavengers hold.
// From M29 the test player's raids on the colony too (fightRaid): those at
// home play the AI, the raiders press on, as at the hangar. From M38c its
// jobs at stations (fightStationJob), played as act 1's jobs are.
// Both sides are played as the campaign's boardings go (encounter.js): the
// side aboard the other's ship presses on (press.js), and the side at home
// plays the AI (ai.js). Seeded: the same options always give the same
// report.
//
//   node tools/sim.js --boardings                  200 fights a row
//   node tools/sim.js --boardings --fights 500
//   node tools/sim.js --boardings --set fireDamage=3
//
// A row is the squad (data/encounters.json), at full health, against a
// hostile preset's party: at home on the launched start ship (or the ship
// given as `home`), boarded by them; and aboard a ship of the preset, a new
// one each fight, boarding her. A ship's security turrets (M39) fight for
// whoever's ship it is, as in a campaign's boardings (encounter.js).
import { aiAction } from '../src/sim/ai.js';
import { autoplay } from '../src/sim/autoplay.js';
import { isMachine } from '../src/sim/battle.js';
import { saveFight } from '../src/sim/campaign.js';
import { endJob } from '../src/sim/contracts.js';
import { deploy, machinesOn } from '../src/sim/deploy.js';
import { beginBoarding, endBoarding } from '../src/sim/encounter.js';
import { boardPlace, endPlaceFight } from '../src/sim/expeditions.js';
import { jobAction } from '../src/sim/jobAi.js';
import { endColonyRaid, faceRaid, raidCampaign, raidTake } from '../src/sim/raids.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { reachable } from '../src/sim/moves.js';
import { MAX_ROUNDS, playOn, RAID_PLAYERS } from '../src/sim/fightOut.js';
import { pressAction } from '../src/sim/press.js';
import { canSee } from '../src/sim/sight.js';
import { takeStationJob } from '../src/sim/stationJobs.js';
import { armFor } from './arms.js';
import { launchedShip } from './startShip.js';

export { MAX_ROUNDS, playOn };

// Who plays which side: the side aboard the other's ship presses on.
export const BOARDING_PLAYERS = {
  them: { crew: pressAction, enemy: aiAction },
  you: { crew: aiAction, enemy: pressAction },
};
// A boarding fight still going after MAX_ROUNDS rounds has stalled; the
// fights play on as src/sim/fightOut.js has them (M38f: the sim's own, for
// a raid fought out without the player), RAID_PLAYERS a raid's.
// Who plays a job (M38c, as act 1's: tools/run.js): the crew the job
// player, the enemy the AI.
const JOB_PLAYERS = { crew: jobAction, enemy: aiAction };

// The boarding fight that is due in a campaign, fought out by the AI and
// ended (encounter.js beginBoarding, endBoarding): { campaign, won, rounds,
// dir, salvage, dragged }. dragged: it went past DRAGGING rounds and both
// sides pressed on. Throws if it can't begin, or stalls even so. The crew
// goes in with the best weapons on hand for a fight aboard a ship (M37,
// arms.js).
export function fightBoarding(campaign, rules) {
  const begun = beginBoarding(armFor(campaign, rules, 'ship'), rules);
  if (!begun.ok) throw new Error(begun.error);
  return fightThrough(begun.campaign, rules, endBoarding);
}

// The fight at a place the scavengers hold, on a trip from the colony
// (M28: expeditions.js boardPlace, endPlaceFight), fought out by the AI and
// ended, as fightBoarding's, armed for a fight aboard her.
export function fightPlace(campaign, rules) {
  const begun = boardPlace(armFor(campaign, rules, 'ship'), rules);
  if (!begun.ok) throw new Error(begun.error);
  return fightThrough(begun.campaign, rules, endPlaceFight);
}

// The job at `index` on the station's board (M38c: stationJobs.js
// takeStationJob) with the squad `squad` (crew ids; null, the healthiest),
// the crew armed for a fight on the ground, fought out and ended
// (contracts.js endJob): { campaign, won, rounds, dragged }.
export function fightStationJob(campaign, rules, index, squad = null) {
  const taken = takeStationJob(armFor(campaign, rules, 'ground'), rules, index, squad);
  if (!taken.ok) throw new Error(taken.error);
  const { won, rounds, dragged, campaign: ended } = fightThrough(taken.campaign, rules, endJob, JOB_PLAYERS);
  return { campaign: ended, won, rounds, dragged };
}

// The raid that is down at the colony, faced (raids.js faceRaid: the guns
// fire at the lander first) and, with any raiders landed and anyone home,
// fought out by the AI and ended (endColonyRaid): { campaign, landing,
// fought (true with a fight), won, rounds, dragged, taken (what a lost
// raid took, raids.js raidTake, or null) }. Those at home are armed for a
// fight on the ground; while the ship is out on a voyage (M38d) the spare
// weapons are aboard it, so they fight with what they carry.
export function fightRaid(campaign, rules) {
  const faced = faceRaid(campaign.colony?.voyage ? campaign : armFor(campaign, rules, 'ground'), rules);
  if (!faced.ok) throw new Error(faced.error);
  if (!faced.fight) return { campaign: faced.campaign, landing: faced.landing, fought: false, won: faced.won, rounds: 0, dragged: false, taken: faced.taken };
  const done = fightThrough(faced.campaign, rules, endColonyRaid, RAID_PLAYERS);
  // The fight's end takes from the stores as they stood (raids.js
  // settleRaid), at the colony fought for (M38e: raidCampaign).
  const taken = done.won ? null : raidTake(raidCampaign(faced.campaign), rules);
  return { campaign: done.campaign, landing: faced.landing, fought: true, won: done.won, rounds: done.rounds, dragged: done.dragged, taken };
}

// A fight begun in campaign, played to its end, and ended: a boarding, its
// players by which way it goes; or a raid's (players given). Throws
// SealedIn for a fight that can't end (sealedIn), and an Error for one
// that stalled otherwise.
function fightThrough(campaign, rules, end, players = BOARDING_PLAYERS[campaign.fight.boarding?.dir]) {
  const { fight } = campaign;
  const played = playOn(fight.battle, rules, players);
  const { dragged } = played;
  if (!played.battle.winner) {
    const what = fight.raid ? 'raid' : fight.job ? 'job' : 'boarding';
    if (sealedIn(played.battle, rules)) throw new SealedIn(`A ${what} fight sealed itself in: after ${MAX_ROUNDS} rounds no one standing can reach a tile with an enemy in sight.`);
    throw new Error(`A ${what} fight stalled after ${MAX_ROUNDS} rounds.`);
  }
  const over = saveFight(campaign, played.battle, [...fight.log, ...played.events]);
  return { campaign: end(over, rules), won: played.battle.winner === 'crew', rounds: played.battle.round, dir: fight.boarding?.dir ?? null, salvage: fight.boarding?.salvage ?? null, dragged };
}

// A fight that can't end (M32): no one standing on either side can get to
// a tile with an enemy in sight, however far it walks. The fallen can shut
// the only way through: no one passes the other side's (moves.js). These
// fights have no objective, and a fight can't be left once begun (ROADMAP
// §9), so a player would be held there for good; the test player's trips
// stop (tools/voyage.js).
export class SealedIn extends Error {}

export function sealedIn(battle, rules) {
  const standing = battle.units.filter((u) => u.status === 'active');
  return standing.every((unit) => {
    const foes = standing.filter((u) => u.side !== unit.side);
    for (const spot of reachable(battle, unit, Infinity, rules).values()) {
      if (foes.some((foe) => canSee(battle, [spot.x, spot.y], [foe.x, foe.y], rules))) return false;
    }
    return true;
  });
}

// The harness's rows: two for each hostile preset with a party.
export function boardingRows(rules, ship = launchedShip(rules)) {
  const home = mapFromShip(ship, rules);
  return [...rules.ships.values()]
    .filter((preset) => preset.tactics && preset.party)
    .flatMap((preset) => [
      { label: `At home, boarded by a ${preset.name.toLowerCase()}'s crew`, dir: 'you', preset, map: () => home },
      {
        label: `Boarding a ${preset.name.toLowerCase()}`,
        dir: 'them',
        preset,
        map: (seed) => {
          const made = generateShip(rules, preset.id, seed);
          if (!made.ok) throw new Error(made.error);
          return mapFromShip(made.ship, rules, { wrecked: made.wrecked });
        },
      },
    ]);
}

// Plays `fights` boardings a row: [{ label, preset, dir, fights, won,
// stalled, rounds, hpLeft }], rounds and hpLeft being each fight's (hpLeft:
// the crew's hit points standing at the end, in fights with a winner, a
// turret's not among them).
export function runBoardings(rules, { fights = 200, seed = 'balance', rounds = MAX_ROUNDS, home = launchedShip(rules) } = {}) {
  return boardingRows(rules, home).map((row) => {
    const party = rules.encounters.get(row.preset.party).enemies;
    const out = { label: row.label, preset: row.preset.id, dir: row.dir, fights, won: 0, stalled: 0, rounds: [], hpLeft: [] };
    for (let n = 1; n <= fights; n++) {
      const fightSeed = `${seed} ${row.dir} ${row.preset.id} ${n}`;
      const map = row.map(fightSeed);
      const machines = machinesOn(map, rules, row.dir === 'you' ? 'crew' : 'enemy');
      const held = machines.map(({ x, y }) => [x, y]);
      // deploy puts its first list on the bridge and its second at the hatches.
      const placed = row.dir === 'you' ? deploy(map, rules.squad, party, rules, held) : deploy(map, party, rules.squad, rules, held);
      if (!placed.ok) throw new Error(`${row.label}: ${placed.error}`);
      const units = [...(row.dir === 'you' ? placed.units : [...placed.units.slice(party.length), ...placed.units.slice(0, party.length)]), ...machines];
      const { battle } = autoplay({ map, units, seed: fightSeed, options: { press: row.dir === 'you' } }, rules, BOARDING_PLAYERS[row.dir], { maxRounds: rounds });
      if (!battle.winner) {
        out.stalled += 1;
        continue;
      }
      if (battle.winner === 'crew') out.won += 1;
      out.rounds.push(battle.round);
      out.hpLeft.push(battle.units.filter((u) => u.side === 'crew' && u.status === 'active' && !isMachine(u, rules)).reduce((sum, u) => sum + u.hp, 0));
    }
    return out;
  });
}

// The rows as a table.
export function boardingText(rows, { seed = 'balance' } = {}) {
  const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor((list.length - 1) / 2)] : '–');
  const width = Math.max(...rows.map((row) => row.label.length), 4);
  const head = `${'Fight'.padEnd(width)}  ${'Fights'.padStart(6)}  ${'Crew wins'.padStart(9)}  ${'Stalled'.padStart(7)}  ${'Rounds'.padStart(6)}  ${'Crew hp left'.padStart(12)}`;
  const lines = rows.map((row) =>
    `${row.label.padEnd(width)}  ${String(row.fights).padStart(6)}  ${`${Math.round((100 * row.won) / row.fights)}%`.padStart(9)}  ${String(row.stalled).padStart(7)}  ${String(median(row.rounds)).padStart(6)}  ${String(median(row.hpLeft)).padStart(12)}`,
  );
  return [
    `Boardings, both ways: the squad at full health, played by the AI, against each hostile preset's party, seed "${seed}". Aboard the other's ship a side presses on; at home it plays the AI. Rounds and hit points left are medians, in the fights with a winner.`,
    head,
    ...lines,
  ].join('\n');
}
