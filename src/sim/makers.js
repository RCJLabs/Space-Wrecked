// Manufacturers (M23g): each maker's version of a part is a part of its
// own, `bastion-engine` beside `engine`, on the same footprint with stats
// and a price of its own (data/modules.json `base`, filled in by defs.js).
// Where the game asks for a part rather than a part by its maker (act 1's
// goal, the shop's "needed" lines, the checklist's fixes), any maker's
// version will do.

// The part a definition is a version of: its base, or itself.
export function baseOf(def) {
  return def.base ?? def.id;
}

// Every maker's version of the part `type` is a version of, the base first
// and the rest in data order: [type]. An unknown type is its own.
export function versionsOf(defs, type) {
  const def = defs.modules.get(type);
  if (!def) return [type];
  return groupsOf(defs).get(baseOf(def));
}

// How many of a part there are, any maker's, counting each with count(type).
export function countOfAny(defs, type, count) {
  return versionsOf(defs, type).reduce((sum, version) => sum + (count(version) ?? 0), 0);
}

// The version of a part to fit from what there is: the first with one or
// more (the base first), else the part asked for. count(type) is how many
// of a type there are, or null when there are endless parts.
export function versionAtHand(defs, type, count) {
  if (!count) return type;
  return versionsOf(defs, type).find((version) => count(version) > 0) ?? type;
}

// Each base part's versions, kept for each part table.
const groups = new WeakMap();
function groupsOf(defs) {
  let group = groups.get(defs.modules);
  if (!group) {
    group = new Map();
    for (const def of defs.modules.values()) group.set(baseOf(def), [...(group.get(baseOf(def)) ?? []), def.id]);
    groups.set(defs.modules, group);
  }
  return group;
}
