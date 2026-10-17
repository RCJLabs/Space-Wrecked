// The companions' words (M33c): who they are where they offer to come
// aboard, the choice that takes a berth, who signed on, their crew card at
// sea and at the colony, the quests panel, the loyalty place and its win,
// and the third rank in a fight.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sideColors } from '../src/render/palette.js';
import { crewColor } from '../src/render/units.js';
import { createBattle } from '../src/sim/battle.js';
import { crewUnit } from '../src/sim/campaign.js';
import { aboard, joinCompanion } from '../src/sim/companions.js';
import { chooseEvent } from '../src/sim/events.js';
import { withPlaces } from '../src/sim/expeditions.js';
import { companionCard } from '../src/ui/campaign/companionText.js';
import { rankUpLines } from '../src/ui/campaign/crewJobText.js';
import { crewCardText, squadText } from '../src/ui/campaign/crewText.js';
import { eventText, resultText } from '../src/ui/campaign/eventText.js';
import { crewText as crewRowsText } from '../src/ui/campaign/hubText.js';
import { questPlaceEnd, questsText } from '../src/ui/campaign/questText.js';
import { placesText, squadRows } from '../src/ui/campaign/tripText.js';
import { unitText } from '../src/ui/fight/hints.js';
import { icons } from '../src/ui/icons.js';
import { openMap, rules } from './battleKit.js';
import { settled } from './colonyKit.js';
import { atStep, CHAINS } from './companionKit.js';

const ABOUT = { varga: 'Engineer · The Fleet', brandt: 'Quartermaster · The union', osei: 'Scout · Con-Reg', halloran: 'Medic · The Hallorans' };
const loyalOf = (campaign, id) => ({ ...campaign, crew: campaign.crew.map((m) => (m.companion === id ? { ...m, loyal: true } : m)) });

test("a chain's step offers its companion: face, name, side, job and past; the choice signing them on says so, and takes a berth", () => {
  for (const [chain, { join, done, companion: id }] of Object.entries(CHAINS)) {
    const there = atStep(chain);
    const companion = rules.companions.get(id);
    const text = eventText(there, rules);
    assert.deepEqual(text.companion, {
      id,
      name: companion.name,
      about: ABOUT[id],
      past: companion.past,
      face: { look: companion.look, job: rules.jobs.get(companion.job).look, trim: crewColor(there.crew.length), bust: companion.bust, mark: sideColors[rules.factions.sides.get(companion.side).color] },
      line: `${companion.name}, ${ABOUT[id]}. ${companion.past}`,
    });
    const joins = text.choices.find((c) => c.id === join);
    assert.equal(joins.ok, true, chain);
    assert.equal(joins.berth, 'Takes a berth · 1 free');
    assert.match(joins.ask, new RegExp(`${companion.name} signs on, in a free berth\\. It does step 1 of 1 of .*\\. A crew of 4 eats 4 supplies a jump, and full holds last \\d+ jumps\\. Tap again to choose\\.$`));
    assert.equal(text.choices.find((c) => c.id === done).berth, '', 'doing it without them takes no berth');
    // No berth free: the choice says why.
    const full = { ...there, crew: [...there.crew, { ...there.crew[2], id: 9, name: 'Stowaway' }] };
    const refused = eventText(full, rules).choices.find((c) => c.id === join);
    assert.deepEqual([refused.ok, refused.why], [false, 'Needs a free berth.']);
  }
});

test('signed on: the result shows them, the chain done and their loyalty quest opened; done without them, no one', () => {
  const there = atStep('tender');
  const made = chooseEvent(there, rules, 'tagjoin').campaign;
  const result = resultText(made, rules);
  assert.deepEqual(result.companion, companionCard(rules.companions.get('varga'), made, rules));
  assert.equal(result.companion.face.trim, crewColor(made.crew.indexOf(aboard(made, 'varga'))), 'in the trim of her place in the crew');
  assert.equal(result.quest, "The tender's stores: done. Ines Varga signs on. A new quest: Varga's tender. The pirates who took the tender's stores, within reach of the colony.");
  assert.equal(eventText(made, rules), null, 'settled');
  const tagged = chooseEvent(there, rules, 'tag').campaign;
  assert.equal(resultText(tagged, rules).companion, null);
  assert.equal(resultText(tagged, rules).quest, "The tender's stores: done.");
});

test("a companion's face is their bust in their side's color, on the crew card, the squad pickers and the trip's; anyone else's is their helmet badge (M34)", () => {
  const made = chooseEvent(atStep('tender'), rules, 'tagjoin').campaign;
  const bust = { bust: rules.companions.get('varga').bust, mark: sideColors.blue };
  const faces = [crewCardText(made, rules).members, squadText(made, rules).members, squadRows(made, rules, [])].map((members) => members.map((m) => m.face));
  for (const list of faces) {
    const at = made.crew.indexOf(aboard(made, 'varga'));
    assert.deepEqual(list[at], { look: aboard(made, 'varga').look, job: rules.jobs.get('engineer').look, trim: crewColor(at), ...bust });
    assert.ok(list.every((face, i) => i === at || (face.bust === undefined && face.mark === undefined)), 'the rest wear their helmets');
  }
});

test('the crew card: a companion has their side, past and loyalty; loyal, the third rank, their talent and its numbers; at the colony too', () => {
  const made = chooseEvent(atStep('tender'), rules, 'tagjoin').campaign;
  const varga = crewCardText(made, rules).members.find((m) => m.name === 'Ines Varga');
  assert.deepEqual(
    { about: varga.about, past: varga.past, rank: varga.rank, rankLine: varga.rankLine, loyalty: varga.loyalty, brief: varga.brief },
    {
      about: 'Engineer · The Fleet',
      past: rules.companions.get('varga').past,
      rank: 1,
      rankLine: 'Rank 1, Hot welds · 3 fights · rank 2 at 8',
      loyalty: "Loyal once Varga's tender is done: rank 3, Bosun's weld.",
      brief: 'Weld ×3 · fixes a wreck a jump · mines +1',
    },
  );
  const others = crewCardText(made, rules).members.filter((m) => m.name !== 'Ines Varga');
  assert.ok(others.every((m) => m.loyalty === null && m.past === undefined), 'the rest have no story');
  // At the colony, loyal.
  const home = loyalOf(joinCompanion(settled(), rules, 'varga').campaign, 'varga');
  const card = crewCardText(home, rules);
  assert.deepEqual([card.title, card.text, card.hire, card.hint], [`Crew · ${home.crew.length} at the colony`, 'Everyone at the colony, and what each brings to it. No spare weapons on hand.', null, { tone: 'info', text: 'Tap Done for the colony.' }]);
  const loyal = card.members.find((m) => m.name === 'Ines Varga');
  assert.deepEqual(
    [loyal.rank, loyal.rankLine, loyal.loyalty, loyal.brief],
    [3, "Rank 3, Bosun's weld · 3 fights · Running repairs at 8", "Loyal: Bosun's weld, Weld ×3 a fight, 8 rounds.", 'Weld ×3 · fixes a wreck a jump · mines +1'],
  );
  assert.ok(card.members.every((m) => m.dismiss === null), 'no one is let go at the colony');
  // The third rank on the squad picker and the crew panel's rows.
  assert.equal(squadText(home, rules).members.find((m) => m.name === 'Ines Varga').rank, 3);
  assert.equal(crewRowsText(home, rules).find((row) => row.name === 'Ines Varga').rank, 3);
  // Reaching rank 2 by fights, loyal: the rank's name and its gives, not
  // the order, already past it.
  assert.deepEqual(rankUpLines([{ member: aboard(home, 'varga'), rank: 2 }], rules), ['Ines Varga reaches Running repairs: fixes 2 wrecks a jump.']);
});

test("the quests panel: a side's chain and the companion it brought, their loyalty quest open, done and gone cold", () => {
  const made = chooseEvent(atStep('tender'), rules, 'tagjoin').campaign;
  const line = (campaign, id) => questsText(campaign, rules).find((quest) => quest.id === id);
  assert.equal(line(made, 'tender').next, 'Ines Varga came aboard.');
  assert.deepEqual([line(made, 'varga-loyal').label, line(made, 'varga-loyal').next], ['Step 1 of 1', "The pirates who took the tender's stores, within reach of the colony."]);
  assert.equal(line(chooseEvent(atStep('tender'), rules, 'tag').campaign, 'tender').next, 'The Fleet remembers it.', 'done without her');
  const finished = { ...made, quests: { ...made.quests, 'varga-loyal': { step: 0, state: 'done' } } };
  assert.equal(line(loyalOf(finished, 'varga'), 'varga-loyal').next, "Ines Varga is loyal: rank 3, Bosun's weld.");
  const gone = { ...made, quests: { ...made.quests, 'varga-loyal': { step: 0, state: 'cold' } } };
  assert.deepEqual([line(gone, 'varga-loyal').label, line(gone, 'varga-loyal').next], ['Gone cold', 'Ines Varga was let go before it was done.']);
});

test('the loyalty place at the colony, with who holds her; won, the fight says the companion is loyal', () => {
  const home = withPlaces(joinCompanion(settled(), rules, 'osei').campaign, rules);
  const place = home.colony.places.find((p) => p.quest === 'osei-loyal');
  const row = placesText(home, rules).find((entry) => entry.quest);
  assert.deepEqual([row.name, row.kind, row.line], ["Survey chief's tug", "Ama's survey chief", "Ama's survey chief · 2 days away · held"]);
  assert.match(row.about, /^Chief Surveyor Harl's tug/);
  assert.deepEqual(questPlaceEnd(place, true, home, rules), [
    "Ama's survey chief: done. Harl's claim stakes go out the airlock with his survey log. Ama files her own, honestly, in triplicate, with the colony's name on it.",
    "Ama Osei is loyal: rank 3, Surveyor's eye (Mark ×3 a fight, +30 to hit), from the next fight.",
  ]);
  assert.deepEqual(questPlaceEnd(place, false, home, rules), [], 'lost, nothing');
});

test("in a fight: the third rank by its talent's name, and the order's numbers", () => {
  const home = loyalOf(joinCompanion(settled(), rules, 'varga').campaign, 'varga');
  const unit = crewUnit(aboard(home, 'varga'), rules);
  const { battle } = createBattle({ map: openMap(6, 3), seed: 3, units: [{ ...unit, x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 1 }] }, rules);
  const card = unitText(battle.units[0], rules);
  assert.match(card.lines[0], /^Crew · rank 3, Bosun's weld · /);
  assert.equal(card.lines.at(-1), 'Weld: 3 of 3 left this fight, 8 rounds each.');
  // Not loyal: rank 1's name, and the order's line as ever.
  const before = createBattle({ map: openMap(6, 3), seed: 3, units: [{ ...crewUnit({ ...aboard(home, 'varga'), loyal: undefined }, rules), x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 1 }] }, rules).battle;
  assert.match(unitText(before.units[0], rules).lines[0], /^Crew · rank 1, Hot welds · /);
  assert.equal(unitText(before.units[0], rules).lines.at(-1), 'Weld: 3 of 3 left this fight.');
  // Three chevrons for the third rank.
  assert.equal((icons.rank3.match(/<path /g) ?? []).length, 3);
});
