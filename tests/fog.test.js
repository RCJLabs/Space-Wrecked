// M45: fog of war, a setting (save v41): which enemies the crew can see,
// for the screen to hide the rest; the rules and the AI are the same with
// it on or off. And the board's playback of the door events lands where the
// rules do.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { applyEvent } from '../src/render/playback.js';
import { act, createBattle } from '../src/sim/battle.js';
import { defaultSettings, reduceSettings, settingsProblems } from '../src/sim/settings.js';
import { sightedBy } from '../src/sim/sight.js';
import { openMap, rules, wall } from './battleKit.js';
import { settingsText } from '../src/ui/settingsText.js';

const battleOf = (units) => createBattle({ map: wall(openMap(6, 1), 2, 0, 'e', 'door'), units, seed: 7 }, rules).battle;

test('fog of war: the enemies one of the crew standing can see, and no others', () => {
  const battle = battleOf([{ kind: 'marine', x: 3, y: 0 }, { kind: 'pirate', x: 0, y: 0 }, { kind: 'pirate', x: 5, y: 0 }]);
  assert.deepEqual([...sightedBy(battle, 'crew', rules)], ['e2'], 'the one behind the closed door is hidden');
  const opened = act(battle, { type: 'open', unit: 'c1', side: 'w' }, rules).battle;
  assert.deepEqual([...sightedBy(opened, 'crew', rules)].sort(), ['e1', 'e2']);
  const down = { ...opened, units: opened.units.map((u) => (u.id === 'c1' ? { ...u, status: 'down' } : u)) };
  assert.equal(sightedBy(down, 'crew', rules).size, 0, 'the crew down sees no one');
});

test('the setting: off for a new game, on and off, checked in a save, and on the Settings screen', () => {
  assert.equal(defaultSettings().fog, false);
  const on = reduceSettings(defaultSettings(), { type: 'settings/fog', value: true });
  assert.equal(on.fog, true);
  assert.equal(reduceSettings(on, { type: 'settings/fog', value: 'yes' }), on);
  assert.deepEqual(settingsProblems({ ...on, fog: 1 }), ['The fog of war setting is invalid.']);
  const row = settingsText(on, rules.balance).find((r) => r.key === 'fog');
  assert.deepEqual([row.title, row.value, row.action], ['Fog of war', true, 'settings/fog']);
  assert.match(row.line, /enemy still knows where the crew is/);
});

test('save v41: a save from before has fog of war off (and moves on to the current version)', () => {
  assert.equal(SAVE_VERSION, 53);
  const { fog, ...v40 } = defaultSettings();
  const moved = migrate({ version: 40, data: { settings: v40, campaign: null } });
  assert.equal(moved.version, 53);
  assert.deepEqual(moved.data.settings, defaultSettings());
});

test("the board's playback of door events lands where the rules do", () => {
  let battle = battleOf([{ kind: 'marine', x: 3, y: 0 }, { kind: 'pirate', x: 2, y: 0 }]);
  let view = battle;
  for (const action of [{ type: 'open', unit: 'c1', side: 'w' }, { type: 'close', unit: 'c1', side: 'w' }, { type: 'lock', unit: 'c1', side: 'w' }, { type: 'end' }, { type: 'force', unit: 'e1', side: 'e' }]) {
    if (battle.side === 'enemy' && action.unit === 'c1') battle = act(battle, { type: 'end' }, rules).battle;
    const result = act(battle, action, rules);
    assert.ok(result.ok, `${JSON.stringify(action)}: ${result.error}`);
    for (const event of result.events) view = applyEvent(view, event);
    battle = result.battle;
    assert.deepEqual([view.doors, view.locks ?? [], view.broken ?? []], [battle.doors, battle.locks ?? [], battle.broken ?? []], action.type);
  }
});
