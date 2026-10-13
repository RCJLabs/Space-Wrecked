// Small helpers for drawing portraits as SVG text (portraits/): numbers
// rounded for the path data, smooth curves through points, polygons,
// left-right mirroring in the 100 x 100 box, and mixing two colors.

// A number to two decimals, as path data writes it.
export const num = (n) => Math.round(n * 100) / 100;
export const pt = ([x, y]) => `${num(x)},${num(y)}`;

// A smooth curve through the points (Catmull-Rom as cubic Beziers): closed
// round to the first, or open from the first to the last.
export function spline(points, closed = true) {
  const n = points.length;
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

// An open spline's path data without its opening move, to join to a path.
export const onward = (points) => spline(points, false).replace(/^M[^C]*/, '');

export const poly = (points) => `M${points.map(pt).join('L')}Z`;
export const mirror = ([x, y]) => [100 - x, y];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Two '#rrggbb' colors mixed, t of the way from a to b.
export function mix(a, b, t) {
  const [x, y] = [a, b].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
