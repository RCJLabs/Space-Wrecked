// Simple 3D shapes as plain data, for the painter to project and draw. A
// model is { faces, lines, glows }:
//   faces  [{ style, pts }]  flat polygons, pts [[x, y, z], ...]
//   lines  [{ style, pts }]  polylines; closed ones repeat the first point
//   glows  [{ at, r, color }] soft round lights, r in cells
// Styles are names the painter looks up. Coordinates are cells, z up.

export function createModel() {
  return { faces: [], lines: [], glows: [] };
}

export function face(model, style, pts) {
  model.faces.push({ style, pts });
}

export function polyline(model, style, pts) {
  model.lines.push({ style, pts });
}

export function glow(model, at, r, color) {
  model.glows.push({ at, r, color });
}

// A box standing on z0. Its top and sides are faces in `fill`; its outline
// is lines in `edge`. The bottom is left out: it sits on something, which
// draws that edge already.
export function box(model, [x0, y0, z0], [x1, y1, z1], { fill, edge, top = fill }) {
  const base = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (fill) {
    for (let i = 0; i < 4; i++) {
      const [a, b] = [base[i], base[(i + 1) % 4]];
      face(model, fill, [[...a, z0], [...b, z0], [...b, z1], [...a, z1]]);
    }
  }
  if (top) face(model, top, base.map(([x, y]) => [x, y, z1]));
  if (edge) {
    polyline(model, edge, closed(base.map(([x, y]) => [x, y, z1])));
    for (const [x, y] of base) polyline(model, edge, [[x, y, z0], [x, y, z1]]);
  }
}

// A ring of `segments` points around `center`, square to `axis` ('z' lies
// flat, 'x' and 'y' stand on edge).
export function ringPoints(center, r, axis = 'z', segments = 12) {
  const [cx, cy, cz] = center;
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const [u, v] = [r * Math.cos(t), r * Math.sin(t)];
    if (axis === 'z') pts.push([cx + u, cy + v, cz]);
    else if (axis === 'x') pts.push([cx, cy + u, cz + v]);
    else pts.push([cx + u, cy, cz + v]);
  }
  return pts;
}

// A cylinder or a cone from `center` along `axis` for `length` cells; r1 is
// the far end's radius (a cone when it differs from r). Both ends are faces
// in `fill`, ribs and rims are lines in `edge`.
export function cylinder(model, center, r, length, { axis = 'z', r1 = r, fill, edge, ends = fill, ribs = 4, segments = 12 }) {
  const far = [...center];
  far[{ x: 0, y: 1, z: 2 }[axis]] += length;
  const a = ringPoints(center, r, axis, segments);
  const b = ringPoints(far, r1, axis, segments);
  if (ends) {
    face(model, ends, a);
    face(model, ends, b);
  }
  if (fill) {
    // The side as a band of quads, so it shades like a solid.
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      face(model, fill, [a[i], a[j], b[j], b[i]]);
    }
  }
  if (edge) {
    polyline(model, edge, closed(a));
    polyline(model, edge, closed(b));
    const step = Math.max(1, Math.round(segments / Math.max(ribs, 1)));
    for (let i = 0; i < segments; i += step) polyline(model, edge, [a[i], b[i]]);
  }
}

// A flat ring (circle outline) lying on z.
export function circle(model, style, center, r, segments = 12) {
  polyline(model, style, closed(ringPoints(center, r, 'z', segments)));
}

// A flat rectangle on the deck at height z: a face, an outline or both.
export function rect(model, [x0, y0], [x1, y1], z, { fill, edge }) {
  const pts = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  if (fill) face(model, fill, pts);
  if (edge) polyline(model, edge, closed(pts));
}

export function closed(pts) {
  return [...pts, pts[0]];
}

// A copy of the model with every point mapped by fn([x, y, z]).
export function mapModel(model, fn) {
  return {
    faces: model.faces.map((f) => ({ style: f.style, pts: f.pts.map(fn) })),
    lines: model.lines.map((l) => ({ style: l.style, pts: l.pts.map(fn) })),
    glows: model.glows.map((g) => ({ ...g, at: fn(g.at) })),
  };
}

// Appends every face, line and glow of `from` to `into`.
export function merge(into, from) {
  into.faces.push(...from.faces);
  into.lines.push(...from.lines);
  into.glows.push(...from.glows);
  return into;
}
