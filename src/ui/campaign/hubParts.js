// Pieces the campaign's homes share: the hangar (hangar.js) and the stub
// that stands in for an act not built yet (stub.js). A titled panel, the
// crew's rows, a list of labels and values, and the ship standing still in
// the middle, seen from outside.
import { traceHull } from '../../render/hull.js';
import { fitOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { BOARD_VIEW, boardBox, createBoard } from '../../render/shipView.js';
import { node } from '../fight/panels.js';

const MARGIN = 10; // pixels around the ship
const NO_MIN = [0, 0]; // the view fits the ship alone, however small

export function panel(title, ...children) {
  const el = node('section', 'hgr-panel');
  el.append(node('h2', null, title), ...children);
  return el;
}

// The crew list's rows, from crewText (hubText.js): the name, with the job
// under it when the name isn't the job's (the captain's), a bar for hit
// points, and the numbers.
export function crewRows(crew) {
  return crew.map(({ name, job, hp, max }) => {
    const row = node('li');
    row.dataset.wounded = String(hp < max);
    const who = node('span', 'hgr-name');
    who.append(node('span', null, name));
    if (job) who.append(node('small', null, job));
    const bar = node('span', 'hgr-hp');
    const fill = node('span');
    fill.style.width = `${(100 * hp) / max}%`;
    bar.append(fill);
    row.append(who, bar, node('span', 'hgr-num', `${hp}/${max}`));
    return row;
  });
}

// [[label, value]] as the rows of a <dl>; a long value, the parts on hand
// say, takes its own line.
export function listRows(lines) {
  return lines.map(([label, value]) => {
    const row = node('div');
    if (value.length > 14) row.dataset.wide = '';
    row.append(node('dt', null, label), node('dd', null, value));
    return row;
  });
}

// The ship standing still in area, seen from outside and fitted to it:
//   stand.show(ship, defs)   when the ship changes
//   stand.layout()           when area may have moved or changed size
//   stand.draw(ctx, view)    every frame; it draws only after a change
export function createShipStand(area) {
  let board = null;
  let box = null;
  let camera = null;
  let dirty = true;
  const stand = {
    show(ship, defs) {
      const frame = defs.frames.get(ship.frame);
      if (!frame) return;
      const hull = traceHull(ship, defs);
      board = createBoard(frame);
      board.setHull({ ship, defs, hull, skin: skinFor('yard') });
      box = boardBox(frame, hull, NO_MIN);
      camera = null;
      stand.layout();
    },
    layout() {
      dirty = true;
      if (!board) return;
      const r = area.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      camera = fitOrbit({ ...BOARD_VIEW, pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, MARGIN);
    },
    draw(ctx, view) {
      if (!dirty) return;
      dirty = false;
      if (!board || !camera) {
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        return;
      }
      board.draw(ctx, camera, { x: 0, y: 0, w: view.width, h: view.height }, 'hull');
    },
  };
  return stand;
}
