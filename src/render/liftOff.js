// The ship lifting off at the end of act 1 (src/ui/campaign/launch.js): its
// engines light and shake it, it climbs off the pad toward the camera, then
// it flies away nose first, gathering speed, until it is out of sight.
// Pure: the scene is made once from the ship (exterior.js), and each moment
// of the sequence, the camera and the flames, comes from the time alone.
import { exteriorScene } from './exterior.js';
import { prepareSolid } from './painter.js';
import { shade } from './solid.js';

// The sequence, in seconds from its start: the engines light until IGNITE,
// the ship climbs until CLIMB, it is gone at AWAY, and the sequence is over
// at END.
export const IGNITE = 1;
export const CLIMB = 2.2;
export const AWAY = 4.2;
export const END = 4.8;

const GROW = 0.14; // how much nearer the climb brings the ship
// How much smaller the ship is when it is gone. Shrinking pulls it back
// toward the middle as it flies off; under half, flying wins all the way.
const SHRINK = 0.45;
const SHAKE = 3; // pixels, at its worst
const LIFT = 0.05; // of the view's height, the climb moves the ship up

// The ship seen from outside, lit and ready to draw, with where its
// engines' flames come out: { faces, glows, exhausts: [{ at, dir, flame }],
// skin }.
// input: { ship, defs, hull: traceHull(ship, defs), skin }.
export function liftOffScene(input) {
  // exhausts: the mouth of each nozzle, on the hull's skin (exterior.js).
  const { faces, glows, exhausts } = exteriorScene(input);
  return { faces: prepareSolid(faces, shade), glows, exhausts, skin: input.skin };
}

// The sequence at t seconds: { flame, shake, rise, away, gone, over }.
// flame is how bright the engines burn (more than 1 once it is under way),
// shake how hard they shake the ship, rise how far it has climbed and away
// how far through flying off it is, each 0 to 1.
export function liftOffAt(t) {
  const lit = easeOut(clamp(t / IGNITE));
  const away = clamp((t - CLIMB) / (AWAY - CLIMB));
  return {
    flame: t >= AWAY ? 0 : lit * (1 + 0.5 * away),
    shake: lit * (1 - clamp(away * 2)),
    rise: easeInOut(clamp((t - IGNITE) / (CLIMB - IGNITE))),
    away,
    gone: t >= AWAY,
    over: t >= END,
  };
}

// The camera for a moment of the sequence, from base, the camera on the
// ship at rest, centred in rect, the part of the screen it is seen in; box
// is the ship's box (orbit.js). The climb brings the ship nearer and up;
// flying away moves it toward its nose, the +x of the deck, ever faster,
// and shrinks it, until all of it is past the right of rect. t, in
// seconds, only shakes it.
export function liftOffCamera(base, rect, box, moment, t) {
  const { rise, away, shake } = moment;
  const run = away ** 3;
  const near = 1 + GROW * rise;
  const scale = base.scale * near * (1 - SHRINK * run);
  // Far enough that the whole ship, at its smallest, is past the edge.
  const length = box.x1 - box.x0;
  const reach = (rect.w / 2 + SHAKE) / (base.scale * near * (1 - SHRINK)) + length * 1.5;
  const jolt = SHAKE * shake;
  return {
    ...base,
    pivot: [base.pivot[0] - reach * run, base.pivot[1]],
    scale,
    x: base.x + jolt * (0.6 * Math.sin(t * 61.3) + 0.4 * Math.sin(t * 37.9 + 1.7)),
    y: base.y - rect.h * LIFT * (rise + run) + jolt * (0.6 * Math.sin(t * 53.1 + 0.5) + 0.4 * Math.sin(t * 29.3 + 2.1)),
  };
}

// Glows in each engine's plume, from the mouth out.
export const PLUME = 5;

// The engines' flames for a moment: glows (painter.js) along each exhaust,
// a hot core at the mouth and a plume tapering behind it, longer as the
// flame grows and flickering with t; and while the ship is low, the glow
// they throw on the pad. None before they light or once the ship is gone.
export function flameGlows(scene, moment, t) {
  const { flame, rise } = moment;
  if (flame <= 0) return [];
  const { exhausts, skin } = scene;
  const glows = [];
  exhausts.forEach(({ at, dir, flame: color = skin.flame }, i) => {
    const flicker = 1 + 0.12 * Math.sin(t * 41 + i * 2.3) + 0.06 * Math.sin(t * 97 + i);
    // Glows closer together than they are wide, so the plume is one.
    const length = 0.3 + 1.2 * flame * flicker;
    for (let k = 0; k < PLUME; k++) {
      const u = k / (PLUME - 1);
      glows.push({ at: along(at, dir, 0.1 + length * u), r: 0.12 + (0.4 - 0.1 * u) * flame * flicker, color: k ? color : skin.glassHi });
    }
  });
  const pad = (1 - rise) * Math.min(1, flame);
  if (pad > 0 && exhausts.length) {
    const mid = [0, 1].map((k) => exhausts.reduce((sum, { at, dir }) => sum + at[k] + dir[k] * 1.2, 0) / exhausts.length);
    glows.push({ at: [...mid, 0], r: 2.2 * pad, color: exhausts[0].flame ?? skin.flame });
  }
  return glows;
}

function along([x, y, z], [dx, dy], d) {
  return [x + dx * d, y + dy * d, z];
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOut(u) {
  return 1 - (1 - u) ** 2;
}

function easeInOut(u) {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}
