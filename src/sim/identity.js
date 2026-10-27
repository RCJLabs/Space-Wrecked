// The ship's identity (M52): her name, the hull number painted by her bow,
// and the emblem she wears amidships, if any. They belong to the
// campaign's ship, not to a design: the blueprint codes leave them out.
// A new game rolls the name and number from its seed (the name from
// data/campaign.json shipNames) without moving the campaign's RNG; a save
// from before M52 has none until a screen wants them (withIdentity). Pure.
//
//   campaign.identity   { name, number, emblem, suits? } or null
//
// suits (M58) is what the crew's suits are painted: 'standard', their own
// slate, or 'ship', the ship's paint (SUITS). Absent is standard.
import { int, seedFrom } from '../core/rng.js';

export const MAX_NAME = 24;
export const SUITS = ['standard', 'ship'];
// The hull number's letters: none that reads as a digit.
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const NUMBER = /^[A-HJ-NP-Z]{2}-\d{3}$/;

// The identity a new ship is given: a name from the list and a number, both
// from the seed alone; no emblem.
export function rollIdentity(rules, seed) {
  let state = seedFrom(`ship:${seed}`);
  const draw = (min, max) => {
    const r = int(state, min, max);
    state = r.state;
    return r.value;
  };
  const names = rules.shipNames;
  const name = names[draw(0, names.length - 1)];
  const number = `${LETTERS[draw(0, LETTERS.length - 1)]}${LETTERS[draw(0, LETTERS.length - 1)]}-${String(draw(100, 999))}`;
  return { name, number, emblem: null, suits: 'standard' };
}

// The campaign with its identity rolled, if it has none yet (a save from
// before M52); as it is otherwise.
export function withIdentity(campaign, rules) {
  return campaign.identity ? campaign : { ...campaign, identity: rollIdentity(rules, campaign.seed) };
}

// A name as the player typed it, tidied: spaces trimmed and run together.
export function tidyName(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
}

// Why a name won't do, or null.
export function nameProblem(name) {
  const tidy = tidyName(name);
  if (!tidy) return 'Give the ship a name.';
  if (tidy.length > MAX_NAME) return `A ship's name is ${MAX_NAME} letters at most.`;
  return null;
}

// The ship renamed: { ok: true, campaign } or { ok: false, error }.
export function renameShip(campaign, name, rules) {
  const why = nameProblem(name);
  if (why) return { ok: false, error: why };
  const { identity } = withIdentity(campaign, rules);
  return { ok: true, campaign: { ...campaign, identity: { ...identity, name: tidyName(name) } } };
}

// The ship's emblem set (one of the emblems offered) or taken off (null):
// { ok: true, campaign } or { ok: false, error }.
export function setEmblem(campaign, emblem, rules) {
  if (emblem !== null && !rules.emblems.get(emblem)?.offered) return { ok: false, error: 'That emblem is not on offer.' };
  const { identity } = withIdentity(campaign, rules);
  return { ok: true, campaign: { ...campaign, identity: { ...identity, emblem } } };
}

// The crew's suits painted as SUITS names (M58): { ok: true, campaign } or
// { ok: false, error }.
export function setSuits(campaign, suits, rules) {
  if (!SUITS.includes(suits)) return { ok: false, error: 'Suits are standard or the ship\'s.' };
  const { identity } = withIdentity(campaign, rules);
  return { ok: true, campaign: { ...campaign, identity: { ...identity, suits } } };
}

// What the crew's suits are painted: 'standard' or 'ship'.
export function suitsOf(campaign) {
  return campaign?.identity?.suits ?? 'standard';
}

// True for a readable identity, or null (a save from before M52).
export function isIdentity(value) {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Object.keys(value).some((key) => !['name', 'number', 'emblem', 'suits'].includes(key))) return false;
  if (value.suits !== undefined && !SUITS.includes(value.suits)) return false;
  return nameProblem(value.name) === null && tidyName(value.name) === value.name && NUMBER.test(value.number) && (value.emblem === null || (typeof value.emblem === 'string' && /^[a-z][a-z0-9-]*$/.test(value.emblem)));
}

// What the player's ship wears on her hull: { number, emblem }, rolled
// for a save from before M52 as withIdentity does.
export function hullIdentity(campaign, rules) {
  const { number, emblem } = withIdentity(campaign, rules).identity;
  return { number, emblem };
}

// What a ship of a preset (data/ships.json) wears: her side's emblem, and
// no number. null for a ship of no side, or a side without an emblem.
export function presetIdentity(presetId, rules) {
  const side = rules.ships.get(presetId)?.side;
  const emblem = side ? rules.factions.sides.get(side)?.emblem : null;
  return emblem ? { number: null, emblem } : null;
}

// The player's ship's name, rolled for a save from before M52.
export function shipName(campaign, rules) {
  return withIdentity(campaign, rules).identity.name;
}
