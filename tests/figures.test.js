import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIGURE_TOP, figureFaces } from '../src/render/figures/figure.js';
import { lookProblems, SUITS } from '../src/render/figures/looks.js';
import { createFigureSprites, steppedPose, viewOf } from '../src/render/figures/sprites.js';
import { project } from '../src/render/orbit.js';
import { drawOrder, paintSolid, prepareSolid } from '../src/render/painter.js';
import { palette } from '../src/render/palette.js';
import { shade } from '../src/render/solid.js';
import { colorsOf } from '../src/render/units.js';
import { rules } from './battleKit.js';

const deg = Math.PI / 180;
const FIGHT = { yaw: 0, pitch: 60 * deg, distance: 40, pivot: [5, 3], scale: 48, x: 450, y: 180 };
const fighters = [...rules.jobs.values(), ...rules.enemies.values()];
const heldOf = (fighter) => rules.weapons.get(fighter.weapon).held;
const crewColors = { ...colorsOf('crew', 'active', palette.crewA) };
const POSES = [{}, { aim: 1 }, { stride: 0.25 }, { stride: 0.75 }, { aim: 0.5, stride: 0.5 }, { fall: 0.4 }, { fall: 1 }];

function facesOf(fighter, pose = {}, { at = [2.5, 3.5], facing = [0, 1], detail = 1 } = {}) {
  const out = [];
  figureFaces(out, { at, facing }, fighter.look, heldOf(fighter), crewColors, pose, detail);
  return out;
}

const points = (faces) => faces.flatMap((f) => f.pts);
const top = (faces) => Math.max(...points(faces).map((p) => p[2]));
const along = (faces, [fx, fy], [cx, cy]) => points(faces).map(([x, y]) => (x - cx) * fx + (y - cy) * fy);

test('every job and enemy is a figure: flat faces, unit normals, palette colours, on its own tile and never through the deck', () => {
  const colors = new Set(Object.values(palette));
  for (const fighter of fighters) {
    for (const pose of POSES) {
      for (const detail of [1, 0.6]) {
        const faces = facesOf(fighter, pose, { detail });
        assert.ok(faces.length > 150, `${fighter.id} is more than a box`);
        for (const face of faces) {
          assert.ok(face.pts.flat().every(Number.isFinite));
          assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-9);
          assert.ok(colors.has(face.color), `${fighter.id}: ${face.color}`);
        }
        const pts = points(faces);
        assert.ok(pts.every(([x, y, z]) => x > 2 && x < 3 && y > 3 && y < 4 && z >= -1e-9), `${fighter.id} ${JSON.stringify(pose)}: within its tile, above the deck`);
      }
    }
  }
});

test('standing, a figure is a person high and its visor looks the way it faces', () => {
  for (const fighter of fighters) {
    for (const facing of [[0, 1], [1, 0], [-0.6, -0.8]]) {
      const faces = facesOf(fighter, {}, { facing });
      assert.ok(top(faces) > 0.74 && top(faces) <= FIGURE_TOP, `${fighter.id}: ${top(faces)}`);
      const visor = faces.filter((f) => f.color === crewColors.visor || f.color === crewColors.glass);
      const ahead = along(visor, facing, [2.5, 3.5]);
      assert.ok(ahead.reduce((a, b) => a + b, 0) / ahead.length > 0.04, `${fighter.id}: visor ahead`);
    }
  }
});

test('aimed, the weapon points ahead at the shoulder; at the ready it lies across the body', () => {
  for (const fighter of fighters) {
    const reach = (pose) => Math.max(...along(facesOf(fighter, pose).filter((f) => f.color === crewColors.gun), [0, 1], [2.5, 3.5]));
    assert.ok(reach({ aim: 1 }) > reach({}) + 0.03, `${fighter.id} aims ahead`);
  }
});

test('walking, the feet stride apart, and back together over a stride', () => {
  const marine = rules.jobs.get('marine');
  const feet = (pose) => along(facesOf(marine, pose).filter((f) => Math.max(...f.pts.map((p) => p[2])) < 0.03), [0, 1], [2.5, 3.5]);
  const spread = (pose) => Math.max(...feet(pose)) - Math.min(...feet(pose));
  assert.ok(spread({ stride: 0.25 }) > spread({}) + 0.1);
  assert.ok(Math.abs(spread({ stride: 0.5 }) - spread({})) < 1e-9, 'half a stride: together again');
});

test('fallen, a figure lies on its back along the way it faced, its weapon on the deck beside it', () => {
  for (const fighter of fighters) {
    const faces = facesOf(fighter, { fall: 1 });
    assert.ok(top(faces) < 0.45, `${fighter.id} lies low: ${top(faces)}`);
    const length = along(faces, [0, 1], [2.5, 3.5]);
    const across = along(faces, [1, 0], [2.5, 3.5]);
    assert.ok(Math.max(...length) - Math.min(...length) > 0.65, `${fighter.id} lies along its facing`);
    assert.ok(Math.max(...length) - Math.min(...length) > Math.max(...across) - Math.min(...across));
    const gun = faces.filter((f) => f.color === crewColors.gun);
    assert.ok(gun.length && points(gun).every((p) => p[2] < 0.15) && Math.min(...points(gun).map((p) => p[2])) < 0.06, `${fighter.id}'s weapon on the deck`);
    const midway = top(facesOf(fighter, { fall: 0.5 }));
    assert.ok(midway < top(facesOf(fighter)) && midway > top(faces), 'falling, between the two');
  }
});

test("a ship's turret (M39) is a figure of its own: on its tile, below a person, barrels level aimed, slumped and dark once wrecked", () => {
  const turret = rules.machines.get('turret');
  const colors = new Set(Object.values(palette));
  const facesFor = (pose, { facing = [0, 1], detail = 1 } = {}) => {
    const out = [];
    figureFaces(out, { at: [2.5, 3.5], facing }, turret.look, heldOf(turret), crewColors, pose, detail);
    return out;
  };
  for (const pose of [{}, { aim: 1 }, { fall: 0.4 }, { fall: 1 }]) {
    for (const detail of [1, 0.6]) {
      const faces = facesFor(pose, { detail });
      assert.ok(faces.length > 60, 'more than a box');
      for (const face of faces) {
        assert.ok(face.pts.flat().every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(...face.normal) - 1) < 1e-9);
        assert.ok(colors.has(face.color), face.color);
      }
      assert.ok(points(faces).every(([x, y, z]) => x > 2 && x < 3 && y > 3 && y < 4 && z >= -1e-9), `${JSON.stringify(pose)}: within its tile, above the deck`);
      assert.ok(top(faces) < 0.7 && top(faces) <= FIGURE_TOP, `lower than a person: ${top(faces)}`);
    }
  }
  // No suit: nothing in a visor's colours.
  assert.ok(!facesFor({}).some((f) => f.color === crewColors.visor || f.color === crewColors.glass));
  // Its barrels reach ahead the way it faces, turned with it.
  const muzzle = (pose, facing = [0, 1]) => {
    const pts = points(facesFor(pose, { facing }).filter((f) => f.color === crewColors.gun));
    const far = Math.max(...pts.map(([x, y]) => (x - 2.5) * facing[0] + (y - 3.5) * facing[1]));
    const tips = pts.filter(([x, y]) => (x - 2.5) * facing[0] + (y - 3.5) * facing[1] > far - 0.03);
    return { far, high: tips.reduce((a, p) => a + p[2], 0) / tips.length };
  };
  assert.ok(muzzle({}).far > 0.35 && muzzle({}, [1, 0]).far > 0.35);
  assert.ok(muzzle({ aim: 1 }).high > muzzle({}).high + 0.02, 'aimed, the barrels come up level');
  assert.ok(muzzle({ fall: 1 }).high < muzzle({}).high - 0.05, 'wrecked, they droop');
  // Its eye is lit until it is wrecked.
  assert.ok(facesFor({}).some((f) => f.emissive && f.color === crewColors.lamp));
  assert.ok(!facesFor({ fall: 1 }).some((f) => f.emissive));
});

test('each job and each enemy type has a look of its own, a suit both sides wear, and only what can be drawn', () => {
  for (const group of [[...rules.jobs.values()], [...rules.enemies.values()]]) {
    const looks = group.map((f) => JSON.stringify([f.look, heldOf(f)]));
    assert.equal(new Set(looks).size, looks.length);
  }
  for (const suit of Object.keys(SUITS)) {
    assert.ok([...rules.jobs.values()].some((f) => f.look.suit === suit), `the crew wear ${suit}`);
    assert.ok([...rules.enemies.values()].some((f) => f.look.suit === suit), `enemies wear ${suit}`);
  }
  for (const fighter of fighters) assert.deepEqual(lookProblems(fighter.look), []);
  // A skinsuit's helmet on an EVA suit is not a look.
  assert.match(lookProblems({ suit: 'eva', build: 'light', helmet: 'fin', back: 'none', marks: 'plain' })[0], /look\.helmet for a eva suit/);
});

test("a kept drawing's angles, sizes and poses are rounded to steps", () => {
  const at = [5.5, 3.5, 0.38];
  const a = viewOf(FIGHT, at, [0, 1], 48);
  assert.equal(viewOf(FIGHT, at, [Math.sin(1 * deg), Math.cos(1 * deg)], 48.1).key, a.key, 'a degree and a tenth of a pixel: the same drawing');
  assert.notEqual(viewOf(FIGHT, at, [1, 0], 48).key, a.key, 'turned: another');
  assert.notEqual(viewOf({ ...FIGHT, yaw: 20 * deg }, at, [0, 1], 48).key, a.key, 'seen from elsewhere: another');
  assert.notEqual(viewOf(FIGHT, at, [0, 1], 60).key, a.key, 'bigger: another');
  assert.ok(Math.abs(a.pitch - 60 * deg) < 6 * deg, "seen from about the camera's pitch");
  // Perspective: a figure off to the right is seen a little from its left,
  // and one nearer the camera from higher up.
  assert.ok(viewOf(FIGHT, [12.5, 3.5, 0.38], [0, 1], 48).yaw < a.yaw - 10 * deg);
  assert.ok(viewOf(FIGHT, [5.5, 10.5, 0.38], [0, 1], 48).pitch > a.pitch + 5 * deg);
  assert.deepEqual(steppedPose({ aim: 0.6, stride: 0.49, fall: 0.33 }), { aim: 0.5, stride: 0.5, fall: 0.3 });
  assert.deepEqual(steppedPose({ stride: 0.3 }).stride, 0.25, 'a walk in eighths');
  assert.deepEqual(steppedPose({ stride: 0.98 }), { aim: 0, stride: 0, fall: 0 });
  assert.deepEqual(steppedPose({}), { aim: 0, stride: null, fall: 0 });
});

// A canvas and a 2D context that remember what was drawn.
function fakeCanvas(w, h) {
  const ctx = new Proxy({ calls: [], getTransform: () => ({ a: 1 }) }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => target.calls.push([key, ...args]);
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return { width: w, height: h, ctx, getContext: () => ctx };
}

test('a figure is drawn once and kept: the same view draws the kept drawing, at its anchor', () => {
  const made = [];
  const sprites = createFigureSprites({ makeCanvas: (w, h) => (made.push(fakeCanvas(w, h)), made.at(-1)) });
  const marine = rules.jobs.get('marine');
  const figure = { id: 'c1', at: [5.5, 3.5], facing: [0, 1], look: marine.look, held: heldOf(marine), colors: crewColors, pose: {}, key: 'marine' };
  const screen = fakeCanvas(900, 400).ctx;
  for (let frame = 0; frame < 3; frame++) {
    sprites.frame();
    sprites.item(figure, 2).draw(screen, FIGHT);
  }
  assert.equal(made.length, 2, 'painted once, on a scratch canvas, then kept on its own');
  const [scratch, kept] = made;
  assert.ok(scratch.ctx.calls.filter(([name]) => name === 'fill').length > 100, 'the figure painted');
  // Its outline: eight copies a little out all round, tinted, then the figure.
  const copies = kept.ctx.calls.filter(([name]) => name === 'drawImage');
  assert.equal(copies.length, 9);
  assert.ok(copies.every(([, from]) => from === scratch));
  assert.ok(kept.ctx.calls.some(([name]) => name === 'fillRect'));
  assert.deepEqual(copies.at(-1).slice(6, 8), [0, 0], 'the figure itself last, in place');
  const drawn = screen.calls.filter(([name]) => name === 'drawImage');
  assert.equal(drawn.length, 3);
  assert.ok(drawn.every(([, canvas]) => canvas === kept));
  const [sx, sy] = project(FIGHT, 5.5, 3.5, 0.38);
  assert.deepEqual(screen.calls.find(([name]) => name === 'translate').slice(1).map(Math.round), [Math.round(sx), Math.round(sy)]);
  assert.equal(sprites.stale(), false);
  // Its drawing is about a person's height on screen at 48 px a cell.
  const [, , , , w, h] = drawn[0];
  assert.ok(h > 25 && h < 60 && w > 10 && w < 45, `${w} × ${h}`);
});

test('past the budget, a figure shows its last drawing and the frame asks to be drawn again', () => {
  let clock = 0;
  const sprites = createFigureSprites({ budget: 5, now: () => (clock += 10), makeCanvas: fakeCanvas });
  const engineer = rules.jobs.get('engineer');
  const figure = (id, facing, pose) => ({ id, at: [5.5, 3.5], facing, look: engineer.look, held: heldOf(engineer), colors: crewColors, pose, key: 'engineer' });
  const screen = fakeCanvas(900, 400).ctx;
  const show = (...figures) => {
    sprites.frame();
    for (const f of figures) sprites.item(f, 2).draw(screen, FIGHT);
  };
  // Never seen before, both are drawn, whatever the budget; the same figure
  // the same way round shares a drawing.
  show(figure('c1', [0, 1], {}), figure('c2', [1, 0], {}), figure('c3', [0, 1], {}));
  assert.equal(sprites.size(), 2);
  assert.equal(sprites.stale(), false);
  // Both aim: one new drawing fits the budget, the other waits a frame.
  show(figure('c1', [0, 1], { aim: 1 }), figure('c2', [1, 0], { aim: 1 }));
  assert.equal(sprites.size(), 3);
  assert.equal(sprites.stale(), true, 'one showed its old drawing');
  show(figure('c1', [0, 1], { aim: 1 }), figure('c2', [1, 0], { aim: 1 }));
  assert.equal(sprites.size(), 4);
  assert.equal(sprites.stale(), false);
});

test('the painter draws items in depth order among the faces', () => {
  const near = { pts: [[0, 6, 0], [1, 6, 0], [1, 7, 0], [0, 7, 0]], normal: [0, 0, 1], color: '#111111' };
  const far = { pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], color: '#222222' };
  const order = [];
  const ctx = fakeCanvas(10, 10).ctx;
  ctx.fill = () => order.push(ctx.fillStyle);
  const item = { at: [0.5, 3.5, 0.3], draw: () => order.push('item') };
  paintSolid(ctx, prepareSolid([near, far], shade), [], FIGHT, { items: [item] });
  assert.deepEqual(order, [shade(far), 'item', shade(near)]);
});

test('kept drawings go, oldest first, once they take more than their room', () => {
  const sprites = createFigureSprites({ bytes: 60000, makeCanvas: fakeCanvas });
  const medic = rules.jobs.get('medic');
  const screen = fakeCanvas(900, 400).ctx;
  for (let i = 0; i < 12; i++) {
    sprites.frame();
    sprites.item({ id: `c${i}`, at: [5.5, 3.5], facing: [Math.cos(i), Math.sin(i)], look: medic.look, held: heldOf(medic), colors: crewColors, pose: {}, key: 'medic' }, 2).draw(screen, FIGHT);
  }
  assert.ok(sprites.size() < 12 && sprites.size() >= 1, `${sprites.size()} kept`);
});

// Each figure filled into a grid of pixels at the cover screen's size (48
// CSS px a cell, 2 device px each), back to front, without its outline.
function pixelsOf(fighter, side, facing) {
  const out = [];
  figureFaces(out, { at: [0, 0], facing }, fighter.look, heldOf(fighter), colorsOf(side, 'active', side === 'crew' ? palette.crewA : palette.enemyTrim), {}, 0.6);
  const [W, H] = [70, 110];
  const cam = { yaw: 0, pitch: 60 * deg, distance: 40, pivot: [0, 0], scale: 96, x: W / 2, y: H * 0.72 };
  const grid = new Array(W * H).fill(null);
  for (const { face } of drawOrder(prepareSolid(out, shade), cam)) {
    const pts = face.pts.map((p) => project(cam, ...p));
    const rgb = face.fill.match(/\d+/g).map(Number);
    const [x0, x1] = [Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])))), Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))))];
    const [y0, y1] = [Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])))), Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))))];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let sign = 0;
        let inside = true;
        for (let i = 0; i < pts.length && inside; i++) {
          const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
          const cross = (b[0] - a[0]) * (y + 0.5 - a[1]) - (b[1] - a[1]) * (x + 0.5 - a[0]);
          if (cross !== 0) {
            if (sign === 0) sign = Math.sign(cross);
            else if (Math.sign(cross) !== sign) inside = false;
          }
        }
        if (inside) grid[y * W + x] = rgb;
      }
    }
  }
  return grid;
}

// The share of the pixels in either figure that differ between two.
function apart(a, b) {
  let [union, differ] = [0, 0];
  for (let i = 0; i < a.length; i++) {
    if (!a[i] && !b[i]) continue;
    union += 1;
    if (!a[i] || !b[i] || Math.abs(a[i][0] - b[i][0]) + Math.abs(a[i][1] - b[i][1]) + Math.abs(a[i][2] - b[i][2]) > 60) differ += 1;
  }
  return differ / union;
}

test("at the cover screen's size, every job's figure and every enemy type's is told apart from the rest of its side", () => {
  for (const [side, group] of [['crew', [...rules.jobs.values()]], ['enemy', [...rules.enemies.values()]]]) {
    for (const facing of [[0.35, 0.94], [-0.35, -0.94], [1, 0]]) {
      const pics = group.map((f) => pixelsOf(f, side, facing));
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const share = apart(pics[i], pics[j]);
          assert.ok(share >= 0.2, `${group[i].id} and ${group[j].id} facing ${facing}: ${(share * 100).toFixed(0)}% of their pixels differ`);
        }
      }
    }
  }
});
