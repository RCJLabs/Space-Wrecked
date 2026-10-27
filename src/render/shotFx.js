// What a shot looks like besides its tracer (M59): a flash at the muzzle as
// it leaves, sparks thrown where it hits, and a puff where a miss strikes
// past. Pure: the same shot frame always gives the same marks, scattered
// by the shot's seed (playback.js frameAt, the ms its beat starts), so a
// replay and a redraw draw the same sparks.
//   tone(weapon)      'stun', 'fire' or 'plain': a weapon that stuns, one
//                     that sets fires (data/weapons.json stun, burn), any other
//   muzzle(shot)      { at: [x, y], alpha } while the flash shows, or null
//   sparks(shot)      [{ at: [x, y], z, alpha }] a hit's sparks as they fly
//   puff(shot)        [{ at: [x, y], z, alpha, r }] a miss's dust, or []
//   endOf(shot)       [x, y] where the shot ends: the target's middle on a
//                     hit, wide and past it on a miss
// Points are in tiles (a tile's middle at +0.5), z in the board's units.
import { next } from '../core/rng.js';
import { FLIGHT } from './playback.js';

export const SPARKS = 7;
const PUFFS = 4;
const MUZZLE = 0.12; // the flash shows for this part of a shot's time
const SPARK_TIME = 0.35; // and the sparks fly for this part after it lands

export function tone(weapon) {
  if (weapon?.stun) return 'stun';
  if (weapon?.burn) return 'fire';
  return 'plain';
}

export function endOf({ from, to, hit }) {
  const [ax, ay] = [from[0] + 0.5, from[1] + 0.5];
  const [bx, by] = [to[0] + 0.5, to[1] + 0.5];
  if (hit) return [bx, by];
  // Wide of the target, and on past it.
  const [dx, dy] = [bx - ax, by - ay];
  const len = Math.hypot(dx, dy) || 1;
  return [bx + (dx / len) * 0.7 - (dy / len) * 0.35, by + (dy / len) * 0.7 + (dx / len) * 0.35];
}

export function muzzle({ from, to, progress }) {
  if (progress >= MUZZLE) return null;
  const [ax, ay] = [from[0] + 0.5, from[1] + 0.5];
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const len = Math.hypot(dx, dy) || 1;
  // A little way out along the line, where the barrel ends.
  return { at: [ax + (dx / len) * 0.32, ay + (dy / len) * 0.32], alpha: 1 - progress / MUZZLE };
}

// n numbers in [0, 1) from a shot's seed, the same each time.
function dice(seed, n) {
  let state = (Math.imul(seed | 0, 2654435761) ^ 0x5f3759df) >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const roll = next(state);
    state = roll.state;
    out.push(roll.value);
  }
  return out;
}

export function sparks(shot) {
  const { hit, progress, seed = 0 } = shot;
  if (!hit || progress < FLIGHT) return [];
  const age = (progress - FLIGHT) / SPARK_TIME;
  if (age >= 1) return [];
  const [x, y] = endOf(shot);
  const roll = dice(seed, SPARKS * 2);
  return Array.from({ length: SPARKS }, (_, i) => {
    const angle = roll[i * 2] * Math.PI * 2;
    const reach = (0.25 + 0.35 * roll[i * 2 + 1]) * Math.sqrt(age);
    // Up as they fly out, then falling back.
    const z = 0.4 + 0.3 * age - 0.5 * age * age;
    return { at: [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach], z, alpha: 1 - age };
  });
}

export function puff(shot) {
  const { hit, progress, seed = 0 } = shot;
  if (hit || progress < FLIGHT) return [];
  const age = (progress - FLIGHT) / SPARK_TIME;
  if (age >= 1) return [];
  const [x, y] = endOf(shot);
  const roll = dice(seed + 1, PUFFS * 2);
  return Array.from({ length: PUFFS }, (_, i) => {
    const angle = roll[i * 2] * Math.PI * 2;
    const reach = 0.12 * roll[i * 2 + 1] + 0.1 * age;
    return { at: [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach], z: 0.3 + 0.15 * age, alpha: 0.7 * (1 - age), r: 0.06 + 0.08 * age };
  });
}
