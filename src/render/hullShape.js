// The hull's shape around a traced outline (hull.js), in a hull style from
// data/hulls.json (M23d). The rules stay on the square grid, so the curves
// go outside the rooms: the outline is moved out in steps, one per point of
// the style's profile, from the roof's edge (d = 0, all the way up) out to
// the side (d = margin), with its outer corners rounded or cut, and its inner
// ones too, more the further out. Every contour has the same points, so the
// bands between them are the hull's shoulder and side. Each run of the front
// column gets a nose, carried forward from the hull's section there in rings.
// Pure geometry, in cells (z as a fraction of the hull's height); the 3D
// scenes (exterior.js, shipScene.js) make faces of it. Ships fly toward +x.

import { DEFAULT_HULL } from '../sim/builder.js';

// What a style may ask for. The camera keeps room for the most of them
// (hull.js OVERHANG), and a margin over half a cell would close a one-cell
// gap between two parts of a ship.
export const MAX_MARGIN = 0.5;
export const MAX_NOSE = 2.2;
export const CORNERS = ['round', 'cut'];
export const ROOFS = ['tinted', 'panels'];
const MAX_CORNER = 3;
const MAX_STEPS = 8;
const MAX_POINTS = 12;

// A style a ship can be drawn in when content has none (a test's tiny
// catalog): the outline as it is, upright.
export const PLAIN = {
  id: 'plain',
  name: 'Plain',
  margin: 0,
  corners: 'cut',
  outer: 0,
  stern: 0,
  inner: 0,
  steps: 1,
  profile: [[0, 1], [0, 0]],
  stripe: [0.375, 0.525],
  smooth: false,
  roof: 'tinted',
  nose: { base: 0.6, perWidth: 0.25, max: 1.5, tip: 0.42, rings: [[0, 1]] },
};

// The style a ship's hull is drawn in: its own, or the default's, or plain.
export function styleOf(defs, ship) {
  return defs.hulls?.get(ship.hull) ?? defs.hulls?.get(DEFAULT_HULL) ?? PLAIN;
}

const EPS = 1e-9;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const along = (n) => [-n[1], n[0]]; // a segment's direction, from its outward normal
const same = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
const key = ([x, y]) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;

// Returns {
//   style,
//   loops: [{ levels: [{ d, h, pts: [[x, y]] }], nose: [bool], per }]
//     every level has the same points, around the ship, per of them at each
//     corner; nose[p] is true where the piece from point p to the next is a
//     nose's front, which the nose covers
//   noses: [{ x, y0, y1, length, rings: [[[x, y, h]]], tip, blunt }]
//     tip is null on a blunt nose, whose last ring is its flat front
// }
export function hullShape(hull, style) {
  const loops = outlineLoops(hull).map((loop) => contours(loop, style));
  const noses = loops.flatMap((loop) => loop.noses);
  return { style, loops: loops.map(({ levels, nose, per }) => ({ levels, nose, per })), noses };
}

// The traced outline (hull.js edges) as closed loops: [{ v, n, end }] for
// each straight run, from v to end with its outward normal n, the solid on
// its left-hand side as the loop goes round.
export function outlineLoops(hull) {
  const edges = hull.edges.map(({ a, b, normal }) => (dot(along(normal), sub(b, a)) >= 0 ? { a, b, n: normal } : { a: b, b: a, n: normal }));
  const from = new Map();
  for (const e of edges) {
    const k = key(e.a);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(e);
  }
  const used = new Set();
  const loops = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const runs = [];
    for (let e = start; e && !used.has(e); ) {
      used.add(e);
      const last = runs[runs.length - 1];
      if (last && same(last.n, e.n)) last.end = e.b;
      else runs.push({ v: e.a, n: e.n, end: e.b });
      // Where two ways go on from a point, keep the solid on the inside:
      // the one that turns furthest toward it.
      const next = (from.get(key(e.b)) ?? []).filter((c) => !used.has(c));
      next.sort((p, q) => dot(sub(p.b, p.a), e.n) - dot(sub(q.b, q.a), e.n));
      e = next[0];
    }
    if (runs.length > 1 && same(runs[0].n, runs[runs.length - 1].n)) runs[0].v = runs.pop().v;
    if (runs.length >= 3) loops.push(runs);
  }
  return loops;
}

// Where line a (through pa, normal na), moved out by da, crosses line b.
function cross(pa, na, da, pb, nb, db) {
  const qa = add(pa, mul(na, da));
  const qb = add(pb, mul(nb, db));
  const ua = along(na);
  const den = dot(ua, nb);
  return Math.abs(den) < EPS ? qa : add(qa, mul(ua, dot(sub(qb, qa), nb) / den));
}

// One loop's contours, a level for each point of the profile.
function contours(runs, style) {
  const n = runs.length;
  const at = (i) => runs[((i % n) + n) % n];
  const front = Math.max(...runs.map((r) => Math.max(r.v[0], r.end[0])));
  const back = Math.min(...runs.map((r) => Math.min(r.v[0], r.end[0])));
  // A nose's front: a run facing forward at the front of the ship. It stays
  // where it is (moves out by nothing): the nose takes over from there.
  const isNose = runs.map((r) => r.n[0] === 1 && Math.abs(r.v[0] - front) < EPS);
  const out = (i) => (isNose[((i % n) + n) % n] ? 0 : 1);
  const atStern = (r) => r.n[0] === -1 && Math.abs(r.v[0] - back) < EPS;
  const steps = style.corners === 'round' ? style.steps : 1;
  const margin = style.margin;
  const levels = style.profile.map(([d, h]) => ({ d, h, pts: [] }));
  const nose = [];
  for (let i = 0; i < n; i++) {
    const [prev, next] = [at(i - 1), at(i)];
    const [n1, n2] = [prev.n, next.n];
    const [u1, u2] = [along(n1), along(n2)];
    const convex = dot(u2, n1) < -EPS;
    const pinned = out(i - 1) === 0 || out(i) === 0;
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(n1, n2))));
    const stern = atStern(prev) || atStern(next);
    for (const level of levels) {
      const { d } = level;
      const miter = cross(next.v, n1, d * out(i - 1), next.v, n2, d * out(i));
      const flat = () => {
        for (let k = 0; k <= steps; k++) level.pts.push(miter);
      };
      if (pinned || d <= EPS || turn < EPS) {
        flat();
        continue;
      }
      // Each corner takes up to half of the runs either side of it.
      const before = cross(prev.v, at(i - 2).n, d * out(i - 2), prev.v, n1, d * out(i - 1));
      const after = cross(at(i + 1).v, n2, d * out(i), at(i + 1).v, at(i + 1).n, d * out(i + 1));
      const room = Math.min(len(sub(miter, before)), len(sub(after, miter))) / 2;
      const want = convex ? (stern ? style.stern : style.outer) : style.inner * (d / margin);
      if (want <= EPS) {
        flat();
        continue;
      }
      if (style.corners === 'cut') {
        // Cut square across. An outer cut stays clear of the cell's corner.
        const t = Math.min(want, room, convex ? ((2 * d) / Math.sin(turn)) * 0.97 : Infinity);
        level.pts.push(add(miter, mul(u1, -t)), add(miter, mul(u2, t)));
        continue;
      }
      // Rounded: an arc tangent to both runs. An outer one stays clear of
      // the cell's corner; an inner one curves the other way.
      const half = Math.tan(turn / 2);
      const r = Math.min(want, room / half, convex ? (d / (1 - Math.cos(turn / 2))) * 0.97 : Infinity);
      const c = cross(next.v, n1, convex ? d - r : d + r, next.v, n2, convex ? d - r : d + r);
      const sign = convex ? 1 : -1;
      const a1 = Math.atan2(sign * n1[1], sign * n1[0]);
      let a2 = Math.atan2(sign * n2[1], sign * n2[0]);
      while (a2 - a1 > Math.PI) a2 -= 2 * Math.PI;
      while (a2 - a1 < -Math.PI) a2 += 2 * Math.PI;
      for (let k = 0; k <= steps; k++) {
        const a = a1 + ((a2 - a1) * k) / steps;
        level.pts.push(add(c, [Math.cos(a) * r, Math.sin(a) * r]));
      }
    }
    for (let k = 0; k < steps; k++) nose.push(false);
    nose.push(isNose[i]); // the run after the corner
  }
  const per = steps + 1;
  const noses = [];
  runs.forEach((run, i) => {
    if (!isNose[i]) return;
    // The section through the hull at the front: down one side and up the
    // other, from the corners either end of this run.
    const left = levels.map((l) => [...l.pts[i * per + steps], l.h]);
    const right = levels.map((l) => [...l.pts[((i + 1) % n) * per], l.h]);
    noses.push(noseOf(run, left, right, style.nose));
  });
  return { levels, nose, noses, per };
}

// A nose carried forward from the section in rings that shrink toward the
// tip, along an axis from the middle of the section down to the tip's
// height. A ring is [u, s]: u of the way along, the section scaled by s.
function noseOf(run, left, right, { base, perWidth, max, tip, rings, blunt = false }) {
  const [y0, y1] = [Math.min(run.v[1], run.end[1]), Math.max(run.v[1], run.end[1])];
  const x = run.v[0];
  const length = Math.min(max, base + perWidth * (y1 - y0));
  const mid = (y0 + y1) / 2;
  const section = [...left, ...[...right].reverse()].filter((p, k, all) => k === 0 || Math.hypot(p[1] - all[k - 1][1], p[2] - all[k - 1][2]) > 1e-6);
  const centre = 0.5;
  const axisH = (u) => centre + (tip - centre) * u;
  const ringPts = rings.map(([u, s]) => section.map(([, y, h]) => [x + length * u, mid + (y - mid) * s, axisH(u) + (h - centre) * s]));
  const along = rings.map(([u]) => u);
  return { x, y0, y1, length, along, rings: ringPts, tip: blunt ? null : [x + length, mid, tip], blunt, axis: (u) => [x + length * u, mid, axisH(u)] };
}

// The bands of the hull's shoulder and side, at full height `height`:
// [{ pts: [[x, y, z] × 4], outward: [x, y], wall }], wall true for the
// upright side. Pieces with no size (a sharp corner, its points all one)
// are left out, and so are a nose's fronts.
export function hullBands(shape, height) {
  const bands = [];
  for (const { levels, nose } of shape.loops) {
    const count = levels[0].pts.length;
    for (let j = 0; j + 1 < levels.length; j++) {
      const [A, B] = [levels[j], levels[j + 1]];
      const wall = Math.abs(A.d - B.d) < EPS;
      for (let p = 0; p < count; p++) {
        if (nose[p]) continue;
        const q = (p + 1) % count;
        if (len(sub(A.pts[p], A.pts[q])) + len(sub(B.pts[p], B.pts[q])) < 1e-6) continue;
        const dir = len(sub(B.pts[q], B.pts[p])) > 1e-9 ? sub(B.pts[q], B.pts[p]) : sub(A.pts[q], A.pts[p]);
        bands.push({
          pts: [[...A.pts[p], A.h * height], [...A.pts[q], A.h * height], [...B.pts[q], B.h * height], [...B.pts[p], B.h * height]],
          outward: mul([dir[1], -dir[0]], 1 / len(dir)),
          wall,
        });
      }
    }
  }
  return bands;
}

// The surface of a nose: [{ pts: [[x, y, z]], axis: [x, y, z], front }],
// quads between rings, triangles to the tip, and a blunt nose's flat front.
export function noseSurfaces(nose, height) {
  const scale = (p) => [p[0], p[1], p[2] * height];
  const rings = nose.rings.map((ring) => ring.map(scale));
  const surfaces = [];
  for (let r = 0; r + 1 < rings.length; r++) {
    const [A, B] = [rings[r], rings[r + 1]];
    const axis = scale(nose.axis((nose.along[r] + nose.along[r + 1]) / 2));
    for (let k = 0; k < A.length; k++) {
      const q = (k + 1) % A.length;
      surfaces.push({ pts: [A[k], A[q], B[q], B[k]], axis, front: false });
    }
  }
  const last = rings[rings.length - 1];
  if (nose.tip) {
    const tip = scale(nose.tip);
    const axis = scale(nose.axis((nose.along[nose.along.length - 1] + 1) / 2));
    for (let k = 0; k < last.length; k++) surfaces.push({ pts: [last[k], last[(k + 1) % last.length], tip], axis, front: false });
  } else {
    surfaces.push({ pts: [...last].reverse(), axis: scale(nose.axis(nose.along[nose.along.length - 1] / 2)), front: true });
  }
  return surfaces;
}

// Where a ray from inside the hull, from `from` toward `dir`, comes out of
// the hull's side (the outermost contour of the loop it is in), or the
// point `from` moved out by the margin if it misses: [x, y].
export function sidePoint(shape, from, dir) {
  let best = null;
  for (const { levels } of shape.loops) {
    const pts = levels[levels.length - 1].pts;
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
      const hit = rayHit(from, dir, a, b);
      if (hit !== null && (best === null || hit < best)) best = hit;
    }
  }
  return best === null ? add(from, mul(dir, shape.style.margin + 0.5)) : add(from, mul(dir, best));
}

// How far along the ray (from + t dir) it crosses segment ab, or null.
function rayHit(from, dir, a, b) {
  const e = sub(b, a);
  const den = dir[0] * e[1] - dir[1] * e[0];
  if (Math.abs(den) < EPS) return null;
  const w = sub(a, from);
  const t = (w[0] * e[1] - w[1] * e[0]) / den;
  const s = (w[0] * dir[1] - w[1] * dir[0]) / den;
  return t > EPS && s >= -EPS && s <= 1 + EPS ? t : null;
}

// The point of the hull's side nearest `to`: [x, y].
export function nearestSide(shape, to) {
  let best = null;
  for (const { levels } of shape.loops) {
    for (const p of levels[levels.length - 1].pts) {
      if (best === null || len(sub(p, to)) < len(sub(best, to))) best = p;
    }
  }
  return best ?? to;
}

// What is wrong with a hull style from data/hulls.json, as messages.
export function hullStyleProblems(style) {
  const problems = [];
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  if (!num(style.margin, EPS, MAX_MARGIN)) problems.push(`margin must be more than 0 and at most ${MAX_MARGIN} cells`);
  if (!CORNERS.includes(style.corners)) problems.push(`corners must be one of ${CORNERS.join(', ')}`);
  for (const k of ['outer', 'stern', 'inner']) if (!num(style[k], 0, MAX_CORNER)) problems.push(`${k} must be a corner's size from 0 to ${MAX_CORNER} cells`);
  if (!(Number.isInteger(style.steps) && style.steps >= 1 && style.steps <= MAX_STEPS)) problems.push(`steps must be a whole number from 1 to ${MAX_STEPS}`);
  if (typeof style.smooth !== 'boolean') problems.push('smooth must be true or false');
  if (!ROOFS.includes(style.roof)) problems.push(`roof must be one of ${ROOFS.join(', ')}`);
  const profile = style.profile;
  const pairs = Array.isArray(profile) && profile.length >= 2 && profile.length <= MAX_POINTS && profile.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => num(v, 0, 1)));
  if (!pairs) {
    problems.push(`profile must be 2 to ${MAX_POINTS} points [out, up], each from 0 to 1`);
  } else {
    const [first, wall, last] = [profile[0], profile[profile.length - 2], profile[profile.length - 1]];
    if (first[0] !== 0 || first[1] !== 1) problems.push('profile must start at the roof: [0, 1]');
    if (last[0] !== style.margin || last[1] !== 0 || wall[0] !== style.margin || !(wall[1] > 0)) problems.push('profile must end with the side: [margin, its top], then [margin, 0]');
    for (let i = 1; i < profile.length; i++) {
      if (profile[i][0] < profile[i - 1][0] || profile[i][1] > profile[i - 1][1]) problems.push('profile must go out and down, never back in or up');
    }
    if (!(Array.isArray(style.stripe) && style.stripe.length === 2 && num(style.stripe[0], 0, 1) && num(style.stripe[1], 0, 1) && style.stripe[0] < style.stripe[1] && style.stripe[1] <= wall[1])) {
      problems.push("stripe must be [low, high] on the side, below its top");
    }
  }
  const nose = style.nose;
  if (!nose || typeof nose !== 'object') {
    problems.push('nose must be an object');
  } else {
    if (!num(nose.base, 0, MAX_NOSE) || !num(nose.perWidth, 0, 1) || !num(nose.max, EPS, MAX_NOSE)) problems.push(`nose must have base and max (at most ${MAX_NOSE} cells) and perWidth (0 to 1)`);
    if (!num(nose.tip, 0, 1)) problems.push('nose tip must be a height from 0 to 1');
    if (nose.blunt !== undefined && typeof nose.blunt !== 'boolean') problems.push('nose blunt must be true or false');
    const rings = nose.rings;
    const ok = Array.isArray(rings) && rings.length >= 1 && rings.length <= MAX_POINTS && rings.every((r) => Array.isArray(r) && r.length === 2 && num(r[0], 0, 1) && num(r[1], EPS, 1));
    if (!ok) {
      problems.push('nose rings must be 1 or more [along, size], along from 0 to 1, size over 0 to 1');
    } else {
      if (rings[0][0] !== 0 || rings[0][1] !== 1) problems.push('nose rings must start at the hull: [0, 1]');
      for (let i = 1; i < rings.length; i++) {
        if (!(rings[i][0] > rings[i - 1][0]) || rings[i][1] > rings[i - 1][1]) problems.push('nose rings must go forward and get smaller');
      }
      if (nose.blunt && rings.length < 2) problems.push('a blunt nose needs a ring for its front');
    }
  }
  return problems;
}
