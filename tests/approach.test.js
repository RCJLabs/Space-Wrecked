// The approach phase's rules (src/sim/approach.js, ROADMAP §4.2), and M21's
// Done when for them: every roll at the odds shown; guns, engines, shields
// and the reactor each change how an approach goes (tools/approach.js, Law
// 1); and its damage carries into the boarding map as wrecked rooms. And
// M23e's: a gun's damage and a shield's strength are its part's, point
// defense cuts the other ship's odds, and each of the new parts that fights
// changes how an approach goes. And M31's: each maker's parts change it,
// Kestrel's as a trade on a shielded ship.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { AIMS, choicesFor, closeChance, enemyOrder, fleeChance, hitChance, isOrder, lostShare, OUTCOMES, playRound, sideStats, targetsOf } from '../src/sim/approach.js';
import { shipStats } from '../src/sim/constraints.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { cellAt } from '../src/sim/grid.js';
import { mapFromShip, WRECKS } from '../src/sim/mapFromShip.js';
import { ADDED, hostilePresets, launchedShip, runApproaches, withPart } from '../tools/approach.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const you = launchedShip(rules);
const cutter = generateShip(rules, 'cutter', 1);
const tactics = rules.ships.get('cutter').tactics;
const side = (ship, wrecked = {}, damage = {}) => ({ ship, damage, wrecked });
const fresh = (round = 1) => ({ you: side(you), them: side(cutter.ship), round, tactics });
const uidsOf = (ship, tag) => ship.modules.filter((m) => rules.modules.get(m.type).tags.includes(tag)).map((m) => m.uid);
const hpOf = (ship, uid) => rules.modules.get(ship.modules.find((m) => m.uid === uid).type).stats.hp;
const bounded = (chance) => Math.max(balance.chanceMin, Math.min(balance.chanceMax, chance));
// A ship whose reactors are all wrecked but the last, and that one a hit
// point from it: { wrecked, damage } for side().
function lastReactorGoing(ship) {
  const reactors = uidsOf(ship, 'reactor');
  const last = reactors.at(-1);
  return { wrecked: Object.fromEntries(reactors.slice(0, -1).map((uid) => [uid, 'fire'])), damage: { [last]: hpOf(ship, last) - 1 }, last };
}
// The first seed whose round, played with `order`, does what `test` asks.
function seedWhere(state, order, test, from = 0) {
  for (let seed = from; seed < from + 5000; seed++) {
    const played = playRound(state, order, seedFrom(seed), rules);
    if (test(played)) return { seed, played };
  }
  throw new Error('No seed found');
}

test("a ship's numbers come from the modules it has working", () => {
  const stats = sideStats(side(you), rules);
  const thrust = uidsOf(you, 'engine').length * rules.modules.get('engine').stats.thrust;
  assert.deepEqual([stats.guns, stats.shields, stats.thrust, stats.mass], [uidsOf(you, 'weapon').length, 0, thrust, shipStats(you, rules).mass]);
  assert.equal(stats.evasion, Math.round((balance.evasionPerThrust * thrust) / stats.mass));
  assert.deepEqual([stats.powered, stats.moving, stats.disabled], [true, true, false]);
  // A wrecked engine takes its thrust, not its mass; no engine or no
  // reactor working, disabled.
  const [engine] = uidsOf(you, 'engine');
  const less = sideStats(side(you, { [engine]: 'fire' }), rules);
  assert.deepEqual([less.thrust, less.mass], [thrust - rules.modules.get('engine').stats.thrust, stats.mass]);
  assert.equal(sideStats(side(you, Object.fromEntries(uidsOf(you, 'engine').map((uid) => [uid, 'rubble']))), rules).disabled, true);
  assert.equal(sideStats(side(you, Object.fromEntries(uidsOf(you, 'reactor').map((uid) => [uid, 'fire']))), rules).disabled, true);
});

test('the odds: guns against evasion, fleeing and closing by thrust for mass, each within its bounds', () => {
  const mine = sideStats(side(you), rules);
  const theirs = sideStats(side(cutter.ship), rules);
  assert.equal(hitChance(theirs, false, rules), bounded(balance.gunnery - theirs.evasion));
  assert.equal(hitChance(theirs, true, rules), bounded(balance.gunnery - theirs.evasion - balance.evadeBonus));
  assert.equal(fleeChance(mine, theirs, rules), bounded(balance.fleeChance + Math.round(balance.fleePerThrust * (mine.ratio - theirs.ratio))));
  assert.equal(closeChance(theirs, mine, rules), bounded(balance.closeChance + Math.round(balance.closePerThrust * (theirs.ratio - mine.ratio))));
  assert.equal(hitChance({ evasion: 500, intercept: 0 }, true, rules), balance.chanceMin);
  assert.equal(hitChance({ evasion: -500, intercept: 0 }, false, rules), balance.chanceMax);
  // The choices the screen shows: fire at each kind they have, with the
  // chance against their order; evade, with their guns' chance both ways.
  const intent = { kind: 'fire', at: 'engines' };
  const choices = choicesFor(fresh(), intent, rules);
  const fire = choices.find((c) => c.order.at === 'engines');
  assert.deepEqual([fire.ok, fire.guns, fire.chance, fire.damages], [true, mine.guns, hitChance(theirs, false, rules), mine.damages]);
  assert.deepEqual(choices.find((c) => c.order.at === 'shields'), { ...choices.find((c) => c.order.at === 'shields'), ok: false, why: 'They have no working shields.' });
  const evade = choices.find((c) => c.order.kind === 'evade');
  assert.deepEqual([evade.chance, evade.was], [hitChance(mine, true, rules), hitChance(mine, false, rules)]);
  assert.equal(choicesFor(fresh(), { kind: 'evade' }, rules).find((c) => c.order.at === 'engines').chance, hitChance(theirs, true, rules), 'against a ship that evades');
});

test('every shot, flight and boarding rolls at the chance shown', () => {
  const state = fresh();
  const intent = enemyOrder(state, rules);
  const shown = choicesFor(state, intent, rules).find((c) => c.order.at === 'reactor');
  let hits = 0;
  let shots = 0;
  for (let seed = 0; seed < 1500; seed++) {
    const played = playRound(state, { kind: 'fire', at: 'reactor' }, seedFrom(seed), rules);
    const volley = played.events.find((e) => e.kind === 'volley' && e.side === 'you');
    assert.equal(volley.chance, shown.chance);
    for (const shot of volley.shots) {
      assert.equal(shot.hit, shot.roll < shown.chance);
      shots += 1;
      hits += shot.hit ? 1 : 0;
    }
  }
  assert.ok(Math.abs(hits / shots - shown.chance / 100) < 0.04, `${shown.chance}% shown, ${Math.round((100 * hits) / shots)}% hit`);
  const flee = choicesFor(state, intent, rules).find((c) => c.order.kind === 'flee');
  for (let seed = 0; seed < 50; seed++) {
    const played = playRound(state, { kind: 'flee' }, seedFrom(seed), rules);
    const flight = played.events[0];
    assert.deepEqual([flight.kind, flight.chance, flight.ok], ['flee', flee.chance, flight.roll < flee.chance]);
    assert.equal(played.outcome?.kind === 'escaped', flight.ok);
    if (flight.ok) assert.equal(played.events.length, 1, 'gone before anyone fires');
  }
  // The other ship's boarding and flight, at the chances its order shows
  // (approachText.js), worked out before the round.
  const closing = fresh(tactics.board);
  const shownClose = closeChance(sideStats(closing.them, rules), sideStats(closing.you, rules), rules);
  for (let seed = 0; seed < 50; seed++) {
    const played = playRound(closing, { kind: 'evade' }, seedFrom(seed), rules);
    const close = played.events.find((e) => e.kind === 'close');
    assert.deepEqual([close.side, close.chance, close.ok], ['them', shownClose, close.roll < shownClose]);
    assert.equal(played.outcome?.kind === 'boardedBy', close.ok);
  }
  const worn = Object.fromEntries(AIMS.flatMap((aim) => targetsOf(side(cutter.ship), aim, rules)).map((t) => [t.uid, t.hp - 1]));
  const running = { ...fresh(), them: side(cutter.ship, {}, worn) };
  assert.deepEqual(enemyOrder(running, rules), { kind: 'flee' });
  const shownFlee = fleeChance(sideStats(running.them, rules), sideStats(running.you, rules), rules);
  for (let seed = 0; seed < 50; seed++) {
    const played = playRound(running, { kind: 'evade' }, seedFrom(seed), rules);
    const flight = played.events[0];
    assert.deepEqual([flight.kind, flight.side, flight.chance, flight.ok], ['flee', 'them', shownFlee, flight.roll < shownFlee]);
    assert.equal(played.outcome?.kind === 'fled', flight.ok);
  }
});

test('shields soak up hits first; a hit lands on the module with the fewest hit points left, and wrecks it at none', () => {
  const corvette = generateShip(rules, 'corvette', 2);
  const theirs = sideStats(side(corvette.ship), rules);
  assert.ok(theirs.shields > 0);
  const state = { you: side(you), them: side(corvette.ship), round: 1, tactics: rules.ships.get('corvette').tactics };
  const { played } = seedWhere(state, { kind: 'fire', at: 'engines' }, (p) => p.events.some((e) => e.side === 'you' && e.shots.some((s) => s.hit)));
  const volley = played.events.find((e) => e.kind === 'volley' && e.side === 'you');
  const absorbed = volley.shots.reduce((sum, shot) => sum + shot.absorbed, 0);
  assert.ok(absorbed > 0 && absorbed <= theirs.shields);
  const most = Math.max(...sideStats(side(you), rules).damages);
  for (const shot of volley.shots.filter((s) => s.hit)) assert.equal(shot.absorbed + shot.damage <= most, true);
  // A wreck on the module hit least far from wrecked.
  const engines = uidsOf(cutter.ship, 'engine');
  const hurt = { [engines[1]]: hpOf(cutter.ship, engines[1]) - 1 };
  assert.equal(targetsOf(side(cutter.ship, {}, hurt), 'engines', rules)[0].uid, engines[1]);
  const { played: hit } = seedWhere({ ...fresh(), them: side(cutter.ship, {}, hurt) }, { kind: 'fire', at: 'engines' }, (p) => p.events.some((e) => e.side === 'you' && e.shots[0]?.hit));
  const shot = hit.events.find((e) => e.side === 'you').shots[0];
  assert.deepEqual([shot.module, shot.damage], [engines[1], 1]);
  assert.ok(WRECKS.includes(shot.wreck));
  assert.equal(hit.them.wrecked[engines[1]], shot.wreck);
  assert.equal(hit.them.damage[engines[1]], hpOf(cutter.ship, engines[1]));
});

test('a round goes flights, then volleys, then boardings: a ship disabled by a volley closes on no one', () => {
  // The cutter closes from its boarding round; with its last reactor about
  // to go, the player's volley can stop it.
  const going = lastReactorGoing(cutter.ship);
  const almost = { ...fresh(tactics.board), them: side(cutter.ship, going.wrecked, going.damage) };
  assert.equal(enemyOrder(almost, rules).kind, 'close');
  const { played } = seedWhere(almost, { kind: 'fire', at: 'reactor' }, (p) => p.events.some((e) => e.side === 'you' && e.shots.some((s) => s.hit)));
  assert.ok(['boarded', 'destroyed'].includes(played.outcome.kind));
  assert.ok(!played.events.some((e) => e.kind === 'close'), 'it never closed');
  // Closing comes after the volleys, at the odds shown before them.
  const { played: closed } = seedWhere(fresh(tactics.board), { kind: 'evade' }, (p) => p.outcome?.kind === 'boardedBy');
  assert.deepEqual(closed.events.map((e) => e.kind), ['close']);
  assert.equal(closed.outcome.how, 'closed');
  // The last round passes: the ships part.
  const { played: last } = seedWhere({ ...fresh(balance.approachRounds), tactics: { aim: ['weapons'] } }, { kind: 'evade' }, (p) => p.outcome?.kind === 'parted');
  assert.equal(last.round, balance.approachRounds);
});

test('a wrecked last reactor blows up blowChance times in 100; the player\'s ship never blows', () => {
  const going = lastReactorGoing(cutter.ship);
  const almost = { ...fresh(), them: side(cutter.ship, going.wrecked, going.damage) };
  let blown = 0;
  let wrecked = 0;
  for (let seed = 0; seed < 1500; seed++) {
    const played = playRound(almost, { kind: 'fire', at: 'reactor' }, seedFrom(seed), rules);
    const blow = played.events.find((e) => e.kind === 'blow');
    if (!blow) continue;
    wrecked += 1;
    assert.equal(blow.chance, balance.blowChance);
    assert.equal(played.outcome.kind, blow.ok ? 'destroyed' : played.outcome.kind);
    if (blow.ok) blown += 1;
    else assert.ok(['boarded', 'adrift'].includes(played.outcome.kind), 'no reactor: disabled, and boarded');
  }
  assert.ok(Math.abs(blown / wrecked - balance.blowChance / 100) < 0.06, `${blown} of ${wrecked}`);
  // The player's reactor going leaves the player disabled and boarded.
  const mine = uidsOf(you, 'reactor')[0];
  const theirTurn = { you: side(you, {}, { [mine]: rules.modules.get('reactor').stats.hp - 1 }), them: side(cutter.ship), round: 1, tactics: { aim: ['reactor'] } };
  const { played } = seedWhere(theirTurn, { kind: 'evade' }, (p) => p.you.wrecked[mine] !== undefined);
  assert.equal(played.outcome.kind, 'boardedBy');
  assert.ok(!played.events.some((e) => e.kind === 'blow'));
});

test("the other ship's tactics: fire at what it aims at, close from its round, run when it has lost enough", () => {
  assert.deepEqual(enemyOrder(fresh(), rules), { kind: 'fire', at: tactics.aim[0] });
  assert.deepEqual(enemyOrder(fresh(tactics.board), rules), { kind: 'close' });
  // With the player's engines gone, it aims at the next thing on its list.
  const noEngines = { ...fresh(), you: side(you, Object.fromEntries(uidsOf(you, 'engine').map((uid) => [uid, 'fire']))) };
  assert.deepEqual(enemyOrder(noEngines, rules), { kind: 'fire', at: tactics.aim[1] });
  // Hurt past its flee share, it runs.
  const all = Object.fromEntries(cutter.ship.modules.filter((m) => AIMS.some((aim) => targetsOf(side(cutter.ship), aim, rules).some((t) => t.uid === m.uid))).map((m) => [m.uid, rules.modules.get(m.type).stats.hp - 1]));
  const hurt = { ...fresh(), them: side(cutter.ship, {}, all) };
  assert.ok(lostShare(hurt.them, rules) >= tactics.flee);
  assert.deepEqual(enemyOrder(hurt, rules), { kind: 'flee' });
});

test('the player can close to board a ship that can still fight, at the odds shown, unless the engines are out', () => {
  const close = choicesFor(fresh(), { kind: 'fire', at: 'engines' }, rules).find((c) => c.order.kind === 'close');
  assert.deepEqual([close.ok, close.why], [true, null]);
  const { played } = seedWhere(fresh(), { kind: 'close' }, (p) => p.outcome?.kind === 'boarded');
  const roll = played.events.find((e) => e.kind === 'close' && e.side === 'you');
  assert.deepEqual([roll.chance, roll.ok, played.outcome.how], [close.chance, true, 'closed']);
  // With no engine working, it can't close.
  const stuck = { ...fresh(), you: side(you, Object.fromEntries(uidsOf(you, 'engine').map((uid) => [uid, 'fire']))) };
  const refused = choicesFor(stuck, { kind: 'fire', at: 'engines' }, rules).find((c) => c.order.kind === 'close');
  assert.deepEqual([refused.ok, refused.why], [false, 'Your engines are out.']);
  assert.deepEqual(playRound(stuck, { kind: 'close' }, seedFrom(1), rules), { ok: false, error: 'Your engines are out.' });
  assert.equal(playRound(fresh(), { kind: 'fire', at: 'nowhere' }, seedFrom(1), rules).ok, false);
  assert.equal(isOrder({ kind: 'fire', at: 'shields' }), true);
  assert.equal(isOrder({ kind: 'flee', at: 'shields' }), false);
});

test('damage carries into the boarding map: every wrecked room has its hazard on every tile', () => {
  const { played } = seedWhere(fresh(), { kind: 'fire', at: 'engines' }, (p) => Object.keys(p.you.wrecked).length > 0 && Object.keys(p.them.wrecked).length > 0);
  for (const [who, ship] of [['you', you], ['them', cutter.ship]]) {
    const { wrecked } = played[who];
    const map = mapFromShip(ship, rules, { wrecked });
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const uid = cellAt(map.roomAt, x, y);
        assert.equal(cellAt(map.hazards, x, y), uid === null ? null : (wrecked[uid] ?? null), `${who}: tile ${x}, ${y}`);
      }
    }
    assert.deepEqual(Object.fromEntries(map.rooms.filter((room) => room.wreck).map((room) => [room.uid, room.wreck])), Object.fromEntries(Object.entries(wrecked).map(([uid, wreck]) => [Number(uid), wreck])));
  }
});

test("a gun's damage and a shield's strength are its part's", () => {
  const mount = rules.modules.get('weapon');
  const cannon = rules.modules.get('cannon');
  // Guns fire in the order they were fitted, each for its own damage.
  const armed = withPart(you, rules, 'cannon');
  assert.deepEqual(sideStats(side(armed), rules).damages, [mount.damage, cannon.damage]);
  assert.ok(cannon.damage > mount.damage);
  // Shields add up what each one holds.
  const shielded = withPart(withPart(you, rules, 'shield'), rules, 'shieldarray');
  assert.equal(sideStats(side(shielded), rules).shields, rules.modules.get('shield').shield + rules.modules.get('shieldarray').shield);
  // The order shows each gun's damage; the volley does it.
  const state = { ...fresh(), you: side(armed) };
  const fire = choicesFor(state, enemyOrder(state, rules), rules).find((c) => c.order.at === 'reactor');
  assert.deepEqual(fire.damages, [mount.damage, cannon.damage]);
  const reactor = uidsOf(cutter.ship, 'reactor')[0];
  const { played } = seedWhere(state, { kind: 'fire', at: 'reactor' }, (p) => p.events.some((e) => e.side === 'you' && !e.shots[0].hit && e.shots[1].hit));
  const shot = played.events.find((e) => e.side === 'you').shots[1];
  assert.deepEqual([shot.module, shot.absorbed, shot.damage], [reactor, 0, Math.min(cannon.damage, hpOf(cutter.ship, reactor))]);
  // Through a shield generator, a cannon's hit still wrecks a gun; a mount's
  // doesn't (ROADMAP §5).
  const generator = rules.modules.get('shield').shield;
  assert.ok(cannon.damage - generator >= mount.stats.hp && mount.damage - generator < mount.stats.hp);
});

test("point defense takes its intercept off the other ship's hit chance, up to interceptMax, and is shot at as a gun", () => {
  const turret = rules.modules.get('pointdefense');
  const one = withPart(you, rules, 'pointdefense');
  const mine = sideStats(side(one), rules);
  assert.equal(mine.intercept, turret.intercept);
  assert.equal(hitChance(mine, false, rules), balance.gunnery - mine.evasion - turret.intercept);
  assert.equal(sideStats(side(you), rules).intercept, 0);
  // More turrets take off more, up to the most.
  let many = one;
  for (let i = 0; i < 3; i++) many = withPart(many, rules, 'pointdefense');
  assert.equal(sideStats(side(many), rules).intercept, balance.interceptMax);
  assert.ok(4 * turret.intercept > balance.interceptMax);
  // The other ship's guns roll at the chance the evade order shows, the cut
  // in it (Law 4).
  const state = { ...fresh(), you: side(one) };
  const evade = choicesFor(state, enemyOrder(state, rules), rules).find((c) => c.order.kind === 'evade');
  assert.deepEqual([evade.was, evade.chance], [hitChance(mine, false, rules), hitChance(mine, true, rules)]);
  const { played } = seedWhere(state, { kind: 'evade' }, (p) => p.events.some((e) => e.kind === 'volley' && e.side === 'them'));
  assert.equal(played.events.find((e) => e.side === 'them').chance, evade.chance);
  // Aimed at the guns, a volley hits the turret first (it has the fewest hit
  // points left); wrecked, it takes nothing off.
  const [uid] = uidsOf(one, 'pointdefense');
  assert.equal(targetsOf(side(one), 'weapons', rules)[0].uid, uid);
  assert.equal(sideStats(side(one, { [uid]: 'fire' }), rules).intercept, 0);
  assert.equal(sideStats(side(one), rules).guns, sideStats(side(you), rules).guns, 'a turret is no gun');
});

// Law 1 for the parts an approach plays with (tools/approach.js ADDED):
// each changes how it goes against some preset, by winning more (10 in every
// 100 on the score) or by losing less (5 fewer boardings of the player's ship
// in every 100). And the guns, shields and engines, whose job the approach
// is, do worse against none (3 points of score at most, within the dice),
// but for one trade measured since M31: the shield array's mass lets the
// Halloran runner, light on Kestrel's parts, board the ship a little more
// often (4 points at 300 approaches, 5 at 120).
// The small reactor's job is power: as a spare it keeps the ship going
// against a ship that fires at reactors, and its mass costs a little against
// one that doesn't.
const FIGHTING = ['weapons', 'defense', 'engines'];
const TRADES = [{ part: 'shieldarray', preset: 'runner', score: -5 }];
test("Law 1: each part an approach plays with, added to the launched start ship, changes how it goes; the guns, shields and engines do worse against no preset; each maker's versions change it too", () => {
  const rows = runApproaches(rules, { runs: 120 });
  const row = (ship, preset) => rows.find((r) => r.ship === ship && r.preset === preset);
  for (const part of ADDED) {
    const deltas = hostilePresets(rules).map((preset) => ({
      preset,
      score: row(`+${part}`, preset).score - row('start', preset).score,
      fewer: Math.round((100 * (row('start', preset).losses - row(`+${part}`, preset).losses)) / row('start', preset).runs),
    }));
    assert.ok(deltas.some((d) => d.score >= 10 || d.fewer >= 5), `+${part} does better against some preset: ${JSON.stringify(deltas)}`);
    const worst = (d) => TRADES.find((t) => t.part === part && t.preset === d.preset)?.score ?? -3;
    if (FIGHTING.includes(rules.modules.get(part).category)) assert.ok(deltas.every((d) => d.score >= worst(d)), `+${part} does worse against none: ${JSON.stringify(deltas)}`);
  }
  assert.equal(rules.modules.get('smallreactor').category, 'power');
  assert.ok(rules.ships.get('corvette').tactics.aim.includes('reactor'), 'the corvette fires at reactors');
  // v0.1's gun, shield and engine each win more against some preset, as in M21.
  for (const part of ['weapon', 'shield', 'engine']) {
    assert.ok(hostilePresets(rules).some((preset) => row(`+${part}`, preset).score - row('start', preset).score >= 10), part);
  }
  const runs = row('start', 'cutter').runs;
  const yard = (preset) => row('start', preset);
  const fares = (a, b, preset) => OUTCOMES.some((kind) => Math.abs(a(preset).outcomes[kind] - b(preset).outcomes[kind]) >= runs / 10);
  // M23g: the start ship with Bastion's version of every part. Its mass
  // costs evasion against every preset; its hit points lose it half the
  // parts or fewer to some preset's volleys; and the approaches end
  // differently, by a tenth of them or more against some preset.
  const bastion = (preset) => row('start bastion', preset);
  assert.ok(hostilePresets(rules).every((preset) => bastion(preset).evasion < yard(preset).evasion), 'Bastion evades less');
  assert.ok(hostilePresets(rules).some((preset) => bastion(preset).wrecked * 2 <= yard(preset).wrecked), 'Bastion loses fewer parts');
  assert.ok(hostilePresets(rules).some((preset) => fares(bastion, yard, preset)), 'Bastion fares differently');
  // M31: Kestrel's, lighter, evade more against every preset: fewer of its
  // shots land. With a shield fitted, each maker's own, its frailer parts
  // break more often for each hit, and it fares worse than the Yard's
  // against some preset (Evan's call: without a shield every preset's first
  // targets die to one hit whoever made them, and the lighter ship does
  // better against every preset).
  const kestrel = (preset) => row('start kestrel', preset);
  const [shielded, kestrelShielded] = [(preset) => row('+shield', preset), (preset) => row('start kestrel +shield', preset)];
  assert.ok(hostilePresets(rules).every((preset) => kestrel(preset).evasion > yard(preset).evasion && kestrel(preset).hits < yard(preset).hits), 'Kestrel evades more');
  const perHit = (r) => r.wrecked / r.hits;
  assert.ok(hostilePresets(rules).some((preset) => perHit(kestrelShielded(preset)) > perHit(shielded(preset))), "Kestrel's parts break sooner");
  assert.ok(hostilePresets(rules).some((preset) => kestrelShielded(preset).score < shielded(preset).score), 'shielded, Kestrel fares worse against some preset');
  // M31: Scrapline's, with the reactor it needs to fly: the reactor's mass
  // costs it evasion, and the approaches end differently.
  const scrapline = (preset) => row('start scrapline', preset);
  assert.ok(hostilePresets(rules).every((preset) => scrapline(preset).evasion < yard(preset).evasion), 'Scrapline evades less');
  assert.ok(hostilePresets(rules).some((preset) => fares(scrapline, yard, preset)), 'Scrapline fares differently');
  // The same seeds always play out the same.
  assert.deepEqual(runApproaches(rules, { runs: 5 }), runApproaches(rules, { runs: 5 }));
});
