// Builders for SVG strings: the part art is made of these. Numbers are
// rounded to two places to keep the strings short.

export function num(value) {
  return Math.round(value * 100) / 100;
}

// Attributes from an object; undefined and null values are left out.
export function attrs(values) {
  let out = '';
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    out += ` ${name}="${typeof value === 'number' ? num(value) : value}"`;
  }
  return out;
}

export const rect = (x, y, width, height, a = {}) => `<rect${attrs({ x, y, width, height, ...a })}/>`;
export const circle = (cx, cy, r, a = {}) => `<circle${attrs({ cx, cy, r, ...a })}/>`;
export const line = (x1, y1, x2, y2, a = {}) => `<line${attrs({ x1, y1, x2, y2, ...a })}/>`;
export const path = (d, a = {}) => `<path${attrs({ d, ...a })}/>`;

// A whole document: viewBox in the art's units, drawn at width × height px.
export function svgDocument(viewWidth, viewHeight, width, height, content, defs = '') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(viewWidth)} ${num(viewHeight)}" width="${num(width)}" height="${num(height)}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    content +
    '</svg>'
  );
}
