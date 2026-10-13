// The crew on the run (M23): recruits at stations (src/sim/recruits.js),
// the room aboard and the squad a boarding takes (crew.js), letting crew go,
// the med bay healing the wounded over jumps (medbay.js), and save v14.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSave, MIGRATIONS, parseSave } from '../src/core/save.js';
import { seedFrom } from '../src/core/rng.js';
import { campaignProblems, maxHp } from '../src/sim/campaign.js';
import { crewRoom, defaultSquad, squadProblem } from '../src/sim/crew.js';
import { beginBoarding, endBoarding, giveOrder } from '../src/sim/encounter.js';
import { launch } from '../src/sim/launch.js';
import { healRate } from '../src/sim/medbay.js';
import { dismissCrew, dismissPlan, hirePlan, hireRecruit, recruitOffer, recruitsAt } from '../src/sim/recruits.js';
import { initialState, reduce, saveData } from '../src/sim/root.js';
import { beginRun, jump, jumpPlan, leavePlan, leaveSector, linked, reach } from '../src/sim/travel.js';
import { withPart } from '../tools/startShip.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
// The run with the ship at the first station of its sector.
function atStation(extra = {}) {
  const fresh = onRun(extra);
  const station = fresh.run.sector.nodes.find((n) => n.type === 'station').id;
  return { ...fresh, run: { ...fresh.run, at: station, seen: [...fresh.run.seen, station] } };
}
// The crew with hit points set by job, the rest as they are.
const hurt = (campaign, hp) => ({ ...campaign, crew: campaign.crew.map((m) => (m.job in hp ? { ...m, hp: hp[m.job] } : m)) });
// A recruit signed on at the station: the campaign after it.
const hired = (campaign, slot = 0) => {
  const done = hireRecruit(campaign, rules, slot);
  assert.ok(done.ok, done.error);
  return done.campaign;
};

test('a station offers recruitOffer recruits, from the data, the same on every visit', () => {
  const campaign = atStation({ credits: 500 });
  const offer = recruitOffer(campaign, rules);
  assert.equal(offer.length, balance.recruitOffer);
  for (const recruit of offer) {
    const [first, last] = recruit.name.split(' ');
    assert.ok(rules.recruits.first.includes(first) && rules.recruits.last.includes(last), recruit.name);
    assert.ok(rules.jobs.has(recruit.job) && recruit.traits.length === 1 && rules.traits.has(recruit.traits[0]), JSON.stringify(recruit));
    assert.equal(recruit.hp, maxHp(recruit, rules), 'at full health');
  }
  assert.equal(new Set(offer.map((r) => r.name)).size, offer.length, 'no two alike');
  // The same station, the same recruits; another station, others; and the
  // campaign's RNG doesn't move.
  assert.deepEqual(recruitOffer({ ...campaign, rng: seedFrom(99) }, rules), offer);
  const other = campaign.run.sector.nodes.find((n) => n.type === 'station' && n.id !== campaign.run.at);
  assert.notDeepEqual(recruitsAt(campaign, rules, other.id).map((r) => r.name), offer.map((r) => r.name));
  // Away from a station, no one.
  assert.deepEqual(recruitOffer(onRun(), rules), []);
  // A name already aboard is rolled again.
  const twin = { ...campaign, crew: [...campaign.crew.slice(0, 2), { ...campaign.crew[2], name: offer[0].name }] };
  assert.ok(!recruitOffer(twin, rules).some((r) => r.name === offer[0].name));
});

test('signing on takes the fee and a free berth, and the rest of the offer stays as it was', () => {
  const campaign = atStation({ credits: 500 });
  assert.equal(crewRoom(campaign.ship, rules), 4, 'one quarters and one life support: room for 4');
  const [first, second] = recruitOffer(campaign, rules);
  const after = hired(campaign, first.slot);
  const member = after.crew.at(-1);
  assert.deepEqual(member, { id: 4, name: first.name, job: first.job, hp: first.hp, traits: first.traits });
  assert.equal(after.credits, 500 - balance.recruitFee);
  assert.equal(after.flags.recruitsHired, 1);
  assert.deepEqual(after.run.hired, [{ node: campaign.run.at, slot: first.slot }]);
  assert.deepEqual(recruitOffer(after, rules), [second], 'signed on, gone from the offer; the other unchanged');
  // The ship carries 4: no room for a fifth.
  assert.deepEqual(hirePlan(after, rules, second.slot), { ok: false, error: 'No room aboard: the berths and life support carry 4.' });
  // Short of the fee; away from a station; signed on already.
  assert.equal(hirePlan({ ...campaign, credits: balance.recruitFee - 1 }, rules, first.slot).error, `Signing on costs ${balance.recruitFee} credits.`);
  assert.equal(hirePlan(onRun({ credits: 500 }), rules, 0).error, 'Recruits sign on at stations.');
  assert.equal(hirePlan(after, rules, first.slot).error, 'No one is for hire there.');
  // More quarters and life support, more room.
  const roomier = { ...after, ship: withPart(withPart(after.ship, rules, 'quarters'), rules, 'lifesupport') };
  assert.equal(crewRoom(roomier.ship, rules), 8);
  assert.ok(hirePlan(roomier, rules, second.slot).ok);
});

test('crew are let go at stations, anyone but the captain', () => {
  const campaign = hired(atStation({ credits: 500 }));
  const recruit = campaign.crew.at(-1);
  const gone = dismissCrew(campaign, rules, recruit.id);
  assert.ok(gone.ok, gone.error);
  assert.deepEqual(gone.campaign.crew, campaign.crew.slice(0, -1));
  assert.equal(gone.campaign.flags.crewDismissed, 1);
  assert.equal(dismissPlan(campaign, rules, campaign.captain).error, 'The captain stays with the ship.');
  assert.equal(dismissPlan(campaign, rules, 99).error, 'No one aboard goes by that.');
  const away = { ...campaign, run: { ...campaign.run, at: campaign.run.sector.start } };
  assert.equal(dismissPlan(away, rules, recruit.id).error, 'Crew are let go at stations.');
});

test('the squad: the whole crew while it fits, else the healthiest squadSize, in the crew\'s order', () => {
  const crew = (hps) => hps.map((hp, i) => ({ id: i + 1, name: `C${i + 1}`, job: 'marine', hp, traits: [] }));
  assert.equal(balance.squadSize, 3);
  assert.deepEqual(defaultSquad(crew([2, 3, 4]), rules), [1, 2, 3], 'three: all of them, however hurt');
  assert.deepEqual(defaultSquad(crew([8, 2, 10, 5]), rules), [1, 3, 4], 'the most hit points first');
  assert.deepEqual(defaultSquad(crew([6, 6, 6, 6]), rules), [1, 2, 3], 'ties go by the crew\'s order');
  const four = crew([8, 2, 10, 5]);
  assert.equal(squadProblem(four, [1, 2, 3, 4], rules), 'A squad is 3 at most.');
  assert.equal(squadProblem(four, [], rules), 'Pick someone to go.');
  assert.equal(squadProblem(four, [1, 1], rules), 'Pick the squad from the crew aboard.');
  assert.equal(squadProblem(four, [9], rules), 'Pick the squad from the crew aboard.');
  assert.equal(squadProblem(four, [2], rules), null, 'one is a squad');
});

// A campaign at a cutter whose approach ended with her boarding the ship,
// the crew 4 strong: the last a recruit at full health, and the marine hurt.
function boardedWithFour() {
  const signed = hired(atStation({ credits: 500 }));
  const { sector } = signed.run;
  const to = linked(sector, signed.run.at).find((id) => sector.nodes[id].type !== 'station') ?? linked(sector, signed.run.at)[0];
  const nodes = sector.nodes.map(({ event, hostile, ...node }) => (node.id === to ? { ...node, type: 'hostile', hostile: { ship: 'cutter', seed: 1 } } : node));
  const met = jump({ ...signed, run: { ...signed.run, sector: { ...sector, nodes } } }, rules, to).campaign;
  for (let seed = 0; seed < 3000; seed++) {
    let at = { ...met, rng: seedFrom(seed) };
    while (!at.run.approach.outcome) at = giveOrder(at, rules, { kind: 'evade' }).campaign;
    if (at.run.approach.outcome.kind === 'boardedBy') return hurt(at, { marine: 2 });
  }
  throw new Error('No seed ends in boardedBy');
}

test('a boarding takes the squad picked, or the healthiest three; the rest sit it out as they are', () => {
  const campaign = boardedWithFour();
  assert.equal(campaign.crew.length, 4);
  const marine = campaign.crew.find((m) => m.job === 'marine');
  // No pick: the healthiest three, so the hurt marine stays aboard.
  const begun = beginBoarding(campaign, rules);
  assert.ok(begun.ok, begun.error);
  const { fight } = begun.campaign;
  assert.deepEqual(fight.crew, defaultSquad(campaign.crew, rules));
  assert.ok(!fight.crew.includes(marine.id));
  const units = fight.battle.units.filter((u) => u.side === 'crew');
  assert.deepEqual(units.map((u) => u.name), fight.crew.map((id) => campaign.crew.find((m) => m.id === id).name), 'the units are the squad, in its order');
  // The marine, left out, keeps their hit points whatever the fight does.
  const won = { ...begun.campaign, fight: { ...fight, battle: { ...fight.battle, winner: 'crew', units: fight.battle.units.map((u) => (u.side === 'crew' ? { ...u, hp: 1 } : u)) } } };
  const after = endBoarding(won, rules);
  assert.equal(after.crew.find((m) => m.id === marine.id).hp, 2);
  assert.ok(after.crew.filter((m) => m.id !== marine.id).every((m) => m.hp === 1));
  // A pick: the marine and one more go.
  const picked = beginBoarding(campaign, rules, { squad: [campaign.crew[3].id, marine.id] });
  assert.ok(picked.ok, picked.error);
  assert.deepEqual(picked.campaign.fight.crew, [marine.id, campaign.crew[3].id], 'in the crew\'s order');
  assert.equal(picked.campaign.fight.battle.units.filter((u) => u.side === 'crew').length, 2);
  // A squad too big, or of no one aboard, doesn't begin.
  assert.deepEqual(beginBoarding(campaign, rules, { squad: campaign.crew.map((m) => m.id) }), { ok: false, error: 'A squad is 3 at most.' });
  assert.equal(beginBoarding(campaign, rules, { squad: [42] }).ok, false);
  // Through the game: the action carries the squad.
  const state = { ...initialState(1), campaign, screen: 'approach' };
  const next = reduce(state, { type: 'campaign/boarding/begin', rules, squad: [marine.id] });
  assert.deepEqual(next.campaign.fight.crew, [marine.id]);
  assert.equal(next.screen, 'campaign-fight');
});

test('a working med bay heals each of the wounded a hit point a jump, two with a medic aboard', () => {
  const plain = hurt(onRun(), { marine: 2, engineer: 3, medic: 8 });
  assert.equal(healRate(plain, rules), 0, 'no med bay, no healing');
  const to = linked(plain.run.sector, plain.run.at)[0];
  assert.equal(jumpPlan(plain, rules, to).heal, 0);
  const withBay = { ...plain, ship: withPart(plain.ship, rules, 'medbay') };
  assert.equal(healRate(withBay, rules), 2, 'the med bay 1, the medic 1');
  const noMedic = { ...withBay, crew: withBay.crew.filter((m) => m.job !== 'medic'), captain: withBay.crew.find((m) => m.job !== 'medic').id };
  assert.equal(healRate(noMedic, rules), 1);
  // A jump: each of the wounded heals 2, up to their most.
  const plan = jumpPlan(withBay, rules, to);
  assert.equal(plan.heal, 2);
  const after = jump(withBay, rules, to).campaign;
  assert.deepEqual(after.crew.map((m) => m.hp), [4, 5, 8]);
  assert.equal(after.flags.hpHealed, 4);
  // A long jump counts longJumpFactor jumps.
  const far = [...reach(withBay.run.sector, withBay.run.at)].find(([, links]) => links === 2)?.[0];
  assert.notEqual(far, undefined, 'a long jump on from the way in');
  assert.equal(jumpPlan(withBay, rules, far).heal, 2 * balance.longJumpFactor);
  assert.deepEqual(jump(withBay, rules, far).campaign.crew.map((m) => m.hp), [8, 8, 8], 'capped at each one\'s most');
  // Hungry, the crew loses hungerHp first, then heals.
  const hungry = jump({ ...withBay, supplies: 0 }, rules, to).campaign;
  assert.deepEqual(hungry.crew.map((m) => m.hp), [Math.max(1, 2 - balance.hungerHp) + 2, Math.max(1, 3 - balance.hungerHp) + 2, 8]);
  // Wrecked, it heals nothing.
  const bay = withBay.ship.modules.find((m) => m.type === 'medbay').uid;
  assert.equal(healRate({ ...withBay, wrecks: { [bay]: 'fire' } }, rules), 0);
});

test('leaving a sector heals as a jump does', () => {
  let campaign = { ...hurt(onRun(), { marine: 2 }), supplies: 999 };
  campaign = { ...campaign, ship: withPart(campaign.ship, rules, 'medbay') };
  const exit = campaign.run.sector.exit;
  campaign = { ...campaign, run: { ...campaign.run, at: exit, seen: [...campaign.run.seen, exit] } };
  assert.equal(leavePlan(campaign, rules).heal, 2);
  const left = leaveSector(campaign, rules);
  assert.ok(left.ok, left.error);
  assert.equal(left.campaign.crew.find((m) => m.job === 'marine').hp, 4);
  assert.deepEqual(left.campaign.run.hired, [], 'a new sector, no one signed on in it yet');
});

test('through the game: hiring and letting go, and save v14 with its migration', () => {
  const campaign = atStation({ credits: 500 });
  const state = { ...initialState(1), campaign, screen: 'sector' };
  const signed = reduce(state, { type: 'campaign/hire', rules, slot: recruitOffer(campaign, rules)[0].slot });
  assert.equal(signed.campaign.crew.length, 4);
  assert.equal(signed.screen, 'sector');
  const letGo = reduce(signed, { type: 'campaign/dismiss', rules, id: 4 });
  assert.equal(letGo.campaign.crew.length, 3);
  assert.equal(reduce(letGo, { type: 'campaign/dismiss', rules, id: campaign.captain }), letGo, 'the captain stays');
  // The save holds who signed on, and reads back.
  const back = parseSave(JSON.stringify(makeSave(saveData(signed))));
  assert.ok(back.ok, back.error);
  assert.deepEqual(back.save.data.campaign, signed.campaign);
  // A v13 run has no one signed on; a hire at a node never reached is caught.
  const up = MIGRATIONS.find((m) => m.from === 13).up;
  const { hired: _, ...v13run } = signed.campaign.run;
  assert.deepEqual(up({ campaign: { ...signed.campaign, run: v13run } }).campaign.run.hired, []);
  assert.deepEqual(up({ campaign: { ...signed.campaign, run: null } }).campaign.run, null);
  const stray = { ...signed.campaign, run: { ...signed.campaign.run, hired: [{ node: campaign.run.sector.exit, slot: 0 }] } };
  assert.deepEqual(campaignProblems(stray), ["The campaign's run has unreadable recruits."]);
  const twice = { ...signed.campaign, run: { ...signed.campaign.run, hired: [...signed.campaign.run.hired, ...signed.campaign.run.hired] } };
  assert.deepEqual(campaignProblems(twice), ["The campaign's run has unreadable recruits."]);
});
