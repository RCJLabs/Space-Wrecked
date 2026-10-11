// Solid 3D shapes for the ship seen from outside: faces with outward
// normals, so the painter can drop the ones facing away, light the rest and
// draw them back to front. A face is
//   { pts: [[x, y, z], ...], normal: [x, y, z], color, edge?, emissive?, alpha?, bias? }
// color is '#rrggbb'; edge is a stroke color for its outline; an emissive
// face isn't shaded; alpha (0 to 1) lets what is behind it show through;
// bias nudges its place in the draw order (negative is
// nearer), and sortAt, a point, sorts it as if it were there (paint on a
// wall sorts with the wall). Coordinates are cells, z up.

// A box: its top and four sides (the bottom sits on something).
export function solidBox(out, [x0, y0, z0], [x1, y1, z1], color, extra = {}) {
  out.push(
    { pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], normal: [0, 0, 1], color, ...extra },
    { pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], normal: [0, -1, 0], color, ...extra },
    { pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], normal: [1, 0, 0], color, ...extra },
    { pts: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], normal: [0, 1, 0], color, ...extra },
    { pts: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], normal: [-1, 0, 0], color, ...extra },
  );
}

// A flat plate lying at height z.
export function plate(out, [x0, y0], [x1, y1], z, color, extra = {}) {
  out.push({ pts: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], normal: [0, 0, 1], color, ...extra });
}

// An upright cylinder standing on z0: its top and its side in strips.
export function solidCylinder(out, [cx, cy, z0], r, height, color, { top = color, segments = 14, ...extra } = {}) {
  const z1 = z0 + height;
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    ring.push([Math.cos(t), Math.sin(t)]);
  }
  out.push({ pts: ring.map(([u, v]) => [cx + u * r, cy + v * r, z1]), normal: [0, 0, 1], color: top, ...extra });
  for (let i = 0; i < segments; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % segments]];
    const [nu, nv] = [a[0] + b[0], a[1] + b[1]];
    const n = Math.hypot(nu, nv);
    out.push({
      pts: [[cx + a[0] * r, cy + a[1] * r, z0], [cx + b[0] * r, cy + b[1] * r, z0], [cx + b[0] * r, cy + b[1] * r, z1], [cx + a[0] * r, cy + a[1] * r, z1]],
      normal: [nu / n, nv / n, 0],
      color,
      ...extra,
    });
  }
}

// A tube lying along the deck from `start` in direction [dx, dy] (a unit
// step along x or y) for `length`, widening from r0 to r1: nozzles and gun
// barrels. Its far end is a face in `endColor` (emissive if `glowing`).
export function solidTube(out, start, [dx, dy], length, r0, r1, color, { endColor = color, glowing = false, segments = 12 } = {}) {
  const [sx, sy, sz] = start;
  // Across the tube: the deck direction square to it, and up.
  const [ax, ay] = [-dy, dx];
  const ring = (t, r) => {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const [u, v] = [Math.cos(a), Math.sin(a)];
      pts.push([sx + dx * t + ax * u * r, sy + dy * t + ay * u * r, sz + v * r]);
    }
    return pts;
  };
  const near = ring(0, r0);
  const far = ring(length, r1);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const a = ((i + 0.5) / segments) * Math.PI * 2;
    const slope = (r0 - r1) / length; // a cone's sides lean back
    const n = [ax * Math.cos(a) + dx * slope, ay * Math.cos(a) + dy * slope, Math.sin(a)];
    const len = Math.hypot(...n);
    out.push({ pts: [near[i], near[j], far[j], far[i]], normal: n.map((c) => c / len), color });
  }
  out.push({ pts: far, normal: [dx, dy, 0], color: endColor, emissive: glowing });
}

// Turns and moves faces made in a module's unrotated frame onto a placement
// { x, y, rot } (points and normals both turn), as placeModel does.
export function placeFaces(faces, def, { x, y, rot }) {
  let [w, h] = def.size;
  const turns = [];
  for (let i = 0; i < rot; i++) {
    turns.push(h);
    [w, h] = [h, w];
  }
  return faces.map((face) => {
    const pts = face.pts.map(([px, py, pz]) => {
      for (const height of turns) [px, py] = [height - py, px];
      return [x + px, y + py, pz];
    });
    let [nx, ny, nz] = face.normal;
    for (let i = 0; i < turns.length; i++) [nx, ny] = [-ny, nx];
    return { ...face, pts, normal: [nx, ny, nz] };
  });
}

// The outward normal of a flat polygon, given a point inside the solid.
export function normalOf(pts, inside) {
  const [a, b, c] = pts;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1;
  n = n.map((k) => k / len);
  const out = [a[0] - inside[0], a[1] - inside[1], a[2] - inside[2]];
  return n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? n.map((k) => -k) : n;
}

// Where the light comes from: above, behind and to port.
export const LIGHT = (() => {
  const v = [-0.35, -0.55, 0.76];
  const len = Math.hypot(...v);
  return v.map((k) => k / len);
})();

// A face's fill: its color lit by LIGHT, as an rgb() string, or rgba() for
// a face with an alpha (marks on the deck that the floor shows through).
export function shade(face, light = LIGHT) {
  const n = parseInt(face.color.slice(1), 16);
  let [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  if (!face.emissive) {
    const lit = face.normal[0] * light[0] + face.normal[1] * light[1] + face.normal[2] * light[2];
    const k = 0.45 + 0.6 * Math.max(0, lit);
    [r, g, b] = [r, g, b].map((v) => Math.min(255, Math.round(v * k)));
  }
  return face.alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${face.alpha})`;
}
