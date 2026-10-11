// Draws models (mesh.js) on a 2D canvas through an orbit camera (orbit.js).
// Blueprint scenes are see-through, so nothing is depth-sorted: each style
// is one batch, filled and stroked once, in a fixed order, which keeps a
// frame to a few dozen draw calls. Faces are wound the same way on screen
// before they're batched, so where two overlap they fill once instead of
// cancelling out.
import { eyeOf } from './orbit.js';
import { rgba } from './palette.js';

// A model's faces and lines grouped by style. Made once per scene; the
// painter projects it for every frame.
export function batchModel(model) {
  const faces = new Map();
  const lines = new Map();
  for (const { style, pts } of model.faces) push(faces, style, pts);
  for (const { style, pts } of model.lines) push(lines, style, pts);
  return { faces, lines, glows: model.glows };
}

function push(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

// Draws batches in `order` with `styles` ({ fill, stroke, width, dash,
// halo } by name; the name 'glows' draws the glows).
export function paintBatches(ctx, batches, cam, styles, order) {
  const project = projector(cam);
  const zoom = Math.max(0.85, Math.min(1.6, cam.scale / 60));
  for (const name of order) {
    if (name === 'glows') {
      paintGlows(ctx, batches.glows, project, cam);
      continue;
    }
    const style = styles[name];
    const faces = batches.faces.get(name);
    if (faces && style.fill) {
      const path = new Path2D();
      for (const pts of faces) addFace(path, pts, project);
      ctx.fillStyle = style.fill;
      ctx.fill(path);
    }
    const lines = batches.lines.get(name);
    if (lines && style.stroke) {
      const path = new Path2D();
      for (const pts of lines) addLine(path, pts, project);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (style.halo) {
        ctx.setLineDash([]);
        ctx.strokeStyle = style.halo;
        ctx.lineWidth = style.width * zoom * 3.4;
        ctx.stroke(path);
      }
      ctx.setLineDash(style.dash ?? []);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.width * zoom;
      ctx.stroke(path);
    }
  }
  ctx.setLineDash([]);
}

// A function from a world point to [sx, sy, depth] for this camera (the
// same as orbit.js's project, with the camera's sines worked out once). It
// returns one shared array, so read it before the next call.
function projector(cam) {
  const [ox, oy] = cam.pivot;
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const f = cam.scale * cam.distance;
  const out = [0, 0, 0];
  return (p) => {
    const dx = p[0] - ox;
    const dy = p[1] - oy;
    const toward = dx * s + dy * c;
    const depth = cam.distance - toward * cp - p[2] * sp;
    const k = f / depth;
    out[0] = cam.x + (dx * c - dy * s) * k;
    out[1] = cam.y - (p[2] * cp - toward * sp) * k;
    out[2] = depth;
    return out;
  };
}

const buffer = [];

function addFace(path, pts, project) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const q = project(pts[i]);
    buffer[2 * i] = q[0];
    buffer[2 * i + 1] = q[1];
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += buffer[2 * i] * buffer[2 * j + 1] - buffer[2 * j] * buffer[2 * i + 1];
  }
  if (area >= 0) {
    path.moveTo(buffer[0], buffer[1]);
    for (let i = 1; i < n; i++) path.lineTo(buffer[2 * i], buffer[2 * i + 1]);
  } else {
    path.moveTo(buffer[2 * n - 2], buffer[2 * n - 1]);
    for (let i = n - 2; i >= 0; i--) path.lineTo(buffer[2 * i], buffer[2 * i + 1]);
  }
  path.closePath();
}

function addLine(path, pts, project) {
  let q = project(pts[0]);
  path.moveTo(q[0], q[1]);
  for (let i = 1; i < pts.length; i++) {
    q = project(pts[i]);
    path.lineTo(q[0], q[1]);
  }
}

// Soft lights, added on top of what is under them.
function paintGlows(ctx, glows, project, cam) {
  if (!glows.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glows) {
    const [x, y, depth] = project(g.at);
    const r = (g.r * cam.scale * cam.distance) / depth;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, rgba(g.color, 0.55));
    gradient.addColorStop(1, rgba(g.color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Solid faces (solid.js), lit and ready to draw: made once per scene.
// Each keeps its fill, its middle (for sorting and facing) and its bias.
export function prepareSolid(faces, shadeFace) {
  return faces.map((face) => {
    const n = face.pts.length;
    const mid = [0, 0, 0];
    for (const p of face.pts) for (let k = 0; k < 3; k++) mid[k] += p[k] / n;
    return { pts: face.pts, normal: face.normal, mid, at: face.sortAt ?? mid, fill: shadeFace(face), edge: face.edge ?? null, bias: face.bias ?? 0 };
  });
}

// Draws solid faces back to front, leaving out those that face away from
// the camera, then glows. Without a depth buffer this is the painter's
// algorithm: right for the ship's simple shapes, which don't pass through
// each other. With edges false, outlines are left out: a quicker frame,
// for while the camera moves.
export function paintSolid(ctx, faces, glows, cam, { edges = true } = {}) {
  const project = projector(cam);
  const eye = eyeOf(cam);
  const shown = [];
  for (const face of faces) {
    const [mx, my, mz] = face.mid;
    const [nx, ny, nz] = face.normal;
    if ((eye[0] - mx) * nx + (eye[1] - my) * ny + (eye[2] - mz) * nz <= 0) continue;
    shown.push({ face, depth: project(face.at)[2] + face.bias });
  }
  shown.sort((a, b) => b.depth - a.depth);
  const zoom = Math.max(0.85, Math.min(1.6, cam.scale / 60));
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.9 * zoom;
  for (const { face } of shown) {
    ctx.beginPath();
    for (let i = 0; i < face.pts.length; i++) {
      const q = project(face.pts[i]);
      if (i === 0) ctx.moveTo(q[0], q[1]);
      else ctx.lineTo(q[0], q[1]);
    }
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    if (edges && face.edge) {
      ctx.strokeStyle = face.edge;
      ctx.stroke();
    }
  }
  paintGlows(ctx, glows, project, cam);
}

const LABEL_FONT = "600 10.5px ui-monospace, 'Roboto Mono', Menlo, Consolas, monospace";

// Callouts: a leader line from a point in the scene to its name, kept
// inside rect. labels: [{ at: [x, y, z], text, tone }]; tones maps a tone
// to a color; backdrop is the color behind the text.
export function paintLabels(ctx, labels, cam, rect, tones, backdrop) {
  if (!labels.length) return;
  const project = projector(cam);
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.letterSpacing = '1px';
  ctx.textBaseline = 'middle';
  for (const label of labels) {
    const [ax, ay] = project(label.at);
    const text = label.text.toUpperCase();
    const width = ctx.measureText(text).width + 12;
    const toRight = ax < rect.x + rect.w * 0.62;
    const ex = clamp(ax + (toRight ? 22 : -22), rect.x + 8, rect.x + rect.w - 8);
    const ey = clamp(ay - 34, rect.y + 44, rect.y + rect.h - 40);
    const bx = clamp(toRight ? ex : ex - width, rect.x + 8, rect.x + rect.w - width - 8);
    const color = tones[label.tone] ?? tones.info;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex, ey);
    ctx.lineTo(toRight ? bx : bx + width, ey);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ax, ay, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = backdrop;
    ctx.beginPath();
    ctx.roundRect(bx, ey - 10, width, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, bx + 6, ey + 0.5);
  }
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
