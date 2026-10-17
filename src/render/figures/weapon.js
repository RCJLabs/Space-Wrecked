// The weapon a figure holds, drawn from its held shape (looks.js): along
// `dir` from the grip, a stock, a body with its magazine and sight, and a
// barrel; a pistol is a body and a grip. A fitting of its own goes on after
// (M37): a drum, a scope, coils, a fuel tank, prongs, a nail box or a
// second barrel.
import { add, cross, norm, scale, slab, tube } from './shapes.js';

export function weapon(kit, { grip, dir }, held) {
  const { gun, dark } = kit.colors;
  const at = (t) => add(grip, scale(dir, t));
  const down = norm(cross(cross(dir, [0, 0, 1]), dir));
  const [len, high, wide] = [held.length, held.height / 2, held.height * 0.28];
  if (held.hands === 1) {
    slab(kit, at(-0.025), at(len - 0.025), wide * 0.9, high * 0.55, gun, 0.6);
    slab(kit, at(-0.012), add(at(0.012), scale(down, -0.055)), wide * 0.75, 0.012, dark);
  } else {
    const [stock, body] = [len * 0.3, len * 0.42];
    slab(kit, at(-stock), at(-stock * 0.35), wide * 0.8, high * 0.85, gun, 0.15);
    slab(kit, at(-stock * 0.35), at(body), wide, high, gun, 0.45);
    slab(kit, at(body), at(len - stock), held.bore, held.bore * 1.2, gun, high / (held.bore * 1.2));
    slab(kit, at(0.02), add(at(0.045), scale(down, -0.065)), wide * 0.7, 0.012, dark);
    slab(kit, add(at(0), [0, 0, high * 1.6]), add(at(0.07), [0, 0, high * 1.6]), 0.01, 0.012, dark);
  }
  // `down` points up from the gun's line (the magazine hangs at minus it).
  if (held.fitting) fitting(kit, held, { at, up: down, side: norm(cross(dir, [0, 0, 1])) });
}

// The fitting: drawn where it sits on a weapon of that length, above
// (`up`), below or beside (`side`) the line of the barrel.
function fitting(kit, held, { at, up, side }) {
  const { dark, trim, gun } = kit.colors;
  const [len, high, wide] = [held.length, held.height / 2, held.height * 0.28];
  const muzzle = held.hands === 1 ? len - 0.025 : len - len * 0.3;
  const down = scale(up, -1);
  switch (held.fitting) {
    case 'drum': {
      // A round magazine across the gun, under its body: no deeper than a
      // gun lying on the deck has room for (1.5 of its half height).
      const middle = add(at(held.hands === 1 ? len * 0.35 : len * 0.12), scale(down, high * 0.7));
      tube(kit, add(middle, scale(side, -wide * 1.2)), add(middle, scale(side, wide * 1.2)), high * 0.8, high * 0.8, dark, 8);
      break;
    }
    case 'scope':
      tube(kit, add(at(-0.01), scale(up, high * 2.3)), add(at(len * 0.36), scale(up, high * 2.3)), high * 0.5, high * 0.6, dark, 6);
      slab(kit, add(at(len * 0.1), scale(up, high)), add(at(len * 0.16), scale(up, high)), wide * 0.4, high * 0.7, dark, 0.5);
      break;
    case 'coils':
      // Three glowing rings along the barrel.
      for (let i = 1; i <= 3; i++) {
        const t = len * 0.42 + ((muzzle - len * 0.42) * i) / 4;
        tube(kit, add(at(t - 0.008), scale(up, high * 0.45)), add(at(t + 0.008), scale(up, high * 0.45)), held.bore * 2.4, held.bore * 2.4, trim, 6, true);
      }
      break;
    case 'tank':
      // A fuel tank strapped along the top of the body.
      tube(kit, add(at(-len * 0.1), scale(up, high * 1.6)), add(at(len * 0.4), scale(up, high * 1.6)), high, high, dark, 8);
      break;
    case 'prongs':
      for (const s of [-1, 1]) {
        slab(kit, add(at(muzzle), scale(side, s * wide * 0.7)), add(at(muzzle + 0.05), scale(side, s * wide * 0.7)), 0.006, 0.006, trim, 0, true);
      }
      break;
    case 'box':
      // A box of rivets on top of the body.
      slab(kit, add(at(len * 0.02), scale(up, high * 1.7)), add(at(len * 0.24), scale(up, high * 1.7)), wide * 1.1, high * 0.75, dark);
      break;
    case 'twin':
      // A second barrel beside the first, its whole length.
      slab(kit, add(at(-0.02), scale(side, wide * 1.6)), add(at(muzzle), scale(side, wide * 1.6)), wide * 0.75, high * 0.5, gun, 0.6);
      break;
    default:
      break;
  }
}
