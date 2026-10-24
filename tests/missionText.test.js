// M38's missions on screen: the job board's brief and who is against it,
// the objective under the round, how the fight ended, the hint line, the
// crew bar's words and the unit card for the person brought out and for a
// carrier, the tags and tiles on the board, the playback of the new events
// and their sounds.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createBattle } from '../src/sim/battle.js';
import { createFight, ordersFor, reduceFight } from '../src/sim/fight.js';
import { applyEvent, frameAt, makeTimeline } from '../src/render/playback.js';
import { unitsScene, zonesScene } from '../src/render/units.js';
import { jobOutcome, jobText, objectiveText } from '../src/ui/campaign/jobText.js';
import { eventText, hintFor, stateText, unitText } from '../src/ui/fight/hints.js';
import { middleTile, objectiveMarks, objectiveZones } from '../src/ui/fight/marks.js';
import { cueSound, MOMENT_SOUNDS } from '../src/ui/sounds.js';
import { drawn, rules } from './battleKit.js';

// An open yard, 8 × 4, as tests/missions.test.js has it.
const yard = () =>
  drawn(`
+-+-+-+-+-+-+-+-+
|. . . . . . . .|
+               +
|. . h . . h . .|
+               +
|. . . . . . . .|
+               +
|. . . . . . . .|
+-+-+-+-+-+-+-+-+
`);
const WEST = [[0, 0], [0, 1], [0, 2], [0, 3]];
const start = (objective, units) => createBattle({ map: yard(), units, seed: 5, objective }, rules).battle;
const play = (battle, action) => {
  const result = act(battle, action, rules);
  assert.ok(result.ok, result.error);
  return result;
};
const unit = (battle, id) => battle.units.find((u) => u.id === id);
// A job of each new mission, as the board holds one.
const JOBS = {
  extract: { contract: 'strikefund', client: 'marta', site: 'depot', twist: null, seed: 3, credits: 80 },
  escort: { contract: 'backdoor', client: 'rook', site: 'yard', twist: null, seed: 3, credits: 80 },
  defend: { contract: 'yardwatch', client: 'dutch', site: 'yard', twist: null, seed: 3, credits: 90 },
  sabotage: { contract: 'pumps', client: 'marta', site: 'pit9', twist: null, seed: 3, credits: 110 },
  rescue: { contract: 'nephew', client: 'prewitt', site: 'depot', twist: null, seed: 3, credits: 100 },
};

test("the board's brief says what each new mission takes, its words filled in, and only the enemies are against it", () => {
  const text = Object.fromEntries(Object.entries(JOBS).map(([mission, job]) => [mission, jobText(job, rules)]));
  for (const [mission, words] of Object.entries(text)) {
    assert.ok(words, mission);
    assert.doesNotMatch(words.brief, /\{\w+\}/, `${mission}: every word filled in`);
    assert.doesNotMatch(words.against, /Client|Captive/, `${mission}: the person brought out isn't against it`);
    assert.ok(words.against.length > 0, `${mission}: someone is`);
  }
  assert.match(text.extract.brief, /^Carry 1 tagged crate out the way you came in\./);
  assert.match(text.escort.brief, new RegExp(`^Walk ${rules.clients.get('rook').name} across to the far gate\\.`));
  assert.match(text.defend.brief, /^Hold the way in for 6 rounds\./);
  assert.match(text.sabotage.brief, /^Set a charge beside 1 tagged target\./);
  assert.match(text.rescue.brief, /^Danny Prewitt is held at the back of the site\./);
  assert.deepEqual(Object.values(text).map((words) => words.mission), ['Walk it out', 'Escort', 'Hold the line', 'Sabotage', 'Rescue']);
});

test('the objective under the round: crates out, the client\'s way, the rounds held, the charges blown, the captive held or freed', () => {
  const crew = [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }];
  const progress = (job, battle) => objectiveText(battle, job, rules).progress;
  const extract = start({ type: 'extract', crates: [[2, 1]], exits: WEST }, crew);
  assert.equal(progress(JOBS.extract, extract), 'Crates out: 0 of 1');
  const escort = start({ type: 'escort', ward: 'w1', exits: [[7, 0]] }, [...crew, { kind: 'client', x: 0, y: 0, name: 'Jory Rook' }]);
  assert.equal(progress(JOBS.escort, escort), 'Jory Rook: to the far gate');
  assert.equal(progress(JOBS.escort, { ...escort, objective: { ...escort.objective, out: true } }), 'Jory Rook: through the far gate');
  const down = { ...escort, units: escort.units.map((u) => (u.id === 'w1' ? { ...u, status: 'down', bleed: 2 } : u)) };
  assert.equal(progress(JOBS.escort, down), 'Jory Rook: down, 2 turns to live');
  const defend = start({ type: 'defend', rounds: 6, line: WEST }, crew);
  assert.equal(progress(JOBS.defend, defend), 'Held: round 1 of 6');
  const sabotage = start({ type: 'sabotage', targets: [[2, 1]], left: 2 }, crew);
  assert.equal(progress(JOBS.sabotage, sabotage), 'Blown: 0 of 1 · 2 charges left');
  const rescue = start({ type: 'rescue', ward: 'w1', exits: WEST }, [...crew, { kind: 'captive', x: 3, y: 1, name: 'Danny Prewitt', held: true }]);
  assert.equal(progress(JOBS.rescue, rescue), 'Danny Prewitt: held');
  const freed = play(play(rescue, { type: 'move', unit: 'c1', to: [2, 2] }).battle, { type: 'free', unit: 'c1' }).battle;
  assert.equal(progress(JOBS.rescue, freed), 'Danny Prewitt: freed, walk them out');
  assert.equal(objectiveText(freed, JOBS.rescue, rules).title, 'Rescue');
});

test("the fight's end says why: the line held, they broke through, the person brought out lost", () => {
  const battle = start({ type: 'escort', ward: 'w1', exits: [[7, 0]] }, [{ kind: 'marine', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'client', x: 0, y: 0, name: 'Jory Rook' }]);
  const over = (winner, reason) => [{ type: 'over', winner, reason }];
  assert.match(jobOutcome({ ...battle, winner: 'crew' }, JOBS.defend, rules, over('crew', 'held')).text, /^The line held\. Paid /);
  assert.match(jobOutcome({ ...battle, winner: 'enemy' }, JOBS.defend, rules, over('enemy', 'through')).text, /^They broke through: no pay\./);
  assert.match(jobOutcome({ ...battle, winner: 'enemy' }, JOBS.escort, rules, over('enemy', 'ward')).text, /^Jory Rook is lost: no pay\./);
  assert.match(jobOutcome({ ...battle, winner: 'crew' }, JOBS.escort, rules, over('crew', 'objective')).text, /^Paid /);
});

test('the hint line: Free and Plant when in reach, the person brought out with no gun, a carrier one move a turn', () => {
  const rescue = start({ type: 'rescue', ward: 'w1', exits: WEST }, [{ kind: 'marine', x: 2, y: 2 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'captive', x: 3, y: 1, name: 'Danny Prewitt', held: true }]);
  let fight = createFight(rescue, rules);
  let orders = ordersFor(fight, rules);
  assert.equal(orders.free, true);
  assert.match(hintFor(fight, orders).text, /can reach Danny Prewitt: tap Free/);
  fight = reduceFight(fight, { type: 'fight/free' }, rules);
  assert.equal(unit(fight.battle, 'w1').status, 'active', 'freed, and they can move at once');
  fight = reduceFight(fight, { type: 'fight/select', unit: 'w1' }, rules);
  orders = ordersFor(fight, rules);
  assert.equal(orders.unit.id, 'w1');
  assert.deepEqual([orders.targets.length, orders.reload, orders.overwatch, orders.free, orders.plant, orders.grab], [0, false, false, false, null, null], 'no gun, no objective orders');
  assert.match(hintFor(fight, orders).text, /^Danny Prewitt has no gun: tap a tile to move them out the way you came in\./);

  const sabotage = start({ type: 'sabotage', targets: [[2, 1]], left: 2 }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]);
  fight = createFight(sabotage, rules);
  orders = ordersFor(fight, rules);
  assert.deepEqual(orders.plant, [2, 1]);
  assert.match(hintFor(fight, orders).text, /can reach the target: tap Plant/);

  const extract = start({ type: 'extract', crates: [[2, 1]], exits: WEST }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]);
  const carrying = play(extract, { type: 'grab', unit: 'c1', at: [2, 1] }).battle;
  fight = createFight(carrying, rules);
  orders = ordersFor(fight, rules);
  assert.match(hintFor(fight, orders).text, /has the crate: one move a turn, no dash\. Walk it out the way you came in/);
});

test("the crew bar's words and the unit card: held, no gun, a crate in hand", () => {
  const captive = start({ type: 'rescue', ward: 'w1', exits: WEST }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'captive', x: 3, y: 1, name: 'Danny Prewitt', held: true }]);
  const ward = unit(captive, 'w1');
  assert.equal(stateText(ward), 'Held');
  assert.equal(stateText({ ...ward, status: 'active', ap: 2 }), '2 AP · no gun');
  const card = unitText(ward, rules, captive);
  assert.equal(card.title, 'Danny Prewitt w1');
  assert.match(card.lines[0], /^Captive · 5\/5 hit points · Held\.$/);
  assert.match(card.lines.join(' '), /Held: they can't move, and no one shoots them, till one of the crew beside them taps Free\./);
  assert.match(unitText({ ...ward, status: 'active' }, rules).lines.join(' '), /No gun: they only move, as the crew do\. If they bleed out, the job is lost\./);
  const extract = start({ type: 'extract', crates: [[2, 1]], exits: WEST }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]);
  const carrier = unit(play(extract, { type: 'grab', unit: 'c1', at: [2, 1] }).battle, 'c1');
  assert.match(stateText(carrier), /^Crate · \d AP · \d+ shots?$/, 'the crate first, where a narrow crew bar cuts the end short');
  assert.ok(unitText(carrier, rules).lines.includes('Carrying a crate: one move a turn, no dash, until it is out.'));
  assert.ok(unitText({ ...carrier, status: 'down', bleed: 2 }, rules).lines.includes('Down with a crate in hand: anyone of the crew beside them can take it with Grab.'));
});

test('the board tags the crates, the way out, the far gate, the targets and their charges, and the way in held, and outlines their tiles', () => {
  const crew = [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }];
  assert.deepEqual(middleTile(WEST), [0, 1]);
  assert.deepEqual(middleTile([[4, 4]]), [4, 4]);
  const extract = start({ type: 'extract', crates: [[2, 1], [5, 1]], exits: WEST }, crew);
  assert.deepEqual(objectiveMarks(extract), [
    { at: [2, 1], text: 'CRATE', done: false },
    { at: [5, 1], text: 'CRATE', done: false },
    { at: [0, 1], text: 'WAY OUT 0/2', done: false },
  ]);
  const picked = play(extract, { type: 'grab', unit: 'c1', at: [2, 1] }).battle;
  assert.deepEqual(objectiveMarks(picked).map((mark) => mark.text), ['CRATE', 'WAY OUT 0/2'], 'a crate in hand is its carrier\'s word, not a tag');
  assert.deepEqual(objectiveZones(extract.objective), [{ tiles: WEST, tone: 'out' }]);
  const escort = start({ type: 'escort', ward: 'w1', exits: [[7, 0], [7, 1]] }, [...crew, { kind: 'client', x: 0, y: 0, name: 'Jory Rook' }]);
  assert.deepEqual(objectiveMarks(escort), [{ at: [7, 0], text: 'FAR GATE', done: false }]);
  const sabotage = start({ type: 'sabotage', targets: [[2, 1], [5, 1]], left: 3 }, crew);
  const planted = play(sabotage, { type: 'plant', unit: 'c1', at: [2, 1] }).battle;
  assert.deepEqual(objectiveMarks(planted), [
    { at: [2, 1], text: 'CHARGE SET', done: false, tone: 'charge' },
    { at: [5, 1], text: 'TARGET', done: false },
  ]);
  assert.deepEqual(objectiveMarks({ ...planted, objective: { ...planted.objective, charges: [], blown: [[2, 1]] } })[0], { at: [2, 1], text: 'BLOWN', done: true });
  assert.deepEqual(objectiveZones(sabotage.objective), [], 'targets are tagged, not outlined');
  const defend = start({ type: 'defend', rounds: 6, line: WEST }, crew);
  assert.deepEqual(objectiveMarks(defend), [{ at: [0, 1], text: 'HOLD 1/6', done: false }]);
  // A zone's tag goes on the free tile nearest its middle: over one of the
  // crew it would sit under their hit points.
  const manned = start({ type: 'defend', rounds: 6, line: WEST }, [{ kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]);
  assert.deepEqual(objectiveMarks(manned)[0].at, [0, 2]);
  const full = start({ type: 'defend', rounds: 6, line: [[0, 1], [0, 2]] }, [{ kind: 'marine', x: 0, y: 1 }, { kind: 'medic', x: 0, y: 2 }, { kind: 'pirate', x: 7, y: 3 }]);
  assert.deepEqual(objectiveMarks(full)[0].at, [0, 1], 'everyone on it: the middle tile');
  assert.deepEqual(objectiveZones(defend.objective), [{ tiles: WEST, tone: 'hold' }]);
  // Each tile of each zone, outlined on the deck under the orders' marks,
  // and the way in held crossed as well as colored (M42): a plate and two
  // strips a tile.
  const faces = zonesScene(objectiveZones(defend.objective));
  assert.equal(faces.length, WEST.length * 3);
  assert.equal(zonesScene([{ tiles: WEST, tone: 'out' }]).length, WEST.length, 'a way out: the plate alone');
  assert.ok(faces.every((face) => face.normal[2] === 1 && face.bias > -0.03), 'flat on the deck, under the reach marks');
  // A captive held stands; down, they lie.
  const figure = (status) => unitsScene([{ id: 'w1', side: 'crew', status, at: [3.5, 1.5], facing: [1, 0], trim: '#fff', look: null, held: false, pose: { aim: 0, fall: 0 } }]).figures[0].pose.fall;
  assert.deepEqual([figure('held'), figure('down')], [0, 1]);
});

test('the playback: a crate picked up, taken from the fallen and carried out, the captive freed, and a blast with its damage over each unit beside it', () => {
  const extract = start({ type: 'extract', crates: [[2, 1]], exits: WEST }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'medic', x: 1, y: 2 }, { kind: 'pirate', x: 7, y: 3 }]);
  const picked = applyEvent(extract, { type: 'grab', unit: 'c1', at: [2, 1], left: 0 });
  assert.deepEqual(unit(picked, 'c1').carrying, [2, 1]);
  assert.equal(unit(extract, 'c1').carrying, undefined, 'the battle before is left as it was');
  const taken = applyEvent(picked, { type: 'grab', unit: 'c2', at: [1, 1], from: 'c1', left: 0 });
  assert.deepEqual([unit(taken, 'c1').carrying, unit(taken, 'c2').carrying], [undefined, [2, 1]]);
  assert.equal(applyEvent(taken, { type: 'out', unit: 'c2', at: [0, 2], crate: [2, 1], left: 0 }).units.find((u) => u.id === 'c2').carrying, undefined);
  const grab = start({ type: 'grab', crates: [[2, 1]] }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 7, y: 3 }]);
  assert.equal(unit(applyEvent(grab, { type: 'grab', unit: 'c1', at: [2, 1], left: 0 }), 'c1').carrying, undefined, 'a grab job\'s crate is grabbed, not carried');
  const rescue = start({ type: 'rescue', ward: 'w1', exits: WEST }, [{ kind: 'marine', x: 2, y: 2 }, { kind: 'pirate', x: 7, y: 3 }, { kind: 'captive', x: 3, y: 1, name: 'Danny Prewitt', held: true }]);
  assert.equal(unit(applyEvent(rescue, { type: 'free', unit: 'c1', target: 'w1' }), 'w1').status, 'active');

  const blast = { type: 'blast', at: [2, 1], units: ['c1', 'e1'], damage: 4 };
  const near = start({ type: 'sabotage', targets: [[2, 1]], left: 2 }, [{ kind: 'marine', x: 1, y: 1 }, { kind: 'pirate', x: 3, y: 1 }]);
  const hit = applyEvent(near, blast);
  assert.deepEqual([unit(hit, 'c1').hp, unit(hit, 'e1').hp], [unit(near, 'c1').hp - 4, Math.max(0, unit(near, 'e1').hp - 4)]);
  const timeline = makeTimeline(near, [{ events: [blast], battle: hit }]);
  const frame = frameAt(timeline, timeline.length * 0.5);
  assert.deepEqual(frame.blast, { at: [2, 1], progress: 0.5 });
  const later = frameAt(timeline, timeline.length * 0.3);
  assert.deepEqual(later.floats.map((f) => [f.at, f.text, f.tone]), [[[2, 1], 'BLAST', 'hit'], [[1, 1], 'HURT −4', 'hurt'], [[3, 1], '−4', 'hit']]);
  assert.equal(frameAt(timeline, timeline.length + 1).blast, null, 'gone once it has played');
  // Its words in the status line: bad when it catches one of the crew.
  assert.equal(eventText(blast, near).tone, 'bad');
  assert.equal(eventText({ ...blast, units: ['e1'] }, near).tone, 'good');
  assert.equal(eventText({ type: 'through', unit: 'e1', at: [0, 1] }, near).tone, 'bad');
});

test('a blast sounds as one, and freeing the captive and setting a charge each their own (M51)', () => {
  const of = (event) => cueSound({ event, lands: false }, { units: [] }, rules);
  assert.deepEqual([of({ type: 'blast', at: [1, 1], units: [], damage: 4 }), of({ type: 'plant', unit: 'c1' }), of({ type: 'free', unit: 'c1' }), of({ type: 'pull', unit: 'e1' })], ['blast', 'plant', 'free', null]);
  assert.ok(MOMENT_SOUNDS.includes('blast'));
});
