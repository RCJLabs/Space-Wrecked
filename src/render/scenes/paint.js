// Drawing scenes (M34): a scene's shapes (shapes.js) painted on a canvas,
// and the backdrops the screens draw them as. A scene is painted once a
// size into an offscreen canvas, so a frame only draws that canvas, scaled
// and faded: the lift-off and the landing (backdropAt says how, from the
// moment of the sequence) and the title.
import { rgba } from '../palette.js';
import { boxOf } from './shapes.js';

// Paints `shapes` on context g, whose transform maps a scene unit to `unit`
// device pixels. A soft shape (blur, in units) isn't blurred, which costs
// seconds on a large canvas: a run of them is painted on a smaller layer,
// as many times smaller as its blur is wide, and laid over g scaled up,
// which softens its edges as much. `make(w, h)` makes the layer's canvas.
export function paintShapes(g, shapes, unit = 1, make = canvasOf, clip = null) {
  let run = [];
  const flush = () => {
    if (run.length) paintSoft(g, run, unit, make, clip);
    run = [];
  };
  for (const shape of shapes) {
    if (shape.blur && shape.kind !== 'group') {
      if (run.length && (run[0].blend ?? '') !== (shape.blend ?? '')) flush();
      run.push(shape);
    } else {
      flush();
      paintShape(g, shape, unit, make);
    }
  }
  flush();
}

// The layer soft runs are painted on, one for each way of making a canvas,
// grown as needed and kept.
const layers = new WeakMap();

// A run of soft shapes: painted k times smaller on the layer, only over the
// box they cover, and laid over g at full size.
function paintSoft(g, run, unit, make, clip) {
  const most = Math.max(...run.map((s) => s.blur));
  const k = Math.max(2, Math.min(12, Math.round((most * unit) / 2.5)));
  const m = g.getTransform();
  const [ux0, uy0, ux1, uy1] = boxOf(run);
  const x0 = Math.max(0, Math.floor(m.a * ux0 + m.e));
  const y0 = Math.max(0, Math.floor(m.d * uy0 + m.f));
  const x1 = Math.min(g.canvas.width, Math.ceil(m.a * ux1 + m.e));
  const y1 = Math.min(g.canvas.height, Math.ceil(m.d * uy1 + m.f));
  if (x1 <= x0 || y1 <= y0) return;
  const [w, h] = [Math.ceil((x1 - x0) / k), Math.ceil((y1 - y0) / k)];
  let layer = layers.get(make);
  if (!layer || layer.width < w || layer.height < h) {
    layer = make(Math.max(w, layer?.width ?? 0), Math.max(h, layer?.height ?? 0));
    layers.set(make, layer);
  }
  const lg = layer.getContext('2d');
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalAlpha = 1;
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, w + 1, h + 1);
  lg.setTransform(m.a / k, m.b / k, m.c / k, m.d / k, (m.e - x0) / k, (m.f - y0) / k);
  lg.save();
  if (clip) {
    trace(lg, clip);
    lg.clip();
  }
  for (const s of run) paintShape(lg, { ...s, blur: undefined, blend: undefined }, unit / k, make);
  lg.restore();
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (run[0].blend) g.globalCompositeOperation = run[0].blend;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(layer, 0, 0, w, h, x0, y0, w * k, h * k);
  g.restore();
}


function paintShape(g, s, unit, make) {
  g.save();
  if (s.alpha !== undefined) g.globalAlpha *= s.alpha;
  if (s.blend) g.globalCompositeOperation = s.blend;
  if (s.kind === 'group') {
    trace(g, s.clip);
    g.clip();
    paintShapes(g, s.shapes, unit, make, s.clip);
  } else {
    trace(g, s);
    if (s.fill) {
      g.fillStyle = paintOf(g, s.fill);
      g.fill();
    }
    if (s.stroke) {
      g.strokeStyle = paintOf(g, s.stroke);
      g.lineWidth = s.width ?? 1;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke();
    }
  }
  g.restore();
}

// A shape's outline as the context's path.
function trace(g, s) {
  g.beginPath();
  if (s.kind === 'rect') g.rect(s.x, s.y, s.w, s.h);
  else if (s.kind === 'ellipse') g.ellipse(s.x, s.y, s.rx, s.ry, s.turn ?? 0, 0, Math.PI * 2);
  else if (s.smooth) curve(g, s.points, !s.open);
  else {
    g.moveTo(...s.points[0]);
    for (const p of s.points.slice(1)) g.lineTo(...p);
    if (!s.open) g.closePath();
  }
}

// A curve through every point (Catmull-Rom, as Bezier segments).
function curve(g, points, closed) {
  const n = points.length;
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  g.moveTo(...points[0]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) g.closePath();
}

// A color, or a gradient made on g.
function paintOf(g, paint) {
  if (typeof paint === 'string') return paint;
  const gradient = paint.linear ? g.createLinearGradient(...paint.linear) : g.createRadialGradient(paint.radial[0], paint.radial[1], 0, ...paint.radial);
  for (const [at, color, alpha] of paint.stops) gradient.addColorStop(at, rgba(color, alpha));
  return gradient;
}

function canvasOf(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

// A framed scene (the hangar, a world seen whole) painted to cover a w x h
// box (CSS px) at dpr, its middle in the middle: a canvas of the box's size.
export function paintCover(scene, w, h, dpr, make = canvasOf) {
  const canvas = make(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)));
  const g = canvas.getContext('2d');
  const [sw, sh] = scene.size;
  const k = Math.max(w / sw, h / sh) * dpr;
  g.setTransform(k, 0, 0, k, (canvas.width - sw * k) / 2, (canvas.height - sh * k) / 2);
  paintShapes(g, scene.shapes, k, make);
  return canvas;
}

// A ground (ground.js) painted into a square canvas `side` device px wide.
export function paintTile(scene, side, make = canvasOf) {
  const canvas = make(side, side);
  const g = canvas.getContext('2d');
  const k = side / scene.size[0];
  g.setTransform(k, 0, 0, k, 0, 0);
  paintShapes(g, scene.shapes, k, make);
  return canvas;
}

// The ground's square takes this much of the screen's longer side at zoom 1,
// enough to cover the screen wherever the ship stands.
export const GROUND_COVER = 1.25;
// The ground's zoom with the ship standing on it, and as it fades.
export const NEAR = 1.32;
export const FAR = 0.82;
// How far through flying off (liftOff.js `away`) the ground starts to fade
// and is gone.
export const FADE = [0.1, 0.5];
// The most device pixels across a painted ground, to keep its memory down.
export const MOST_TILE = 1800;

// The ground's canvas size for a w x h screen at dpr: as sharp as its
// nearest zoom needs, up to MOST_TILE.
export function tileSide(w, h, dpr) {
  return Math.min(MOST_TILE, Math.ceil(GROUND_COVER * Math.max(w, h) * NEAR * dpr));
}

// How the backdrop stands at a moment of the lift-off (liftOff.js
// liftOffAt; the landing's is the same played backwards): the ground's zoom,
// near while the ship stands on it, falling away as it climbs, and how much
// of the ground still shows over the world seen whole, all of it until the
// ship flies off and none soon after.
export function backdropAt(moment) {
  const { rise, away } = moment;
  const fade = Math.max(0, Math.min(1, (away - FADE[0]) / (FADE[1] - FADE[0])));
  return {
    zoom: (1 + (NEAR - 1) * (1 - rise)) * (1 - (1 - FAR) * away),
    ground: 1 - fade * fade * (3 - 2 * fade),
  };
}

// Draws the backdrop ({ world, ground }, painted canvases) for a moment:
// the world seen whole over the screen, the ground over it centred on
// `at`, the ship's place.
export function drawBackdrop(ctx, backdrop, moment, view, at) {
  ctx.drawImage(backdrop.world, 0, 0, view.width, view.height);
  const { zoom, ground } = backdropAt(moment);
  if (ground <= 0) return;
  const side = GROUND_COVER * Math.max(view.width, view.height) * zoom;
  ctx.globalAlpha = ground;
  ctx.drawImage(backdrop.ground, at[0] - side / 2, at[1] - side / 2, side, side);
  ctx.globalAlpha = 1;
}
