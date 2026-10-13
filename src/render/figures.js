// Figures on a battle map (M23b): the crew and their enemies as people in
// spacesuits, drawn in code. Pure: a design, colors and a pose in, solid
// faces (solid.js) out. A figure is a skeleton posed in its own frame (u
// ahead, v to its left, w up, its feet at the origin): two-bone arms reach
// the weapon, two-bone legs reach the deck. A design dresses the bones in
// shapes (tubes, balls, lathes, plates), then the faces are turned and
// moved onto the deck where it stands. The figure sorts against walls as a
// whole, at its middle, and its faces among themselves (painter.js groups).
//
// MOCKUP: five designs to choose from.
import { normalOf } from './solid.js';

export const DESIGNS = ['eva', 'assault', 'skinsuit', 'industrial', 'diver'];
const MIDDLE = 0.38; // the height a figure sorts at, against walls and other figures

// colors: { suit, trim, dark, under, visor, glass, lamp, gun, outline, halo
// }; pose: { aim (0 to 1), stride (0 to 1, the walk's phase, or null) };
// group: a number of its own, so the painter keeps its faces together and
// outlines them as one.
export function figureFaces(out, { at: [cx, cy], facing: [fx, fy], group }, design, colors, pose = {}) {
  const place = ([u, v, w]) => [cx + u * fx - v * fy, cy + u * fy + v * fx, w];
  const faces = [];
  const d = DRESS[design];
  d.dress({ faces, place, colors, edges: d.edges }, bones(d.body, pose));
  const anchor = [cx, cy, MIDDLE];
  for (const face of faces) out.push({ ...face, anchor, group, ...(colors.halo ? { halo: colors.halo } : {}) });
}

// --- The skeleton -----------------------------------------------------------

// Proportions: hip and shoulder heights, half widths, bone lengths, and the
// middle of the head.
const BODY = { hip: 0.35, shoulder: 0.58, shoulderW: 0.13, hipW: 0.058, upper: 0.15, fore: 0.15, thigh: 0.17, shin: 0.17, head: 0.66 };

function bones(body, { aim = 0, stride = null }) {
  const b = { ...BODY, ...body };
  const phase = stride == null ? 0 : Math.sin(stride * Math.PI * 2);
  const lift = stride == null ? 0 : 0.012 * Math.abs(phase);
  const chest = [0.015 + 0.02 * aim, 0, b.shoulder - 0.03 + lift];
  const neck = [chest[0] + 0.005, 0, b.shoulder + 0.02 + lift];
  const head = [chest[0] + 0.01, 0, b.head + lift];
  const shoulders = [-1, 1].map((s) => [chest[0], s * b.shoulderW, b.shoulder + lift]);
  const hips = [-1, 1].map((s) => [0, s * b.hipW, b.hip + lift]);
  const feet = [-1, 1].map((s) => [0.012 + 0.09 * phase * s, s * (b.hipW + 0.012), 0.05 + 0.03 * Math.max(0, phase * s)]);
  const knees = hips.map((hip, i) => bend(hip, feet[i], b.thigh, b.shin, [1, 0, 0]));
  // The weapon: at the ready it lies across the body, pointing down and to
  // the left; aimed, it points ahead at the shoulder.
  const grip = [0.07 + 0.03 * aim, -0.06, 0.43 + 0.11 * aim];
  const tilt = (1 - aim) * 0.3;
  const across = (1 - aim) * 0.55;
  const dir = [Math.cos(tilt) * Math.cos(across), Math.cos(tilt) * Math.sin(across), -Math.sin(tilt)];
  const hands = [grip, add(grip, scale(dir, 0.13))];
  const elbows = shoulders.map((sh, i) => bend(sh, hands[i], b.upper, b.fore, [-0.3, (i ? 1 : -1) * 0.9, -0.5]));
  return { b, chest, neck, head, shoulders, elbows, hands, hips, knees, feet, grip, dir };
}

// The middle joint of a two-bone limb from a to c, bending toward `pole`.
function bend(a, c, upper, lower, pole) {
  let d = sub(c, a);
  let len = Math.hypot(...d);
  const reach = upper + lower - 1e-6;
  if (len > reach) {
    d = scale(d, reach / len);
    len = reach;
  }
  const dir = scale(d, 1 / (len || 1));
  const along = (upper * upper - lower * lower + len * len) / (2 * (len || 1));
  const h = Math.sqrt(Math.max(0, upper * upper - along * along));
  const p = norm(sub(pole, scale(dir, dot(pole, dir))));
  return add(add(a, scale(dir, along)), scale(p, h));
}

// --- The designs ------------------------------------------------------------

const DRESS = {
  // Classic EVA: a puffy white suit with ringed joints, a hard chest with
  // its controls, a life-support pack, a bubble helmet with a dark visor.
  // The trim is stripes on the arms and legs, over the helmet and on the
  // pack's lid.
  eva: {
    edges: false,
    body: { shoulderW: 0.135 },
    dress(kit, s) {
      const { suit, trim, dark } = kit.colors;
      const { hip, shoulder } = s.b;
      for (let i = 0; i < 2; i++) {
        tube(kit, s.hips[i], s.knees[i], 0.054, 0.047, suit);
        band(kit, mix(s.hips[i], s.knees[i], 0.4), sub(s.knees[i], s.hips[i]), 0.056, 0.035, trim);
        band(kit, s.knees[i], sub(s.feet[i], s.hips[i]), 0.05, 0.03, dark);
        tube(kit, s.knees[i], s.feet[i], 0.047, 0.045, suit);
        boot(kit, s.feet[i], 0.052, 0.09, 0.08, suit, dark);
      }
      // The hard upper torso, the waist ring, the chest controls.
      lathe(kit, [0, 0], [[hip - 0.04, 0.085, 0.1], [hip + 0.05, 0.096, 0.115], [shoulder - 0.06, 0.112, 0.14], [shoulder + 0.02, 0.1, 0.13], [shoulder + 0.05, 0.06, 0.09]], 14, suit, { square: 3 });
      lathe(kit, [0, 0], [[hip - 0.01, 0.093, 0.11], [hip + 0.02, 0.095, 0.112]], 14, dark, { top: false, square: 3 });
      block(kit, [0.1, -0.06, hip + 0.08], [0.145, 0.06, hip + 0.15], suit);
      block(kit, [0.145, -0.05, hip + 0.09], [0.148, 0.05, hip + 0.14], dark);
      for (const [v, c] of [[-0.03, trim], [0, kit.colors.lamp], [0.03, kit.colors.visor]]) block(kit, [0.146, v - 0.009, hip + 0.112], [0.151, v + 0.009, hip + 0.128], c, { emissive: true });
      // The life-support pack, its lid in the trim, hoses to the chest.
      lathe(kit, [-0.16, 0], [[hip + 0.03, 0.058, 0.108], [shoulder + 0.03, 0.058, 0.108]], 12, suit, { square: 5, top: false });
      lathe(kit, [-0.16, 0], [[shoulder + 0.03, 0.058, 0.108], [shoulder + 0.055, 0.05, 0.095]], 12, trim, { square: 5 });
      for (const v of [-0.07, 0.07]) tube(kit, [-0.11, v, hip + 0.06], [0.06, v * 1.2, hip + 0.1], 0.012, 0.012, dark, 6);
      for (let i = 0; i < 2; i++) {
        ball(kit, s.shoulders[i], [0.055, 0.055, 0.055], () => ({ color: suit }), 8, 5);
        tube(kit, s.shoulders[i], s.elbows[i], 0.046, 0.043, suit);
        band(kit, mix(s.shoulders[i], s.elbows[i], 0.5), sub(s.elbows[i], s.shoulders[i]), 0.048, 0.035, trim);
        band(kit, s.elbows[i], sub(s.hands[i], s.shoulders[i]), 0.046, 0.026, dark);
        tube(kit, s.elbows[i], s.hands[i], 0.043, 0.04, suit);
        band(kit, mix(s.elbows[i], s.hands[i], 0.92), sub(s.hands[i], s.elbows[i]), 0.044, 0.02, dark);
        ball(kit, s.hands[i], [0.036, 0.036, 0.036], () => ({ color: suit }), 6, 4);
      }
      weapon(kit, s);
      // The neck ring and the bubble: a dark visor with a glint, the trim
      // over the top.
      lathe(kit, [s.neck[0], 0], [[s.neck[2] - 0.02, 0.09, 0.098], [s.neck[2] + 0.015, 0.088, 0.096]], 14, dark);
      ball(kit, add(s.head, [0, 0, 0.012]), [0.12, 0.118, 0.118], (lat, lon) => {
        const across = Math.sin(lon);
        if (Math.cos(lon) > 0.3 && lat > -0.5 && lat < 0.62) return lat > 0.3 && across > -0.45 && across < 0.05 ? { color: kit.colors.visor, emissive: true } : { color: kit.colors.glass };
        if (lat > 0.25 && Math.abs(across) < 0.2) return { color: trim };
        return { color: suit };
      }, 16, 9);
    },
  },

  // Assault armor: plates over a dark undersuit, a breastplate wider at the
  // top, round shoulder guards capped in the trim, an angular helmet with a
  // T-shaped visor and a crest.
  assault: {
    edges: false,
    body: { shoulderW: 0.14 },
    dress(kit, s) {
      const { suit, trim, dark } = kit.colors;
      const { hip, shoulder } = s.b;
      for (let i = 0; i < 2; i++) {
        tube(kit, s.hips[i], s.knees[i], 0.04, 0.034, dark, 8);
        tube(kit, s.knees[i], s.feet[i], 0.034, 0.03, dark, 8);
        plateAlong(kit, mix(s.hips[i], s.knees[i], 0.1), mix(s.hips[i], s.knees[i], 0.85), 0.048, 0.042, 0.0, 0.052, suit);
        plateAlong(kit, mix(s.knees[i], s.feet[i], 0.15), mix(s.knees[i], s.feet[i], 0.8), 0.042, 0.046, 0.0, 0.048, suit);
        knee(kit, s.knees[i], trim);
        sabaton(kit, s.feet[i], suit, dark);
      }
      // The waist, the belly, the breastplate with its light, the pack.
      lathe(kit, [0, 0], [[hip - 0.05, 0.068, 0.082], [hip + 0.045, 0.06, 0.075]], 8, dark, { square: 3 });
      lathe(kit, [0.01, 0], [[hip + 0.03, 0.07, 0.08], [hip + 0.1, 0.076, 0.088]], 8, suit, { square: 3 });
      hexa(kit, [[-0.075, -0.095, hip + 0.1], [0.095, -0.085, hip + 0.1], [0.095, 0.085, hip + 0.1], [-0.075, 0.095, hip + 0.1], [-0.085, -0.13, shoulder + 0.015], [0.108, -0.115, shoulder - 0.01], [0.108, 0.115, shoulder - 0.01], [-0.085, 0.13, shoulder + 0.015]], suit);
      hexa(kit, [[0.095, -0.07, hip + 0.12], [0.112, -0.06, hip + 0.13], [0.112, 0.06, hip + 0.13], [0.095, 0.07, hip + 0.12], [0.104, -0.1, shoulder - 0.025], [0.12, -0.085, shoulder - 0.035], [0.12, 0.085, shoulder - 0.035], [0.104, 0.1, shoulder - 0.025]], suit);
      block(kit, [0.118, -0.011, hip + 0.15], [0.126, 0.011, shoulder - 0.06], trim, { emissive: true });
      hexa(kit, [[-0.135, -0.075, hip + 0.09], [-0.08, -0.085, hip + 0.09], [-0.08, 0.085, hip + 0.09], [-0.135, 0.075, hip + 0.09], [-0.145, -0.095, shoulder + 0.005], [-0.08, -0.105, shoulder + 0.015], [-0.08, 0.105, shoulder + 0.015], [-0.145, 0.095, shoulder + 0.005]], dark);
      for (const v of [-0.045, 0.045]) block(kit, [-0.151, v - 0.02, hip + 0.12], [-0.141, v + 0.02, hip + 0.145], kit.colors.lamp, { emissive: true });
      for (let i = 0; i < 2; i++) {
        tube(kit, s.shoulders[i], s.elbows[i], 0.033, 0.03, dark, 8);
        tube(kit, s.elbows[i], s.hands[i], 0.03, 0.028, dark, 8);
        plateAlong(kit, mix(s.elbows[i], s.hands[i], 0.1), mix(s.elbows[i], s.hands[i], 0.8), 0.036, 0.04, -0.01, 0.042, suit);
        cubeAt(kit, s.hands[i], 0.03, dark);
        const side = Math.sign(s.shoulders[i][1]);
        dome(kit, add(s.shoulders[i], [0, side * 0.005, -0.005]), [0.088, 0.078, 0.062], (lat) => ({ color: lat > 0.75 ? trim : suit }), 10, 4, [0, side * 0.7, 1]);
      }
      weapon(kit, s);
      // The helmet: a faceted shell, the T visor, the crest.
      const [hu, , hw] = s.head;
      lathe(kit, [hu, 0], [[hw - 0.075, 0.048, 0.048], [hw - 0.03, 0.06, 0.06]], 8, dark, { square: 2.6 });
      lathe(kit, [hu, 0], [[hw - 0.045, 0.082, 0.068], [hw + 0.03, 0.094, 0.078], [hw + 0.075, 0.084, 0.07], [hw + 0.105, 0.05, 0.044]], 8, suit, { square: 2.6 });
      block(kit, [hu + 0.086, -0.06, hw + 0.01], [hu + 0.097, 0.06, hw + 0.034], kit.colors.visor, { emissive: true });
      block(kit, [hu + 0.08, -0.013, hw - 0.04], [hu + 0.093, 0.013, hw + 0.012], kit.colors.visor, { emissive: true });
      hexa(kit, [[hu - 0.075, -0.013, hw + 0.075], [hu + 0.06, -0.013, hw + 0.085], [hu + 0.06, 0.013, hw + 0.085], [hu - 0.075, 0.013, hw + 0.075], [hu - 0.06, -0.01, hw + 0.13], [hu + 0.025, -0.01, hw + 0.128], [hu + 0.025, 0.01, hw + 0.128], [hu - 0.06, 0.01, hw + 0.13]], trim);
    },
  },

  // Skinsuit: a close-fitting slate suit with lines of light in the trim
  // down the limbs and chest, light plates over it, a smooth egg of a helmet
  // with a visor that wraps round, a fin on top and a slim spine pack.
  skinsuit: {
    edges: false,
    body: { shoulderW: 0.118, hipW: 0.05, head: 0.675, hip: 0.37, thigh: 0.18, shin: 0.18 },
    dress(kit, s) {
      const { suit, trim, under } = kit.colors;
      const { hip, shoulder } = s.b;
      const glow = { emissive: true };
      const seam = (a, c, r0, r1) => {
        const out = [0, Math.sign(a[1]) || 1, 0];
        line(kit, add(a, scale(out, r0)), add(c, scale(out, r1)), 0.008, trim, glow);
      };
      for (let i = 0; i < 2; i++) {
        tube(kit, s.hips[i], s.knees[i], 0.042, 0.033, under, 8);
        tube(kit, s.knees[i], s.feet[i], 0.033, 0.027, under, 8);
        plateAlong(kit, mix(s.hips[i], s.knees[i], 0.12), mix(s.hips[i], s.knees[i], 0.8), 0.036, 0.03, 0.0, 0.048, suit);
        plateAlong(kit, mix(s.knees[i], s.feet[i], 0.1), mix(s.knees[i], s.feet[i], 0.55), 0.03, 0.026, 0.0, 0.04, suit);
        seam(s.hips[i], s.knees[i], 0.04, 0.032);
        seam(s.knees[i], add(s.feet[i], [0, 0, 0.03]), 0.032, 0.027);
        boot(kit, s.feet[i], 0.034, 0.075, 0.07, suit, under);
      }
      lathe(kit, [0, 0], [[hip - 0.035, 0.06, 0.072], [hip + 0.06, 0.056, 0.068], [shoulder - 0.07, 0.07, 0.1], [shoulder - 0.005, 0.06, 0.1], [shoulder + 0.035, 0.035, 0.05]], 12, under, { square: 2.4 });
      // The chest plate, a V of light down it, a belt, the spine pack.
      lathe(kit, [0.012, 0], [[shoulder - 0.11, 0.065, 0.088], [shoulder - 0.06, 0.07, 0.1], [shoulder - 0.01, 0.062, 0.1], [shoulder + 0.02, 0.045, 0.07]], 12, suit, { square: 2.4 });
      line(kit, [0.07, -0.07, shoulder - 0.03], [0.068, 0, hip + 0.06], 0.008, trim, glow);
      line(kit, [0.07, 0.07, shoulder - 0.03], [0.068, 0, hip + 0.06], 0.008, trim, glow);
      lathe(kit, [0, 0], [[hip - 0.01, 0.063, 0.074], [hip + 0.02, 0.062, 0.073]], 12, suit, { top: false, square: 2.4 });
      lathe(kit, [-0.09, 0], [[hip + 0.03, 0.035, 0.045], [shoulder + 0.01, 0.04, 0.05], [shoulder + 0.03, 0.025, 0.035]], 8, suit, { square: 3 });
      for (const w of [hip + 0.1, hip + 0.15]) block(kit, [-0.132, -0.022, w], [-0.126, 0.022, w + 0.018], trim, glow);
      for (let i = 0; i < 2; i++) {
        dome(kit, s.shoulders[i], [0.05, 0.046, 0.034], () => ({ color: suit }), 8, 3, [0, Math.sign(s.shoulders[i][1]) * 0.8, 1]);
        tube(kit, s.shoulders[i], s.elbows[i], 0.032, 0.027, under, 8);
        tube(kit, s.elbows[i], s.hands[i], 0.027, 0.023, under, 8);
        seam(s.shoulders[i], s.elbows[i], 0.03, 0.026);
        ball(kit, s.hands[i], [0.027, 0.027, 0.027], () => ({ color: suit }), 6, 4);
      }
      weapon(kit, s);
      tube(kit, s.neck, add(s.neck, [0, 0, 0.05]), 0.03, 0.028, under, 8);
      // The egg, its visor round the front, the fin over the top.
      const c = add(s.head, [-0.005, 0, 0.022]);
      ball(kit, c, [0.096, 0.08, 0.1], (lat, lon) => {
        if (Math.cos(lon) > -0.2 && lat > -0.3 && lat < 0.36) return { color: kit.colors.visor, emissive: true };
        return { color: suit };
      }, 16, 9);
      fin(kit, c, 0.1, trim);
    },
  },

  // Industrial hardsuit: a walking cab. A chamfered box of a body with
  // hazard stripes and lamps, twin tanks in the trim, a roll bar behind the
  // head, a square cab of a helmet with a window, lamps and an antenna.
  industrial: {
    edges: false,
    body: { shoulderW: 0.15, hipW: 0.066, head: 0.64, hip: 0.33, thigh: 0.16, shin: 0.16 },
    dress(kit, s) {
      const { suit, trim, dark } = kit.colors;
      const { hip, shoulder } = s.b;
      for (let i = 0; i < 2; i++) {
        tube(kit, s.hips[i], s.knees[i], 0.05, 0.048, suit, 8, 5);
        tube(kit, s.knees[i], s.feet[i], 0.048, 0.046, suit, 8, 5);
        cubeAt(kit, s.knees[i], 0.042, dark);
        const [u, v] = s.feet[i];
        block(kit, [u - 0.065, v - 0.058, 0], [u + 0.105, v + 0.058, 0.07], dark);
        block(kit, [u + 0.06, v - 0.058, 0.035], [u + 0.105, v + 0.058, 0.07], trim);
      }
      // The body, its stripes and lamps, the tanks, the roll bar.
      lathe(kit, [0.005, 0], [[hip - 0.045, 0.1, 0.122], [shoulder + 0.035, 0.1, 0.125]], 8, suit, { square: 6 });
      block(kit, [0.098, -0.105, hip + 0.015], [0.108, 0.105, hip + 0.115], dark);
      for (let k = 0; k < 4; k++) {
        const v0 = -0.1 + k * 0.053;
        hexa(kit, [[0.108, v0, hip + 0.02], [0.112, v0, hip + 0.02], [0.112, v0 + 0.027, hip + 0.02], [0.108, v0 + 0.027, hip + 0.02], [0.108, v0 + 0.024, hip + 0.11], [0.112, v0 + 0.024, hip + 0.11], [0.112, v0 + 0.051, hip + 0.11], [0.108, v0 + 0.051, hip + 0.11]], trim);
      }
      for (const v of [-0.045, 0, 0.045]) block(kit, [0.1, v - 0.013, shoulder - 0.06], [0.112, v + 0.013, shoulder - 0.035], kit.colors.lamp, { emissive: true });
      for (const v of [-0.06, 0.06]) {
        tube(kit, [-0.15, v, hip - 0.01], [-0.15, v, shoulder + 0.03], 0.048, 0.048, trim, 10);
        dome(kit, [-0.15, v, shoulder + 0.03], [0.048, 0.048, 0.03], () => ({ color: trim }), 10, 3);
      }
      for (const v of [-0.15, 0.15]) line(kit, [-0.115, v, shoulder - 0.06], [-0.115, v, shoulder + 0.13], 0.014, dark);
      line(kit, [-0.115, -0.164, shoulder + 0.13], [-0.115, 0.164, shoulder + 0.13], 0.014, dark);
      for (let i = 0; i < 2; i++) {
        cubeAt(kit, add(s.shoulders[i], [0, 0, 0.01]), 0.055, trim);
        tube(kit, s.shoulders[i], s.elbows[i], 0.043, 0.041, suit, 8, 5);
        cubeAt(kit, s.elbows[i], 0.04, dark);
        tube(kit, s.elbows[i], s.hands[i], 0.046, 0.046, suit, 8, 5);
        cubeAt(kit, s.hands[i], 0.046, dark);
      }
      weapon(kit, s);
      // The cab: its window, a lit strip, lamps, a band of trim, an antenna.
      const [hu, , hw] = s.head;
      lathe(kit, [hu, 0], [[hw - 0.05, 0.078, 0.082], [hw + 0.07, 0.072, 0.078]], 8, suit, { square: 5 });
      hexa(kit, [[hu + 0.072, -0.06, hw - 0.025], [hu + 0.083, -0.06, hw - 0.025], [hu + 0.083, 0.06, hw - 0.025], [hu + 0.072, 0.06, hw - 0.025], [hu + 0.066, -0.056, hw + 0.055], [hu + 0.077, -0.056, hw + 0.055], [hu + 0.077, 0.056, hw + 0.055], [hu + 0.066, 0.056, hw + 0.055]], kit.colors.glass);
      block(kit, [hu + 0.074, -0.052, hw + 0.03], [hu + 0.08, 0.052, hw + 0.045], kit.colors.visor, { emissive: true });
      lathe(kit, [hu, 0], [[hw + 0.07, 0.074, 0.08], [hw + 0.085, 0.072, 0.078]], 8, trim, { square: 5 });
      for (const v of [-0.05, 0.05]) block(kit, [hu + 0.03, v - 0.018, hw + 0.085], [hu + 0.068, v + 0.018, hw + 0.105], kit.colors.lamp, { emissive: true });
      line(kit, [hu - 0.05, 0.05, hw + 0.085], [hu - 0.065, 0.05, hw + 0.21], 0.006, dark);
      cubeAt(kit, [hu - 0.065, 0.05, hw + 0.21], 0.012, kit.colors.lamp);
    },
  },

  // Deep diver: a round metal helmet in the trim with three glowing
  // portholes and a valve on top, a broad collar, a heavy rounded suit with
  // a riveted chest plate, a tank with hoses to the helmet, weighted belt
  // and boots.
  diver: {
    edges: false,
    body: { head: 0.675, shoulderW: 0.14, hipW: 0.062 },
    dress(kit, s) {
      const { suit, trim, dark } = kit.colors;
      const { hip, shoulder } = s.b;
      for (let i = 0; i < 2; i++) {
        tube(kit, s.hips[i], s.knees[i], 0.056, 0.05, suit);
        band(kit, s.knees[i], sub(s.feet[i], s.hips[i]), 0.054, 0.03, dark);
        tube(kit, s.knees[i], s.feet[i], 0.05, 0.048, suit);
        tube(kit, add(s.feet[i], [0, 0, 0.02]), add(s.feet[i], [0, 0, 0.075]), 0.058, 0.056, trim);
        boot(kit, s.feet[i], 0.06, 0.095, 0.075, dark, dark);
      }
      lathe(kit, [0, 0], [[hip - 0.05, 0.1, 0.115], [hip + 0.06, 0.122, 0.135], [shoulder - 0.05, 0.118, 0.142], [shoulder + 0.02, 0.085, 0.11]], 14, suit);
      lathe(kit, [0, 0], [[hip - 0.055, 0.106, 0.121], [hip + 0.005, 0.11, 0.125]], 14, dark, { top: false });
      for (const v of [-0.06, 0, 0.06]) block(kit, [0.1, v - 0.016, hip - 0.04], [0.117, v + 0.016, hip - 0.005], trim);
      // The chest plate and its rivets.
      hexa(kit, [[0.105, -0.07, hip + 0.07], [0.132, -0.06, hip + 0.07], [0.132, 0.06, hip + 0.07], [0.105, 0.07, hip + 0.07], [0.09, -0.095, shoulder - 0.005], [0.12, -0.085, shoulder - 0.015], [0.12, 0.085, shoulder - 0.015], [0.09, 0.095, shoulder - 0.005]], trim);
      for (const v of [-0.05, 0.05]) for (const w of [hip + 0.09, shoulder - 0.04]) cubeAt(kit, [0.13, v, w], 0.008, dark);
      // The tank, banded, and its hoses up to the helmet.
      tube(kit, [-0.165, 0, hip + 0.01], [-0.165, 0, shoulder + 0.01], 0.055, 0.055, dark, 10);
      dome(kit, [-0.165, 0, shoulder + 0.01], [0.055, 0.055, 0.035], () => ({ color: dark }), 10, 3);
      for (const w of [hip + 0.06, shoulder - 0.05]) band(kit, [-0.165, 0, w], [0, 0, 1], 0.059, 0.022, trim);
      for (const v of [-0.04, 0.04]) {
        const top = [-0.165, v, shoulder + 0.03];
        tube(kit, top, add(top, [0.02, v * 0.3, 0.06]), 0.013, 0.013, dark, 6);
        tube(kit, add(top, [0.02, v * 0.3, 0.06]), add(s.head, [-0.1, v * 1.3, -0.01]), 0.013, 0.013, dark, 6);
      }
      for (let i = 0; i < 2; i++) {
        ball(kit, s.shoulders[i], [0.058, 0.058, 0.058], () => ({ color: suit }), 8, 5);
        tube(kit, s.shoulders[i], s.elbows[i], 0.05, 0.046, suit);
        tube(kit, s.elbows[i], s.hands[i], 0.046, 0.042, suit);
        band(kit, mix(s.elbows[i], s.hands[i], 0.85), sub(s.hands[i], s.elbows[i]), 0.05, 0.03, trim);
        ball(kit, s.hands[i], [0.04, 0.04, 0.04], () => ({ color: dark }), 6, 4);
      }
      weapon(kit, s);
      // The collar, the helmet and its portholes, the valve on top.
      lathe(kit, [s.neck[0], 0], [[s.neck[2] - 0.035, 0.125, 0.155], [s.neck[2] - 0.005, 0.12, 0.15], [s.neck[2] + 0.01, 0.1, 0.12]], 14, trim);
      const c = add(s.head, [0, 0, 0.02]);
      ball(kit, c, [0.118, 0.118, 0.116], () => ({ color: trim }), 16, 9);
      porthole(kit, c, 0, 0.118, 0.058);
      for (const a of [Math.PI / 2, -Math.PI / 2]) porthole(kit, c, a, 0.118, 0.038);
      tube(kit, add(c, [-0.02, 0, 0.1]), add(c, [-0.02, 0, 0.145]), 0.022, 0.022, dark, 8);
      tube(kit, add(c, [-0.02, -0.04, 0.135]), add(c, [-0.02, 0.04, 0.135]), 0.01, 0.01, dark, 6);
    },
  },
};

// The weapon along its line from the grip: a body, a stock, a barrel, a
// magazine, a sight.
function weapon(kit, { grip, dir }) {
  const { gun, dark } = kit.colors;
  const at = (t) => add(grip, scale(dir, t));
  const down = norm(cross(cross(dir, [0, 0, 1]), dir));
  slab(kit, at(-0.06), at(0.16), 0.022, 0.042, gun, 0.45);
  slab(kit, at(-0.135), at(-0.06), 0.017, 0.036, gun, 0.15);
  slab(kit, at(0.16), at(0.28), 0.01, 0.014, gun, 1.2);
  slab(kit, at(0.02), add(at(0.045), scale(down, -0.065)), 0.015, 0.013, dark);
  slab(kit, add(at(0.0), [0, 0, 0.046]), add(at(0.075), [0, 0, 0.046]), 0.011, 0.012, dark);
}

// --- Shapes -----------------------------------------------------------------

// A face, outlined in an edged design unless it glows or is part of a
// smooth shape.
function emit(kit, local, inside, color, { smooth = false, ...extra } = {}) {
  const pts = local.map(kit.place);
  const edge = kit.edges && kit.colors.outline && !extra.emissive && !smooth ? { edge: kit.colors.outline } : {};
  kit.faces.push({ pts, normal: normalOf(pts, kit.place(inside)), color, ...edge, ...extra });
}

// Six faces from eight corners: 0-3 one end, 4-7 the other, in order.
function hexa(kit, c, color, extra) {
  const inside = scale(c.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / 8);
  for (const q of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) emit(kit, q.map((i) => c[i]), inside, color, extra);
}

function block(kit, [u0, v0, w0], [u1, v1, w1], color, extra) {
  hexa(kit, [[u0, v0, w0], [u1, v0, w0], [u1, v1, w0], [u0, v1, w0], [u0, v0, w1], [u1, v0, w1], [u1, v1, w1], [u0, v1, w1]], color, extra);
}

function cubeAt(kit, [u, v, w], h, color) {
  block(kit, [u - h, v - h, w - h], [u + h, v + h, w + h], color);
}

// A box from a to b, `w` across and `h` high, its middle `lift` of h above
// the line.
function slab(kit, a, b, w, h, color, lift = 0, extra) {
  const [side, up] = frame(sub(b, a));
  const corner = (p, s, t) => add(add(p, scale(side, s * w)), scale(up, (t + lift) * h));
  hexa(kit, [corner(a, -1, -1), corner(a, 1, -1), corner(a, 1, 1), corner(a, -1, 1), corner(b, -1, -1), corner(b, 1, -1), corner(b, 1, 1), corner(b, -1, 1)], color, extra);
}

function beam(kit, a, b, half, color) {
  slab(kit, a, b, half, half, color);
}

// A thin square rod: seams, cage bars, antennas.
function line(kit, a, b, half, color, extra) {
  slab(kit, a, b, half, half, color, 0, extra);
}

// An upright frustum round [u, v] from w0 to w1: its bottom and top half
// sizes [hu, hv].
function frustum(kit, [cu, cv], w0, w1, [bu, bv], [tu, tv], color) {
  hexa(kit, [[cu - bu, cv - bv, w0], [cu + bu, cv - bv, w0], [cu + bu, cv + bv, w0], [cu - bu, cv + bv, w0], [cu - tu, cv - tv, w1], [cu + tu, cv - tv, w1], [cu + tu, cv + tv, w1], [cu - tu, cv + tv, w1]], color);
}

// An armor plate laid along a limb from a to b, w0 to w1 across, from
// `near` to `far` ahead of the bone.
function plateAlong(kit, a, b, w0, w1, near, far, color) {
  const [side, up] = frame(sub(b, a));
  const ahead = norm(add(scale(up, 0.25), [1, 0, 0]));
  const p = (q, s, w, o) => add(add(q, scale(side, s * w)), scale(ahead, o));
  hexa(kit, [p(a, -1, w0, near), p(a, 1, w0, near), p(a, 1, w0, far), p(a, -1, w0, far), p(b, -1, w1, near), p(b, 1, w1, near), p(b, 1, w1, far), p(b, -1, w1, far)], color);
}

// A knee guard: a wedge ahead of the knee.
function knee(kit, [u, v, w], color) {
  hexa(kit, [[u + 0.02, v - 0.03, w - 0.035], [u + 0.06, v - 0.025, w - 0.03], [u + 0.06, v + 0.025, w - 0.03], [u + 0.02, v + 0.03, w - 0.035], [u + 0.02, v - 0.03, w + 0.035], [u + 0.055, v - 0.025, w + 0.03], [u + 0.055, v + 0.025, w + 0.03], [u + 0.02, v + 0.03, w + 0.035]], color);
}

// A shoulder plate in three steps, the top one in the trim.
function pauldron(kit, [u, v, w], color, top) {
  const side = Math.sign(v);
  for (let k = 0; k < 3; k++) {
    const z = w + 0.045 - k * 0.032;
    const out = 0.055 + k * 0.014;
    const half = 0.075 - k * 0.006;
    const inner = v - side * 0.03;
    const outer = v + side * out;
    hexa(kit, [[u - half, Math.min(inner, outer), z - 0.03], [u + half, Math.min(inner, outer), z - 0.03], [u + half, Math.max(inner, outer), z - 0.03], [u - half, Math.max(inner, outer), z - 0.03], [u - half * 0.9, Math.min(inner, outer) + (side < 0 ? 0.01 : 0), z], [u + half * 0.9, Math.min(inner, outer) + (side < 0 ? 0.01 : 0), z], [u + half * 0.9, Math.max(inner, outer) - (side > 0 ? 0.01 : 0), z], [u - half * 0.9, Math.max(inner, outer) - (side > 0 ? 0.01 : 0), z]], k === 0 ? top : color);
  }
}

// A tapered tube from a to b, radius ra to rb, with its ends capped;
// square above 2 squares it off.
function tube(kit, a, b, ra, rb, color, n = 10, square = 2) {
  const [side, up] = frame(sub(b, a));
  const curve = (c) => Math.sign(c) * Math.abs(c) ** (2 / square);
  const ring = (p, r) => Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * Math.PI * 2;
    return add(p, add(scale(side, r * curve(Math.cos(t))), scale(up, r * curve(Math.sin(t)))));
  });
  const [r0, r1] = [ring(a, ra), ring(b, rb)];
  const inside = scale(add(a, b), 0.5);
  const smooth = { smooth: square === 2 };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    emit(kit, [r0[i], r0[j], r1[j], r1[i]], inside, color, smooth);
  }
  emit(kit, r1, a, color, smooth);
  emit(kit, r0, b, color, smooth);
}

// A short ring round a joint at p, along `axis`.
function band(kit, p, axis, r, length, color) {
  const d = scale(norm(axis), length / 2);
  tube(kit, sub(p, d), add(p, d), r, r, color);
}

// A surface turned round the upright through [u, v]: rings [w, ru, rv]
// from the bottom up, joined, the top closed unless `top` is false. square
// above 2 squares the rings off toward rounded boxes.
function lathe(kit, [cu, cv], rings, n, color, { top = true, square = 2 } = {}) {
  const k = 2 / square;
  const curve = (c) => Math.sign(c) * Math.abs(c) ** k;
  const ring = ([w, ru, rv]) => Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    return [cu + ru * curve(Math.cos(a)), cv + rv * curve(Math.sin(a)), w];
  });
  const pts = rings.map(ring);
  for (let r = 0; r < rings.length - 1; r++) {
    const inside = [cu, cv, (rings[r][0] + rings[r + 1][0]) / 2];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      emit(kit, [pts[r][i], pts[r][j], pts[r + 1][j], pts[r + 1][i]], inside, color);
    }
  }
  if (top) emit(kit, pts.at(-1), [cu, cv, rings[0][0]], color);
}

// An ellipsoid round c, radii [ru, rv, rw]; paint(lat, lon) gives each
// facet's { color, emissive } (lon 0 is straight ahead, a facet's middle).
function ball(kit, c, [ru, rv, rw], paint, n = 10, m = 6) {
  const pt = (i, j) => {
    const lon = ((i - 0.5) / n) * Math.PI * 2;
    const lat = -Math.PI / 2 + (j / m) * Math.PI;
    return add(c, [ru * Math.cos(lat) * Math.cos(lon), rv * Math.cos(lat) * Math.sin(lon), rw * Math.sin(lat)]);
  };
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const quad = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
      const pts = j === 0 ? [quad[0], quad[2], quad[3]] : j === m - 1 ? [quad[0], quad[1], quad[2]] : quad;
      const lon = (i / n) * Math.PI * 2;
      const lat = -Math.PI / 2 + ((j + 0.5) / m) * Math.PI;
      const { color, emissive } = paint(lat, lon);
      emit(kit, pts, c, color, { smooth: true, emissive });
    }
  }
}

// The top half of an ellipsoid round c, its top along `axis` (up unless
// given), radii [ahead, across, high], closed underneath; paint(lat, lon)
// as for ball.
function dome(kit, c, [ra, rb, rh], paint, n = 10, m = 3, axis = [0, 0, 1]) {
  const up = norm(axis);
  const ahead = norm(sub([1, 0, 0], scale(up, up[0])));
  const across = cross(up, ahead);
  const pt = (i, j) => {
    const lon = ((i - 0.5) / n) * Math.PI * 2;
    const lat = (j / m) * (Math.PI / 2);
    return add(c, add(add(scale(ahead, ra * Math.cos(lat) * Math.cos(lon)), scale(across, rb * Math.cos(lat) * Math.sin(lon))), scale(up, rh * Math.sin(lat))));
  };
  const inside = add(c, scale(up, rh * 0.3));
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const quad = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
      const pts = j === m - 1 ? [quad[0], quad[1], quad[2]] : quad;
      const { color, emissive } = paint(((j + 0.5) / m) * (Math.PI / 2), (i / n) * Math.PI * 2);
      emit(kit, pts, inside, color, { smooth: true, emissive });
    }
  }
  emit(kit, Array.from({ length: n }, (_, i) => pt(i, 0)), inside, paint(0, 0).color, { smooth: true });
}

// A boot: a rounded toe ahead of the ankle, on a dark sole.
function boot(kit, [u, v], half, ahead, high, color, sole) {
  block(kit, [u - 0.055, v - half, 0], [u + ahead, v + half, 0.02], sole);
  hexa(kit, [[u - 0.055, v - half, 0.02], [u + ahead, v - half * 0.85, 0.02], [u + ahead, v + half * 0.85, 0.02], [u - 0.055, v + half, 0.02], [u - 0.05, v - half, high], [u + ahead * 0.4, v - half * 0.9, high], [u + ahead * 0.4, v + half * 0.9, high], [u - 0.05, v + half, high]], color);
}

// An armored boot with a pointed toe.
function sabaton(kit, [u, v], color, sole) {
  block(kit, [u - 0.05, v - 0.045, 0], [u + 0.09, v + 0.045, 0.018], sole);
  hexa(kit, [[u - 0.05, v - 0.045, 0.018], [u + 0.105, v - 0.02, 0.018], [u + 0.105, v + 0.02, 0.018], [u - 0.05, v + 0.045, 0.018], [u - 0.045, v - 0.045, 0.09], [u + 0.035, v - 0.04, 0.075], [u + 0.035, v + 0.04, 0.075], [u - 0.045, v + 0.045, 0.09]], color);
}

// A fin over the top of a helmet at c, front to back.
function fin(kit, c, r, color) {
  const [cu, , cw] = c;
  hexa(kit, [[cu - r * 1.05, -0.007, cw + r * 0.1], [cu - r * 0.05, -0.007, cw + r * 1.02], [cu - r * 0.05, 0.007, cw + r * 1.02], [cu - r * 1.05, 0.007, cw + r * 0.1], [cu - r * 1.35, -0.005, cw + r * 0.35], [cu - r * 0.55, -0.005, cw + r * 1.32], [cu - r * 0.55, 0.005, cw + r * 1.32], [cu - r * 1.35, 0.005, cw + r * 0.35]], color);
}

// A porthole on a helmet ball at c, facing longitude a: a ring and glass.
function porthole(kit, c, a, r, size) {
  const n = 10;
  const dirn = norm([Math.cos(a), Math.sin(a), 0.08]);
  const [side, up] = frame(dirn);
  const ring = (rad, out) => Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * Math.PI * 2;
    return add(add(c, scale(dirn, r + out)), add(scale(side, rad * Math.cos(t)), scale(up, rad * Math.sin(t))));
  });
  const [base, rim, glass] = [ring(size * 1.05, -0.01), ring(size, 0.014), ring(size * 0.72, 0.016)];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    emit(kit, [base[i], base[j], rim[j], rim[i]], c, kit.colors.dark);
    emit(kit, [rim[i], rim[j], glass[j], glass[i]], c, kit.colors.dark);
  }
  emit(kit, glass, c, kit.colors.visor, { emissive: true });
}

// Two directions square to `axis` and to each other: across it (level) and
// up from it.
function frame(axis) {
  const a = norm(axis);
  let side = cross(a, [0, 0, 1]);
  if (Math.hypot(...side) < 1e-6) side = [0, 1, 0];
  side = norm(side);
  return [side, cross(side, a)];
}

// --- Vectors ----------------------------------------------------------------

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function mix(a, b, t) {
  return add(a, scale(sub(b, a), t));
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(a) {
  return scale(a, 1 / (Math.hypot(...a) || 1));
}
