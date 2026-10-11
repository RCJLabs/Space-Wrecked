// The battle map sandbox: the builder's open ship as the boarding map it
// converts to (src/sim/mapFromShip.js), in 3D. Tap a room to wreck it (on
// fire, then open to vacuum, then full of rubble, then whole again);
// long-press a tile to read it. Drag to pan, pinch to zoom, twist to turn.
// Wrecks are only for trying things: nothing here is saved, and a fight on
// the same ship (the Fight sandbox) starts with them (wrecks.js).
// Input -> mapFromShip -> new map -> redraw.
import { loadContent } from '../../platform/content.js';
import { battleBoxes } from '../../render/battleScene.js';
import { BATTLE_VIEW, createBattleBoard } from '../../render/battleView.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, turnOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { activeSlot } from '../../sim/builds.js';
import { cellAt } from '../../sim/grid.js';
import { mapFromShip, nextWreck } from '../../sim/mapFromShip.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { roomName, tileText, WRECK_TEXT } from './tileText.js';
import { keepWrecks, wrecksOf } from './wrecks.js';

const MARGIN = 14; // pixels around the ship when the view is fitted
const MAX_ZOOM = 3; // times the fitted scale
const MIN_ZOOM = 0.6; // times the fitted scale, or of the whole map's if that is further out
const TURN_SLOP = 0.17; // radians of twist before a pinch turns the map
const KEY_TURN = Math.PI / 12; // Q and E on a keyboard
const SETTLE_MS = 150; // still this long after a camera move, the map sharpens

export const battleScreen = {
  // game: the game's store; the ship is its builder's open slot.
  mount(root, { store: game }) {
    const el = node('section', 'battle');
    const board = node('div', 'bat-board');
    const info = node('p', 'bat-info');
    const status = node('p', 'bat-status');
    const card = node('div', 'bat-card');
    const tools = node('div', 'bat-tools');
    const clearButton = toolButton(icons.remove, 'Clear', 'Clear every wreck');
    const fitButton = toolButton(icons.fit, 'Fit', 'Reset the view');
    info.hidden = card.hidden = true;
    tools.append(clearButton, fitButton);
    board.append(info, status, card, tools);
    el.append(board);
    root.append(el);
    setStatus({ tone: 'info', text: 'Loading parts…' });

    const mapView = createBattleBoard();
    let defs = null;
    let ship = null;
    let map = null;
    let rect = null;
    let boxes = null; // { fit, all }: battleBoxes(map)
    let fit = null;
    let limits = null;
    let camera = null;
    let drag = null;
    let pinch = null;
    let dirty = true;
    let alive = true;
    let settleTimer = 0;
    const cleanups = [];

    loadContent()
      .then((content) => {
        if (!alive) return;
        defs = content;
        open(activeSlot(game.getState().builds)?.ship ?? null);
        cleanups.push(
          game.subscribe((state) => {
            const next = activeSlot(state.builds)?.ship ?? null;
            if (alive && next !== ship) open(next);
          }),
        );
      })
      .catch((err) => {
        if (alive) setStatus({ tone: 'bad', text: `Couldn't load the parts list: ${err.message}` });
      });

    cleanups.push(
      attachGestures(board, {
        tap(x, y) {
          const at = tileAt(x, y);
          if (!at) return;
          const uid = cellAt(map.roomAt, ...at);
          if (uid === null) {
            setStatus({ tone: 'info', text: `${cellAt(map.tiles, ...at) === 'hull' ? 'Hull' : 'Space'}: tap a room to wreck it.` });
            return;
          }
          const wrecked = { ...wrecksOf(ship) };
          const wreck = nextWreck(wrecked[uid] ?? null);
          if (wreck) wrecked[uid] = wreck;
          else delete wrecked[uid];
          keepWrecks(ship, wrecked);
          rebuild();
          const name = roomName(map, uid, defs);
          const then = nextWreck(wreck);
          setStatus({ tone: wreck ? 'bad' : 'good', text: `${name}: ${wreck ? WRECK_TEXT[wreck] : 'whole again'}. Tap it again ${then ? `and it's ${WRECK_TEXT[then]}` : 'to put it right'}.` });
        },
        longPress(x, y) {
          const at = tileAt(x, y);
          if (at) openCard(at, x);
        },
        dragStart(x0, y0) {
          if (!camera) return false;
          closeCard();
          drag = { x: x0, y: y0 };
          return true;
        },
        dragMove(x, y) {
          if (!drag) return;
          setCamera(panOrbit(camera, x - drag.x, y - drag.y));
          drag = { x, y };
        },
        dragEnd() {
          drag = null;
        },
        dragCancel() {
          drag = null;
        },
        pinchStart(p) {
          if (!camera) return;
          closeCard();
          pinch = { start: camera, from: p };
        },
        pinchMove(p) {
          if (pinch) setCamera(pinchOrbit(pinch.start, pinch.from, p, limits, TURN_SLOP));
        },
        pinchEnd() {
          pinch = null;
        },
      }, { ignore: 'button, .bat-card' }),
    );
    const onWheel = (event) => {
      event.preventDefault();
      if (camera) setCamera(zoomOrbit(camera, event.clientX, event.clientY, camera.scale * Math.exp(-event.deltaY * 0.0015), limits));
    };
    board.addEventListener('wheel', onWheel, { passive: false });
    cleanups.push(() => board.removeEventListener('wheel', onWheel));
    const onKey = (event) => {
      const key = event.key.toLowerCase();
      if (!camera || event.ctrlKey || event.metaKey || (key !== 'q' && key !== 'e')) return;
      setCamera(turnOrbit(camera, rect.x + rect.w / 2, rect.y + rect.h / 2, camera.yaw + (key === 'q' ? -KEY_TURN : KEY_TURN)));
    };
    addEventListener('keydown', onKey);
    cleanups.push(() => removeEventListener('keydown', onKey));

    cleanups.push(
      onTap(clearButton, () => {
        if (!map || !Object.keys(wrecksOf(ship)).length) return;
        keepWrecks(ship, {});
        rebuild();
        setStatus({ tone: 'good', text: 'Every room is whole again.' });
      }),
      onTap(fitButton, () => fit && setCamera(fit)),
    );
    const closeOnTouch = () => closeCard();
    el.addEventListener('pointerdown', closeOnTouch, true);

    const observer = new ResizeObserver(() => layout());
    observer.observe(board);
    cleanups.push(() => observer.disconnect());

    // Shows another ship (or none). Its wrecks start over.
    function open(next) {
      ship = next;
      rebuild();
      if (!map) {
        info.hidden = true;
        clearButton.disabled = fitButton.disabled = true;
        setStatus({ tone: 'info', text: ship ? 'The open ship has no parts yet. Build one in the Builder, then come back.' : 'No ship yet. Build one in the Builder, then come back.' });
        return;
      }
      clearButton.disabled = fitButton.disabled = false;
      setStatus({ tone: 'info', text: 'Tap a room to wreck it. Long-press a tile to read it.' });
      boxes = battleBoxes(map);
      if (rect) refit();
      else layout();
    }

    // Converts the ship with the wrecks as they are now.
    function rebuild() {
      const known = ship && defs.frames.has(ship.frame);
      map = known ? mapFromShip(ship, defs, { wrecked: wrecksOf(ship) }) : null;
      mapView.setMap(map && { map, skin: skinFor('yard') });
      if (map) {
        const wrecks = map.rooms.filter((room) => room.wreck).length;
        const hatches = map.hatches.length;
        setText(info, {
          tone: 'info',
          text: `${map.width} × ${map.height} tiles · ${map.rooms.length} rooms · ${hatches} hatch${hatches === 1 ? '' : 'es'}${wrecks ? ` · ${wrecks} wrecked` : ''}`,
        });
        info.hidden = false;
      }
      dirty = true;
    }

    // The tile under a finger at (x, y), as [x, y], or null off the map.
    function tileAt(x, y) {
      if (!map || !camera) return null;
      const deck = unproject(camera, x, y);
      if (!deck) return null;
      const [tx, ty] = [Math.floor(deck[0]), Math.floor(deck[1])];
      return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height ? [tx, ty] : null;
    }

    // A card saying what is on a tile: its room and fitting, its walls and
    // any wreck. It opens on the half of the board away from the finger.
    function openCard([x, y], fingerX) {
      const { title, lines } = tileText(map, x, y, defs);
      card.replaceChildren(node('h3', null, title), ...lines.map((line) => node('p', null, line)));
      card.dataset.side = fingerX < rect.x + rect.w / 2 ? 'right' : 'left';
      card.hidden = false;
    }

    function closeCard() {
      card.hidden = true;
    }

    function setStatus(message) {
      setText(status, message);
    }

    // Camera

    function layout() {
      if (!alive) return;
      const r = board.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      if (rect && r.left === rect.x && r.top === rect.y && r.width === rect.w && r.height === rect.h) return;
      rect = { x: r.left, y: r.top, w: r.width, h: r.height };
      if (boxes) refit();
      dirty = true;
    }

    // Opens the view on the ship, as large as fits; zooming out stops a
    // little past the whole map.
    function refit() {
      const { fit: onShip, all } = boxes;
      fit = clampOrbit(fitOrbit({ ...BATTLE_VIEW, pivot: middle(onShip) }, rect, onShip, MARGIN), rect, all, MARGIN);
      const whole = fitOrbit({ ...BATTLE_VIEW, pivot: middle(all) }, rect, all, MARGIN);
      limits = { min: Math.min(fit.scale, whole.scale) * MIN_ZOOM, max: fit.scale * MAX_ZOOM };
      setCamera(fit);
    }

    function setCamera(next) {
      camera = clampOrbit(next, rect, boxes.all, MARGIN);
      dirty = true;
    }

    return {
      resize() {
        layout();
        dirty = true;
      },
      // For the dev overlay: how the map's frames were drawn.
      frameStats: () => mapView.frameStats(),
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        if (!rect) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        // A frame drawn while the camera moved is a rough one; once it has
        // been still for a moment, the map is drawn again in full.
        if (mapView.draw(ctx, camera, rect)) {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => (dirty = true), SETTLE_MS);
        }
        ctx.restore();
      },
      unmount() {
        alive = false;
        clearTimeout(settleTimer);
        for (const cleanup of cleanups) cleanup();
        el.removeEventListener('pointerdown', closeOnTouch, true);
        el.remove();
      },
    };
  },
};

function middle(box) {
  return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
}

// Writes { tone, text } into a line only when it changed.
function setText(el, { tone, text }) {
  if (el.textContent !== text) el.textContent = text;
  if (el.dataset.tone !== tone) el.dataset.tone = tone;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function toolButton(icon, label, title) {
  const button = node('button', 'btn bat-tool');
  button.type = 'button';
  button.innerHTML = icon;
  button.append(node('span', null, label));
  button.setAttribute('aria-label', title);
  return button;
}
