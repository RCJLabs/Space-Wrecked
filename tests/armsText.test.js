// M37: the words for weapons wherever they show: the crew card's weapon
// rows and swaps (crewText.js, armsText.js), the shop's weapons and spares
// (shopText.js), a station's rack (sectorText.js), the fight's odds card,
// unit card, tile card and notices (hints.js, tileText.js, fight.js),
// events (eventText.js) and the chance a win leaves a weapon wherever a
// fight's stakes show.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBattle } from '../src/sim/battle.js';
import { newCampaign } from '../src/sim/campaign.js';
import { withBoard } from '../src/sim/contracts.js';
import { createFight, reduceFight } from '../src/sim/fight.js';
import { launch } from '../src/sim/launch.js';
import { shotOdds } from '../src/sim/odds.js';
import { rackAt } from '../src/sim/racks.js';
import { beginRun } from '../src/sim/travel.js';
import { tileText } from '../src/ui/battle/tileText.js';
import { aWeapon, carriedText, gearLine, rulesLine, sparesLine, weaponFacts } from '../src/ui/campaign/armsText.js';
import { crewCardText, crewSaid } from '../src/ui/campaign/crewText.js';
import { changesText, effectsText } from '../src/ui/campaign/eventText.js';
import { jobText } from '../src/ui/campaign/jobText.js';
import { sectorText } from '../src/ui/campaign/sectorText.js';
import { shopText } from '../src/ui/campaign/shopText.js';
import { oddsText, unitText } from '../src/ui/fight/hints.js';
import { openMap, rules } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const fresh = (extra = {}) => ({ ...withBoard(newCampaign(rules, 7), rules), ...extra });
const memberOf = (campaign, job) => campaign.crew.find((member) => member.job === job);
const fight = (map, units) => createBattle({ map, units, seed: 7 }, rules).battle;
const who = (battle, id) => battle.units.find((u) => u.id === id);
const atStation = (extra = {}) => {
  const run = beginRun(launch(readyToLaunch(), rules).campaign, rules).campaign;
  const station = run.run.sector.nodes.find((node) => node.type === 'station');
  return { ...run, ...extra, run: { ...run.run, at: station.id, seen: [...new Set([...run.run.seen, station.id])] } };
};

test("a weapon in words: its name in a sentence, its kind, numbers and aim, and what its rules do", () => {
  assert.equal(aWeapon('autogun', rules), 'an autogun');
  assert.equal(aWeapon('sawnoff', rules), 'a sawn-off');
  assert.deepEqual(weaponFacts('rifle', rules), ['Long gun · damage 3–5, +2 on a crit · 4 shots', 'Aim +0 close, +10 mid, +0 long · crit 10%']);
  assert.deepEqual(weaponFacts('rivetgun', rules).at(-1), 'Pierces 1 armor.');
  assert.equal(rulesLine(rules.weapons.get('machinepistol')), 'Fires bursts of 2, each −10 to hit.');
  assert.equal(rulesLine(rules.weapons.get('baton')), 'Reaches 1 tile. A hit stuns: the target loses its next turn.');
  assert.equal(rulesLine(rules.weapons.get('torch')), 'Reaches 2 tiles. A hit sets the tile burning for 3 rounds.');
  assert.equal(rulesLine(rules.weapons.get('rifle')), '');
  assert.equal(gearLine(rules), `Win: ${rules.balance.gearChance}% to pick up one of their weapons.`);
  assert.equal(gearLine({ ...rules, balance: { ...rules.balance, gearChance: 0 } }), null);
});

test('the crew card: what each carries, the spares on hand, a swap only of the kinds their job carries, and what the first tap says', () => {
  const campaign = fresh({ arms: { riotgun: 1, machinepistol: 2 } });
  const card = crewCardText(campaign, rules);
  assert.equal(card.title, `Crew · ${campaign.crew.length} in the hangar`);
  assert.match(card.text, /On hand: a riot gun and 2 machine pistols\.$/);
  const marine = card.members.find((m) => m.id === memberOf(campaign, 'marine').id);
  const medic = card.members.find((m) => m.id === memberOf(campaign, 'medic').id);
  assert.equal(marine.weapon.line, 'Rifle · long gun · damage 3–5, +2 on a crit · 4 shots');
  assert.deepEqual(marine.weapon.swaps.map((s) => s.label), ['Machine pistol', 'Riot gun']);
  assert.deepEqual(medic.weapon.swaps.map((s) => s.label), ['Machine pistol'], 'a medic carries sidearms only');
  const key = `arm:${marine.id}:riotgun`;
  const said = crewSaid(card, key);
  assert.equal(said.tone, 'warn');
  assert.match(said.text, /^Give .+ the riot gun: heavy weapon · damage 5–7, \+2 on a crit · 2 shots\. The rifle goes on hand\. Tap again to swap\.$/);
  assert.equal(crewSaid(card, 'arm:99:riotgun'), null);
  assert.match(card.hint.text, /^Tap a spare weapon under someone to see what it does, and again to swap\. Tap Done for the hangar\.$/);
  // Nothing spare: no swaps, and the card says so.
  const bare = crewCardText(fresh(), rules);
  assert.ok(bare.members.every((m) => m.weapon.swaps.length === 0));
  assert.match(bare.text, /No spare weapons on hand\.$/);
  assert.deepEqual(carriedText(campaign, rules, memberOf(campaign, 'marine'), { swaps: false }).swaps, []);
});

test("the shop's weapons, after its parts, with who could carry them; spares on hand to sell back at half", () => {
  const campaign = fresh({ credits: 500, arms: { baton: 1 } });
  const text = shopText(campaign, rules);
  const weapons = text.stock.filter((item) => item.weapon);
  assert.equal(weapons.length, rules.districts.get('tailings').shop.armsSize);
  assert.ok(text.stock.findIndex((item) => item.weapon) >= text.stock.filter((item) => item.part).length, 'the parts first');
  for (const item of weapons) {
    assert.equal(item.key, `w:${item.weapon}`);
    assert.deepEqual(item.facts, weaponFacts(item.weapon, rules));
    assert.equal(campaign.shop[item.index].weapon, item.weapon);
    assert.match(item.carried, /could carry it\.$|^No one aboard carries/);
  }
  const spare = text.held.find((item) => item.weapon === 'baton');
  assert.deepEqual([spare.key, spare.count, spare.price, spare.ok], ['w:baton', 1, '20 credits', true]);
  assert.equal(spare.action, 'Sell · 20');
});

test("a station's rack: its weapons, two taps each, what the first says, and gone once bought", () => {
  const campaign = atStation({ credits: 500 });
  const rack = rackAt(campaign, rules, campaign.run.at);
  const text = sectorText(campaign, rules).rack;
  assert.equal(text.items.length, rack.length);
  assert.match(text.line, /^Weapons rack: /);
  const [first] = text.items;
  assert.equal(first.key, `rack:${rack[0].slot}`);
  assert.equal(first.label, `${rules.weapons.get(rack[0].weapon).name} · ${rack[0].price}`);
  assert.equal(first.ask, `Buy for ${rack[0].price}?`);
  assert.match(first.text, /It goes on hand, to swap in on the crew card\..* Tap again to buy\.$/);
  const broke = sectorText({ ...campaign, credits: 0 }, rules).rack.items[0];
  assert.equal(broke.ok, false);
  assert.match(broke.why, /credits\.$/);
  const bought = { ...campaign, run: { ...campaign.run, racked: rack.map((item) => ({ node: campaign.run.at, slot: item.slot })) } };
  assert.equal(sectorText(bought, rules).rack, null, 'all bought: no rack');
});

test('the odds card: a burst is each shot at the odds shown, the armor pierced, and a stun or fire said', () => {
  const battle = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0, weapon: 'autogun' }, { kind: 'mp', x: 3, y: 0 }]);
  const [shooter, target] = [who(battle, 'c1'), who(battle, 'e1')];
  const burst = oddsText(shooter, target, shotOdds(battle, shooter, target, rules), rules);
  assert.ok(burst.rows.some(([label, value]) => label === 'Burst of 2, each shot' && value === '−15'));
  assert.match(burst.note, /^2 shots, each at \d+%, till it drops\.$/);
  assert.equal(burst.rules, null);
  const railed = { ...shooter, weapon: 'railrifle' };
  assert.match(oddsText(railed, target, shotOdds(battle, railed, target, rules), rules).damage, /less 0 armor \(1 of 1 pierced\)$/);
  const torched = { ...shooter, weapon: 'torch', x: 2 };
  assert.equal(oddsText(torched, target, shotOdds(battle, torched, target, rules), rules).rules, 'A hit sets its tile burning for 3 rounds.');
  const batoned = { ...shooter, weapon: 'baton', x: 2 };
  assert.equal(oddsText(batoned, target, shotOdds(battle, batoned, target, rules), rules).rules, 'A hit stuns: it loses its next turn.');
});

test("a unit's card says what its weapon's rules do and the fire it stands in; a tile's card says it burns", () => {
  const battle = { ...fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0, weapon: 'torch' }, { kind: 'pirate', x: 3, y: 0 }]), fires: [{ at: [3, 0], until: 4 }] };
  assert.match(unitText(who(battle, 'c1'), rules, battle).lines[2], /^Cutting torch: .* Reaches 2 tiles\. A hit sets the tile burning for 3 rounds\.$/);
  assert.match(unitText(who(battle, 'e1'), rules, battle).lines.at(-1), /^Standing in fire: 2 at the start of each of its turns/);
  assert.ok(!unitText(who(battle, 'c1'), rules, battle).lines.some((line) => line.startsWith('Standing in fire')));
  assert.match(tileText(battle.map, 3, 0, rules, [], battle.fires).lines.at(-1), /^Burning through round 4: 2 to anyone/);
  assert.ok(!tileText(battle.map, 2, 0, rules, [], battle.fires).lines.some((line) => line.startsWith('Burning')));
});

test('a tap on an enemy in sight but past the weapon\'s reach says so, and so does Next with no one in reach', () => {
  const battle = fight(openMap(6, 1), [{ kind: 'marine', x: 0, y: 0, weapon: 'baton' }, { kind: 'pirate', x: 3, y: 0 }]);
  const selected = reduceFight(createFight(battle, rules), { type: 'fight/select', unit: 'c1' }, rules);
  const aimed = reduceFight(selected, { type: 'fight/aim', target: 'e1' }, rules);
  assert.equal(aimed.preview, null);
  assert.equal(aimed.notice.text, `Pirate e1 is out of reach: the shock baton reaches 1 tile. Move ${who(battle, 'c1').name} closer.`);
  assert.equal(reduceFight(selected, { type: 'fight/aim' }, rules).notice.text, "No one in sight is within 1 tile, the shock baton's reach.");
  // Within reach, the shot shows.
  const close = fight(openMap(6, 1), [{ kind: 'marine', x: 2, y: 0, weapon: 'baton' }, { kind: 'pirate', x: 3, y: 0 }]);
  assert.equal(reduceFight(reduceFight(createFight(close, rules), { type: 'fight/select', unit: 'c1' }, rules), { type: 'fight/aim', target: 'e1' }, rules).preview?.type, 'shoot');
});

test('an event can give a weapon: the odds and what came of it say which', () => {
  const campaign = fresh();
  assert.equal(effectsText({ arms: 'sawnoff', credits: -40 }, campaign, rules), '−40 credits, a sawn-off');
  const changes = { credits: 0, supplies: 0, materials: 0, heat: 0, parts: ['cargo'], arms: ['autogun'], sold: [], wounds: [], standing: [] };
  assert.match(changesText(changes, campaign, rules), /^Found: a Cargo hold, an autogun\.$|^Found: an? [A-Z].*, an autogun\.$/);
});

test("the chance a win leaves a weapon shows on a job's card", () => {
  const campaign = fresh();
  assert.equal(jobText(campaign.board[0], rules, [], campaign).gear, gearLine(rules));
});
