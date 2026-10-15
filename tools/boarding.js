// Boardings, played by the AI (M22): the harness behind `node tools/sim.js
// --boardings`, and the test player's boarding fights in tools/voyage.js:
// on the run, and from M28 at the colony's places the scavengers hold.
// From M29 the test player's raids on the colony too (fightRaid): those at
// home play the AI, the raiders press on, as at the hangar.
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
// hostile preset's party: at home on the launched start ship, boarded by
// them; and aboard a ship of the preset, a new one each fight, boarding her.
import { aiAction } from '../src/sim/ai.js';
import { autoplay, playFrom } from '../src/sim/autoplay.js';
import { saveFight } from '../src/sim/campaign.js';
import { deploy } from '../src/sim/deploy.js';
import { beginBoarding, endBoarding } from '../src/sim/encounter.js';
import { boardPlace, endPlaceFight } from '../src/sim/expeditions.js';
import { endColonyRaid, faceRaid, raidTake } from '../src/sim/raids.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { mapFromShip } from '../src/sim/mapFromShip.js';
import { shotOdds } from '../src/sim/odds.js';
import { reachable } from '../src/sim/moves.js';
import { advance, pressAction } from '../src/sim/press.js';
import { canSee } from '../src/sim/sight.js';
import { launchedShip } from './startShip.js';

// Who plays which side: the side aboard the other's ship presses on.
export const BOARDING_PLAYERS = {
  them: { crew: pressAction, enemy: aiAction },
  you: { crew: aiAction, enemy: pressAction },
};
// A boarding fight still going after this many rounds has stalled.
export const MAX_ROUNDS = 60;
// The test player's fights: past this many rounds, both sides press on, so
// two sides on overwatch either side of a door can't hold a voyage up; and
// a shot with less than HOPELESS percent to hit, or overwatch, gives way to
// a step nearer, or with none (the fallen lying in the only way through),
// to a tile with an enemy in sight, so two sides can't trade misses or
// watch for each other for ever (M32).
const DRAGGING = 40;
const HOPELESS = 10;
const BOTH_PRESS = { crew: charge, enemy: charge };
// Who plays a raid on the colony (M29): those at home the AI, the raiders
// pressing on.
const RAID_PLAYERS = { crew: aiAction, enemy: pressAction };

// The boarding fight that is due in a campaign, fought out by the AI and
// ended (encounter.js beginBoarding, endBoarding): { campaign, won, rounds,
// dir, salvage, dragged }. dragged: it went past DRAGGING rounds and both
// sides pressed on. Throws if it can't begin, or stalls even so.
export function fightBoarding(campaign, rules) {
  const begun = beginBoarding(campaign, rules);
  if (!begun.ok) throw new Error(begun.error);
  return fightThrough(begun.campaign, rules, endBoarding);
}

// The fight at a place the scavengers hold, on a trip from the colony
// (M28: expeditions.js boardPlace, endPlaceFight), fought out by the AI and
// ended, as fightBoarding's.
export function fightPlace(campaign, rules) {
  const begun = boardPlace(campaign, rules);
  if (!begun.ok) throw new Error(begun.error);
  return fightThrough(begun.campaign, rules, endPlaceFight);
}

// The raid that is down at the colony, faced (raids.js faceRaid: the guns
// fire at the lander first) and, with any raiders landed and anyone home,
// fought out by the AI and ended (endColonyRaid): { campaign, landing,
// fought (true with a fight), won, rounds, dragged, taken (what a lost
// raid took, raids.js raidTake, or null) }.
export function fightRaid(campaign, rules) {
  const faced = faceRaid(campaign, rules);
  if (!faced.ok) throw new Error(faced.error);
  if (!faced.fight) return { campaign: faced.campaign, landing: faced.landing, fought: false, won: faced.won, rounds: 0, dragged: false, taken: faced.taken };
  const done = fightThrough(faced.campaign, rules, endColonyRaid, RAID_PLAYERS);
  // The fight's end takes from the stores as they stood (raids.js
  // settleRaid).
  const taken = done.won ? null : raidTake(faced.campaign, rules);
  return { campaign: done.campaign, landing: faced.landing, fought: true, won: done.won, rounds: done.rounds, dragged: done.dragged, taken };
}

// A battle played on by the players, and past DRAGGING rounds with both
// sides pressing on (charge), to its end or maxRounds: playFrom's { battle,
// actions, events }, and dragged (true when it went past DRAGGING). The
// test player's fights in act 1 (tools/run.js, M32) play on the same way.
export function playOn(battle, rules, players, { maxRounds = MAX_ROUNDS } = {}) {
  const played = playFrom(battle, rules, players, { maxRounds: Math.min(DRAGGING, maxRounds) });
  if (played.battle.winner || maxRounds <= DRAGGING) return { ...played, dragged: false };
  const rest = playFrom(played.battle, rules, BOTH_PRESS, { maxRounds });
  return { battle: rest.battle, actions: [...played.actions, ...rest.actions], events: [...played.events, ...rest.events], dragged: true };
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
    const what = fight.raid ? 'raid' : 'boarding';
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

// Pressing on, past DRAGGING rounds: as pressAction, but a hopeless shot
// or overwatch gives way to a step nearer, or with none and no enemy in
// sight, to the nearest tile with one in sight, where there is one.
function charge(battle, rules) {
  const action = pressAction(battle, rules);
  if (action.type !== 'shoot' && action.type !== 'overwatch') return action;
  const unit = battle.units.find((u) => u.id === action.unit);
  const target = action.type === 'shoot' ? battle.units.find((u) => u.id === action.target) : null;
  if (target && shotOdds(battle, unit, target, rules).hit >= HOPELESS) return action;
  return advance(battle, unit, rules) ?? (target ? null : intoSight(battle, unit, rules)) ?? action;
}

// A move to the cheapest tile in one action's reach with an enemy in
// sight, or null.
function intoSight(battle, unit, rules) {
  const foes = battle.units.filter((u) => u.side !== unit.side && u.status === 'active');
  const sees = (x, y) => foes.some((foe) => canSee(battle, [x, y], [foe.x, foe.y], rules));
  if (sees(unit.x, unit.y)) return null;
  let best = null;
  for (const spot of reachable(battle, unit, unit.mobility, rules).values()) {
    if ((!best || spot.cost < best.cost) && sees(spot.x, spot.y)) best = spot;
  }
  return best && { type: 'move', unit: unit.id, to: [best.x, best.y] };
}

// The harness's rows: two for each hostile preset with a party.
export function boardingRows(rules) {
  const home = mapFromShip(launchedShip(rules), rules);
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
// the crew's hit points standing at the end, in fights with a winner).
export function runBoardings(rules, { fights = 200, seed = 'balance', rounds = MAX_ROUNDS } = {}) {
  return boardingRows(rules).map((row) => {
    const party = rules.encounters.get(row.preset.party).enemies;
    const out = { label: row.label, preset: row.preset.id, dir: row.dir, fights, won: 0, stalled: 0, rounds: [], hpLeft: [] };
    for (let n = 1; n <= fights; n++) {
      const fightSeed = `${seed} ${row.dir} ${row.preset.id} ${n}`;
      const map = row.map(fightSeed);
      // deploy puts its first list on the bridge and its second at the hatches.
      const placed = row.dir === 'you' ? deploy(map, rules.squad, party, rules) : deploy(map, party, rules.squad, rules);
      if (!placed.ok) throw new Error(`${row.label}: ${placed.error}`);
      const units = row.dir === 'you' ? placed.units : [...placed.units.slice(party.length), ...placed.units.slice(0, party.length)];
      const { battle } = autoplay({ map, units, seed: fightSeed, options: { press: row.dir === 'you' } }, rules, BOARDING_PLAYERS[row.dir], { maxRounds: rounds });
      if (!battle.winner) {
        out.stalled += 1;
        continue;
      }
      if (battle.winner === 'crew') out.won += 1;
      out.rounds.push(battle.round);
      out.hpLeft.push(battle.units.filter((u) => u.side === 'crew' && u.status === 'active').reduce((sum, u) => sum + u.hp, 0));
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
