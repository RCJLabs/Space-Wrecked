#!/usr/bin/env node
// Renders icon.svg to the PNG app icons, pixel by pixel, with no dependencies.
//
// icon.svg must stay inside a small subset this script understands:
//   <svg viewBox="0 0 N N">, <g>, <title>, <desc>,
//   <rect x y width height rx>, <circle cx cy r>, <polygon points>,
//   each with fill (#rgb, #rrggbb or none), fill-opacity and opacity.
// Anything else is an error, so the PNGs never quietly drift from the SVG.
//
//   node tools/icons.js
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

export const OUTPUTS = [
  { file: 'icons/icon-192.png', size: 192, rounded: true },
  { file: 'icons/icon-512.png', size: 512, rounded: true },
  // Full bleed: the launcher applies its own mask.
  { file: 'icons/icon-maskable-512.png', size: 512, rounded: false },
];

const SAMPLES = 4; // per axis, so 16 samples per pixel
const CORNER = 0.1875; // corner radius of the rounded icons, as a share of the size

const GEOMETRY = { rect: ['x', 'y', 'width', 'height', 'rx'], circle: ['cx', 'cy', 'r'], polygon: ['points'] };
const PAINT = ['id', 'fill', 'fill-opacity', 'opacity'];

// Returns { size, shapes }, shapes in paint order.
export function parseIcon(svg) {
  const source = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?xml[\s\S]*?\?>/g, '');
  let size = null;
  const shapes = [];
  for (const [, closing, name, rawAttrs] of source.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*)>/g)) {
    if (closing) continue;
    const attrs = parseAttrs(rawAttrs);
    if (name === 'svg') {
      checkAttrs(name, attrs, ['xmlns', 'viewBox', 'width', 'height']);
      size = parseViewBox(attrs.viewBox);
    } else if (name === 'g' || name === 'title' || name === 'desc') {
      checkAttrs(name, attrs, ['id']);
    } else if (GEOMETRY[name]) {
      checkAttrs(name, attrs, [...GEOMETRY[name], ...PAINT]);
      const shape = makeShape(name, attrs);
      if (shape) shapes.push(shape);
    } else {
      throw new Error(`icons: <${name}> is not supported. Use rect, circle or polygon.`);
    }
  }
  if (!size) throw new Error('icons: the <svg> element needs viewBox="0 0 N N"');
  return { size, shapes };
}

function parseAttrs(text) {
  const attrs = {};
  for (const [, name, , double, single] of text.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[name] = double ?? single;
  }
  return attrs;
}

function checkAttrs(element, attrs, allowed) {
  for (const name of Object.keys(attrs)) {
    if (!allowed.includes(name)) throw new Error(`icons: attribute "${name}" on <${element}> is not supported`);
  }
}

function parseViewBox(value) {
  const parts = (value ?? '').trim().split(/[\s,]+/).map(Number);
  const [minX, minY, w, h] = parts;
  if (parts.length !== 4 || minX !== 0 || minY !== 0 || !(w > 0) || w !== h) {
    throw new Error(`icons: viewBox must be "0 0 N N" (square), got "${value}"`);
  }
  return w;
}

function makeShape(type, attrs) {
  if (attrs.fill === 'none') return null;
  const color = parseColor(attrs.fill ?? '#000'); // SVG's default fill is black
  const alpha = num(attrs, 'fill-opacity', 1) * num(attrs, 'opacity', 1);
  if (type === 'rect') {
    const x = num(attrs, 'x', 0);
    const y = num(attrs, 'y', 0);
    const w = num(attrs, 'width');
    const h = num(attrs, 'height');
    const r = Math.min(num(attrs, 'rx', 0), w / 2, h / 2);
    return { color, alpha, box: [x, y, x + w, y + h], inside: (px, py) => insideRoundRect(px, py, x, y, w, h, r) };
  }
  if (type === 'circle') {
    const cx = num(attrs, 'cx', 0);
    const cy = num(attrs, 'cy', 0);
    const r = num(attrs, 'r');
    return { color, alpha, box: [cx - r, cy - r, cx + r, cy + r], inside: (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r };
  }
  const values = (attrs.points ?? '').trim().split(/[\s,]+/).map(Number);
  if (values.length < 6 || values.length % 2 || values.some(Number.isNaN)) {
    throw new Error(`icons: bad polygon points "${attrs.points}"`);
  }
  const points = [];
  for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    color,
    alpha,
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    inside: (px, py) => insidePolygon(points, px, py),
  };
}

function num(attrs, name, fallback) {
  if (attrs[name] === undefined) {
    if (fallback === undefined) throw new Error(`icons: missing attribute "${name}"`);
    return fallback;
  }
  const value = Number(attrs[name]);
  if (!Number.isFinite(value)) throw new Error(`icons: attribute ${name}="${attrs[name]}" is not a number`);
  return value;
}

function parseColor(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!m) throw new Error(`icons: fill "${value}" is not supported; use #rgb or #rrggbb`);
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function insideRoundRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  if (r <= 0) return true;
  const dx = Math.max(x + r - px, 0, px - (x + w - r));
  const dy = Math.max(y + r - py, 0, py - (y + h - r));
  return dx * dx + dy * dy <= r * r;
}

// Nonzero winding rule, SVG's default fill-rule.
function insidePolygon(points, px, py) {
  let winding = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [x1, y1] = points[j];
    const [x2, y2] = points[i];
    const side = (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
    if (y1 <= py) {
      if (y2 > py && side > 0) winding += 1;
    } else if (y2 <= py && side < 0) {
      winding -= 1;
    }
  }
  return winding !== 0;
}

// Renders to RGBA bytes, supersampled. With `rounded`, corners outside a
// rounded square are left transparent.
export function rasterize({ size: viewSize, shapes }, outSize, { rounded = false } = {}) {
  const scale = viewSize / outSize;
  const corner = viewSize * CORNER;
  const samples = SAMPLES * SAMPLES;
  const rgba = new Uint8Array(outSize * outSize * 4);
  for (let py = 0; py < outSize; py++) {
    const y0 = py * scale;
    const rowShapes = shapes.filter((s) => s.box[1] < y0 + scale && s.box[3] > y0);
    for (let px = 0; px < outSize; px++) {
      const x0 = px * scale;
      const here = rowShapes.filter((s) => s.box[0] < x0 + scale && s.box[2] > x0);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        const y = y0 + ((sy + 0.5) / SAMPLES) * scale;
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = x0 + ((sx + 0.5) / SAMPLES) * scale;
          if (rounded && !insideRoundRect(x, y, 0, 0, viewSize, viewSize, corner)) continue;
          // Paint in document order (source-over), premultiplied.
          let cr = 0;
          let cg = 0;
          let cb = 0;
          let ca = 0;
          for (const s of here) {
            if (!s.inside(x, y)) continue;
            const keep = 1 - s.alpha;
            cr = s.color[0] * s.alpha + cr * keep;
            cg = s.color[1] * s.alpha + cg * keep;
            cb = s.color[2] * s.alpha + cb * keep;
            ca = s.alpha + ca * keep;
          }
          r += cr;
          g += cg;
          b += cb;
          a += ca;
        }
      }
      if (a > 0) {
        const i = (py * outSize + px) * 4;
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
        rgba[i + 3] = Math.round((a / samples) * 255);
      }
    }
  }
  return rgba;
}

// 8-bit RGBA PNG, no filtering, deflated with node:zlib.
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const icon = parseIcon(readFileSync(join(root, 'icon.svg'), 'utf8'));
  for (const { file, size, rounded } of OUTPUTS) {
    const png = encodePng(size, size, rasterize(icon, size, { rounded }));
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), png);
    console.log(`icons: ${file} (${size}x${size}, ${png.length} bytes)`);
  }
}
