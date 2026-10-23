// What a won boarding strips off her (M46): the parts the crew picks from
// her working ones, never corridors and never wrecked, as many as her
// preset's salvage. A boarding fight keeps them in fight.boarding.salvage
// from the start (encounter.js, expeditions.js):
//   pool   the types of her working parts, the dearest first, ties in
//          her order: what the end panel offers
//   parts  the dearest of them, as many as she gives: the picks Continue
//          takes when the player changes none
// A save from before M46 had its parts rolled; its pool is those parts
// (save.js), so it offers what it had rolled.
// And her scrap, scaled by how much of her still works: the volleys broke
// the rest.
import { hasTag } from './modules.js';

// The types of her working parts, the dearest first.
export function salvagePool(ship, wrecked, rules) {
  const working = ship.modules.filter((module) => !(module.uid in wrecked) && rules.modules.has(module.type) && !hasTag(rules.modules.get(module.type), 'corridor'));
  const cost = (type) => rules.modules.get(type).cost ?? 0;
  return working.map((module, i) => ({ type: module.type, i })).sort((a, b) => cost(b.type) - cost(a.type) || a.i - b.i).map((part) => part.type);
}

// The salvage a won boarding offers: { pool, parts }, parts being the
// first `count` of the pool.
export function salvageOffer(ship, wrecked, count, rules) {
  const pool = salvagePool(ship, wrecked, rules);
  return { pool, parts: pool.slice(0, Math.max(0, count)) };
}

// The parts the crew strips: `picks` where they are as many as the salvage
// gives at most, every one in her pool (a part twice only where she has
// two); otherwise the salvage's own (the dearest).
export function strippedParts(salvage, picks) {
  if (!Array.isArray(picks)) return [...salvage.parts];
  if (picks.length > salvage.parts.length) return [...salvage.parts];
  const left = [...(salvage.pool ?? salvage.parts)];
  for (const type of picks) {
    const at = left.indexOf(type);
    if (at < 0) return [...salvage.parts];
    left.splice(at, 1);
  }
  return [...picks];
}

// Her scrap, `credits` rolled from the preset, scaled by the share of her
// parts still working, rounded.
export function scrapLeft(credits, ship, wrecked) {
  const all = ship.modules.length;
  if (!all) return credits;
  const working = ship.modules.filter((module) => !(module.uid in wrecked)).length;
  return Math.round((credits * working) / all);
}
