// M48: the balance pass's rule changes. Those pressing on keep the enemy in
// sight once they have it (press.js), rather than stepping back out of it
// and in again turn after turn; and Bosun's weld patches the allies beside
// the welder and gets one down up (orders.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedFrom } from '../src/core/rng.js';
import { aiAction } from '../src/sim/ai.js';
import { playFrom } from '../src/sim/autoplay.js';
import { act, createBattle } from '../src/sim/battle.js';
import { describeEvent } from '../src/sim/battleLog.js';
import { newCampaign } from '../src/sim/campaign.js';
import { edgeKey } from '../src/sim/mapFromShip.js';
import { pressAction } from '../src/sim/press.js';
import { beginRaid } from '../src/sim/raid.js';
import { openMap, rules, wall } from './battleKit.js';
import { readyToLaunch } from './launchKit.js';

const fight = (map, units) => createBattle({ map, units, seed: 7 }, rules).battle;
const who = (battle, id) => battle.units.find((u) => u.id === id);

// The moves in a fight's events that walk a unit straight back to where it
// was, in the same turn.
function outAndBack(events) {
  let turn = 0;
  let count = 0;
  const last = new Map();
  for (const e of events) {
    if (e.type === 'turn') turn += 1;
    if (e.type !== 'move') continue;
    const [from, to] = [e.path[0].join(), e.path.at(-1).join()];
    const prev = last.get(e.unit);
    if (prev && prev.turn === turn && prev.from === to && prev.to === from) count += 1;
    last.set(e.unit, { turn, from, to });
  }
  return count;
}

test('pressing on: the raiders keep the crew in sight, no stepping out and back (the smuggler\'s hangar raids that did it on main)', () => {
  const crew = newCampaign(rules, 5, { background: 'smuggler' }).crew;
  const hangar = readyToLaunch();
  // Seeds 1, 4 and 8 stepped out and back 10, 6 and 7 turns before M48.
  for (const n of [1, 4, 8]) {
    const begun = beginRaid({ ...hangar, background: 'smuggler', crew, heat: rules.balance.raidHeat, rng: seedFrom(`hangar ${n}`) }, rules);
    assert.ok(begun.ok, begun.error);
    const { events } = playFrom(begun.campaign.fight.battle, rules, { crew: aiAction, enemy: pressAction }, { maxRounds: 60 });
    assert.equal(outAndBack(events), 0, `seed ${n}`);
  }
});

test("Bosun's weld: the allies beside get its hit points back, one down gets up, and the log says so", () => {
  const map = wall(openMap(6, 3), 1, 1, 'e', 'door');
  const battle = fight(map, [{ kind: 'engineer', x: 1, y: 1 }, { kind: 'marine', x: 0, y: 1 }, { kind: 'medic', x: 1, y: 0 }, { kind: 'pirate', x: 5, y: 1 }]);
  battle.doors = [edgeKey(1, 1, 'e')];
  Object.assign(who(battle, 'c1'), { talent: 'varga', uses: 3 });
  Object.assign(who(battle, 'c2'), { hp: 3 });
  Object.assign(who(battle, 'c3'), { hp: 0, status: 'down', bleed: 2 });
  const result = act(battle, { type: 'order', unit: 'c1', side: 'e' }, rules);
  assert.ok(result.ok, result.error);
  const [event] = result.events;
  const marine = who(result.battle, 'c2');
  const medic = who(result.battle, 'c3');
  assert.equal(marine.hp, Math.min(marine.maxHp, 3 + 8));
  assert.deepEqual([medic.status, medic.hp, medic.ap, medic.bleed], ['active', Math.min(medic.maxHp, 8), 0, 0]);
  assert.deepEqual(event.braced, [{ unit: 'c2', hp: marine.hp - 3, up: false }, { unit: 'c3', hp: medic.hp, up: true }]);
  assert.match(describeEvent(event, result.battle), /gets .* back\. .* gets up with 8\.$/);
  // The plain engineer's weld patches no one.
  const plain = fight(map, [{ kind: 'engineer', x: 1, y: 1 }, { kind: 'marine', x: 0, y: 1 }, { kind: 'pirate', x: 5, y: 1 }]);
  plain.doors = [edgeKey(1, 1, 'e')];
  Object.assign(who(plain, 'c2'), { hp: 3 });
  const welded = act(plain, { type: 'order', unit: 'c1', side: 'e' }, rules);
  assert.equal(who(welded.battle, 'c2').hp, 3);
  assert.equal(welded.events[0].braced, undefined);
});
