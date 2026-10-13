// A portrait's mark (face.js), by the look's id (src/sim/looks.js): a scar
// through the brow, freckles, a tattoo under an eye, ports in the temple,
// a cybernetic eye, a steel jaw plate, an earring, an eye patch, or the
// lines of age. Pure SVG text.
import { portraitColors as C } from '../palette.js';
import { mix, num, poly, spline } from './paths.js';

// The side of the eye a mark takes the place of (-1 left, 1 right), or 0.
export function markedEye(mark) {
  if (mark === 'cybereye') return 1;
  if (mark === 'eyepatch') return -1;
  return 0;
}

// The mark as SVG over the face, `skin` its skin color. `id` prefixes its
// clip paths.
export function markSvg(mark, g, skin, id) {
  const [left, right] = g.eyes;
  const deep = mix(skin, C.shadow, 0.42);
  switch (mark) {
    case 'scar': {
      const a = [left.ex - 2.6, 37.5];
      const b = [left.ex + 2.8, 56.5];
      const d = `M${num(a[0])},${a[1]}L${num(b[0])},${b[1]}`;
      const c = mix(skin, C.scar, 0.55);
      let s = `<clipPath id="${id}s"><rect x="0" y="0" width="100" height="44.2"/></clipPath><path d="${d}" stroke="${skin}" stroke-width="2.2" clip-path="url(#${id}s)"/>`;
      s += `<path d="${d}" stroke="${mix(c, C.shadow, 0.1)}" stroke-width="1.5" stroke-linecap="round"/><path d="${d}" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>`;
      for (const t of [0.22, 0.42, 0.62, 0.8]) {
        const [x, y] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        s += `<path d="M${num(x - 1.1)},${num(y + 0.35)}L${num(x + 1.1)},${num(y - 0.35)}" stroke="${mix(c, C.shadow, 0.2)}" stroke-width="0.45"/>`;
      }
      return s;
    }
    case 'freckles': {
      let s = '';
      for (const side of [-1, 1]) for (const [dx, dy] of [[5.6, 51.6], [7.4, 53.2], [9.4, 51.8], [6.6, 55.2], [8.8, 55.6], [3.6, 50.4]]) s += `<circle cx="${num(50 + side * dx)}" cy="${dy}" r="0.42" fill="${mix(skin, C.shadow, 0.3)}" opacity="0.7"/>`;
      return s;
    }
    case 'tattoo':
      return `<path d="M${num(left.ex - 3)},52.6L${num(left.ex - 0.8)},57.4M${num(left.ex - 0.8)},52.4L${num(left.ex + 1.4)},57.2" stroke="${C.tattoo}" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/><circle cx="${num(left.ex + 2.6)}" cy="53.2" r="0.6" fill="${C.tattoo}" opacity="0.85"/>`;
    case 'ports': {
      let s = '';
      for (const [k, y] of [[0.83, 35.5], [0.86, 39.3], [0.88, 43.1]]) {
        const x = num(50 + g.hw * k);
        s += `<circle cx="${x}" cy="${y}" r="1.25" fill="${C.steel}" stroke="${C.steelDark}" stroke-width="0.35"/><circle cx="${x}" cy="${y}" r="0.55" fill="${C.steelDark}"/><circle cx="${num(x + 0.15)}" cy="${num(y + 0.1)}" r="0.22" fill="${C.port}"/>`;
      }
      return s;
    }
    case 'cybereye': {
      const e = right;
      const plate = spline([[e.ex - 4.8, 43.6], [e.ex + 1.5, 41.6], [e.ex + 6.2, 44.2], [e.ex + 6, 50.2], [e.ex + 1, 52.4], [e.ex - 4.6, 50.4]]);
      let s = `<path d="${plate}" fill="${C.plate}" stroke="${C.steelDark}" stroke-width="0.7"/>`;
      s += `<path d="${plate}" fill="none" stroke="${C.steelLight}" stroke-width="0.5" transform="translate(-0.4 -0.4)" opacity="0.7"/>`;
      const [x, y] = [num(e.ex), num(e.ey - 0.3)];
      s += `<circle cx="${x}" cy="${y}" r="3" fill="${C.steelDark}"/><circle cx="${x}" cy="${y}" r="2.1" fill="${C.implant}"/><circle cx="${x}" cy="${y}" r="0.9" fill="${C.implantCore}"/><circle cx="${x}" cy="${y}" r="4.4" fill="${C.implant}" opacity="0.16"/>`;
      for (const [px, py] of [[e.ex - 3.6, 44.6], [e.ex + 5, 45.2], [e.ex + 4.6, 49.6], [e.ex - 3.4, 49.6]]) s += `<circle cx="${num(px)}" cy="${num(py)}" r="0.45" fill="${C.steelLight}"/>`;
      return s;
    }
    case 'jawplate': {
      const { hw, jw, cw, chinY } = g;
      const d = poly([[50 - hw * 0.93, 53.5], [50 - jw - 0.6, 61.2], [50 - cw - 1.6, 67.2], [50 - cw + 1.2, chinY - 0.4], [50 - cw + 2.2, 64], [50 - jw + 3.6, 58.2], [50 - hw * 0.78, 52.6]]);
      let s = `<path d="${d}" fill="${C.steel}" stroke="${C.steelDark}" stroke-width="0.7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${C.steelLight}" stroke-width="0.4" transform="translate(-0.35 -0.35)" opacity="0.6"/>`;
      for (const [x, y] of [[50 - hw * 0.84, 54.4], [50 - jw + 0.9, 61], [50 - cw - 0.2, 66.2]]) s += `<circle cx="${num(x)}" cy="${num(y)}" r="0.55" fill="${C.steelLight}" stroke="${C.steelDark}" stroke-width="0.25"/>`;
      return s;
    }
    case 'earring':
      return `<circle cx="${num(50 + g.hw - 0.2)}" cy="53.6" r="1.3" fill="none" stroke="${C.gold}" stroke-width="0.7"/>`;
    case 'eyepatch': {
      const e = left;
      return `<path d="M${num(50 - g.hw)},40L${num(e.ex)},45.6L${num(50 + g.hw * 0.4)},37.4" fill="none" stroke="${C.patch}" stroke-width="1"/><ellipse cx="${num(e.ex)}" cy="${num(e.ey - 0.2)}" rx="4.6" ry="3.8" fill="${C.patch}" stroke="${C.edge}" stroke-width="0.4"/>`;
    }
    case 'lines': {
      let s = `<path d="M${num(50 - g.hw * 0.5)},31.5Q50,30 ${num(50 + g.hw * 0.5)},31.5M${num(50 - g.hw * 0.4)},34.4Q50,33.2 ${num(50 + g.hw * 0.4)},34.4" fill="none" stroke="${deep}" stroke-width="0.55" opacity="0.55"/>`;
      for (const e of g.eyes) s += `<path d="M${num(e.outer[0] + e.s * 1.2)},${num(e.outer[1] - 1.2)}l${e.s * 1.8},-0.6M${num(e.outer[0] + e.s * 1.3)},${num(e.outer[1] + 0.4)}l${e.s * 1.9},0.5" stroke="${deep}" stroke-width="0.5" opacity="0.6"/>`;
      const { nw, tipY } = g.nose;
      const { mw, my } = g.mouth;
      s += `<path d="M${num(50 - nw - 1.2)},${num(tipY + 0.4)}Q${num(50 - mw - 1.6)},${num(my - 1)} ${num(50 - mw - 1.2)},${num(my + 1.6)}M${num(50 + nw + 1.2)},${num(tipY + 0.4)}Q${num(50 + mw + 1.6)},${num(my - 1)} ${num(50 + mw + 1.2)},${num(my + 1.6)}" fill="none" stroke="${deep}" stroke-width="0.6" opacity="0.5"/>`;
      return s;
    }
    default:
      return '';
  }
}
