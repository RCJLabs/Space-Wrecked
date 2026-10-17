// The events a sector's node (gen/sector.js) or a colony's place
// (expeditions.js) draws from (M36): those of its kind, a background's own
// only on its campaign, and never a quest's, which quests.js places. Fresh
// ones first: none drawn there already and none the campaign has met
// (events.js eventsMet), while the kind has any left. Pure.

// The ids of the events of `kind` a campaign of `background` can meet.
export function eventsOf(rules, kind, background) {
  return [...rules.events.values()].filter((event) => event.kind === kind && !event.quest && (!event.background || event.background === background)).map((event) => event.id);
}

// Of `ids`, those to draw from: none in `used` (drawn there already) and
// none in `met`; failing that, none in used; failing that, all of them.
export function freshest(ids, met, used = []) {
  const unused = ids.filter((id) => !used.includes(id));
  const fresh = unused.filter((id) => !met.includes(id));
  return fresh.length ? fresh : unused.length ? unused : ids;
}
