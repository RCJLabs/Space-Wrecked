// A portrait's hair and beard (face.js), by the look's ids (src/sim/looks.js):
// the hair as a cap over the top of the head out to a hairline, plus what
// falls behind it (long hair, an afro, locs, a bun) or stands up (a
// mohawk); a beard as the jaw's line in to round the mouth. Pure SVG text.
import { portraitColors as C } from '../palette.js';
import { mix, mirror, num, onward, poly, pt, spline } from './paths.js';

// { under, over, beard, mustache }: `under` behind the head, `over` on top
// of it, `beard` under the features and `mustache` over the mouth.
export function hairSvg(look, g, id) {
  const color = C.hair[look.hairColor] ?? C.hair.black;
  const dark = mix(color, C.shadow, 0.35);
  const light = mix(color, C.light, 0.22);
  const shapes = hairShapes(look.hair, g);
  let under = '';
  let over = '';
  if (shapes.back) under += `<path d="${shapes.back}" fill="${color}"/>`;
  if (shapes.strands) for (const d of shapes.strands) under += `<path d="${d}" fill="none" stroke="${dark}" stroke-width="3.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-dasharray="2.2 0.9"/>`;
  if (shapes.bun) {
    const [x, y] = shapes.bun;
    under += `<circle cx="${x}" cy="${y}" r="6.4" fill="${color}"/><path d="M${num(x - 4)},${num(y + 4.6)}Q50,${num(y + 7)} ${num(x + 4)},${num(y + 4.6)}" fill="none" stroke="${dark}" stroke-width="1.4"/>`;
  }
  if (shapes.front) {
    over += `<path d="${shapes.front}" fill="${color}" opacity="${shapes.thin ? 0.72 : 1}"/>`;
    if (!shapes.thin) {
      over += `<clipPath id="${id}r"><path d="${shapes.front}"/></clipPath><g clip-path="url(#${id}r)">`;
      over += `<path d="M${num(50 + g.hw * 0.2)},14L${num(50 + g.hw + 6)},20L${num(50 + g.hw + 6)},50L${num(50 + g.hw * 0.62)},44Z" fill="${dark}" opacity="0.55"/>`;
      over += `<path d="M${num(50 - g.hw * 0.7)},24Q${num(50 - g.hw * 0.3)},18.5 ${num(50 + g.hw * 0.05)},20" fill="none" stroke="${light}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/></g>`;
    }
    if (shapes.part) over += `<path d="M${pt(shapes.part[0])}L${pt(shapes.part[1])}" stroke="${dark}" stroke-width="0.8"/>`;
  }
  if (shapes.crest) over += `<path d="${shapes.crest}" fill="${color}" stroke="${dark}" stroke-width="0.5"/>`;
  if (look.hair === 'bald') over += `<ellipse cx="${num(50 - g.hw * 0.35)}" cy="22.5" rx="5.5" ry="2.6" fill="${mix(C.skin[look.skin] ?? C.skin.tan, C.light, 0.28)}" opacity="0.55"/>`;
  const beard = beardShapes(look.beard, g);
  return {
    under,
    over,
    beard: (beard.full ? `<path d="${beard.full}" fill="${color}" opacity="${beard.stubble ? 0.32 : 1}"/>` : '') + (beard.chin ? `<path d="${beard.chin}" fill="${color}"/>` : ''),
    mustache: beard.mustache && !beard.stubble ? `<path d="${beard.mustache}" fill="${color}"/>` : '',
  };
}

// The hair's shapes: { front, thin, part, back, strands, bun, crest }.
function hairShapes(style, g) {
  const { hw } = g;
  const L = (x, y) => [50 - x, y];
  const R = (x, y) => [50 + x, y];
  // The head's top from temple to temple, pushed out by `vol` at the crown.
  const top = (vol) => {
    const side = g.right.slice(0, 5);
    const points = [...side.slice(1).reverse().map(mirror), ...side];
    return points.map((p, i) => {
      const k = Math.abs(i - 4) / 4;
      const d = [p[0] - 50, p[1] - 40];
      const len = Math.hypot(...d) || 1;
      const push = vol * (1 - 0.82 * k * k);
      return [p[0] + (d[0] / len) * push, p[1] + (d[1] / len) * push];
    });
  };
  const cap = (vol, hairline) => `${spline(top(vol), false)}L${pt(hairline[0])}${onward(hairline)}Z`;
  const crop = [R(hw * 0.985, 42), R(hw * 0.8, 31.6), R(hw * 0.36, 28.3), [50, 28.9], L(hw * 0.36, 28.3), L(hw * 0.8, 31.6), L(hw * 0.985, 42)];
  switch (style) {
    case 'buzz':
      return { front: cap(0.5, crop), thin: true };
    case 'crop':
      return { front: cap(2.2, crop) };
    case 'sidepart':
      return { front: cap(3.2, [R(hw * 0.99, 43), R(hw * 0.8, 33.5), R(hw * 0.3, 30.4), L(hw * 0.2, 27.6), L(hw * 0.46, 25.6), L(hw * 0.8, 31), L(hw * 0.99, 41)]), part: [L(hw * 0.46, 25.6), L(hw * 0.36, 18.4)] };
    case 'quiff':
      return { front: cap(5, [R(hw * 0.97, 37.5), R(hw * 0.72, 27.5), [50, 24.8], L(hw * 0.72, 27.5), L(hw * 0.97, 37.5)]) };
    case 'mohawk':
      return {
        front: cap(0.4, crop),
        thin: true,
        crest: poly([[53.4, 28.5], [53.6, 22], [56.5, 15.5], [52.8, 17], [54.6, 9.5], [51, 12.5], [50.5, 5.5], [48.8, 12], [45.8, 7.5], [46.8, 16], [43.6, 14], [46.3, 22], [46.6, 28.5]]),
      };
    case 'long':
      return {
        front: cap(2.6, [R(hw * 0.99, 47), R(hw * 0.72, 30.5), R(2.4, 25.8), [50, 27], L(2.4, 25.8), L(hw * 0.72, 30.5), L(hw * 0.99, 47)]),
        back: spline([L(hw + 1.6, 30), L(hw + 3.6, 52), L(hw + 4.2, 72), L(hw + 1.5, 84.5), L(hw - 4, 82), [50, 78], R(hw - 4, 82), R(hw + 1.5, 84.5), R(hw + 4.2, 72), R(hw + 3.6, 52), R(hw + 1.6, 30), [50, 14]]),
        part: [[50, 27], [50, 16.5]],
      };
    case 'bun':
      return { front: cap(1.6, [R(hw * 0.985, 41), R(hw * 0.8, 30.5), R(hw * 0.36, 27.4), [50, 27.9], L(hw * 0.36, 27.4), L(hw * 0.8, 30.5), L(hw * 0.985, 41)]), bun: [50, 12.4] };
    case 'afro': {
      const cloud = [];
      for (let i = 0; i < 22; i++) {
        const a = Math.PI * (0.92 + (1.16 * i) / 21);
        const bump = i % 2 ? 1.6 : 0;
        cloud.push([50 + Math.cos(a) * (hw + 10.5 + bump), 32 + Math.sin(a) * (21 + bump)]);
      }
      return { front: cap(4, [R(hw * 0.98, 41), R(hw * 0.72, 29.5), [50, 27.6], L(hw * 0.72, 29.5), L(hw * 0.98, 41)]), back: spline([...cloud, R(hw + 5, 56), L(hw + 5, 56)]) };
    }
    case 'locs': {
      const strands = [];
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const [x0, y0] = [50 + s * hw * (0.55 + i * 0.1), 27 + i * 3.2];
          const [x1, y1] = [50 + s * (hw + 1.5 + i * 0.9), 70 + i * 2.6];
          strands.push(`M${num(x0)},${num(y0)}Q${num(x1 + s * 2)},${num((y0 + y1) / 2)} ${num(x1)},${num(y1)}`);
        }
      }
      return { front: cap(2.8, crop), strands };
    }
    default:
      return {};
  }
}

// The beard's shapes: { full, stubble, mustache, chin }.
function beardShapes(kind, g) {
  const { hw, jw, cw, chinY } = g;
  const { my, mw } = g.mouth;
  if (!kind || kind === 'none') return {};
  const outer = [[50 - hw * 0.97, 47], [50 - hw * 0.96, 52], [50 - jw - 1.2, 62.4], [50 - cw - 2.3, 68.2], [50, chinY + 2.6], [50 + cw + 2.3, 68.2], [50 + jw + 1.2, 62.4], [50 + hw * 0.96, 52], [50 + hw * 0.97, 47]];
  const inner = [[50 + hw * 0.86, 47], [50 + hw * 0.7, 55], [50 + mw + 1.6, my + 0.3], [50 + mw * 0.5, my - 2.9], [50, my - 2.6], [50 - mw * 0.5, my - 2.9], [50 - mw - 1.6, my + 0.3], [50 - hw * 0.7, 55], [50 - hw * 0.86, 47]];
  const full = `${spline(outer, false)}L${pt(inner[0])}${onward(inner)}Z`;
  const mustache = `M${num(50 - mw - 1)},${num(my + 0.5)}Q${num(50 - mw * 0.6)},${num(my - 3.4)} 50,${num(my - 2.6)}Q${num(50 + mw * 0.6)},${num(my - 3.4)} ${num(50 + mw + 1)},${num(my + 0.5)}Q${num(50 + mw * 0.5)},${num(my - 1.2)} 50,${num(my - 1.1)}Q${num(50 - mw * 0.5)},${num(my - 1.2)} ${num(50 - mw - 1)},${num(my + 0.5)}Z`;
  const chin = `M${num(50 - mw * 0.7)},${num(my + 2.4)}Q50,${num(my + 1.6)} ${num(50 + mw * 0.7)},${num(my + 2.4)}Q${num(50 + mw * 0.75)},${num(chinY + 1.8)} 50,${num(chinY + 2.4)}Q${num(50 - mw * 0.75)},${num(chinY + 1.8)} ${num(50 - mw * 0.7)},${num(my + 2.4)}Z`;
  if (kind === 'full') return { full, mustache };
  if (kind === 'stubble') return { full, stubble: true };
  if (kind === 'mustache') return { mustache };
  if (kind === 'goatee') return { mustache, chin };
  return {};
}
