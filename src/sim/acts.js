// The campaign's acts (data/campaign.json): where the campaign is in the
// story, and what its home offers. Act 1's home is the hangar, where the
// job board, the shop, payments on the debt and raids all are; once the
// ship has launched (launch.js), they stay behind. Act 2's is the ship, on
// the run (travel.js), where stations sell supplies, repair, patch, sign on
// crew and see to refits, and shipyards (M37b, yards.js) sell parts and see
// to refits too. Act 3's is the colony on the world settled
// (colony.js), where the ship's parts become buildings. Pure; imports
// nothing, so every part of the sim can ask.

// The act's entry in data/campaign.json: { act, name, hub, home, heals },
// and liftOff where leaving the act means lifting off a planet. Null for an
// act the content doesn't have.
export function actOf(campaign, rules) {
  return rules.acts.get(campaign.act) ?? null;
}

// True when the campaign is at home and its home is the hangar (act 1).
export function atHangar(campaign, rules) {
  return campaign.place === 'hub' && actOf(campaign, rules)?.hub === 'hangar';
}

// True when the ship is at a station on the run (act 2, whose home is the
// ship), with no fight on.
export function atStation(campaign, rules) {
  const { run } = campaign;
  return campaign.place === 'hub' && actOf(campaign, rules)?.hub === 'ship' && run?.sector.nodes[run.at]?.type === 'station';
}

// True when the ship is at a shipyard on the run (M37b), with no fight on.
export function atYard(campaign, rules) {
  const { run } = campaign;
  return campaign.place === 'hub' && actOf(campaign, rules)?.hub === 'ship' && run?.sector.nodes[run.at]?.type === 'shipyard';
}

// True when the ship is at a station or a shipyard on the run: where a
// refit can be made, and a ship a flight check fails is kept.
export function atPort(campaign, rules) {
  return atStation(campaign, rules) || atYard(campaign, rules);
}

// True when the campaign is at home at its colony (act 3), with no fight on.
export function atColony(campaign, rules) {
  return campaign.place === 'hub' && actOf(campaign, rules)?.hub === 'colony' && Boolean(campaign.colony);
}
