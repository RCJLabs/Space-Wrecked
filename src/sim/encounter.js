// Hostile ships on the run (ROADMAP §4.2): the approach phase (approach.js)
// as the campaign plays it, and the boarding fights it can end in (§4.3).
// The ship meets one at a node with a hostile ship on it (gen/sector.js):
// arriving opens the approach, which holds every jump and scan until it is
// over. The other ship is generated from the node's preset and seed and
// saved whole; the player's ship comes in with its wrecks from earlier
// approaches (campaign.wrecks). Each order plays a round with the
// campaign's RNG, saved. When it ends:
//   - a ship that blew up leaves the preset's scrap, in credits;
//   - if anyone fired, heat rises by approachHeat;
//   - the player's wrecks stay (campaign.wrecks) until a station repairs
//     them (repair.js), but the crew always gets one reactor and one engine
//     going again, so the ship can fly on;
//   - the node is settled (run.done), and the flags count it;
//   - a boarding, either way, is a fight that is due (beginBoarding). The
//     player can leave a ship they disabled instead; a ship that boards
//     theirs has to be fought off.
// The approach stays, with its outcome, until the player carries on, or
// until its boarding fight is over.
//
// The pursuer's hunters (hunt.js, M24) are an approach too, opened where
// they wait (openHunt) rather than from the node: a hostile ship there
// slips away, and the node isn't settled by them, so an event there waits
// until they have been dealt with. Facing them (approach.js FACED) drops
// heat to heatAfterRaid, past what the shots added; getting away leaves it.
//
// A boarding fight is on the boarded ship's map, wrecked rooms and all
// (Law 2): her generated ship's when the player boards her, with her crew
// (the preset's party, data/encounters.json) on her bridge and the player's
// crew coming in at her hatches; the player's own when she boards, with
// the crew on the bridge and her party at the hatches, pressing on as a
// raid's raiders do. Whoever wins (endBoarding), the crew keeps its wounds
// (campaign.js endFight), and:
//   - won aboard her: the crew strips her salvage (the preset's count of
//     working parts, by rolls, never corridors) and takes her scrap;
//   - won at home: her boarders' gear, her scrap's worth in credits;
//   - lost at home: her crew takes what a lost raid takes (raid.js
//     raidLoss): the dearest part on hand, or half the credits;
//   - lost aboard her: the crew is beaten back, and that is all.
// What a win pays is rolled as the fight begins, so it can be shown, and
// never changes.
//
// run.approach, while one is open:
//   node     the node it is at
//   hunt     whether it is the pursuer's hunters (M24)
//   enemy    { ship (the preset), name, crew }
//   them     the other ship's side: { ship, damage, wrecked }
//   you      the player's side: { damage, wrecked }; its ship is the
//            campaign's
//   round    the round to play next, 1 up
//   fired    whether a gun has fired yet
//   last     the round played last: { order, intent, events }, or null
//   outcome  null until it ends, then { kind, how?, changes, boarding }.
//            changes: { credits, parts (found), lost (a part or credits,
//            or null), heat, patched (uids got going again) }. boarding:
//            'due' while a boarding fight waits, else null. (A save from
//            before M22 settled its boardings with a stand-in, whose finds
//            and losses are in changes.)
// campaign.fight.boarding, during a boarding fight: { dir: 'them' (the
// crew boarded her) | 'you' (she boarded the player's ship), salvage:
// { parts, credits } (what a win pays) }.
import { int, pick } from '../core/rng.js';
import { BOARDINGS, enemyOrder, FACED, playRound } from './approach.js';
import { createBattle } from './battle.js';
import { crewUnit, endFight } from './campaign.js';
import { defaultSquad, squadMembers, squadProblem } from './crew.js';
import { deploy } from './deploy.js';
import { stationEdge } from './edges.js';
import { tally } from './flags.js';
import { generateShip } from './gen/ship.js';
import { withHeat } from './heat.js';
import { mapFromShip } from './mapFromShip.js';
import { hasTag } from './modules.js';
import { raidLoss } from './raid.js';
import { enemyBonus } from './settings.js';

const MAX_SEED = 0xffffffff;

// The approach as approach.js plays it: { you, them, round, tactics }, or
// null with none open. The player's side carries the crew's edge: the
// gunnery and evasion their jobs add aboard (edges.js, M32).
export function approachState(campaign, rules) {
  const approach = campaign.run?.approach;
  if (!approach) return null;
  const tactics = rules.ships.get(approach.enemy.ship)?.tactics ?? { aim: [] };
  return { you: { ship: campaign.ship, ...approach.you, edge: crewEdge(campaign.crew, rules) }, them: approach.them, round: approach.round, tactics };
}

// What a crew's jobs add to its ship in the approach: { gunnery, evasion }.
export function crewEdge(crew, rules) {
  return { gunnery: stationEdge(crew, rules, 'gunnery'), evasion: stationEdge(crew, rules, 'evasion') };
}

// The other ship's order for the round to come, or null when no approach
// is going on.
export function approachIntent(campaign, rules) {
  const state = approachState(campaign, rules);
  return state && !campaign.run.approach.outcome ? enemyOrder(state, rules) : null;
}

// Opens the approach at the node the ship has come to, if a hostile ship is
// there and the node isn't settled. The campaign as it was otherwise. A
// preset the data no longer has, or one that won't generate, is passed by.
export function openApproach(campaign, rules) {
  const { run } = campaign;
  const node = run?.sector.nodes[run.at];
  if (!node?.hostile || run.approach || run.done.includes(run.at)) return campaign;
  const approach = approachAgainst(campaign, rules, node.hostile.ship, node.hostile.seed, false);
  return approach ? { ...campaign, run: { ...run, approach } } : campaign;
}

// Opens the pursuer's hunters' approach where the ship is (hunt.js): their
// ship, preset `ship`, generated from `seed`. A hostile ship waiting there
// slips away, its node settled. The flags count the hunters met. The
// campaign as it was if an approach is open already, or the preset won't
// generate.
export function openHunt(campaign, rules, ship, seed) {
  const { run } = campaign;
  if (!run || run.approach) return campaign;
  const approach = approachAgainst(campaign, rules, ship, seed, true);
  if (!approach) return campaign;
  const node = run.sector.nodes[run.at];
  const done = node.hostile && !run.done.includes(run.at) ? [...run.done, run.at] : run.done;
  return { ...campaign, flags: tally(campaign.flags, { hunts: 1 }), run: { ...run, done, approach } };
}

// A fresh approach at the ship's node against preset `id` generated from
// `seed`, or null if the preset has no tactics or won't generate.
function approachAgainst(campaign, rules, id, seed, hunt) {
  const preset = rules.ships.get(id);
  const made = preset?.tactics ? generateShip(rules, preset.id, seed) : null;
  if (!made?.ok) return null;
  return {
    node: campaign.run.at,
    hunt,
    enemy: { ship: preset.id, name: preset.name, crew: made.crew },
    them: { ship: made.ship, damage: {}, wrecked: made.wrecked },
    you: { damage: {}, wrecked: wrecksOn(campaign.ship, campaign.wrecks) },
    round: 1,
    fired: false,
    last: null,
    outcome: null,
  };
}

// Gives the player's order for this round, and plays it. Returns { ok:
// true, campaign } with the round played (and, if it ended the approach,
// settled), or { ok: false, error }.
export function giveOrder(campaign, rules, order) {
  const approach = campaign.run?.approach;
  if (!approach) return { ok: false, error: 'There is no ship to face.' };
  if (approach.outcome) return { ok: false, error: 'It is over: carry on.' };
  const played = playRound(approachState(campaign, rules), order, campaign.rng, rules);
  if (!played.ok) return played;
  const next = {
    ...approach,
    you: { damage: played.you.damage, wrecked: played.you.wrecked },
    them: played.them,
    round: played.round,
    fired: approach.fired || played.fired,
    last: { order, intent: played.intent, events: played.events },
  };
  const moved = { ...campaign, rng: played.rng, run: { ...campaign.run, approach: next } };
  return { ok: true, campaign: played.outcome ? settle(moved, rules, played.outcome) : moved };
}

// Puts the approach away once it is over (Carry on), or leaves a ship the
// player disabled without boarding her. A ship boarding the player's has to
// be fought off first. Returns { ok: true, campaign } or { ok: false,
// error }.
export function closeApproach(campaign) {
  const approach = campaign.run?.approach;
  if (!approach?.outcome) return { ok: false, error: approach ? 'The approach is still on.' : 'There is no ship to face.' };
  if (campaign.fight) return { ok: false, error: 'Finish the fight first.' };
  if (approach.outcome.boarding === 'due' && approach.outcome.kind === 'boardedBy') return { ok: false, error: 'They are boarding: fight them off.' };
  return { ok: true, campaign: { ...campaign, run: { ...campaign.run, approach: null } } };
}

// What the approach's end comes to (see the top of the file).
function settle(campaign, rules, outcome) {
  const { run } = campaign;
  const { approach } = run;
  const preset = rules.ships.get(approach.enemy.ship);
  let { rng } = campaign;
  const changes = { credits: 0, parts: [], lost: null, heat: 0, patched: [] };
  if (outcome.kind === 'destroyed' && preset?.scrap) {
    const scrap = int(rng, ...preset.scrap);
    rng = scrap.state;
    changes.credits = scrap.value;
  }
  // The hunters faced: the pursuer has to send for another crew.
  const faced = approach.hunt === true && FACED.includes(outcome.kind);
  const fired = approach.fired ? withHeat(campaign.heat, rules.balance.approachHeat) : campaign.heat;
  const heat = faced ? Math.min(campaign.heat, rules.balance.heatAfterRaid) : fired;
  changes.heat = heat - campaign.heat;
  const kept = juryRig(campaign.ship, approach.you.wrecked, rules);
  changes.patched = kept.patched;
  const won = outcome.kind === 'boarded' || outcome.kind === 'destroyed' ? 1 : 0;
  const boarding = outcome.kind in BOARDINGS ? 'due' : null;
  return {
    ...campaign,
    rng,
    credits: campaign.credits + changes.credits,
    heat,
    wrecks: kept.wrecked,
    flags: tally(campaign.flags, { approaches: 1, approachesWon: won, approachesLost: outcome.kind === 'boardedBy' ? 1 : 0, huntsFaced: faced ? 1 : 0 }),
    // The hunters don't settle the node: an event there is still to come.
    run: { ...run, done: approach.hunt ? run.done : [...run.done, approach.node], approach: { ...approach, outcome: { ...outcome, changes, boarding } } },
  };
}

// The boarding fight that is due, as it would begin, for the screens and
// beginBoarding: { dir, ship (whose map it is on), wrecked, party (her
// crew's enemy ids), preset }, or null with none due.
export function boardingDue(campaign, rules) {
  const approach = campaign.run?.approach;
  if (approach?.outcome?.boarding !== 'due' || campaign.fight) return null;
  const preset = rules.ships.get(approach.enemy.ship);
  const party = rules.encounters.get(preset?.party)?.enemies;
  if (!party) return null;
  const dir = BOARDINGS[approach.outcome.kind];
  return dir === 'them'
    ? { dir, ship: approach.them.ship, wrecked: approach.them.wrecked, party, preset }
    : { dir, ship: campaign.ship, wrecked: approach.you.wrecked, party, preset };
}

// Starts the boarding fight that is due: the squad (crew.js; the player's
// pick, or the healthiest squadSize) against her party, on the boarded
// ship's map with its wrecks. Its seed is the campaign's next roll, and so
// is what a win pays. setup is what the settings make of the fight
// (settings.js fightSettings): forgiving odds, and the difficulty; and the
// squad picked, as crew ids, or null for the default. Returns { ok: true,
// campaign } with the fight on, or { ok: false, error }.
export function beginBoarding(campaign, rules, { forgiving = false, difficulty = 'normal', squad = null } = {}) {
  if (campaign.fight) return { ok: false, error: 'A fight is on already.' };
  const due = boardingDue(campaign, rules);
  if (!due) return { ok: false, error: 'No one is boarding.' };
  if (!campaign.crew.length) return { ok: false, error: 'There is no one aboard to fight.' };
  const ids = squad ?? defaultSquad(campaign.crew, rules);
  const why = squadProblem(campaign.crew, ids, rules);
  if (why) return { ok: false, error: why };
  const members = squadMembers(campaign.crew, ids);
  const unknown = members.find((member) => !rules.jobs.has(member.job));
  if (unknown) return { ok: false, error: `${unknown.name}'s job "${unknown.job}" is unknown.` };
  const map = mapFromShip(due.ship, rules, { wrecked: due.wrecked });
  if (!map) return { ok: false, error: 'There is no ship to fight on.' };
  // deploy puts its first list on the bridge and its second at the hatches.
  const jobs = members.map((member) => member.job);
  const placed = due.dir === 'you' ? deploy(map, jobs, due.party, rules) : deploy(map, due.party, jobs, rules);
  if (!placed.ok) return { ok: false, error: `There isn't room aboard for ${jobs.length} crew and ${due.party.length} of hers.` };
  const units = due.dir === 'you' ? placed.units : [...placed.units.slice(due.party.length), ...placed.units.slice(0, due.party.length)];
  const { value: seed, state: afterSeed } = int(campaign.rng, 0, MAX_SEED);
  const { salvage, rng } = salvageFor(campaign.run.approach, due, afterSeed, rules);
  const bonus = enemyBonus(difficulty, rules.balance);
  const fighters = units.map((unit, i) => {
    const member = members[i];
    return member ? { ...unit, ...crewUnit(member, rules) } : { ...unit, bonus };
  });
  const { battle, events } = createBattle({ map, units: fighters, seed, options: { forgiving, press: due.dir === 'you' } }, rules);
  const fight = { encounter: due.preset.party, seed, crew: members.map((member) => member.id), battle, log: events, job: null, raid: false, boarding: { dir: due.dir, salvage } };
  return { ok: true, campaign: { ...campaign, rng, place: 'fight', fight } };
}

// What winning the boarding pays, rolled: aboard her, her salvage (that
// many of her working parts, never corridors, none twice) and her scrap; at
// home, her scrap alone. Returns { salvage: { parts, credits }, rng }.
function salvageFor(approach, due, rng, rules) {
  let r = rng;
  const parts = [];
  if (due.dir === 'them') {
    let pool = approach.them.ship.modules.filter((module) => !(module.uid in approach.them.wrecked) && rules.modules.has(module.type) && !hasTag(rules.modules.get(module.type), 'corridor'));
    for (let n = 0; n < (due.preset.salvage ?? 0) && pool.length; n++) {
      const part = pick(r, pool);
      r = part.state;
      parts.push(part.value.type);
      pool = pool.filter((module) => module !== part.value);
    }
  }
  let credits = 0;
  if (due.preset.scrap) {
    const scrap = int(r, ...due.preset.scrap);
    r = scrap.state;
    credits = scrap.value;
  }
  return { salvage: { parts, credits }, rng: r };
}

// After a boarding fight with a winner, back to the run (campaign.js
// endFight: wounds, the fights counted) with what it came to (see the top
// of the file), the boarding counted in the flags (boardingsWon or
// boardingsLost), and the approach put away. Any other fight is left to
// endFight as it is.
export function endBoarding(campaign, rules) {
  const { fight } = campaign;
  const after = endFight(campaign, rules);
  if (after === campaign || !fight.boarding) return after;
  const won = fight.battle.winner === 'crew';
  const { dir, salvage } = fight.boarding;
  const parts = { ...after.parts };
  let { credits } = after;
  if (won) {
    for (const type of salvage.parts) parts[type] = (parts[type] ?? 0) + 1;
    credits += salvage.credits;
  } else if (dir === 'you') {
    const loss = raidLoss(campaign, rules);
    if (loss?.part) {
      parts[loss.part] -= 1;
      if (!parts[loss.part]) delete parts[loss.part];
    }
    credits -= loss?.credits ?? 0;
  }
  return {
    ...after,
    credits,
    parts,
    flags: tally(after.flags, { [won ? 'boardingsWon' : 'boardingsLost']: 1 }),
    run: { ...after.run, approach: null },
  };
}

// The wrecks the player's ship keeps after an approach: every one, except
// that with no reactor or no engine left working, the crew gets the first
// of them going again. Returns { wrecked, patched (uids) }.
export function juryRig(ship, wrecked, rules) {
  const kept = { ...wrecked };
  const patched = [];
  for (const tag of ['reactor', 'engine']) {
    const ofTag = ship.modules.filter((module) => rules.modules.has(module.type) && hasTag(rules.modules.get(module.type), tag));
    if (ofTag.length && ofTag.every((module) => module.uid in kept)) {
      delete kept[ofTag[0].uid];
      patched.push(ofTag[0].uid);
    }
  }
  return { wrecked: kept, patched };
}

// The wrecks that are on this ship: { [uid]: wreck } for its modules only.
export function wrecksOn(ship, wrecks = {}) {
  const uids = new Set(ship.modules.map((module) => module.uid));
  return Object.fromEntries(Object.entries(wrecks).filter(([uid]) => uids.has(Number(uid))));
}
