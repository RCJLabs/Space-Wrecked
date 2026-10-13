// The approach phase's rules (src/sim/approach.js, ROADMAP §4.2), and M21's
// Done when for them: every roll at the odds shown; guns, engines, shields
// and the reactor each change how an approach goes (tools/approach.js, Law
// 1); and its damage carries into the boarding map as wrecked rooms.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { AIMS, choicesFor, closeChance, enemyOrder, fleeChance, hitChance, isOrder, lostShare, playRound, sideStats, targetsOf } from '../src/sim/approach.js';
import { shipStats } from '../src/sim/constraints.js';
import { generateShip } from '../src/sim/gen/ship.js';
import { cellAt } from '../src/sim/grid.js';
import { mapFromShip, WRECKS } from '../src/sim/mapFromShip.js';
import { ADDED, hostilePresets, launchedShip, runApproaches } from '../tools/approach.js';
import { rules } from './battleKit.js';

const { balance } = rules;
const you = launchedShip(rules);
const cutter = generateShip(rules, 'cutter', 1);
const tactics = rules.ships.get('cutter').tactics;
const side = (ship, wrecked = {}, damage = {}) => ({ ship, damage, wrecked });
const fresh = (round = 1) => ({ you: side(you), them: side(cutter.ship), round, tactics });
const uidsOf = (ship, tag) => ship.modules.filter((m) => rules.modules.get(m.type).tags.includes(tag)).map((m) => m.uid);
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
  assert.equal(hitChance(theirs, false, rules), balance.gunnery - theirs.evasion);
  assert.equal(hitChance(theirs, true, rules), balance.gunnery - theirs.evasion - balance.evadeBonus);
  assert.equal(fleeChance(mine, theirs, rules), balance.fleeChance + Math.round(balance.fleePerThrust * (mine.ratio - theirs.ratio)));
  assert.equal(closeChance(theirs, mine, rules), balance.closeChance + Math.round(balance.closePerThrust * (theirs.ratio - mine.ratio)));
  assert.equal(hitChance({ evasion: 500 }, true, rules), balance.chanceMin);
  assert.equal(hitChance({ evasion: -500 }, false, rules), balance.chanceMax);
  // The choices the screen shows: fire at each kind they have, with the
  // chance against their order; evade, with their guns' chance both ways.
  const intent = { kind: 'fire', at: 'engines' };
  const choices = choicesFor(fresh(), intent, rules);
  const fire = choices.find((c) => c.order.at === 'engines');
  assert.deepEqual([fire.ok, fire.guns, fire.chance, fire.damage], [true, mine.guns, hitChance(theirs, false, rules), balance.gunDamage]);
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
  for (const shot of volley.shots.filter((s) => s.hit)) assert.equal(shot.absorbed + shot.damage <= balance.gunDamage, true);
  // A wreck on the module hit least far from wrecked.
  const engines = uidsOf(cutter.ship, 'engine');
  const hurt = { [engines[1]]: rules.modules.get('engine').stats.hp - 1 };
  assert.equal(targetsOf(side(cutter.ship, {}, hurt), 'engines', rules)[0].uid, engines[1]);
  const { played: hit } = seedWhere({ ...fresh(), them: side(cutter.ship, {}, hurt) }, { kind: 'fire', at: 'engines' }, (p) => p.events.some((e) => e.side === 'you' && e.shots[0]?.hit));
  const shot = hit.events.find((e) => e.side === 'you').shots[0];
  assert.deepEqual([shot.module, shot.damage], [engines[1], 1]);
  assert.ok(WRECKS.includes(shot.wreck));
  assert.equal(hit.them.wrecked[engines[1]], shot.wreck);
  assert.equal(hit.them.damage[engines[1]], rules.modules.get('engine').stats.hp);
});

test('a round goes flights, then volleys, then boardings: a ship disabled by a volley closes on no one', () => {
  // The cutter closes from its boarding round; with its reactor about to
  // go, the player's volley can stop it.
  const reactor = uidsOf(cutter.ship, 'reactor')[0];
  const almost = { ...fresh(tactics.board), them: side(cutter.ship, {}, { [reactor]: rules.modules.get('reactor').stats.hp - 1 }) };
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
  const reactor = uidsOf(cutter.ship, 'reactor')[0];
  const almost = { ...fresh(), them: side(cutter.ship, {}, { [reactor]: rules.modules.get('reactor').stats.hp - 1 }) };
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

test("the player can't close to board a ship that can still fight, until the boarding fights", () => {
  const close = choicesFor(fresh(), { kind: 'fire', at: 'engines' }, rules).find((c) => c.order.kind === 'close');
  assert.equal(close.ok, false);
  assert.match(close.why, /boarding fights/);
  assert.equal(typeof close.chance, 'number', 'its odds still show');
  assert.deepEqual(playRound(fresh(), { kind: 'close' }, seedFrom(1), rules), { ok: false, error: close.why });
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

test('Law 1: a weapon mount, a shield or an engine added to the launched start ship each does better against a preset, and worse against none', () => {
  const rows = runApproaches(rules, { runs: 120 });
  const score = (ship, preset) => rows.find((row) => row.ship === ship && row.preset === preset).score;
  for (const part of ADDED) {
    const deltas = hostilePresets(rules).map((preset) => score(`+${part}`, preset) - score('start', preset));
    assert.ok(deltas.some((delta) => delta >= 10), `+${part} does better against some preset: ${deltas}`);
    assert.ok(deltas.every((delta) => delta >= -3), `+${part} does worse against none: ${deltas}`);
  }
  // The same seeds always play out the same.
  assert.deepEqual(runApproaches(rules, { runs: 5 }), runApproaches(rules, { runs: 5 }));
});
