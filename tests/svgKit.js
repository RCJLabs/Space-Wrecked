// Drawings as SVG text, for tests (M23c, M34): well formed, nothing from
// outside, and ids of their own.
import assert from 'node:assert/strict';

// Tags open and close in order, every url(#...) names an id in the drawing,
// and nothing points outside it.
export function wellFormed(svg) {
  const inside = svg.replace('xmlns="http://www.w3.org/2000/svg"', '');
  const stack = [];
  for (const [, close, name, rest] of inside.matchAll(/<(\/?)([a-zA-Z]+)([^>]*)>/g)) {
    if (close) assert.equal(stack.pop(), name, `</${name}> closes what opened`);
    else if (!rest.endsWith('/')) stack.push(name);
  }
  assert.deepEqual(stack, [], 'everything closed');
  const ids = idsOf(inside);
  for (const [, ref] of inside.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(ref), `#${ref} is defined`);
  assert.ok(!/NaN|undefined|null|Infinity/.test(inside), 'no broken numbers');
  assert.ok(!/https?:|href=/.test(inside), 'nothing from outside');
}

// The ids a drawing defines.
export const idsOf = (svg) => new Set([...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
