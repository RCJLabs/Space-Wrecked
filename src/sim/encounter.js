// Hostile ships on the run (ROADMAP §4.2): the approach phase (approach.js)
// as the campaign plays it. The ship meets one at a node with a hostile ship
// on it (gen/sector.js): arriving opens the approach, which holds every jump
// and scan until it is over. The other ship is generated from the node's
// preset and seed and saved whole; the player's ship comes in with its
// wrecks from earlier approaches (campaign.wrecks). Each order plays a round
// with the campaign's RNG, saved. When it ends:
//   - the player boarded the other ship: until M22's boarding fights, a
//     stand-in settles it. The crew strips one working part, by a roll, and
//     the preset's scrap, in credits. A ship that blew up leaves only the
//     scrap;
//   - the other ship boarded the player's: its crew takes what a lost raid
//     takes (raid.js raidLoss): the dearest part on hand, or half the
//     credits;
//   - if anyone fired, heat rises by approachHeat;
//   - the player's wrecks stay (campaign.wrecks) until a station repairs
//     them (repair.js), but the crew always gets one reactor and one engine
//     going again, so the ship can fly on;
//   - the node is settled (run.done), and the flags count it.
// The approach stays, with its outcome, until the player carries on.
//
// run.approach, while one is open:
//   node     the node it is at
//   enemy    { ship (the preset), name, crew }
//   them     the other ship's side: { ship, damage, wrecked }
//   you      the player's side: { damage, wrecked }; its ship is the
//            campaign's
//   round    the round to play next, 1 up
//   fired    whether a gun has fired yet
//   last     the round played last: { order, intent, events }, or null
//   outcome  null until it ends, then { kind, how?, changes }. changes:
//            { credits, parts (found), lost (a part or credits, or null),
//            heat, patched (uids got going again) }
import { int, pick } from '../core/rng.js';
import { enemyOrder, playRound } from './approach.js';
import { tally } from './flags.js';
import { generateShip } from './gen/ship.js';
import { withHeat } from './heat.js';
import { hasTag } from './modules.js';
import { raidLoss } from './raid.js';

// The approach as approach.js plays it: { you, them, round, tactics }, or
// null with none open.
export function approachState(campaign, rules) {
  const approach = campaign.run?.approach;
  if (!approach) return null;
  const tactics = rules.ships.get(approach.enemy.ship)?.tactics ?? { aim: [] };
  return { you: { ship: campaign.ship, ...approach.you }, them: approach.them, round: approach.round, tactics };
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
  const preset = rules.ships.get(node.hostile.ship);
  const made = preset?.tactics ? generateShip(rules, preset.id, node.hostile.seed) : null;
  if (!made?.ok) return campaign;
  const approach = {
    node: run.at,
    enemy: { ship: preset.id, name: preset.name, crew: made.crew },
    them: { ship: made.ship, damage: {}, wrecked: made.wrecked },
    you: { damage: {}, wrecked: wrecksOn(campaign.ship, campaign.wrecks) },
    round: 1,
    fired: false,
    last: null,
    outcome: null,
  };
  return { ...campaign, run: { ...run, approach } };
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

// Puts the approach away once it is over (Carry on). Returns { ok: true,
// campaign } or { ok: false, error }.
export function closeApproach(campaign) {
  const approach = campaign.run?.approach;
  if (!approach?.outcome) return { ok: false, error: approach ? 'The approach is still on.' : 'There is no ship to face.' };
  return { ok: true, campaign: { ...campaign, run: { ...campaign.run, approach: null } } };
}

// What the approach's end comes to (see the top of the file).
function settle(campaign, rules, outcome) {
  const { run } = campaign;
  const { approach } = run;
  const preset = rules.ships.get(approach.enemy.ship);
  let { rng, credits } = campaign;
  const parts = { ...campaign.parts };
  const changes = { credits: 0, parts: [], lost: null, heat: 0, patched: [] };
  if (outcome.kind === 'boarded') {
    const working = approach.them.ship.modules.filter((module) => !(module.uid in approach.them.wrecked) && rules.modules.has(module.type));
    if (working.length) {
      const part = pick(rng, working);
      rng = part.state;
      parts[part.value.type] = (parts[part.value.type] ?? 0) + 1;
      changes.parts.push(part.value.type);
    }
  }
  if ((outcome.kind === 'boarded' || outcome.kind === 'destroyed') && preset?.scrap) {
    const scrap = int(rng, ...preset.scrap);
    rng = scrap.state;
    changes.credits = scrap.value;
  }
  if (outcome.kind === 'boardedBy') {
    const loss = raidLoss(campaign, rules);
    changes.lost = loss;
    if (loss?.part) {
      parts[loss.part] -= 1;
      if (!parts[loss.part]) delete parts[loss.part];
    }
    if (loss?.credits) changes.credits = -loss.credits;
  }
  credits += changes.credits;
  const heat = approach.fired ? withHeat(campaign.heat, rules.balance.approachHeat) : campaign.heat;
  changes.heat = heat - campaign.heat;
  const kept = juryRig(campaign.ship, approach.you.wrecked, rules);
  changes.patched = kept.patched;
  const won = outcome.kind === 'boarded' || outcome.kind === 'destroyed' ? 1 : 0;
  return {
    ...campaign,
    rng,
    credits,
    parts,
    heat,
    wrecks: kept.wrecked,
    flags: tally(campaign.flags, { approaches: 1, approachesWon: won, approachesLost: outcome.kind === 'boardedBy' ? 1 : 0 }),
    run: { ...run, done: [...run.done, approach.node], approach: { ...approach, outcome: { ...outcome, changes } } },
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
