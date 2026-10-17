// The plain shapes a scene is made of (M34), and a seeded roll to place
// them. A scene (scenes.js) is a list of shapes in its own units; the
// painter (paint.js) draws them. Pure: plain data in, plain data out.
//   { kind: 'rect', x, y, w, h }
//   { kind: 'ellipse', x, y, rx, ry, turn }   turn in radians
//   { kind: 'poly', points, smooth, open }    closed unless open; smooth
//                                              runs a curve through the points
//   { kind: 'group', clip, shapes }           its shapes, clipped to clip
// Each may have fill and stroke (a color, or a gradient: { linear: [x0, y0,
// x1, y1] } or { radial: [x, y, r] } with stops [[at, color, alpha]]),
// width (the stroke's), alpha, blur (soft edges, in units) and blend (a
// canvas composite, 'lighter' for light).
import { next, seedFrom } from '../../core/rng.js';

// A seeded roll: roll() in [0, 1), between(a, b), int(a, b) inclusive,
// pick(list), the same for the same seed.
export function roller(seed) {
  let state = seedFrom(String(seed));
  const roll = () => {
    const r = next(state);
    state = r.state;
    return r.value;
  };
  return {
    roll,
    between: (a, b) => a + (b - a) * roll(),
    int: (a, b) => a + Math.floor(roll() * (b - a + 1)),
    pick: (list) => list[Math.floor(roll() * list.length)],
  };
}

export const rect = (x, y, w, h, fill, more = {}) => ({ kind: 'rect', x, y, w, h, fill, ...more });
export const ellipse = (x, y, rx, ry, fill, more = {}) => ({ kind: 'ellipse', x, y, rx, ry, turn: 0, fill, ...more });
export const poly = (points, fill, more = {}) => ({ kind: 'poly', points, fill, ...more });
export const line = (points, stroke, width, more = {}) => ({ kind: 'poly', points, open: true, stroke, width, ...more });
export const group = (clip, shapes, more = {}) => ({ kind: 'group', clip, shapes, ...more });

export const linear = (x0, y0, x1, y1, stops) => ({ linear: [x0, y0, x1, y1], stops });
export const radial = (x, y, r, stops) => ({ radial: [x, y, r], stops });

// Light, or a shadow: a soft round of `color`, strongest in the middle.
export function glow(x, y, r, color, alpha, more = {}) {
  return ellipse(x, y, r, r, radial(x, y, r, [[0, color, alpha], [1, color, 0]]), more);
}

// A rough round: n points about (x, y), each out from r by up to `rough` of
// it, as a smooth closed shape.
export function blob(dice, x, y, r, rough, fill, more = {}, n = 9) {
  const turn = dice.between(0, Math.PI * 2);
  const points = Array.from({ length: n }, (_, i) => {
    const a = turn + (i / n) * Math.PI * 2;
    const d = r * (1 + dice.between(-rough, rough));
    return [x + Math.cos(a) * d, y + Math.sin(a) * d];
  });
  return poly(points, fill, { smooth: true, ...more });
}

// A wandering line from (x, y): n steps of `step`, its heading `turn`
// changing by up to `wander` a step.
export function wander(dice, x, y, turn, step, n, wanderBy) {
  const points = [[x, y]];
  let [px, py, heading] = [x, y, turn];
  for (let i = 0; i < n; i++) {
    heading += dice.between(-wanderBy, wanderBy);
    px += Math.cos(heading) * step;
    py += Math.sin(heading) * step;
    points.push([px, py]);
  }
  return points;
}

// Specks of grain over a w x h frame, light and dark: the painted look's
// tooth.
export function grain(dice, w, h, count, light, dark) {
  return Array.from({ length: count }, () => {
    const size = dice.between(1, 2.6);
    return rect(dice.between(0, w), dice.between(0, h), size, size, dice.roll() < 0.5 ? light : dark, { alpha: dice.between(0.04, 0.11) });
  });
}

// The edges darkening to `color`: a w x h frame's vignette.
export function vignette(w, h, color, alpha) {
  const r = Math.hypot(w, h) / 2;
  return rect(0, 0, w, h, radial(w / 2, h / 2, r, [[0.55, color, 0], [1, color, alpha]]));
}

// The box in scene units that shapes cover, their strokes and softness
// with them: [x0, y0, x1, y1].
export function boxOf(shapes) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) {
    const pad = (s.blur ?? 0) * 2 + (s.stroke ? (s.width ?? 1) : 0);
    let box;
    if (s.kind === 'rect') box = [s.x, s.y, s.x + s.w, s.y + s.h];
    else if (s.kind === 'ellipse') {
      const [rx, ry] = s.turn ? [Math.max(s.rx, s.ry), Math.max(s.rx, s.ry)] : [s.rx, s.ry];
      box = [s.x - rx, s.y - ry, s.x + rx, s.y + ry];
    } else if (s.kind === 'group') box = boxOf([s.clip]);
    else {
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    x0 = Math.min(x0, box[0] - pad);
    y0 = Math.min(y0, box[1] - pad);
    x1 = Math.max(x1, box[2] + pad);
    y1 = Math.max(y1, box[3] + pad);
  }
  return [x0, y0, x1, y1];
}

// The shapes with any part in a w x h frame: what lies wholly outside it
// would only cost drawing.
export function inFrame(shapes, w, h) {
  return shapes.filter((shape) => {
    const [x0, y0, x1, y1] = boxOf([shape]);
    return x1 > 0 && y1 > 0 && x0 < w && y0 < h;
  });
}

// Every color a list of shapes uses, fills, strokes and gradient stops, for
// the tests.
export function colorsOf(shapes) {
  const out = new Set();
  const paint = (p) => {
    if (!p) return;
    if (typeof p === 'string') out.add(p);
    else for (const [, color] of p.stops) out.add(color);
  };
  for (const s of shapes) {
    paint(s.fill);
    paint(s.stroke);
    if (s.kind === 'group') for (const c of colorsOf([s.clip, ...s.shapes])) out.add(c);
  }
  return out;
}
