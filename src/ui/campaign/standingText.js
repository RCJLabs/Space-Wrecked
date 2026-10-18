// Words for standing with the sides (src/sim/standing.js, M33): each side
// and its level on the homes' panels, with how far it is to the next; a
// change where it happens (a job's end, an event's result, an approach's
// end), with the level it leaves; whom a job is for and against, and what
// its client's side adds to the pay; a station's side and what it charges,
// and at one of the pursuer's side what trading there adds (M33's fix); and
// a side's patrol's words. Pure: rules are the content tables
// (src/sim/defs.js).
import { palette, sideColors } from '../../render/palette.js';
import { withHeat } from '../../sim/heat.js';
import { dockHeat, jobMoves, jobSides, levelOf, moveStanding, nextLevel, payBonus, priceShare, pursuerSide, stationSide, standingWith } from '../../sim/standing.js';

export const LEVEL_NAMES = { hostile: 'Hostile', cold: 'Cold', neutral: 'Neutral', friendly: 'Friendly', trusted: 'Trusted' };

// A side's name mid-sentence ("the union"), or its id for one the content
// no longer has.
export function sideCalled(side, rules) {
  return rules.factions.sides.get(side)?.name ?? side;
}

// A side's name to start a line: "The union".
export function sideName(side, rules) {
  return capital(sideCalled(side, rules));
}

// A side's color, from src/render/palette.js.
export function sideColor(side, rules) {
  return sideColors[rules.factions.sides.get(side)?.color] ?? palette.ink;
}

// A side's name with its verb: "the union is", "the Hallorans are".
export function sideIs(side, rules) {
  return sideDoes(side, rules, 'is', 'are');
}

// A side's name with a verb, by whether the name is a plural: "Con-Reg
// logs", "the Hallorans log".
function sideDoes(side, rules, one, many) {
  const name = sideCalled(side, rules);
  return `${name} ${name.endsWith('s') ? many : one}`;
}

// "hostile, −10": a standing's level and number.
export function levelSaid(value, rules) {
  return `${LEVEL_NAMES[levelOf(value, rules)].toLowerCase()}, ${signed(value)}`;
}

// The sides for a home's panel, in the data's order: [{ side, name, color,
// level, label ("Hostile −10"), next ("5 to cold", or "The most there is"),
// line (all of it, for a screen reader) }].
export function sidesText(campaign, rules) {
  return [...rules.factions.sides.values()].map(({ id, name, blurb }) => {
    const value = standingWith(campaign, id);
    const level = levelOf(value, rules);
    const up = nextLevel(value, rules);
    const next = up ? `${up.by} to ${up.level}` : 'The most there is';
    return {
      side: id,
      name: capital(name),
      color: sideColor(id, rules),
      level,
      label: `${LEVEL_NAMES[level]} ${signed(value)}`,
      next,
      line: `${capital(name)}: ${LEVEL_NAMES[level].toLowerCase()}, ${signed(value)}. ${up ? `${up.by} more to ${up.level}.` : 'Trusted, the most there is.'} ${blurb}`,
    };
  });
}

// Standing moved (standing.js moveStanding's changes), a line each, with the
// level it leaves: "The union +2: now friendly, 2.", "Con-Reg −1: still
// hostile, −10, as low as it goes."
export function changeLines(changes, rules) {
  return (changes ?? []).map(({ side, by, from, to }) => {
    const name = sideName(side, rules);
    if (to === from) return `${name} ${signed(by)}: still ${levelSaid(to, rules)}, as ${by < 0 ? 'low' : 'high'} as it goes.`;
    const moved = levelOf(to, rules) !== levelOf(from, rules);
    return `${name} ${signed(to - from)}: ${moved ? 'now ' : ''}${levelSaid(to, rules)}.`;
  });
}

// Whom a job is for and against, and what it moves: "For the union
// (friendly): +2 done. Against Con-Reg (hostile): −2 done or lost." Without
// a campaign (tools/jobs.js), the sides without their levels. Null for a job
// of no side.
export function jobSidesText(job, campaign, rules) {
  const sides = jobSides(job, rules);
  const { jobStanding, lostStanding } = rules.balance;
  const at = (side) => (campaign ? `${sideCalled(side, rules)} (${LEVEL_NAMES[levelOf(standingWith(campaign, side), rules)].toLowerCase()})` : sideCalled(side, rules));
  const lines = [];
  if (sides.for) lines.push(`For ${at(sides.for)}: +${jobStanding} done.`);
  if (sides.against) lines.push(`Against ${at(sides.against)}: −${jobStanding} done${lostStanding === jobStanding ? ' or lost' : `, −${lostStanding} lost`}.`);
  return lines.length ? lines.join(' ') : null;
}

// What a job's client's side adds to the pay: "+10%: the union is
// friendly", or null (and null without a campaign).
export function bonusText(job, campaign, rules) {
  const bonus = campaign ? payBonus(campaign, rules, job) : 0;
  if (!bonus) return null;
  const side = jobSides(job, rules).for;
  return `+${bonus}%: ${sideIs(side, rules)} ${LEVEL_NAMES[levelOf(standingWith(campaign, side), rules)].toLowerCase()}`;
}

// What a job's end moves, as its lines (changeLines), done or lost; for the
// fight's end panel, before the crew goes home.
export function jobEndLines(campaign, rules, job, won) {
  return changeLines(moveStanding(campaign, rules, jobMoves(job, rules, won)).changes, rules);
}

// A station's or a shipyard's (M37b) side and what it charges the crew: {
// side, name, color, line ("The union's station: friendly, prices 90%.",
// "The union's yard: ..."), tone (good under full prices, warn over them),
// dock }, or null for nobody's. dock, at one of the pursuer's side where
// the ship is (M33's fix), what trading there adds until the crew has, then
// that it is paid: { line, tone }; null anywhere else.
export function stationText(node, campaign, rules) {
  const side = stationSide(node, rules);
  if (!side) return null;
  const share = priceShare(campaign, rules, node);
  const level = LEVEL_NAMES[levelOf(standingWith(campaign, side), rules)].toLowerCase();
  const prices = share === 100 ? 'full prices' : `prices ${share}%`;
  const tone = share < 100 ? 'good' : share > 100 ? 'warn' : 'info';
  const heat = campaign.run?.at === node.id ? dockHeat(campaign, rules, node) : 0;
  const dock = !heat
    ? null
    : campaign.run.docked
      ? { line: `${capital(sideDoes(side, rules, 'has', 'have'))} logged the ship: trading on here adds no more heat.`, tone: 'info' }
      : { line: `${capital(sideIs(side, rules))} after you: trade here and they log the ship, heat +${heat}. Passing through costs nothing.`, tone: 'warn' };
  const kind = node.type === 'shipyard' ? 'yard' : 'station';
  return { side, name: sideName(side, rules), color: sideColor(side, rules), line: `${capital(possessive(sideCalled(side, rules)))} ${kind}: ${level}, ${prices}.`, tone, dock };
}

// What a trade at the station the ship is at adds (travel.js tradeHeat,
// M33's fix), for its two taps: " Con-Reg logs the ship: heat +10 to 32.",
// or '' when it adds nothing.
export function dockSaid(campaign, rules, dock) {
  if (!dock) return '';
  return ` ${capital(sideDoes(pursuerSide(campaign, rules), rules, 'logs', 'log'))} the ship: heat +${dock} to ${withHeat(campaign.heat, dock)}.`;
}

// A side's patrol's words, by how it greeted the crew ('waved' or 'fired'),
// or null.
export function patrolWords(approach, rules) {
  if (!approach?.patrol) return null;
  const side = rules.ships.get(approach.enemy.ship)?.side;
  return rules.factions.sides.get(side)?.patrol?.[approach.patrol] ?? null;
}

// "+2", "−10", "0".
export function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

function possessive(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
