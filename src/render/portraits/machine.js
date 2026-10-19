// A machine's badge (M39): where a crew member's button shows their
// helmet, a ship's security turret shows itself, seen from the front on
// the same ID card in its trim: its drum on the deck, the swivel ring, the
// head with its lit eye, the two muzzles and the aerial. Pure: SVG text from
// plain data, the same each time.
//   machineSvg(machine, { trim, crop, id })
//     machine  one of figures/looks.js MACHINES ('turret')
//     trim     its color in the crew bar
//     crop     'bust' or 'face' (closer, for small sizes)
//     id       a prefix for the SVG's ids, for drawings put in one page
import { palette, portraitColors as C } from '../palette.js';
import { mix } from './paths.js';

const ZOOM = {
  bust: 'translate(50 50) scale(1) translate(-50 -52)',
  face: 'translate(50 50) scale(1.22) translate(-50 -50)',
};

export function machineSvg(machine = 'turret', { trim = palette.crewA, crop = 'bust', id = 'm' } = {}) {
  const shell = palette.crewSuit;
  const dark = palette.gunmetal;
  const shade = mix(shell, C.shadow, 0.3);
  const defs = `<clipPath id="${id}c"><rect width="100" height="100" rx="8"/></clipPath>`;
  let body = `<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="${C.card}"/>`;
  body += `<path d="M0,0H30L0,30Z" fill="${trim}" opacity="0.9"/><path d="M0,100L100,58V100Z" fill="${mix(C.card, trim, 0.18)}"/>`;
  body += `<rect x="72" y="6" width="22" height="2" rx="1" fill="${C.cardLine}"/><rect x="78" y="10" width="16" height="2" rx="1" fill="${C.cardLine}"/>`;
  body += `<g transform="${ZOOM[crop] ?? ZOOM.bust}">${MACHINES[machine]?.({ shell, dark, shade, trim }) ?? ''}</g>`;
  body += `</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`;
}

const MACHINES = {
  // Its drum and pedestal, the ring in its trim, the head leaning back, the
  // ammunition box at its side, two muzzles either side of its eye, and
  // the aerial's lamp.
  turret: ({ shell, dark, shade, trim }) => {
    let s = `<path d="M20,98L80,98L74,88L26,88Z" fill="${dark}" stroke="${C.edge}" stroke-width="0.9"/>`;
    s += `<rect x="40" y="66" width="20" height="23" fill="${shade}" stroke="${C.edge}" stroke-width="0.9"/>`;
    s += `<ellipse cx="50" cy="66" rx="18" ry="4.2" fill="${trim}" stroke="${C.edge}" stroke-width="0.8"/>`;
    s += `<path d="M64,34L64,19" stroke="${dark}" stroke-width="1.6"/><circle cx="64" cy="18" r="2.6" fill="${trim}"/>`;
    s += `<rect x="13" y="42" width="11" height="17" rx="1.5" fill="${dark}" stroke="${C.edge}" stroke-width="0.8"/>`;
    s += `<path d="M24,64L76,64L70,34L30,34Z" fill="${shell}" stroke="${C.edge}" stroke-width="1"/>`;
    s += `<path d="M30,34L70,34L71.5,41L28.5,41Z" fill="${mix(shell, C.light, 0.35)}"/>`;
    s += `<circle cx="50" cy="45" r="9" fill="${palette.lamp}" opacity="0.18"/><rect x="44" y="41.5" width="12" height="7" rx="2" fill="${palette.lamp}"/>`;
    for (const x of [35, 65]) {
      s += `<circle cx="${x}" cy="55" r="7.2" fill="${dark}" stroke="${C.edge}" stroke-width="0.8"/>`;
      s += `<circle cx="${x}" cy="55" r="4.4" fill="${palette.gun}"/><circle cx="${x}" cy="55" r="2.2" fill="${C.edge}"/>`;
    }
    return s;
  },
};
