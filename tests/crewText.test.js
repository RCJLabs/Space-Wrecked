// The crew's words on the run (M23): the crew card, the crew panel's
// heading, what a first tap says, the squad picker, and the sector map's
// med bay row and healing line.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../src/sim/launch.js';
import { hireRecruit, recruitOffer } from '../src/sim/recruits.js';
import { beginRun, linked } from '../src/sim/travel.js';
import { jobBrief, rankLine } from '../src/ui/campaign/crewJobText.js';
import { crewCardText, crewHeading, crewSaid, squadText } from '../src/ui/campaign/crewText.js';
import { crewText as crewRowsText } from '../src/ui/campaign/hubText.js';
import { jumpText, sectorText } from '../src/ui/campaign/sectorText.js';
import { withPart } from '../tools/startShip.js';
import { rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const { balance } = rules;
const onRun = (extra = {}) => beginRun(launch(readyToLaunch(extra), rules).campaign, rules).campaign;
function atStation(extra = {}) {
  const fresh = onRun(extra);
  const station = fresh.run.sector.nodes.find((n) => n.type === 'station').id;
  return { ...fresh, run: { ...fresh.run, at: station, seen: [...fresh.run.seen, station] } };
}
const hurt = (campaign, hp) => ({ ...campaign, crew: campaign.crew.map((m) => (m.job in hp ? { ...m, hp: hp[m.job] } : m)) });
const withBay = (campaign) => ({ ...campaign, ship: withPart(campaign.ship, rules, 'medbay') });

test('the crew card away from a station: who is aboard, the room and the med bay, and no one to hire or let go', () => {
  const campaign = onRun({ credits: 500 });
  const card = crewCardText(campaign, rules);
  assert.equal(card.title, 'Crew · 3 aboard, room for 4');
  assert.equal(card.text, 'The berths and life support carry 4. With no med bay aboard, wounds heal only when a station patches the crew. Crew sign on and are let go at stations.');
  const [a, b, c] = campaign.crew.map((m) => m.name);
  assert.deepEqual(
    card.members.map(({ name, about, hp, max, dismiss }) => [name, about, hp, max, dismiss]),
    [[a, 'Captain · Marine', 10, 10, null], [b, 'Engineer', 8, 8, null], [c, 'Medic', 8, 8, null]],
    'the captain marked',
  );
  // Crew from before names (M23c) go by their jobs: the job isn't said twice.
  const old = { ...campaign, crew: campaign.crew.map((m) => ({ ...m, name: rules.jobs.get(m.job).name })) };
  assert.deepEqual(crewCardText(old, rules).members.map((m) => m.about), ['Captain', '', '']);
  assert.equal(card.hire, null);
  assert.equal(card.hint.text, 'Crew sign on and are let go at stations. Tap Done for the chart.');
  assert.deepEqual(crewHeading(onRun(), rules), { text: 'Crew', hire: false });
});

test('at a station: the recruits for hire with their fee and what they eat, and anyone but the captain let go', () => {
  const campaign = atStation({ credits: 500 });
  const card = crewCardText(campaign, rules);
  const offer = recruitOffer(campaign, rules);
  const station = campaign.run.sector.nodes[campaign.run.at].name;
  assert.equal(card.hire.title, `For hire at ${station}`);
  assert.equal(card.hire.line, null);
  assert.equal(card.hire.recruits.length, balance.recruitOffer);
  const [first] = card.hire.recruits;
  const { fee } = offer[0];
  const past = rules.recruits.backgrounds.get(offer[0].background);
  assert.deepEqual([first.key, first.name, first.about, first.ok, first.label, first.ask], ['hire:0', offer[0].name, `${rules.jobs.get(offer[0].job).name} · ${past.name}`, true, `Sign on · ${fee}`, `Sign on for ${fee}?`]);
  assert.deepEqual([first.past, first.rankLine], [past.text, rankLine(offer[0], rules, true)]);
  // Each recruit's traits and what they do; one with none says nothing.
  card.hire.recruits.forEach((recruit, i) => {
    if (offer[i].traits.length) assert.match(recruit.traits, /^[A-Z][a-z ]+: [a-z ]+ [+−]\d+/, 'a trait and what it does');
    else assert.equal(recruit.traits, '');
  });
  assert.ok(offer.some((r) => r.traits.length), 'one of them with a trait');
  const eats = 4 * balance.jumpSupplies;
  assert.equal(first.text, `Sign ${first.name} on for ${fee} credits. A crew of 4 eats ${eats} supplies a jump, and full holds last ${Math.floor(balance.baseSupplies / eats)} jumps. Tap again to sign on.`);
  assert.deepEqual(card.members.map((m) => m.dismiss?.key ?? null), [null, 'let:2', 'let:3'], 'the captain stays');
  assert.equal(card.members[1].dismiss.text, `Let ${campaign.crew[1].name} go here, with nothing paid back: a crew of 2. Tap again to let them go.`);
  assert.deepEqual(crewHeading(campaign, rules), { text: `Crew · ${balance.recruitOffer} for hire`, hire: true });
  assert.equal(card.hint.text, 'Tap Sign on to see what a recruit takes, and again to sign them on.');
  // What a first tap says in the foot, and nothing for any other key.
  assert.deepEqual(crewSaid(card, 'hire:0'), { tone: 'warn', text: first.text });
  assert.deepEqual(crewSaid(card, 'let:3'), { tone: 'warn', text: card.members[2].dismiss.text });
  assert.equal(crewSaid(card, 'let:1'), null);
  assert.equal(crewSaid(card, 'on'), null);
  assert.equal(crewSaid(null, 'hire:0'), null);
});

test('a full ship or short credits: the recruits say why, and the panel stops offering them', () => {
  const campaign = atStation({ credits: 500 });
  const full = hireRecruit(campaign, rules, 0).campaign;
  const card = crewCardText(full, rules);
  assert.equal(card.title, 'Crew · 4 aboard, room for 4');
  assert.equal(card.hire.recruits.length, balance.recruitOffer - 1, 'the one signed on is gone from the offer');
  assert.equal(card.hire.line, 'No room aboard: the berths and life support carry 4.');
  assert.ok(card.hire.recruits.every((r) => !r.ok));
  assert.equal(crewSaid(card, 'hire:1'), null, 'a recruit who can\'t sign on says nothing on a tap');
  assert.deepEqual(crewHeading(full, rules), { text: 'Crew', hire: false });
  assert.equal(card.hint.text, 'Tap Let go to see what it leaves, and again to let them go.');
  const offer = recruitOffer(campaign, rules);
  assert.equal(crewCardText({ ...campaign, credits: Math.min(...offer.map((r) => r.fee)) - 1 }, rules).hire.line, `Signing on costs ${offer[0].fee} credits.`);
  // Everyone signed on: no one left.
  let all = { ...campaign, ship: withPart(withPart(campaign.ship, rules, 'quarters'), rules, 'lifesupport') };
  for (const recruit of recruitOffer(all, rules)) all = hireRecruit(all, rules, recruit.slot).campaign;
  assert.equal(crewCardText(all, rules).hire.line, 'No one else is for hire here.');
});

test('the map\'s hint at a station points to the recruits, once nothing more pressing is there', () => {
  const campaign = atStation({ credits: 500 });
  assert.equal(campaign.supplies, balance.baseSupplies, 'the holds full: nothing to buy');
  assert.deepEqual(sectorText(campaign, rules).hint, { tone: 'good', text: `${balance.recruitOffer} recruits want a berth here: tap Crew.` });
  const one = hireRecruit(campaign, rules, 0).campaign;
  assert.doesNotMatch(sectorText(one, rules).hint.text, /recruit/, 'no room left, no word of them');
  assert.match(sectorText(hurt(campaign, { marine: 3 }), rules).hint.text, /^Supplies and a medic here/, 'the medic first');
});

test('the crew card says what the med bay heals, and when it is wrecked', () => {
  const campaign = withBay(atStation());
  assert.match(crewCardText(campaign, rules).text, /The med bay heals each of the wounded 2 a jump\.$/);
  const bay = campaign.ship.modules.find((m) => m.type === 'medbay').uid;
  assert.match(crewCardText({ ...campaign, wrecks: { [bay]: 'fire' } }, rules).text, /The med bay is wrecked: it heals no one until a station repairs it\.$/);
});

test('the squad picker: shown only with more aboard than a squad takes; the healthiest unless picked', () => {
  assert.equal(squadText(onRun(), rules).show, false, 'three aboard: all go');
  // The captain, a marine, hurt; the recruit may be a marine too, and stays whole.
  const signed = hireRecruit(atStation({ credits: 500 }), rules, 0).campaign;
  const four = { ...signed, crew: signed.crew.map((m) => (m.id === signed.captain ? { ...m, hp: 2 } : m)) };
  const [marine, engineer, medic, recruit] = four.crew.map((m) => m.name);
  const text = squadText(four, rules);
  assert.equal(text.show, true);
  assert.equal(text.label, 'Squad · 3 of 4');
  assert.equal(text.title, `Who goes: up to ${balance.squadSize}`);
  assert.equal(text.line, `Going: ${engineer}, ${medic} and ${recruit}. ${marine} sits this one out: tap Squad to change who.`);
  assert.deepEqual(text.members.map((m) => m.going), [false, true, true, true], 'the hurt marine stays aboard');
  const picked = squadText(four, rules, [1, 4]);
  assert.equal(picked.label, 'Squad · 2 of 4');
  assert.equal(picked.line, `Going: ${marine} and ${recruit}. ${engineer} and ${medic} sit this one out: tap Squad to change who.`);
  assert.deepEqual(picked.members.map((m) => m.going), [true, false, false, true]);
});

test('the map: a working med bay in the holdings, and what it heals on a jump with anyone hurt', () => {
  const plain = onRun();
  assert.ok(!sectorText(plain, rules).hold.some(([label]) => label === 'Med bay'));
  const campaign = withBay(plain);
  assert.deepEqual(sectorText(campaign, rules).hold.find(([label]) => label === 'Med bay'), ['Med bay', '2 a jump']);
  const to = linked(campaign.run.sector, campaign.run.at)[0];
  const line = 'The med bay heals each of the wounded 2 on the way.';
  assert.ok(!jumpText(campaign, rules, to).lines.includes(line), 'no one hurt, nothing said');
  assert.ok(jumpText(hurt(campaign, { marine: 4 }), rules, to).lines.includes(line));
  const bay = campaign.ship.modules.find((m) => m.type === 'medbay').uid;
  assert.ok(!sectorText({ ...campaign, wrecks: { [bay]: 'fire' } }, rules).hold.some(([label]) => label === 'Med bay'), 'wrecked, it heals nothing');
});

test("ranks on the cards (M32b): each one's rank and fights, a recruit's background, rank and fee before signing on and their background after, and the squad's ranks", () => {
  const station = atStation({ credits: 500 });
  // A station offering a Fleet veteran, at rank 2.
  const seed = Array.from({ length: 200 }, (_, i) => i + 1).find((n) => recruitOffer({ ...station, seed: n }, rules).some((r) => r.background === 'fleet-veteran'));
  const campaign = { ...station, seed, crew: station.crew.map((m, i) => ({ ...m, fights: [4, 2, 9][i] })) };
  const card = crewCardText(campaign, rules);
  const [captain, second, third] = campaign.crew;
  assert.deepEqual(card.members.map((m) => m.rank), [1, 0, 2]);
  assert.equal(card.members[0].rankLine, `Rank 1, ${rules.jobs.get(captain.job).ranks[0].name} · 4 fights · rank 2 at 8`);
  assert.equal(card.members[1].rankLine, '2 fights · rank 1 at 3');
  assert.equal(card.members[2].rankLine, `Rank 2, ${rules.jobs.get(third.job).ranks[1].name} · 9 fights`);
  assert.equal(card.members[2].brief, jobBrief(third.job, rules, 2), 'what the job brings, at their rank');
  assert.notEqual(card.members[2].brief, jobBrief(third.job, rules), 'rank 2 sharpens it');
  assert.equal(card.members[1].past, undefined, 'the start crew have no background');
  const veteran = recruitOffer(campaign, rules).find((r) => r.background === 'fleet-veteran');
  const offered = card.hire.recruits.find((r) => r.slot === veteran.slot);
  const job = rules.jobs.get(veteran.job);
  assert.equal(offered.about, `${job.name} · Fleet veteran`);
  assert.equal(offered.past, rules.recruits.backgrounds.get('fleet-veteran').text);
  assert.deepEqual([offered.rank, offered.rankLine], [2, `Rank 2, ${job.ranks[1].name} · ${veteran.fights} fights stood`]);
  assert.equal(offered.label, `Sign on · ${veteran.fee}`);
  assert.equal(veteran.fee, 150, 'two traits at rank 2');
  // Signed on: their background stays with them on the card.
  const signed = hireRecruit({ ...campaign, credits: 500 }, rules, veteran.slot).campaign;
  const member = crewCardText(signed, rules).members.at(-1);
  assert.equal(member.about, `${job.name} · Fleet veteran`);
  assert.deepEqual([member.rank, member.rankLine], [2, `Rank 2, ${job.ranks[1].name} · ${veteran.fights} fights`]);
  // The squad card and the crew panels' rows carry each one's rank, for
  // its chevrons.
  assert.deepEqual(squadText(campaign, rules).members.map((m) => [m.about, m.rank]), campaign.crew.map((m, i) => [rules.jobs.get(m.job).name, [1, 0, 2][i]]));
  assert.deepEqual(crewRowsText(campaign, rules).map((row) => [row.job, row.rank]), campaign.crew.map((m, i) => [rules.jobs.get(m.job).name, [1, 0, 2][i]]));
});
