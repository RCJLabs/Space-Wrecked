import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { crc32, encodePng, OUTPUTS, parseIcon, rasterize } from '../tools/icons.js';

const svg = (body, viewBox = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
const pixel = (rgba, size, x, y) => [...rgba.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];

function readChunks(png) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const body = png.subarray(at + 4, at + 8 + length);
    assert.equal(png.readUInt32BE(at + 8 + length), crc32(body), 'chunk CRC');
    chunks.push({ type: body.subarray(0, 4).toString('ascii'), data: body.subarray(4) });
    at += length + 12;
  }
  return chunks;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('encodePng writes a valid RGBA PNG that decodes to the same pixels', () => {
  const rgba = Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 37) % 256);
  const chunks = readChunks(encodePng(3, 2, rgba));
  assert.deepEqual(chunks.map((c) => c.type), ['IHDR', 'IDAT', 'IEND']);
  const header = chunks[0].data;
  assert.equal(header.readUInt32BE(0), 3);
  assert.equal(header.readUInt32BE(4), 2);
  assert.equal(header[8], 8);
  assert.equal(header[9], 6);
  const raw = inflateSync(chunks[1].data);
  assert.equal(raw.length, 2 * (3 * 4 + 1));
  assert.equal(raw[0], 0);
  assert.deepEqual([...raw.subarray(1, 13)], [...rgba.subarray(0, 12)]);
  assert.equal(raw[13], 0);
  assert.deepEqual([...raw.subarray(14)], [...rgba.subarray(12)]);
});

test('a full-size rect fills every pixel', () => {
  const icon = parseIcon(svg('<rect x="0" y="0" width="100" height="100" fill="#f00"/>'));
  const rgba = rasterize(icon, 8);
  for (let i = 0; i < rgba.length; i += 4) assert.deepEqual([...rgba.subarray(i, i + 4)], [255, 0, 0, 255]);
});

test('shapes cover what they should, with opacity and paint order', () => {
  const icon = parseIcon(
    svg(
      '<circle cx="50" cy="50" r="25" fill="#00ff00"/>' +
        '<polygon points="0,0 100,0 0,100" fill="#0000ff" fill-opacity="0.5"/>',
    ),
  );
  const rgba = rasterize(icon, 20);
  assert.deepEqual(pixel(rgba, 20, 12, 12), [0, 255, 0, 255]); // circle only
  assert.deepEqual(pixel(rgba, 20, 19, 19), [0, 0, 0, 0]); // nothing
  assert.deepEqual(pixel(rgba, 20, 1, 1), [0, 0, 255, 128]); // half-transparent triangle
  const [r, g, b, a] = pixel(rgba, 20, 8, 8); // triangle over circle
  assert.deepEqual([r, g, b, a], [0, 128, 128, 255]);
});

test('rounded icons have transparent corners', () => {
  const icon = parseIcon(svg('<rect x="0" y="0" width="100" height="100" fill="#ffffff"/>'));
  const rgba = rasterize(icon, 32, { rounded: true });
  assert.equal(pixel(rgba, 32, 0, 0)[3], 0);
  assert.equal(pixel(rgba, 32, 16, 16)[3], 255);
  assert.equal(pixel(rgba, 32, 16, 0)[3], 255);
});

test('anything outside the supported subset is an error', () => {
  assert.throws(() => parseIcon(svg('<path d="M0 0L1 1"/>')), /<path> is not supported/);
  assert.throws(() => parseIcon(svg('<rect width="1" height="1" transform="rotate(5)"/>')), /"transform"/);
  assert.throws(() => parseIcon(svg('<rect width="1" height="1" fill="red"/>')), /fill "red"/);
  assert.throws(() => parseIcon(svg('<rect width="1"/>')), /missing attribute "height"/);
  assert.throws(() => parseIcon(svg('', '0 0 100 50')), /square/);
  assert.throws(() => parseIcon(svg('<polygon points="0,0 1"/>')), /bad polygon/);
});

test('the shipped icon.svg parses and renders', () => {
  const icon = parseIcon(readFileSync(new URL('../icon.svg', import.meta.url), 'utf8'));
  assert.equal(icon.size, 512);
  assert.ok(icon.shapes.length > 10);
  const full = rasterize(icon, 48);
  for (let i = 3; i < full.length; i += 4) assert.equal(full[i], 255, 'the maskable icon is fully opaque');
  assert.equal(rasterize(icon, 48, { rounded: true })[3], 0, 'the rounded icon has clear corners');
  assert.deepEqual(OUTPUTS.map((o) => o.size), [192, 512, 512]);
});
