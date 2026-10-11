// Placeholder part art until M4: a color per module tag, and a small SVG
// icon of a part's footprint and doors for the palette.
import { footprint, localDoors } from '../sim/modules.js';
import { palette, rgba } from './palette.js';

export function partColor(def) {
  for (const tag of def.tags) {
    const color = palette[`part${tag[0].toUpperCase()}${tag.slice(1)}`];
    if (color) return color;
  }
  return palette.partCorridor;
}

// An SVG string: the footprint at `cell` pixels per cell, with a tick on
// each door socket.
export function partIconSvg(def, cell = 14) {
  const [w, h] = footprint(def, 0);
  const pad = 3;
  const width = w * cell + 2 * pad;
  const height = h * cell + 2 * pad;
  const color = partColor(def);
  const lines = [];
  for (let i = 1; i < w; i++) lines.push(line(pad + i * cell, pad, pad + i * cell, pad + h * cell, rgba(color, 0.45), 1));
  for (let j = 1; j < h; j++) lines.push(line(pad, pad + j * cell, pad + w * cell, pad + j * cell, rgba(color, 0.45), 1));
  const half = cell * 0.24;
  for (const [x, y, side] of localDoors(def, 0)) {
    const cx = pad + (x + 0.5) * cell;
    const cy = pad + (y + 0.5) * cell;
    if (side === 'n') lines.push(line(cx - half, pad + 1.5, cx + half, pad + 1.5, palette.ink, 2.5));
    if (side === 's') lines.push(line(cx - half, pad + h * cell - 1.5, cx + half, pad + h * cell - 1.5, palette.ink, 2.5));
    if (side === 'w') lines.push(line(pad + 1.5, cy - half, pad + 1.5, cy + half, palette.ink, 2.5));
    if (side === 'e') lines.push(line(pad + w * cell - 1.5, cy - half, pad + w * cell - 1.5, cy + half, palette.ink, 2.5));
  }
  return (
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">` +
    `<rect x="${pad}" y="${pad}" width="${w * cell}" height="${h * cell}" rx="2.5" fill="${rgba(color, 0.32)}" stroke="${color}" stroke-width="1.5"/>` +
    lines.join('') +
    '</svg>'
  );
}

function line(x1, y1, x2, y2, stroke, width) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
}
