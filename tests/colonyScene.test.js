// M26: the colony in 3D (src/render/colonyScene.js): the ground cleared for
// the grid in the world's kind's colors, the ship landed off its west edge,
// each building standing on its cells as the part it was, its lights out
// while it is dark, and a part being given marked on the ship and where it
// would stand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colonyStats, donate, donatePlan } from '../src/sim/colony.js';
import { footprint } from '../src/sim/modules.js';
import { colonyScene, GAP, landedAt } from '../src/render/colonyScene.js';
import { exteriorScene, HULL } from '../src/render/exterior.js';
import { traceHull } from '../src/render/hull.js';
import { groundFor, palette, skinFor } from '../src/render/palette.js';
import { rules } from './battleKit.js';
import { settled, uidOf } from './colonyKit.js';

const site = rules.colony.site;

function sceneOf(campaign, mark = null) {
  const stats = colonyStats(campaign, rules);
  const powered = new Map(stats.buildings.map((b) => [b.uid, b.powered]));
  const { ship, colony } = campaign;
  return colonyScene({
    ship,
    hull: traceHull(ship, rules),
    buildings: colony.buildings.map((b) => ({ ...b, powered: powered.get(b.uid) ?? false })),
    site,
    kind: colony.world.kind,
    defs: rules,
    skin: skinFor('yard'),
    mark,
  });
}

const xs = (faces) => faces.flatMap((face) => face.pts.map(([x]) => x));
const ys = (faces) => faces.flatMap((face) => face.pts.map(([, y]) => y));

test('the ship stands landed off the grid\'s west edge, nose toward it, on ground cleared in its world\'s colors', () => {
  const campaign = settled();
  const scene = sceneOf(campaign);
  const hull = traceHull(campaign.ship, rules);
  const outside = exteriorScene({ ship: campaign.ship, defs: rules, hull, skin: skinFor('yard') });
  // Nothing built yet: the ship's faces, moved, and the ground cleared.
  assert.equal(scene.faces.length, outside.faces.length);
  assert.ok(Math.max(...xs(scene.faces)) <= -GAP + 1e-9, 'the ship keeps off the grid');
  const [dx, dy] = landedAt(hull, site);
  assert.deepEqual(scene.faces[0].pts, outside.faces[0].pts.map(([x, y, z]) => [x + dx, y + dy, z]));
  const middle = (Math.min(...ys(scene.faces)) + Math.max(...ys(scene.faces))) / 2;
  assert.ok(Math.abs(middle - site.height / 2) <= 1.5, `the ship stands level with the grid: ${middle}`);
  assert.deepEqual(scene.ground, [{ pts: [[-0.5, -0.5, 0], [site.width + 0.5, -0.5, 0], [site.width + 0.5, site.height + 0.5, 0], [-0.5, site.height + 0.5, 0]], normal: [0, 0, 1], color: groundFor(campaign.colony.world.kind).cleared }]);
  // The view keeps the ship, and the grid's first columns while nothing
  // stands on it.
  assert.ok(scene.box.x0 < Math.min(...xs(scene.faces)) && scene.box.x1 >= 8 && scene.box.x1 < site.width);
  assert.ok(scene.box.y0 < Math.min(-0.5, ...ys(scene.faces)) && scene.box.y1 > Math.max(site.height, ...ys(scene.faces)));
  // Every kind has its ground; one without takes rock's.
  for (const kind of rules.worlds.kinds.keys()) assert.ok(kind === 'rock' || groundFor(kind) !== groundFor('rock'), kind);
  assert.equal(groundFor('nowhere'), groundFor('rock'));
});

test('each building stands on its cells as the part it was, on its slab, its lights on while it has power', () => {
  let campaign = settled();
  for (const type of ['quarters', 'lifesupport', 'weapon']) campaign = donate(campaign, rules, uidOf(campaign, type)).campaign;
  const scene = sceneOf(campaign);
  assert.equal(scene.ground.length, 1 + campaign.colony.buildings.length, 'a slab each');
  for (const building of campaign.colony.buildings) {
    const [w, h] = footprint(rules.modules.get(building.type), building.rot);
    // Its walls and roof: a box on its cells, as tall as a hull.
    const box = scene.faces.filter((face) => face.pts.every(([x, y, z]) => x >= building.x - 1e-9 && x <= building.x + w + 1e-9 && y >= building.y - 1e-9 && y <= building.y + h + 1e-9 && z >= 0 && z <= HULL + 1));
    assert.ok(box.length >= 5, `${building.type}: walls, roof and fittings`);
    assert.ok(box.some((face) => face.normal[2] === 1 && face.pts.every(([, , z]) => z === HULL)), `${building.type}: a roof at the hull's height`);
  }
  // Lit: the barracks' windows and the power plant's core; dark, nothing
  // on the grid glows.
  const onGrid = (list) => list.filter((item) => (item.pts ?? [item.at]).every(([x]) => x >= 0));
  const plant = [...campaign.colony.buildings, { uid: 9, type: 'reactor', x: 12, y: 0, rot: 0 }];
  const lit = colonyScene({ ...inputsOf(campaign), buildings: plant.map((b) => ({ ...b, powered: true })) });
  const dark = colonyScene({ ...inputsOf(campaign), buildings: plant.map((b) => ({ ...b, powered: false })) });
  assert.ok(onGrid(lit.faces).some((face) => face.emissive), 'lit windows');
  assert.ok(onGrid(lit.glows).length > 0, "the power plant's glow");
  assert.equal(onGrid(dark.faces).filter((face) => face.emissive).length, 0, 'no lights in the dark');
  assert.equal(onGrid(dark.glows).length, 0, 'no glow in the dark');
  assert.equal(dark.faces.length, lit.faces.length, 'the same buildings, dark or lit');
  // The same colony always draws the same, and the input is left alone.
  const frozen = structuredClone(campaign);
  assert.deepEqual(sceneOf(campaign), scene);
  assert.deepEqual(campaign, frozen);
});

test('a part being given glows on the ship, and where it would stand is marked out on the ground', () => {
  const campaign = settled();
  const uid = uidOf(campaign, 'quarters');
  const plan = donatePlan(campaign, rules, uid);
  const scene = sceneOf(campaign, { uids: [uid], spot: { type: plan.type, ...plan.placement } });
  const plain = sceneOf(campaign);
  assert.equal(scene.glows.length, plain.glows.length + 2);
  const [onShip, onGround] = scene.glows.slice(-2);
  assert.equal(onShip.color, palette.accent);
  assert.ok(onShip.at[0] < -GAP, 'over the ship');
  assert.ok(onGround.at[0] > 0 && onGround.at[1] > 0, 'over the grid');
  const spot = scene.ground.at(-1);
  assert.equal(spot.color, palette.accent);
  const [w, h] = footprint(rules.modules.get('quarters'), plan.placement.rot);
  assert.ok(spot.pts.some(([x, y]) => x < plan.placement.x && y < plan.placement.y) && spot.pts.some(([x, y]) => x > plan.placement.x + w - 1e-9 && y > plan.placement.y + h - 1e-9));
  // Parts that can't go: only a glow over each on the ship.
  assert.equal(sceneOf(campaign, { uids: [uidOf(campaign, 'reactor')], spot: null }).glows.length, plain.glows.length + 1);
  assert.equal(sceneOf(campaign, { uids: [uidOf(campaign, 'bridge'), uidOf(campaign, 'airlock')], spot: null }).glows.length, plain.glows.length + 2);
});

function inputsOf(campaign) {
  const { ship, colony } = campaign;
  return { ship, hull: traceHull(ship, rules), site, kind: colony.world.kind, defs: rules, skin: skinFor('yard'), mark: null };
}
