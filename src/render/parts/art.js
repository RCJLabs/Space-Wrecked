// What the part styles share: the art's units, line weights that stay
// readable at every zoom, and a drawing made from a part's interior template
// for module types that don't have art of their own, so new content in
// data/modules.json draws without an engine edit.
import { line, rect, svgDocument } from '../svg.js';

// Art units per cell. Each part is drawn in its own unrotated frame of
// size[0] × size[1] cells, origin at the top left; the board turns it.
export const UNIT = 100;
// How far a room's walls sit inside its cells, in units.
export const INSET = 6;
// The cell size, in CSS px, that `weight` takes its widths at.
const TYPICAL_CELL = 70;

// A stroke width in units for a raster of `scale` = { px, ratio }: px device
// pixels per cell at a device pixel ratio. `css` is the width in CSS px at a
// typical cell size; it grows and shrinks with the zoom, but stays between
// min and max CSS px so lines neither blur away nor turn heavy.
export function weight({ px, ratio }, css, { min = 1, max = 2.4 } = {}) {
  const cellCss = px / ratio;
  const width = Math.max(min, Math.min(max, (css * cellCss) / TYPICAL_CELL));
  return (width * ratio * UNIT) / px;
}

// A part's SVG document, sized for `scale`.
export function partDocument(def, { px }, content, defs = '') {
  const [w, h] = def.size;
  return svgDocument(w * UNIT, h * UNIT, Math.round(w * px), Math.round(h * px), content, defs);
}

// The part's size in units.
export function frameOf(def) {
  return { W: def.size[0] * UNIT, H: def.size[1] * UNIT };
}

// The interior template as tiles { ch, x, y, size } in units, unrotated.
function interiorTiles(def) {
  const size = UNIT / (def.interior.length / def.size[1]);
  const tiles = [];
  def.interior.forEach((row, ty) => [...row].forEach((ch, tx) => tiles.push({ ch, x: tx * size, y: ty * size, size })));
  return tiles;
}

// A drawing of the interior template: machinery, crates, lockers, consoles
// and hatches, each in its tile. `look` gives the styles:
// { stroke, fill, dark, screen, hatch } as attribute objects.
export function templateDrawing(def, look) {
  const out = [];
  for (const { ch, x, y, size: s } of interiorTiles(def)) {
    if (ch === '#') {
      out.push(rect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, { rx: s * 0.08, ...look.dark }));
      out.push(line(x + s * 0.28, y + s * 0.72, x + s * 0.72, y + s * 0.28, look.stroke));
    } else if (ch === 'h') {
      out.push(rect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, { rx: s * 0.06, ...look.fill }));
      out.push(line(x + s * 0.2, y + s * 0.2, x + s * 0.8, y + s * 0.8, look.stroke), line(x + s * 0.8, y + s * 0.2, x + s * 0.2, y + s * 0.8, look.stroke));
    } else if (ch === 'H') {
      out.push(rect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, { rx: s * 0.06, ...look.fill }));
      out.push(line(x + s * 0.5, y + s * 0.2, x + s * 0.5, y + s * 0.8, look.stroke));
    } else if (ch === 'c') {
      out.push(rect(x + s * 0.18, y + s * 0.18, s * 0.64, s * 0.64, { rx: s * 0.08, ...look.dark }));
      out.push(rect(x + s * 0.28, y + s * 0.28, s * 0.44, s * 0.2, { rx: s * 0.04, ...look.screen }));
    } else if (ch === 'a') {
      out.push(rect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, { rx: s * 0.06, ...look.hatch }));
    }
  }
  return out.join('');
}
