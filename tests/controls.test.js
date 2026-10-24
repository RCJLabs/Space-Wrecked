// M47: controls and feel. Four settings (save v43): the hand the orders sit
// for, the playback's speed, what confirms, and vibration; and which moments
// of a fight's and an approach's playback vibrate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { MS, roundTimeline } from '../src/render/approachPlayback.js';
import { cuesBetween, makeTimeline } from '../src/render/playback.js';
import { act, createBattle } from '../src/sim/battle.js';
import { CONFIRMS, defaultSettings, HANDS, reduceSettings, settingsProblems, SPEEDS } from '../src/sim/settings.js';
import { settingsText } from '../src/ui/settingsText.js';
import { fightBuzz, PULSE, roundBuzz, roundBuzzes } from '../src/ui/vibrations.js';
import { openMap, rules } from './battleKit.js';

test('the four settings: their defaults, the values each takes, checked in a save, and on the Settings screen', () => {
  const settings = defaultSettings();
  assert.deepEqual([settings.hand, settings.speed, settings.confirm, settings.vibration], ['right', 100, 'taps', true]);
  assert.deepEqual([HANDS, SPEEDS, CONFIRMS], [['right', 'left'], [100, 150, 200], ['taps', 'hold']]);
  const apply = (type, value) => reduceSettings(settings, { type: `settings/${type}`, value });
  assert.equal(apply('hand', 'left').hand, 'left');
  assert.equal(apply('hand', 'both'), settings);
  assert.equal(apply('speed', 200).speed, 200);
  assert.equal(apply('speed', 300), settings);
  assert.equal(apply('speed', '150'), settings);
  assert.equal(apply('confirm', 'hold').confirm, 'hold');
  assert.equal(apply('confirm', 'swipe'), settings);
  assert.equal(apply('vibration', false).vibration, false);
  assert.equal(apply('vibration', 'off'), settings);
  assert.equal(apply('hand', 'right'), settings, 'the same value changes nothing');
  assert.deepEqual(settingsProblems({ ...settings, hand: 'up', speed: 0, confirm: null, vibration: 1 }), [
    'The hand setting is invalid.',
    'The playback speed setting is invalid.',
    'The confirm setting is invalid.',
    'The vibration setting is invalid.',
  ]);
  const rows = Object.fromEntries(settingsText({ ...settings, hand: 'left', speed: 200, confirm: 'hold' }, rules.balance).map((row) => [row.key, row]));
  assert.deepEqual(['hand', 'confirm', 'speed', 'vibration'].map((key) => [rows[key].title, rows[key].action]), [
    ['Hand', 'settings/hand'],
    ['Confirm', 'settings/confirm'],
    ['Playback speed', 'settings/speed'],
    ['Vibration', 'settings/vibration'],
  ]);
  assert.deepEqual(rows.speed.choices.map((c) => c.label), ['1×', '1.5×', '2×']);
  assert.match(rows.hand.line, /on the left/);
  assert.match(rows.confirm.line, /hold it to do it/);
  assert.match(rows.speed.line, /2 times as fast/);
  assert.match(rows.vibration.line, /buzzes/);
});

test('save v43: a save from before has the four settings at their defaults', () => {
  assert.equal(SAVE_VERSION, 47);
  const { hand, speed, confirm, vibration, ...v42 } = { ...defaultSettings(), colors: 'safe' };
  const moved = migrate({ version: 42, data: { settings: v42, campaign: null } });
  assert.equal(moved.version, 47);
  assert.deepEqual(moved.data.settings, { ...defaultSettings(), colors: 'safe' });
});

// A shot from `shooter` at `target` that hits, crit or not, and its playback
// moment as it lands.
function shotMoment(battle, shooter, target, { crit = false } = {}) {
  return { event: { type: 'shot', unit: shooter, target, hit: true, crit, damage: 2 }, lands: true };
}

test("a fight's vibrations: the crew hit, downed, landing a shot, and a crit's second pulse", () => {
  const battle = createBattle({ map: openMap(6, 1), units: [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], seed: 3 }, rules).battle;
  assert.equal(fightBuzz(shotMoment(battle, 'e1', 'c1'), battle), PULSE.hit, 'a crew member hit');
  assert.equal(fightBuzz(shotMoment(battle, 'c1', 'e1'), battle), PULSE.light, "the crew's shot lands");
  assert.deepEqual(fightBuzz(shotMoment(battle, 'e1', 'c1', { crit: true }), battle), [PULSE.hit, PULSE.gap, PULSE.hit]);
  assert.deepEqual(fightBuzz(shotMoment(battle, 'c1', 'e1', { crit: true }), battle), [PULSE.light, PULSE.gap, PULSE.light]);
  assert.equal(fightBuzz({ event: { type: 'shot', unit: 'e1', target: 'c1', hit: false }, lands: true }, battle), null, 'a miss');
  assert.equal(fightBuzz({ event: { type: 'shot', unit: 'e1', target: 'c1', hit: true }, lands: false }, battle), null, 'as it fires');
  assert.equal(fightBuzz({ event: { type: 'down', unit: 'c1' } }, battle), PULSE.long);
  assert.equal(fightBuzz({ event: { type: 'down', unit: 'e1' } }, battle), null, 'an enemy down');
  assert.equal(fightBuzz({ event: { type: 'move', unit: 'c1', path: [[0, 0], [1, 0]] } }, battle), null);
  // A real shot, played: its moment as it lands vibrates as its hit says.
  const shot = act(battle, { type: 'shoot', unit: 'c1', target: 'e1' }, rules);
  assert.ok(shot.ok, shot.error);
  const timeline = makeTimeline(battle, [{ events: shot.events, battle: shot.battle }]);
  const landed = cuesBetween(timeline, -1, timeline.length).filter((m) => m.event.type === 'shot' && m.lands);
  assert.equal(landed.length, 1);
  assert.equal(fightBuzz(landed[0], shot.battle) !== null, landed[0].event.hit);
});

test("an approach's vibrations: the ship hit as each shot lands, a wreck the longer, and the round's hardest at once", () => {
  const side = { guns: [{ at: [0, 0, 0] }, { at: [0, 1, 0] }], center: [0, 0, 0], edge: [1, 0, 0], partAt: () => [0, 0, 0], miss: () => [0, 0, 0] };
  const geometry = { you: side, them: side };
  const shot = (hit, wreck = null) => ({ roll: 1, hit, absorbed: 0, damage: hit ? 1 : 0, module: hit ? 'm1' : null, wreck });
  const events = [
    { kind: 'volley', side: 'you', shots: [shot(true)] },
    { kind: 'volley', side: 'them', shots: [shot(true), shot(true, 'fire'), shot(false)] },
  ];
  const timeline = roundTimeline({ events, before: { you: {}, them: {} }, geometry });
  assert.deepEqual(roundBuzzes(timeline, -1, timeline.ms ?? 1e9), [PULSE.hit, PULSE.long], 'their two hits; not ours, not the miss');
  const firstLands = timeline.beats.filter((b) => b.kind === 'shot' && b.side === 'them')[0].lands;
  assert.deepEqual(roundBuzzes(timeline, -1, firstLands), [PULSE.hit], 'each as it lands');
  assert.equal(firstLands > MS.travel, true);
  assert.equal(roundBuzz({ events }), PULSE.long);
  assert.equal(roundBuzz({ events: events.slice(0, 1) }), null, 'only ours: nothing');
  assert.equal(roundBuzz(null), null);
});

test('hold to confirm: a hold acts at once, a tap only on an armed button and only with taps confirming', async () => {
  const { again, confirms, holdWords } = await import('../src/ui/confirm.js');
  assert.deepEqual([confirms(false, { held: false }, false), confirms(true, { held: false }, false), confirms(true, undefined, false)], [false, true, true], 'two taps');
  assert.deepEqual([confirms(false, { held: false }, true), confirms(true, { held: false }, true), confirms(false, { held: true }, true)], [false, false, true], 'holds');
  assert.equal(again('End turn', false), 'Tap End turn again');
  assert.equal(again('End turn', true), 'Hold End turn');
  const said = (text) => holdWords(text, true);
  assert.equal(said('Fly home: 2 days back. Tap again to fly.'), 'Fly home: 2 days back. Hold to fly.');
  assert.equal(said('Lift off? Tap Launch again.'), 'Lift off? Hold Launch.');
  assert.equal(said('The hunters will be waiting there. Tap Jump on again.'), 'The hunters will be waiting there. Hold Jump on.');
  assert.equal(said('Tap an order to see its odds; tap it again to give it.'), 'Tap an order to see its odds; hold it to give it.');
  assert.equal(said('Tap it again, or Jump, to go.'), 'Hold it, or Jump, to go.');
  assert.equal(said('Tap Sign on to see what a recruit takes, and again to sign them on.'), 'Tap Sign on to see what a recruit takes, and hold to sign them on.');
  assert.equal(said('A farm here: tap it again to build it.'), 'A farm here: hold it to build it.');
  assert.equal(said('No second step here.'), 'No second step here.');
  assert.equal(holdWords('Tap again to fly.', false), 'Tap again to fly.', 'with taps, as written');
});

test("the boards: whether a tap acts (the fight's shown move, the builder's ghost) or only shows", async () => {
  const { createFight, reduceFight, tapActs } = await import('../src/sim/fight.js');
  const battle = createBattle({ map: openMap(6, 1), units: [{ kind: 'marine', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }], seed: 3 }, rules).battle;
  let fight = createFight(battle, rules);
  fight = reduceFight(fight, { type: 'fight/select', unit: 'c1' }, rules);
  assert.equal(tapActs(fight, 2, 0, rules), false, 'the first tap shows the move');
  const shown = reduceFight(fight, { type: 'fight/tap', x: 2, y: 0 }, rules);
  assert.equal(shown.preview?.type, 'move');
  assert.equal(tapActs(shown, 2, 0, rules), true, 'the second acts');
  assert.equal(tapActs(shown, 3, 0, rules), false, 'elsewhere it shows another');
  const { createSession, reduceSession, tapOnGhost } = await import('../src/sim/session.js');
  const { readyToLaunch } = await import('./launchKit.js');
  const ship = readyToLaunch().ship;
  let session = createSession(ship, [], { cargo: 1 }, []);
  session = reduceSession(session, { type: 'build/arm', moduleType: 'cargo' }, rules);
  assert.equal(tapOnGhost(session, rules, 0, 0), false, 'no ghost yet');
  for (let y = -6; y < 12 && !session.ghost; y++) for (let x = -6; x < 16 && !session.ghost; x++) session = reduceSession(session, { type: 'build/tap', x: x + 0.5, y: y + 0.5 }, rules);
  assert.ok(session.ghost, 'a ghost somewhere');
  assert.equal(tapOnGhost(session, rules, session.ghost.x + 0.5, session.ghost.y + 0.5), true);
  assert.equal(tapOnGhost(session, rules, session.ghost.x - 20, session.ghost.y), false);
});
