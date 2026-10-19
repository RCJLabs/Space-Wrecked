// A ship's security turret (M39) as a figure: a drum bolted to the deck,
// a head on a swivel ring with an eye and an aerial lit in its trim, and
// twin barrels that dip at the ready and come level aimed. Wrecked (its
// pose's fall toward 1), the head slumps round on its ring, the barrels
// droop and the eye goes dark. Drawn in the figure's frame (u ahead, v to
// its left, w up) and placed by the kit, all inside its tile.
import { add, block, hexa, lathe, rod, slab, tube } from './shapes.js';

const RING = 0.3; // the swivel ring's height: the head turns and slumps about it
const TRUNNION = [0.02, 0, 0.41]; // where the barrels pivot in the head
const BARREL = 0.42; // their length from there
const SPREAD = 0.075; // half the space between them

export function dressTurret(kit, pose = {}) {
  const { suit, trim, dark, gun, lamp } = kit.colors;
  const aim = Math.min(1, Math.max(0, pose.aim ?? 0));
  const fall = Math.min(1, Math.max(0, pose.fall ?? 0));
  lathe(kit, [0, 0], [[0, 0.28, 0.28], [0.05, 0.28, 0.28], [0.075, 0.24, 0.24]], 12, dark, { square: 3 });
  for (const [u, v] of [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]]) block(kit, [u - 0.025, v - 0.025, 0.05], [u + 0.025, v + 0.025, 0.07], gun);
  tube(kit, [0, 0, 0.075], [0, 0, RING - 0.015], 0.12, 0.1, suit, 10);
  tube(kit, [0, 0, RING - 0.015], [0, 0, RING + 0.015], 0.15, 0.15, trim, 10);
  // The head, turned on its ring: wrecked, it slumps round and over.
  const head = { ...kit, place: (p) => kit.place(slumped(p, fall)) };
  wedge(head, suit);
  block(head, [-0.08, -0.2, 0.33], [0.06, -0.15, 0.45], dark);
  block(head, [0.085, -0.035, 0.44], [0.125, 0.035, 0.475], fall < 0.5 ? lamp : dark, fall < 0.5);
  rod(head, [-0.1, 0.1, 0.5], [-0.1, 0.1, 0.6], 0.008, dark);
  block(head, [-0.115, 0.085, 0.6], [-0.085, 0.115, 0.63], trim, fall < 0.5);
  // The barrels: a little down at the ready, level aimed, drooping wrecked.
  const lift = -0.1 * (1 - aim) - 0.32 * fall;
  const along = [Math.cos(lift), 0, Math.sin(lift)];
  for (const s of [-1, 1]) {
    const root = add(TRUNNION, [0, s * SPREAD, 0]);
    const at = (t) => add(root, [along[0] * t, along[1] * t, along[2] * t]);
    slab(head, at(-0.04), at(0.14), 0.04, 0.04, dark);
    tube(head, at(0.14), at(BARREL), 0.022, 0.02, gun, 8);
    tube(head, at(BARREL - 0.04), at(BARREL), 0.028, 0.028, dark, 8);
  }
}

// The head's body: a box whose front leans back, so it reads as aimed.
function wedge(kit, color) {
  const [back, front, top, low, half] = [-0.15, 0.13, 0.5, RING + 0.015, 0.15];
  hexa(kit, [
    [back, -half, low], [front, -half, low], [front, half, low], [back, half, low],
    [back + 0.02, -half, top], [front - 0.07, -half, top], [front - 0.07, half, top], [back + 0.02, half, top],
  ], color);
}

// A point of the head turned about the swivel ring as far as `fall` has
// it slumped: round a little, tipped forward and over to one side.
function slumped([u, v, w], fall) {
  if (fall <= 0) return [u, v, w];
  const [yaw, pitch, roll] = [0.5 * fall, 0.28 * fall, 0.3 * fall];
  let [a, b, c] = [u, v, w - RING];
  [b, c] = [b * Math.cos(roll) - c * Math.sin(roll), b * Math.sin(roll) + c * Math.cos(roll)];
  [a, c] = [a * Math.cos(pitch) + c * Math.sin(pitch), -a * Math.sin(pitch) + c * Math.cos(pitch)];
  [a, b] = [a * Math.cos(yaw) - b * Math.sin(yaw), a * Math.sin(yaw) + b * Math.cos(yaw)];
  return [a, b, c + RING];
}
