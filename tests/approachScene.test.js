// M38b: the approach seen from outside. The marks on a hull
// (src/render/hullMarks.js) and a round played out as beats in time
// (src/render/approachPlayback.js), both pure: what the approach screen
// draws (render/approachView.js) and when.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { AWAY, frameAt, MS, restingPose, roundCues, roundTimeline, shipGeometry } from '../src/render/approachPlayback.js';
import { HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { damageMarks, partPoint, roofOf, targetMarks } from '../src/render/hullMarks.js';
import { palette } from '../src/render/palette.js';
import { playRound } from '../src/sim/approach.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { launchedShip } from '../tools/approach.js';
import { withPart } from '../tools/startShip.js';
import { rules } from './battleKit.js';
import { CUTTER_SEED } from './launchKit.js';

const you = launchedShip(rules);
const cutter = generateShip(rules, 'cutter', CUTTER_SEED).ship;
const tactics = rules.ships.get('cutter').tactics;
const side = (ship, wrecked = {}, damage = {}) => ({ ship, damage, wrecked });
const uidsOf = (ship, tag) => ship.modules.filter((m) => rules.modules.get(m.type).tags.includes(tag)).map((m) => m.uid);
const geometryOf = (state) => ({ you: shipGeometry({ ship: you, defs: rules, hull: traceHull(you, rules), wrecked: state.you.wrecked }), them: shipGeometry({ ship: cutter, defs: rules, hull: traceHull(cutter, rules), wrecked: state.them.wrecked }) });
// Each point of every face and glow, on the part's roof (give or take the
// width of a blotch).
const within = (marks, roof) => [...marks.faces.flatMap((face) => face.pts), ...(marks.glows ?? []).map((glow) => glow.at)].every(([x, y]) => x > roof[0] - 0.6 && x < roof[2] + 0.6 && y > roof[1] - 0.6 && y < roof[3] + 0.6);
// The first seed whose round, played with order, does what test asks.
function seedWhere(state, order, test) {
  for (let seed = 0; seed < 5000; seed++) {
    const played = playRound(state, order, seedFrom(seed), rules);
    if (played.ok && test(played)) return played;
  }
  throw new Error('No seed found');
}

test('a hull shows what an approach did to her: burnt where hit, and each wrecked part charred with its hazard', () => {
  const [engine] = uidsOf(you, 'engine');
  const roof = roofOf(you, rules, engine);
  const marks = (input) => damageMarks({ ship: you, defs: rules, ...input });
  const on = (face) => face.pts.every(([x, y, z]) => x >= roof[0] && x <= roof[2] && y >= roof[1] && y <= roof[3] && z > HULL);
  assert.deepEqual(marks({}), { faces: [], glows: [] }, 'untouched: nothing');
  const hit = marks({ damage: { [engine]: 5 } });
  assert.deepEqual(new Set(hit.faces.map((face) => face.color)), new Set([palette.burn, palette.scorch]), 'hit: burns ringed with heat');
  assert.ok(hit.faces.every(on), "on the part's own roof");
  assert.deepEqual(hit.glows, [], 'hit: nothing burns');
  // A wrecked part is charred all over first: a ragged plate over her roof.
  const charred = (m) => m.faces[0].color === palette.scorch && m.faces[0].pts.length > 7 && on(m.faces[0]);
  const fire = marks({ damage: { [engine]: 20 }, wrecked: { [engine]: 'fire' } });
  assert.ok(charred(fire) && fire.faces.every(on), 'fire: charred, on her roof');
  assert.ok(fire.glows.some((glow) => glow.color === palette.fire) && fire.glows.some((glow) => glow.color === palette.fireCore), 'fire: flames over it');
  const vacuum = marks({ wrecked: { [engine]: 'vacuum' } });
  assert.ok(charred(vacuum) && vacuum.faces.every(on), 'vacuum: charred, on her roof');
  assert.equal(vacuum.faces.at(-1).color, palette.breach, 'vacuum: a hole as dark as space, over the torn plating');
  assert.ok(vacuum.faces.some((face) => face.color === palette.rubble) && vacuum.glows.length && vacuum.glows.every((glow) => glow.color === palette.vacuum), 'vacuum: torn plating, venting');
  const rubble = marks({ wrecked: { [engine]: 'rubble' } });
  const smoke = rubble.faces.filter((face) => face.color === palette.smoke);
  assert.ok(charred(rubble) && rubble.faces.some((face) => face.color === palette.rubble) && smoke.length, 'rubble: broken plating under smoke');
  assert.ok(smoke.every((face) => face.pts.every(([, , z]) => z > HULL + 0.2)) && within({ faces: smoke }, roof), 'the smoke hangs over her part');
  assert.deepEqual(rubble.faces.slice(-smoke.length), smoke, 'the smoke painted last');
  assert.ok(rubble.faces.filter((face) => face.color !== palette.smoke).every(on) && rubble.glows.length === 0);
  assert.deepEqual(marks({ wrecked: { [engine]: 'fire' } }), marks({ wrecked: { [engine]: 'fire' } }), 'the same every time');
  assert.deepEqual(marks({ damage: { 9999: 5 } }), { faces: [], glows: [] }, "a part she hasn't got");
  assert.deepEqual(partPoint(you, rules, engine), [(roof[0] + roof[2]) / 2, (roof[1] + roof[3]) / 2, HULL]);
});

test("a Fire order's marks: each part it aims at tinted and bracketed, the first it would hit the brightest", () => {
  const guns = uidsOf(cutter, 'weapon');
  const { faces, frames } = targetMarks({ ship: cutter, defs: rules, uids: guns });
  assert.equal(faces.length, guns.length);
  assert.ok(faces.every((face) => face.color === palette.target && face.emissive));
  assert.ok(faces[0].alpha > faces[1].alpha, 'the first brightest');
  assert.deepEqual(frames.map((frame) => [frame.uid, frame.first]), guns.map((uid, i) => [uid, i === 0]));
  guns.forEach((uid, i) => {
    const roof = roofOf(cutter, rules, uid);
    const [a, , c] = frames[i].corners;
    assert.ok(a[0] > roof[0] && a[1] > roof[1] && c[0] < roof[2] && c[1] < roof[3], 'inside her roof');
    assert.ok(c[0] - a[0] > roof[2] - roof[0] - 0.2 && c[1] - a[1] > roof[3] - roof[1] - 0.2, 'round all of it');
    assert.ok(within({ faces: [faces[i]] }, roof));
  });
  assert.deepEqual(targetMarks({ ship: cutter, defs: rules, uids: [] }), { faces: [], frames: [] });
});

test('her guns fire from their own barrels, in the order they were fitted, the wrecked ones left out', () => {
  const guns = uidsOf(cutter, 'weapon');
  const hull = traceHull(cutter, rules);
  const geometry = shipGeometry({ ship: cutter, defs: rules, hull });
  assert.deepEqual(geometry.guns.map((gun) => gun.uid), guns);
  for (const gun of geometry.guns) {
    const roof = roofOf(cutter, rules, gun.uid);
    const [x, y, z] = gun.at;
    assert.ok(x > roof[0] - 1.5 && x < roof[2] + 1.5 && y > roof[1] - 1.5 && y < roof[3] + 1.5 && z > HULL, `gun ${gun.uid} at its barrel's muzzle`);
  }
  const less = shipGeometry({ ship: cutter, defs: rules, hull, wrecked: { [guns[0]]: 'fire' } });
  assert.deepEqual(less.guns.map((gun) => gun.uid), guns.slice(1));
  assert.deepEqual(geometry.partAt(guns[0]), partPoint(cutter, rules, guns[0]));
});

test("a round as beats: each shot from its gun to the part it struck or wide of her, the marks landing with the shots, a line as each event ends", () => {
  const state = { you: side(you), them: side(cutter), round: 1, tactics };
  const geometry = geometryOf(state);
  const ourVolley = (p) => p.events.find((e) => e.kind === 'volley' && e.side === 'you');
  const beatsOf = (played) => roundTimeline({ events: played.events, before: { you: state.you, them: state.them }, outcome: played.outcome, geometry });
  // A round whose shots all fly to where they went, and one with a miss.
  const played = seedWhere(state, { kind: 'fire', at: 'weapons' }, (p) => ourVolley(p)?.shots.some((s) => s.module !== null));
  const timeline = beatsOf(played);
  const shots = timeline.beats.filter((beat) => beat.kind === 'shot');
  assert.equal(shots.length, played.events.filter((e) => e.kind === 'volley').reduce((sum, e) => sum + e.shots.length, 0));
  for (const who of ['you', 'them']) shots.filter((beat) => beat.side === who).forEach((beat, i) => assert.deepEqual(beat.from, geometry[who].guns[i].at, 'from its own gun'));
  const struck = shots.find((beat) => beat.side === 'you' && beat.module !== null);
  assert.deepEqual(struck.to, geometry.them.partAt(struck.module), 'to the part it struck');
  const wide = beatsOf(seedWhere(state, { kind: 'fire', at: 'weapons' }, (p) => ourVolley(p)?.shots.some((s) => !s.hit))).beats.find((beat) => beat.side === 'you' && !beat.hit);
  const ys = traceHull(cutter, rules).cells.map(([, y]) => y);
  assert.ok(wide.to[1] < Math.min(...ys) || wide.to[1] > Math.max(...ys) + 1, 'a miss flies by her');

  const start = frameAt(timeline, 0);
  assert.deepEqual(start.marks.them, { damage: {}, wrecked: {} }, 'nothing landed yet');
  assert.equal(start.shots.length, 1);
  assert.equal(start.lines, 0);
  const landed = frameAt(timeline, struck.lands);
  assert.equal(landed.marks.them.damage[struck.module], struck.damage, 'lands with its shot');
  const end = frameAt(timeline, timeline.ms);
  assert.ok(end.done);
  assert.deepEqual([end.marks.them.damage, end.marks.them.wrecked], [played.them.damage, played.them.wrecked], 'ends as the round left her');
  assert.deepEqual([end.marks.you.damage, end.marks.you.wrecked], [played.you.damage, played.you.wrecked], 'and the crew');
  assert.equal(end.lines, played.events.length);
  assert.equal(frameAt(timeline, timeline.ends[0] - 1).lines, 0);
  assert.equal(frameAt(timeline, timeline.ends[0]).lines, 1, "the first event's line once it has played");
});

test('a torpedo bay (M39) holds fire in the even rounds, so the shots come from the other guns; in its rounds its torpedo flies slower than a shot', () => {
  const armed = withPart(you, rules, 'torpedobay');
  const geometry = { you: shipGeometry({ ship: armed, defs: rules, hull: traceHull(armed, rules) }), them: shipGeometry({ ship: cutter, defs: rules, hull: traceHull(cutter, rules) }) };
  assert.equal(geometry.you.guns.filter((gun) => gun.torpedo).length, 1, 'the bay is one of her guns');
  const others = geometry.you.guns.filter((gun) => !gun.torpedo);
  for (const round of [1, 2]) {
    const state = { you: side(armed), them: side(cutter), round, tactics };
    const played = seedWhere(state, { kind: 'fire', at: 'weapons' }, (p) => p.events.some((e) => e.kind === 'volley' && e.side === 'you'));
    const timeline = roundTimeline({ events: played.events, before: { you: state.you, them: state.them }, outcome: played.outcome, geometry });
    const beats = timeline.beats.filter((beat) => beat.kind === 'shot' && beat.side === 'you');
    const guns = round === 1 ? geometry.you.guns : others;
    assert.equal(beats.length, guns.length, `round ${round}: a shot from each gun that fires`);
    beats.forEach((beat, i) => assert.deepEqual(beat.from, guns[i].at, `round ${round}: from its own barrel`));
    for (const beat of beats) assert.equal(beat.lands - beat.at, beat.torpedo ? MS.torpedo : MS.travel);
    assert.equal(beats.some((beat) => beat.torpedo), round === 1, 'a torpedo only in its round');
    // In flight, the screen is told which is the torpedo.
    const tube = beats.find((beat) => beat.torpedo);
    if (tube) assert.equal(frameAt(timeline, tube.at + 1).shots.find((shot) => shot.from === tube.from)?.torpedo, true);
  }
});

test('a shot her shields stop flies to her nose and shimmers there; a hit flashes; a part wrecked bursts', () => {
  const state = { you: side(you), them: side(cutter), round: 1, tactics };
  const geometry = geometryOf(state);
  const [gun] = uidsOf(cutter, 'weapon');
  const events = [{ kind: 'volley', side: 'you', at: 'weapons', shots: [{ roll: 1, hit: true, absorbed: 10, damage: 0, module: null, wreck: null }, { roll: 2, hit: true, absorbed: 0, damage: 15, module: gun, wreck: 'fire' }] }];
  const timeline = roundTimeline({ events, before: { you: state.you, them: state.them }, geometry });
  const [stopped, wrecking] = timeline.beats;
  assert.deepEqual(stopped.to, geometry.them.edge);
  const shimmer = frameAt(timeline, stopped.lands + 10);
  assert.deepEqual(shimmer.shimmers.map((s) => s.side), ['them']);
  assert.deepEqual(shimmer.flashes, [], 'nothing struck');
  const burst = frameAt(timeline, wrecking.lands + 10);
  assert.deepEqual(burst.flashes.map((f) => [f.side, f.kind]), [['them', 'burst']]);
  assert.equal(burst.marks.them.wrecked[gun], 'fire');
  assert.deepEqual(frameAt(timeline, wrecking.lands + MS.land + 1).flashes, [], 'and fades');
});

test('a flight that gets away takes her off the screen, a closing brings them together and grapples, a reactor going bursts her', () => {
  const state = { you: side(you), them: side(cutter), round: 1, tactics };
  const geometry = geometryOf(state);
  const play = (events, outcome) => roundTimeline({ events, before: { you: state.you, them: state.them }, outcome, geometry });
  for (const [who, kind] of [['you', 'escaped'], ['them', 'fled']]) {
    const away = play([{ kind: 'flee', side: who, ok: true }], { kind });
    const end = frameAt(away, away.ms);
    assert.deepEqual([end.moves.them, end.gone.them, end.gone.you], [AWAY, true, false], `${kind}: hers flies off`);
    assert.deepEqual(restingPose({ kind }).gone, { you: false, them: true });
  }
  const tried = play([{ kind: 'flee', side: 'you', ok: false }], null);
  assert.deepEqual(frameAt(tried, tried.ms).moves, { you: 0, them: 0 }, 'a failed try lurches and settles back');
  assert.ok(frameAt(tried, MS.lurch / 2).moves.you < 0);

  const closed = play([{ kind: 'close', side: 'you', ok: true }], { kind: 'boarded', how: 'closed' });
  const together = frameAt(closed, closed.ms);
  assert.deepEqual([together.close, together.moves, together.grapple], [1, { you: 0, them: 0 }, 'them']);
  const coming = frameAt(closed, MS.close / 2).close;
  assert.ok(coming > 0 && coming < 1, 'coming in');
  assert.equal(frameAt(closed, closed.ms - 1).grapple, null, 'grappled once all is played');
  // Disabled, she is boarded with no closing played: they come in last.
  const disabled = play([{ kind: 'volley', side: 'them', at: 'engines', shots: [] }], { kind: 'boardedBy', how: 'disabled' });
  assert.equal(disabled.beats.at(-1).kind, 'close');
  assert.deepEqual(frameAt(disabled, disabled.ms).grapple, 'you');
  assert.deepEqual(restingPose({ kind: 'boardedBy' }), { moves: { you: 0, them: 0 }, gone: { you: false, them: false }, grapple: 'you', close: 1 });
  assert.equal(restingPose(null).close, 0);

  const blown = play([{ kind: 'blow', ok: true }], { kind: 'destroyed' });
  assert.deepEqual(frameAt(blown, 10).flashes.map((f) => f.kind), ['blowup']);
  assert.ok(frameAt(blown, MS.blow).gone.them, 'she is gone');
  assert.deepEqual(restingPose({ kind: 'destroyed' }).gone, { you: false, them: true });
  assert.deepEqual(restingPose({ kind: 'parted' }), restingPose(null), 'parted: as they stood');
});

test("the round's sounds as it plays: each shot as it fires, a hit or the crew's miss as it lands, a jump, a blast; a quiet round confirms", () => {
  const state = { you: side(you), them: side(cutter), round: 1, tactics };
  const geometry = geometryOf(state);
  const [gun] = uidsOf(cutter, 'weapon');
  const events = [
    { kind: 'volley', side: 'you', at: 'weapons', shots: [{ hit: false, absorbed: 0, damage: 0, module: null, wreck: null }, { hit: true, absorbed: 0, damage: 15, module: gun, wreck: null }] },
    { kind: 'volley', side: 'them', at: 'engines', shots: [{ hit: false, absorbed: 0, damage: 0, module: null, wreck: null }] },
  ];
  const timeline = roundTimeline({ events, before: { you: state.you, them: state.them }, geometry });
  assert.deepEqual(roundCues(timeline, -1, timeline.ms), ['shotgun', 'miss', 'shotgun', 'hit', 'shotgun']);
  const half = timeline.ms / 2;
  assert.deepEqual([...roundCues(timeline, -1, half), ...roundCues(timeline, half, timeline.ms)].sort(), roundCues(timeline, -1, timeline.ms).sort(), 'each once, however the frames fall');
  const quiet = roundTimeline({ events: [{ kind: 'close', side: 'you', ok: false }], before: { you: state.you, them: state.them }, geometry });
  assert.deepEqual(roundCues(quiet, -1, quiet.ms), ['confirm']);
  const away = roundTimeline({ events: [{ kind: 'flee', side: 'you', ok: true }], before: { you: state.you, them: state.them }, outcome: { kind: 'escaped' }, geometry });
  assert.deepEqual(roundCues(away, -1, away.ms), ['confirm', 'jump']);
  const blown = roundTimeline({ events: [{ kind: 'blow', ok: true }], before: { you: state.you, them: state.them }, outcome: { kind: 'destroyed' }, geometry });
  assert.ok(roundCues(blown, -1, blown.ms).includes('blast'));
  assert.ok(['shotgun', 'hit', 'miss', 'jump', 'blast', 'confirm'].every((id) => rules.sounds.has(id)), 'each in data/sounds.json');
});
