// A raid's landing seen (M51): the lander comes down over the colony's
// ground to the raiders' edge, each powered gun's shots flying up at it as
// they were rolled (raids.js faceRaid's landing), a hit flashing on it.
// The timeline is pure, from the landing's own numbers (no new rolls);
// paintLanding draws a moment of it over the colony.
import { project } from './orbit.js';
import { palette, rgba } from './palette.js';

export const LANDING_MS = 3000;
const HIGH = 14; // how high over the ground the lander starts, in cells
const FIRING = [0.12, 0.72]; // the share of the descent the guns fire over
const FLIGHT_MS = 260; // a shot's flight to the lander
const FADE_MS = 300; // and its fading after
const SIZE = 1.1; // the lander's half-width, in cells

// The landing as a timeline: { ms, from, to, shots: [{ at, from, hit }],
// raiders } where from and to are the lander's start and end over the
// deck ([x, y, z]), each shot's `at` its firing, in ms, and `from` its
// gun's middle. guns: [{ uid, x, y }] the guns' middles by building uid;
// edge: [x, y], where the lander comes down; raiders: how many it carries.
export function landingTimeline(landing, guns, edge, raiders) {
  const where = new Map(guns.map((g) => [g.uid, [g.x, g.y]]));
  const n = landing.shots.length;
  const shots = landing.shots.map((shot, i) => ({
    at: LANDING_MS * (FIRING[0] + ((FIRING[1] - FIRING[0]) * (i + 0.5)) / Math.max(1, n)),
    from: where.get(shot.uid) ?? edge,
    hit: shot.hit,
  }));
  return { ms: LANDING_MS, from: [edge[0], edge[1], HIGH], to: [edge[0], edge[1], 0], shots, raiders };
}

// Where the lander is t ms in: easing down, slowing to land.
export function landerAt(timeline, t) {
  const k = Math.min(1, Math.max(0, t / timeline.ms));
  const eased = 1 - (1 - k) * (1 - k);
  const { from, to } = timeline;
  return [from[0], from[1], from[2] + (to[2] - from[2]) * eased];
}

// How many raiders are still aboard t ms in: one fewer for each hit as it
// lands.
export function aboardAt(timeline, t) {
  return timeline.raiders - timeline.shots.filter((s) => s.hit && t >= s.at + FLIGHT_MS).length;
}

// The shots fired and landed by t: [{ shot, lands: false|true }] passed in
// (from, to], for the sounds.
export function shotsBetween(timeline, from, to) {
  const out = [];
  for (const shot of timeline.shots) {
    if (shot.at > from && shot.at <= to) out.push({ shot, lands: false });
    const lands = shot.at + FLIGHT_MS;
    if (lands > from && lands <= to) out.push({ shot, lands: true });
  }
  return out;
}

// Draws the lander and the shots t ms in, over the colony drawn through cam.
export function paintLanding(ctx, cam, timeline, t) {
  const at = landerAt(timeline, t);
  ctx.save();
  // Its shadow on the ground, darker as it nears.
  const near = 1 - at[2] / timeline.from[2];
  const shadow = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => project(cam, at[0] + dx * SIZE, at[1] + dy * SIZE * 0.7, 0));
  ctx.fillStyle = rgba(palette.space, 0.15 + 0.35 * near);
  fill(ctx, shadow);
  // The lander: a blunt hull, its belly glowing from the burn.
  const top = 0.9;
  const body = (z, w) => [[-w, -w * 0.7], [w, -w * 0.7], [w, w * 0.7], [-w, w * 0.7]].map(([dx, dy]) => project(cam, at[0] + dx, at[1] + dy, at[2] + z));
  const belly = body(0, SIZE);
  const roof = body(top, SIZE * 0.7);
  ctx.fillStyle = palette.line;
  fill(ctx, belly);
  ctx.fillStyle = rgba(palette.ink, 0.6);
  fill(ctx, roof);
  ctx.strokeStyle = palette.bad;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(...belly[i]);
    ctx.lineTo(...roof[i]);
    ctx.stroke();
  }
  if (t < timeline.ms) {
    const [bx, by] = project(cam, at[0], at[1], at[2] - 0.1);
    const r = 14 + 8 * near;
    const burn = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    burn.addColorStop(0, rgba(palette.tracer, 0.9));
    burn.addColorStop(1, rgba(palette.fire, 0));
    ctx.fillStyle = burn;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // The guns' shots, flying up at it; a hit flashes on it.
  for (const shot of timeline.shots) {
    const age = t - shot.at;
    if (age < 0 || age > FLIGHT_MS + FADE_MS) continue;
    const target = landerAt(timeline, shot.at + FLIGHT_MS);
    const aim = shot.hit ? target : [target[0] + 1.6, target[1] - 1.2, target[2] + 1.5];
    const flying = Math.min(1, age / FLIGHT_MS);
    const fade = age <= FLIGHT_MS ? 1 : 1 - (age - FLIGHT_MS) / FADE_MS;
    const a = project(cam, shot.from[0], shot.from[1], 0.6);
    const tip = [0, 1, 2].map((i) => [shot.from[0], shot.from[1], 0.6][i] + (aim[i] - [shot.from[0], shot.from[1], 0.6][i]) * flying);
    const b = project(cam, ...tip);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(palette.tracer, 0.35);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = palette.tracer;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (shot.hit && age >= FLIGHT_MS) {
      const r = 24 * (1.2 - fade * 0.4);
      const flash = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], r);
      flash.addColorStop(0, rgba(palette.tracer, 0.95));
      flash.addColorStop(1, rgba(palette.fire, 0));
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(b[0], b[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function fill(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
}
