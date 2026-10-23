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
  assert.equal(SAVE_VERSION, 43);
  const { hand, speed, confirm, vibration, ...v42 } = { ...defaultSettings(), colors: 'safe' };
  const moved = migrate({ version: 42, data: { settings: v42, campaign: null } });
  assert.equal(moved.version, 43);
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
