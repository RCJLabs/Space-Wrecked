// The colony in its place on the screen (M26), and the player's hands on
// it (M27): a tap finds the grid cell or the building under the finger, a
// drag pans the view, a pinch zooms it and, twisted, turns it, and the
// mouse wheel zooms. The view fits what the scene keeps in view
// (colonyScene.js box) and keeps the player's zoom and turn until that
// changes: placing a building shows the whole grid, square to the screen,
// and leaving it the colony again.
//   stand.show(campaign, defs, mark, whole)   when the colony, the mark or
//                           what is in view changes
//   stand.layout()          when the place may have moved
//   stand.draw(ctx, view)   every frame; draws after a change
//   stand.mark              the mark last shown
//   stand.cellAt(x, y)      the grid cell [i, j] under screen point (x, y),
//                           or null off the grid
//   stand.buildingAt(x, y)  the uid of the building under (x, y), or null
//   stand.onGhost(x, y)     true when (x, y) is on the ghost
//   stand.scale             CSS pixels a cell at the view's middle
//   stand.dispose()
import { colonyScene } from '../../render/colonyScene.js';
import { drawColony, prepareColony } from '../../render/colonyView.js';
import { traceHull } from '../../render/hull.js';
import { fitOrbit, panOrbit, pinchOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { pickBox } from '../../render/pick.js';
import { BOARD_VIEW } from '../../render/shipView.js';
import { colonyStats, siteDef } from '../../sim/colony.js';
import { footprint } from '../../sim/modules.js';
import { attachGestures } from '../gestures.js';

const MARGIN = 10; // pixels round the colony in its place
// Placing, the grid square to the screen: turned, it would stand taller
// on it, and its cells come out smaller.
const PLACE_VIEW = { ...BOARD_VIEW, yaw: 0 };
const MIN_ZOOM = 0.7; // times the fitted scale
const MAX_ZOOM = 4;
const TURN_SLOP = 0.17; // radians of twist before a pinch turns the view
const GHOST_TALL = 1.5; // how high a tap on the ghost still finds it

// onTap(x, y): a tap on the colony, in screen pixels; onHold(x, y), a hold
// (M47: with holds confirming, one on the ghost builds it).
export function createStand(area, { onTap, onHold = null }) {
  let scene = null;
  let built = null;
  let box = null;
  let camera = null;
  let fit = null;
  let moved = false; // the player has panned, zoomed or turned the view
  let dirty = true;
  let site = null;
  let whole = false;
  let ghost = null;
  let defs = null;
  let drag = null;
  let pinch = null;

  const limits = () => ({ min: fit.scale * MIN_ZOOM, max: fit.scale * MAX_ZOOM });
  const set = (next) => {
    camera = next;
    moved = true;
    dirty = true;
  };
  const detach = attachGestures(area, {
    tap(x, y) {
      if (camera) onTap(x, y);
    },
    longPress(x, y) {
      if (camera) onHold?.(x, y);
    },
    dragStart(x, y) {
      if (!camera) return false;
      drag = { x, y };
      return true;
    },
    dragMove(x, y) {
      if (!drag) return;
      set(panOrbit(camera, x - drag.x, y - drag.y));
      drag = { x, y };
    },
    dragEnd() {
      drag = null;
    },
    dragCancel() {
      drag = null;
    },
    pinchStart(p) {
      if (camera) pinch = { start: camera, from: p };
    },
    pinchMove(p) {
      if (pinch) set(pinchOrbit(pinch.start, pinch.from, p, limits(), TURN_SLOP));
    },
    pinchEnd() {
      pinch = null;
    },
  });
  const onWheel = (event) => {
    event.preventDefault();
    if (camera) set(zoomOrbit(camera, event.clientX, event.clientY, camera.scale * Math.exp(-event.deltaY * 0.0015), limits()));
  };
  area.addEventListener('wheel', onWheel, { passive: false });

  const stand = {
    mark: null,
    get scale() {
      return camera?.scale ?? 0;
    },
    show(campaign, content, mark, wholeGrid = false) {
      defs = content;
      whole = wholeGrid;
      stand.mark = mark;
      ghost = mark?.ghost ?? null;
      const { ship, colony } = campaign;
      site = defs.colony.site;
      const stats = colonyStats(campaign, defs);
      const powered = new Map(stats.buildings.map((b) => [b.uid, b.powered]));
      built = colonyScene({
        ship,
        hull: traceHull(ship, defs),
        buildings: colony.buildings.map((b) => ({ ...b, powered: powered.get(b.uid) ?? false })),
        site,
        kind: colony.world.kind,
        defs,
        skin: skinFor('yard'),
        mark,
        whole,
        away: Boolean(colony.trip),
      });
      scene = prepareColony(built, colony.world.kind);
      // The view keeps its fit, and the player's moves, while only the
      // mark changes.
      if (!box || whole !== box.whole || ['x0', 'y0', 'x1', 'y1'].some((key) => box[key] !== built.box[key])) {
        box = { ...built.box, whole };
        camera = null;
        moved = false;
      }
      stand.layout();
    },
    layout() {
      dirty = true;
      if (!box) return;
      const r = area.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      const next = fitOrbit({ ...(whole ? PLACE_VIEW : BOARD_VIEW), pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rect, box, MARGIN);
      // A new place refits the view; the player's moves keep their zoom
      // against the new fit.
      if (moved && camera && fit) camera = { ...camera, scale: camera.scale * (next.scale / fit.scale), x: camera.x + (next.x - fit.x), y: camera.y + (next.y - fit.y) };
      else camera = next;
      fit = next;
    },
    draw(ctx, view) {
      if (!dirty) return;
      dirty = false;
      if (!scene || !camera) {
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        return;
      }
      drawColony(ctx, { x: 0, y: 0, w: view.width, h: view.height }, camera, scene);
    },
    cellAt(x, y) {
      const at = camera && unproject(camera, x, y);
      if (!at || !site) return null;
      const [i, j] = [Math.floor(at[0]), Math.floor(at[1])];
      return i >= 0 && j >= 0 && i < site.width && j < site.height ? [i, j] : null;
    },
    buildingAt(x, y) {
      return camera && built ? pickBox(camera, built.picks, x, y) : null;
    },
    onGhost(x, y) {
      const def = ghost && defs && siteDef(ghost.type, defs);
      if (!camera || !def) return false;
      const [w, h] = footprint(def, ghost.rot);
      return pickBox(camera, [{ uid: 0, box: [ghost.x, ghost.y, 0, ghost.x + w, ghost.y + h, GHOST_TALL] }], x, y) === 0;
    },
    dispose() {
      detach();
      area.removeEventListener('wheel', onWheel);
    },
  };
  return stand;
}
