// The campaign's acts (data/campaign.json): where the campaign is in the
// story, and what its home offers. Act 1's home is the hangar, where the
// job board, the shop, payments on the debt and raids all are; once the
// ship has launched (launch.js), they stay behind. Pure; imports nothing,
// so every part of the sim can ask.

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
