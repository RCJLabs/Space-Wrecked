// Patching up the crew (ROADMAP §4.6): in act 2 wounds stay until M23's med
// bay, so a station patches the crew up for credits, patchPrice a hit point,
// and a station of a side its level's share of that, in whole credits
// (M33, standing.js). It heals a hit point at a time, to whoever has fewest
// left (then the lowest id), up to each one's most, as far as the credits
// go. Pure.
import { maxHp } from './campaign.js';
import { tally } from './flags.js';
import { costAt, mostFor, shareHere } from './standing.js';
import { hereOf, onTheRun } from './travel.js';

// What the station the ship is at would patch: { ok: true, heals: [{ id,
// name, from, to }] (what the credits cover), hp, cost, total (the price of
// healing everyone fully), price (a hit point's, before the share), share
// (of the price the station charges) }, or { ok: false, error, total? }.
export function patchPlan(campaign, rules) {
  if (!onTheRun(campaign, rules) || hereOf(campaign)?.type !== 'station') return { ok: false, error: 'The crew is patched up at stations.' };
  const hurt = campaign.crew.map((member) => ({ member, most: maxHp(member, rules) })).filter(({ member, most }) => member.hp < most);
  if (!hurt.length) return { ok: false, error: 'No one is hurt.' };
  const price = rules.balance.patchPrice;
  const share = shareHere(campaign, rules);
  const missing = hurt.reduce((sum, { member, most }) => sum + most - member.hp, 0);
  const total = costAt(missing, price, share);
  const covered = Math.min(missing, mostFor(campaign.credits, price, share));
  if (!covered) return { ok: false, error: `Patching a hit point costs ${costAt(1, price, share)} credits.`, total };
  const hp = new Map(hurt.map(({ member }) => [member.id, member.hp]));
  for (let n = 0; n < covered; n++) {
    const next = hurt.filter(({ member, most }) => hp.get(member.id) < most).sort((a, b) => hp.get(a.member.id) - hp.get(b.member.id) || a.member.id - b.member.id)[0];
    hp.set(next.member.id, hp.get(next.member.id) + 1);
  }
  const heals = hurt.filter(({ member }) => hp.get(member.id) > member.hp).map(({ member }) => ({ id: member.id, name: member.name, from: member.hp, to: hp.get(member.id) }));
  return { ok: true, heals, hp: covered, cost: costAt(covered, price, share), total, price, share };
}

// Patches up the crew at the station, as far as the credits go. Returns
// { ok: true, campaign, plan } or { ok: false, error }.
export function patchCrew(campaign, rules) {
  const plan = patchPlan(campaign, rules);
  if (!plan.ok) return plan;
  const to = new Map(plan.heals.map((heal) => [heal.id, heal.to]));
  const crew = campaign.crew.map((member) => (to.has(member.id) ? { ...member, hp: to.get(member.id) } : member));
  return { ok: true, plan, campaign: { ...campaign, crew, credits: campaign.credits - plan.cost, flags: tally(campaign.flags, { hpPatched: plan.hp }) } };
}
