// Styling pieces seen from outside (M23f): wings, fins, a spoiler, antennas,
// a dish, lights and armor plates, each set on the hull's side against the
// rooms beside it, in the ship's paint. Pure: a piece and where it sits in,
// solid faces (solid.js) and glows out. Wedges and curves have no model of
// their own: the hull's skin wraps them (hull.js).
//
// Each model is made in the piece's own frame, unturned: w × h cells (its
// size) with the origin at the top left, its root along its south edge,
// against the hull, and the ship flying toward +x. `root` is how far into
// those cells the hull's side stands: the hull's margin, less where a
// corner curves in. A placement's turn (src/sim/styling.js) mirrors and
// turns the model onto the grid, so a wing on either side sweeps back.
import { edgeCells, mountSide, pieceDirection, pieceFootprint, piecePoint, pieceShape, stepSide } from '../sim/styling.js';
import { sidePoint } from './hullShape.js';
import { palette, rgba } from './palette.js';
import { normalOf, solidBox } from './solid.js';
import { num, path } from './svg.js';

// input: { def, placement, shape: hullShape(...), wallTop, skin }.
// Returns { faces, glows }.
export function pieceScene({ def, placement, shape, wallTop, skin }) {
  const faces = [];
  const glows = [];
  const model = MODELS[def.id];
  if (!model) return { faces, glows };
  const [, h] = def.size;
  const root = rootDepth(def, placement, shape);
  // Which way the piece's tip points, for a wing's navigation light: red to
  // port (north, flying east), green to starboard.
  const [, tipY] = pieceDirection(placement, [0, -1]);
  model(faces, glows, { r: h - root, wallTop, k: skin, light: tipY > 0 ? skin.starboard : skin.port });
  return {
    faces: faces.map((face) => ({ ...face, pts: face.pts.map((p) => at(def, placement, p)), normal: turned(placement, face.normal), ...(face.sortAt ? { sortAt: at(def, placement, face.sortAt) } : {}) })),
    glows: glows.map((g) => ({ ...g, at: at(def, placement, g.at) })),
  };
}

function at(def, placement, [x, y, z]) {
  return [...piecePoint(def, placement, [x, y]), z];
}

function turned(placement, [nx, ny, nz]) {
  return [...pieceDirection(placement, [nx, ny]), nz];
}

// How far into the piece's cells, from its root edge, the hull's side
// stands: the least over its root cells, less a little so the root tucks
// under the skin.
function rootDepth(def, placement, shape) {
  const side = mountSide(placement.rot);
  const [dx, dy] = STEP[side];
  let least = shape.style.margin;
  for (const [x, y] of edgeCells(def, placement, side)) {
    const [rx, ry] = stepSide(x, y, side);
    const from = [rx + 0.5, ry + 0.5];
    const [sx, sy] = sidePoint(shape, from, [-dx, -dy]);
    least = Math.min(least, (sx - from[0]) * -dx + (sy - from[1]) * -dy - 0.5);
  }
  return Math.max(0, least - 0.04);
}

const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// A flat polygon given a thickness: its top at z1, its bottom at z0 and a
// side along each edge.
function slab(out, poly, z0, z1, color, extra = {}) {
  const middle = [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length, (z0 + z1) / 2];
  out.push({ pts: poly.map(([x, y]) => [x, y, z1]), normal: [0, 0, 1], color, ...extra });
  out.push({ pts: [...poly].reverse().map(([x, y]) => [x, y, z0]), normal: [0, 0, -1], color, ...extra });
  for (let i = 0; i < poly.length; i++) {
    const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
    const pts = [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]];
    out.push({ pts, normal: normalOf(pts, middle), color, ...extra });
  }
}

// A thin plate in any plane: the quad (or polygon) `pts`, thickness t, with
// a face either side and its edges.
function plate3(out, pts, t, color, extra = {}) {
  const n = normalOf(pts, pts[0].map((v, k) => v - 1e-3 * [0, 0, 1][k]));
  const off = (p, s) => p.map((v, k) => v + n[k] * s * t / 2);
  const front = pts.map((p) => off(p, 1));
  const back = pts.map((p) => off(p, -1));
  const middle = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  out.push({ pts: front, normal: n, color, ...extra });
  out.push({ pts: [...back].reverse(), normal: n.map((v) => -v), color, ...extra });
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const side = [back[i], back[j], front[j], front[i]];
    out.push({ pts: side, normal: normalOf(side, middle), color, ...extra });
  }
}

// A strip in the trim along a wing's leading edge, on its top.
function leadingEdge(f, a, b, z, color) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  // In from the edge, toward the wing's middle (its trailing side is -x).
  let [nx, ny] = [-dy / len, dx / len];
  if (nx > 0) [nx, ny] = [-nx, -ny];
  const w = 0.07;
  const pts = [[a[0], a[1]], [b[0], b[1]], [b[0] + nx * w, b[1] + ny * w], [a[0] + nx * w, a[1] + ny * w]];
  f.push({ pts: pts.map(([x, y]) => [x, y, z + 0.004]), normal: [0, 0, 1], color, sortAt: [(a[0] + b[0]) / 2 + nx * 0.2, (a[1] + b[1]) / 2 + ny * 0.2, z + 0.01] });
}

// x where the edge from p to q crosses height y (on the deck's plan).
function xAt(p, q, y) {
  return p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]);
}

// Models by piece id: (faces, glows, { r, wallTop, k, light }) => void. r is
// the root's y; k is the skin, painted.
const MODELS = {
  // A wing swept back from the side, a stripe in the trim near its tip and
  // a navigation light there.
  sweptwing(f, g, { r, wallTop, k, light }) {
    const [z0, z1] = [wallTop * 0.4, wallTop * 0.4 + 0.055];
    const [rootBack, rootFront, tipFront, tipBack] = [[0.1, r + 0.04], [1.94, r + 0.04], [0.66, 0.16], [0.04, 0.16]];
    slab(f, [rootBack, rootFront, tipFront, tipBack], z0, z1, k.plates[3], { edge: k.edge });
    const [y0, y1] = [0.3, 0.44];
    const band = [[xAt(rootBack, tipBack, y1), y1], [xAt(rootFront, tipFront, y1), y1], [xAt(rootFront, tipFront, y0), y0], [xAt(rootBack, tipBack, y0), y0]];
    f.push({ pts: band.map(([x, y]) => [x, y, z1 + 0.003]), normal: [0, 0, 1], color: k.livery, sortAt: [0.35, 0.37, z1 + 0.01] });
    leadingEdge(f, rootFront, tipFront, z1, k.livery);
    solidBox(f, [0.16, 0.12, z0 - 0.01], [0.3, 0.22, z1 + 0.03], light, { emissive: true });
    g.push({ at: [0.23, 0.17, z1 + 0.05], r: 0.28, color: light });
  },
  // A long delta, root to tip, with a fence on top and the trim along its
  // trailing edge.
  deltawing(f, g, { r, wallTop, k, light }) {
    const [z0, z1] = [wallTop * 0.4, wallTop * 0.4 + 0.06];
    const [rootBack, rootFront, tipFront, tipBack] = [[0.08, r + 0.04], [2.94, r + 0.04], [0.56, 0.1], [0.08, 0.1]];
    slab(f, [rootBack, rootFront, tipFront, tipBack], z0, z1, k.plates[3], { edge: k.edge });
    leadingEdge(f, rootFront, tipFront, z1, k.livery);
    f.push({ pts: [[0.08, r + 0.02, z1 + 0.003], [0.24, r + 0.02, z1 + 0.003], [0.22, 0.14, z1 + 0.003], [0.1, 0.14, z1 + 0.003]], normal: [0, 0, 1], color: k.livery, sortAt: [0.16, 0.9, z1 + 0.01] });
    const fenceY0 = 0.5;
    plate3(f, [[1.3, r, z1], [xAt(rootFront, tipFront, fenceY0) - 0.15, fenceY0, z1], [xAt(rootFront, tipFront, fenceY0) - 0.25, fenceY0, z1 + 0.1], [1.3, r, z1 + 0.14]], 0.03, k.metal, { edge: k.edge });
    solidBox(f, [0.14, 0.06, z0 - 0.01], [0.28, 0.16, z1 + 0.03], light, { emissive: true });
    g.push({ at: [0.21, 0.11, z1 + 0.05], r: 0.28, color: light });
  },
  // A fin canted out from the top of the side, swept back, banded in the
  // trim near its tip.
  tailfin(f, g, { r, wallTop, k }) {
    const base = [[0.08, r + 0.03, wallTop], [1.9, r + 0.03, wallTop]];
    const tip = [[0.7, 0.04, 1.62], [0.02, 0.04, 1.62]];
    plate3(f, [base[0], base[1], tip[0], tip[1]], 0.05, k.plates[3], { edge: k.edge });
    const lerp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
    const [a, b] = [lerp(base[1], tip[0], 0.72), lerp(base[0], tip[1], 0.72)];
    const [c, d] = [lerp(base[1], tip[0], 0.86), lerp(base[0], tip[1], 0.86)];
    plate3(f, [b, a, c, d], 0.062, k.livery);
  },
  // An airfoil held over the side on two struts, end plates in the trim.
  spoiler(f, g, { r, wallTop, k }) {
    for (const x of [0.45, 1.55]) plate3(f, [[x - 0.05, r + 0.02, wallTop * 0.8], [x + 0.05, r + 0.02, wallTop * 0.8], [x + 0.05, 0.5, 1.06], [x - 0.05, 0.5, 1.06]], 0.05, k.dark, { edge: k.edge });
    plate3(f, [[0.08, 0.16, 1.16], [1.92, 0.16, 1.16], [1.92, 0.84, 1.06], [0.08, 0.84, 1.06]], 0.05, k.plates[3], { edge: k.edge });
    f.push({ pts: [[0.1, 0.18, 1.19], [1.9, 0.18, 1.19], [1.9, 0.34, 1.167], [0.1, 0.34, 1.167]], normal: [0, 0.15, 0.99], color: k.livery, sortAt: [1, 0.26, 1.25] });
    for (const x of [0.08, 1.92]) plate3(f, [[x, 0.12, 1.02], [x, 0.88, 0.96], [x, 0.88, 1.16], [x, 0.12, 1.24]], 0.04, k.livery, { edge: k.edge });
  },
  // A mast on a bracket off the side, two cross-bars and a red light on top.
  antenna(f, g, { r, wallTop, k }) {
    const z = wallTop * 0.5;
    solidBox(f, [0.42, 0.44, z], [0.58, r + 0.04, z + 0.07], k.dark, { edge: k.edge });
    solidBox(f, [0.47, 0.47, z], [0.53, 0.53, 1.72], k.metalHi, { edge: k.edge });
    solidBox(f, [0.2, 0.48, 1.3], [0.8, 0.52, 1.34], k.metal, { edge: k.edge });
    solidBox(f, [0.3, 0.48, 1.52], [0.7, 0.52, 1.56], k.metal, { edge: k.edge });
    solidBox(f, [0.45, 0.45, 1.72], [0.55, 0.55, 1.8], k.port, { emissive: true });
    g.push({ at: [0.5, 0.5, 1.78], r: 0.22, color: k.port });
  },
  // A dish on a stalk, tipped up and out from the hull.
  dish(f, g, { r, wallTop, k }) {
    const z = wallTop * 0.5;
    solidBox(f, [0.42, 0.44, z], [0.58, r + 0.04, z + 0.07], k.dark, { edge: k.edge });
    solidBox(f, [0.46, 0.46, z], [0.54, 0.54, 0.86], k.metal, { edge: k.edge });
    const axis = [0, -0.55, 0.835];
    const centre = [0.5, 0.46, 0.98];
    // Square to the axis: across (x) and up the dish (y and z).
    const [u, v] = [[1, 0, 0], [0, axis[2], -axis[1]]];
    const rim = [];
    const segments = 10;
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      rim.push(centre.map((c, j) => c + 0.38 * (Math.cos(t) * u[j] + Math.sin(t) * v[j])));
    }
    const back = centre.map((c, j) => c - axis[j] * 0.13);
    for (let i = 0; i < segments; i++) {
      const tri = [back, rim[i], rim[(i + 1) % segments]];
      const n = normalOf(tri, centre.map((c, j) => c - axis[j] * 0.4));
      const inner = n[0] * axis[0] + n[1] * axis[1] + n[2] * axis[2] > 0;
      f.push({ pts: tri, normal: inner ? n : n.map((c) => -c), color: k.soft, edge: k.edge });
      f.push({ pts: [...tri].reverse(), normal: inner ? n.map((c) => -c) : n, color: k.metal, edge: k.edge });
    }
    const feed = centre.map((c, j) => c + axis[j] * 0.2);
    solidBox(f, [feed[0] - 0.035, feed[1] - 0.035, feed[2] - 0.035], [feed[0] + 0.035, feed[1] + 0.035, feed[2] + 0.035], k.dark);
  },
  // A lamp in a housing on the side, shining out.
  floodlight(f, g, { r, wallTop, k }) {
    const z0 = wallTop * 0.22;
    solidBox(f, [0.26, 0.54, z0], [0.74, r + 0.04, z0 + 0.2], k.dark, { edge: k.edge });
    f.push({ pts: [[0.31, 0.538, z0 + 0.04], [0.69, 0.538, z0 + 0.04], [0.69, 0.538, z0 + 0.16], [0.31, 0.538, z0 + 0.16]], normal: [0, -1, 0], color: k.glowCore, emissive: true });
    g.push({ at: [0.5, 0.36, z0 + 0.1], r: 0.6, color: k.glowCore });
  },
  // A rail along the side with a row of lights in the trim.
  lightstrip(f, g, { r, wallTop, k }) {
    const [z0, z1] = [wallTop * 0.42, wallTop * 0.42 + 0.08];
    solidBox(f, [0.1, r - 0.06, z0], [1.9, r + 0.04, z1], k.dark, { edge: k.edge });
    for (const x of [0.35, 1, 1.65]) {
      solidBox(f, [x - 0.1, r - 0.1, z0 + 0.01], [x + 0.1, r - 0.06, z1 - 0.01], k.livery, { emissive: true });
      g.push({ at: [x, r - 0.14, (z0 + z1) / 2], r: 0.24, color: k.livery });
    }
  },
  // A plate bolted along the side, its ends bevelled, two rows of rivets.
  armorplate(f, g, { r, wallTop, k }) {
    const [z0, z1] = [0.04, wallTop - 0.03];
    const out = r - 0.15;
    slab(f, [[0.08, r + 0.03], [1.92, r + 0.03], [1.84, out], [0.16, out]], z0, z1, k.metal, { edge: k.edge });
    for (const z of [z0 + 0.06, z1 - 0.06]) {
      for (let i = 0; i < 5; i++) {
        const x = 0.34 + i * 0.33;
        solidBox(f, [x - 0.025, out - 0.015, z - 0.025], [x + 0.025, out, z + 0.025], k.dark);
      }
    }
  },
};

// Piece ids with a model, for tests.
export const MODELED = Object.keys(MODELS);

// A piece as an inline icon for the drawer, `cell` CSS px per cell: its
// model seen from the front and above (z lifts it up the page), in the
// styling's blueprint color, against a dashed line where the hull is. A
// wedge or a curve is its outline, its legs bold.
export function pieceIconSvg(def, cell = 26) {
  const [w, h] = def.size;
  const U = 100;
  const stroke = palette.bpStyle;
  const body = { fill: rgba(stroke, 0.16), stroke, 'stroke-width': 4, 'stroke-linejoin': 'round' };
  let content = '';
  let box = [0, 0, w * U, h * U];
  if (def.shape) {
    const { region } = pieceShape(def, { x: 0, y: 0, rot: 0 });
    content += path(`M${region.map(([x, y]) => `${num(x * U)} ${num(y * U)}`).join('L')}Z`, { ...body, fill: rgba(stroke, 0.3) });
    content += path(`M0 0L0 ${h * U}L${w * U} ${h * U}`, { fill: 'none', stroke, 'stroke-width': 9, 'stroke-linecap': 'round' });
  } else {
    const faces = [];
    MODELS[def.id](faces, [], { r: h - 0.46, wallTop: 0.36, k: ICON_SKIN, light: palette.bad });
    const lift = (p) => [p[0] * U, (p[1] - p[2] * 0.55) * U];
    const shown = faces.filter((f) => f.normal[2] > -0.3).sort((a, b) => mean(a, 2) + mean(a, 1) - (mean(b, 2) + mean(b, 1)));
    const pts = shown.flatMap((f) => f.pts.map(lift));
    box = [Math.min(0, ...pts.map((p) => p[0])), Math.min(0, ...pts.map((p) => p[1])), Math.max(w * U, ...pts.map((p) => p[0])), Math.max(h * U, ...pts.map((p) => p[1]))];
    content += path(`M${box[0]} ${num((h - 0.46) * U)}H${box[2]}`, { stroke, 'stroke-width': 4, 'stroke-dasharray': '10 8', opacity: 0.7 });
    for (const f of shown) content += path(`M${f.pts.map(lift).map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`, f.emissive ? { ...body, fill: stroke } : body);
  }
  const [vw, vh] = [box[2] - box[0], box[3] - box[1]];
  const scale = (cell * Math.min(w, h)) / (U * Math.min(w, h));
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="${num(box[0])} ${num(box[1])} ${num(vw)} ${num(vh)}" width="${num(vw * scale)}" height="${num(vh * scale)}">${content}</svg>`;
}

function mean(face, k) {
  return face.pts.reduce((s, p) => s + p[k], 0) / face.pts.length;
}

// Plain colors for the icon's model: the icon draws it in outline.
const ICON_SKIN = { hull: '#000000', plates: ['#000000', '#000000', '#000000', '#000000'], livery: '#000000', metal: '#000000', metalHi: '#000000', dark: '#000000', soft: '#000000', edge: '#000000', port: '#000000', starboard: '#000000', glowCore: '#000000' };

// The footprint a placement covers, for callers that frame a ship.
export { pieceFootprint };
