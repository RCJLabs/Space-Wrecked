// The med bay (ROADMAP §4.5, M23): on the run, wounds heal over jumps. A
// working med bay (a part with heal in data/modules.json, not wrecked)
// heals each of the wounded its heal a jump, up to their most, and a crew
// member whose job has a station heal (the medic's, data/jobs.json) adds
// that: 1 a jump, 2 with a medic aboard. A long jump counts as many jumps
// as the supplies it eats (travel.js). The best med bay and the best
// station heal count; a second of either adds nothing. Pure.
import { maxHp } from './campaign.js';

// What the ship heals each of the wounded in a jump: 0 without a working
// med bay.
export function healRate(campaign, rules) {
  const wrecks = campaign.wrecks ?? {};
  const bays = campaign.ship.modules.map((module) => (String(module.uid) in wrecks ? 0 : rules.modules.get(module.type)?.heal ?? 0));
  const bay = Math.max(0, ...bays);
  return bay ? bay + stationHeal(campaign.crew, rules) : 0;
}

// What the crew's best station heal adds to a med bay's (a medic's,
// data/jobs.json), or 0: the colony's infirmary takes it too (days.js).
export function stationHeal(crew, rules) {
  return Math.max(0, ...crew.map((member) => rules.jobs.get(member.job)?.station?.heal ?? 0));
}

// The crew after hp healed each, up to each one's most: { crew, healed }
// (healed: the hit points healed in all).
export function healCrew(crew, hp, rules) {
  let healed = 0;
  const after = crew.map((member) => {
    const to = Math.min(maxHp(member, rules), member.hp + hp);
    if (to <= member.hp) return member;
    healed += to - member.hp;
    return { ...member, hp: to };
  });
  return { crew: healed ? after : crew, healed };
}
