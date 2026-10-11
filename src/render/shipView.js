// Draws the builder board on the canvas: the hull frame, placed parts with
// their doors, the selection and the ghost. Placeholder shapes until M4's
// SVG parts. Works in CSS pixels; the caller sets the device-pixel
// transform. Never changes the scene.
//
// scene: {
//   camera, frame, defs, ship,
//   doors     doorStates(ship, defs)
//   loose     Set of uids not joined to the bridge
//   selected  uid or null
//   lifted    uid of a part being dragged (drawn faint) or null
//   ghost     { placement, ok, blockers: [uid] } or null
// }
import { footprint, hasTag, interiorRows, placedDoors } from '../sim/modules.js';
import { toScreen } from './camera.js';
import { palette, rgba } from './palette.js';
import { partColor } from './parts.js';

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function drawBoard(ctx, scene) {
  const { camera, defs, ship } = scene;
  drawFrame(ctx, camera, scene.frame);
  const byUid = new Map();
  for (const module of ship.modules) {
    const def = defs.modules.get(module.type);
    if (!def) continue;
    byUid.set(module.uid, def);
    drawPart(ctx, camera, defs, def, module, module.uid === scene.lifted ? 0.3 : 1);
  }
  for (const door of scene.doors) {
    if (door.uid === scene.lifted) continue;
    const isAirlock = hasTag(byUid.get(door.uid), 'airlock');
    drawDoor(ctx, camera, door.x, door.y, door.side, doorColor(door.state, isAirlock));
  }
  const blockers = new Set(scene.ghost?.blockers ?? []);
  for (const module of ship.modules) {
    const def = byUid.get(module.uid);
    if (!def || module.uid === scene.lifted) continue;
    if (scene.loose.has(module.uid)) outline(ctx, camera, def, module, palette.bad, 2, 0, [6, 5]);
    if (blockers.has(module.uid)) outline(ctx, camera, def, module, palette.bad, 3, 1);
    if (module.uid === scene.selected) {
      outline(ctx, camera, def, module, palette.space, 6, 3);
      outline(ctx, camera, def, module, palette.ink, 3, 3);
    }
  }
  if (scene.ghost) drawGhost(ctx, camera, defs, scene.ghost);
}

function drawFrame(ctx, camera, frame) {
  const s = camera.scale;
  const [x, y] = toScreen(camera, 0, 0);
  const w = frame.width * s;
  const h = frame.height * s;
  const pad = Math.max(3, s * 0.06);
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad, pad * 2);
  ctx.fillStyle = palette.hull;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.hullEdge;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 1; i < frame.width; i++) {
    const gx = Math.round(x + i * s) + 0.5;
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
  }
  for (let j = 1; j < frame.height; j++) {
    const gy = Math.round(y + j * s) + 0.5;
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.hullGrid;
  ctx.stroke();
}

function drawPart(ctx, camera, defs, def, placement, alpha) {
  const s = camera.scale;
  const [w, h] = footprint(def, placement.rot);
  const [x0, y0] = toScreen(camera, placement.x, placement.y);
  const inset = insetFor(s);
  const color = partColor(def);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(x0 + inset, y0 + inset, w * s - 2 * inset, h * s - 2 * inset, Math.min(8, s * 0.1));
  ctx.fillStyle = tint(color, 0.2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawInterior(ctx, defs, def, placement.rot, x0, y0, s, color);
  drawLabel(ctx, def, x0 + inset, y0 + inset, w * s - 2 * inset, h * s - 2 * inset, s);
  ctx.globalAlpha = 1;
}

// Interior tiles as simple marks: machinery blocks, cover bars, consoles.
function drawInterior(ctx, defs, def, rot, x0, y0, s, color) {
  const rows = rotatedInterior(def, rot);
  const t = s / defs.tilesPerCell;
  for (let ty = 0; ty < rows.length; ty++) {
    for (let tx = 0; tx < rows[ty].length; tx++) {
      const mark = TILE_MARKS[rows[ty][tx]];
      if (!mark) continue;
      const [fx, fy, fw, fh, alpha, ink] = mark;
      ctx.fillStyle = tint(ink ? palette.ink : color, alpha);
      ctx.fillRect(x0 + (tx + fx) * t, y0 + (ty + fy) * t, fw * t, fh * t);
    }
  }
}

// Tile character -> [x, y, w, h] within the tile, alpha, and whether it is
// drawn in ink (otherwise the part's color).
const TILE_MARKS = {
  '#': [0.14, 0.14, 0.72, 0.72, 0.45, false],
  H: [0.2, 0.2, 0.6, 0.6, 0.2, true],
  h: [0.2, 0.4, 0.6, 0.2, 0.22, true],
  c: [0.3, 0.3, 0.4, 0.4, 0.6, true],
  a: [0.1, 0.1, 0.8, 0.8, 0.22, false],
};

const interiors = new Map();
function rotatedInterior(def, rot) {
  const key = `${def.id}/${rot}`;
  let rows = interiors.get(key);
  if (!rows) interiors.set(key, (rows = interiorRows(def, rot)));
  return rows;
}

// The part's name if it fits, otherwise its glyph.
function drawLabel(ctx, def, x, y, w, h, s) {
  const nameSize = clamp(s * 0.17, 10, 15);
  ctx.font = `600 ${nameSize}px ${FONT}`;
  let text = def.name;
  if (ctx.measureText(text).width > w - 8 || h < nameSize * 1.8) {
    text = def.glyph;
    ctx.font = `700 ${clamp(s * 0.36, 12, 28)}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = tint(palette.space, 0.8);
  ctx.strokeText(text, x + w / 2, y + h / 2);
  ctx.fillStyle = palette.ink;
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function doorColor(state, isAirlock) {
  if (state === 'linked') return palette.good;
  if (state === 'open') return palette.accent;
  if (state === 'blocked') return tint(palette.bad, 0.85);
  return isAirlock ? palette.partAirlock : tint(palette.inkDim, 0.6);
}

// A short bar just inside the cell edge the door is on.
function drawDoor(ctx, camera, x, y, side, color) {
  const s = camera.scale;
  const [cx, cy] = toScreen(camera, x, y);
  const length = s * 0.4;
  const thick = Math.max(3, s * 0.07);
  const inset = insetFor(s) + thick / 2 + 1;
  const along = (s - length) / 2;
  ctx.beginPath();
  if (side === 'n' || side === 's') {
    const ly = side === 'n' ? cy + inset : cy + s - inset;
    ctx.moveTo(cx + along, ly);
    ctx.lineTo(cx + along + length, ly);
  } else {
    const lx = side === 'w' ? cx + inset : cx + s - inset;
    ctx.moveTo(lx, cy + along);
    ctx.lineTo(lx, cy + along + length);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = thick;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function outline(ctx, camera, def, placement, color, width, grow, dash) {
  const s = camera.scale;
  const [w, h] = footprint(def, placement.rot);
  const [x0, y0] = toScreen(camera, placement.x, placement.y);
  const inset = insetFor(s) - grow;
  ctx.beginPath();
  ctx.roundRect(x0 + inset, y0 + inset, w * s - 2 * inset, h * s - 2 * inset, Math.min(10, s * 0.12));
  if (dash) ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

// A part being placed: drawn faint, tinted green where it fits and red where
// it doesn't, with its doors.
function drawGhost(ctx, camera, defs, ghost) {
  const { placement, ok } = ghost;
  const def = defs.modules.get(placement.type);
  const s = camera.scale;
  const [w, h] = footprint(def, placement.rot);
  const [x0, y0] = toScreen(camera, placement.x, placement.y);
  const color = ok ? palette.good : palette.bad;
  drawPart(ctx, camera, defs, def, placement, 0.75);
  for (const [x, y, side] of placedDoors(def, placement)) drawDoor(ctx, camera, x, y, side, palette.ink);
  ctx.beginPath();
  ctx.roundRect(x0 + 1, y0 + 1, w * s - 2, h * s - 2, Math.min(10, s * 0.12));
  ctx.fillStyle = tint(color, 0.18);
  ctx.fill();
  ctx.setLineDash([8, 5]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
}

function insetFor(scale) {
  return Math.max(2, scale * 0.05);
}

// rgba() strings, made once per color and alpha.
const tints = new Map();
function tint(hex, alpha) {
  const key = `${hex}/${alpha}`;
  let value = tints.get(key);
  if (!value) tints.set(key, (value = rgba(hex, alpha)));
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
