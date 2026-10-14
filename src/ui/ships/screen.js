// The enemy ships sandbox: ships generated from each preset in
// data/ships.json (src/sim/gen/ship.js), one seed at a time, seen from
// outside (Hull), as the builder draws them (Plans) or as their boarding
// map (Map, with a derelict's wrecked rooms). Open in builder copies the
// ship into a new builder slot, which the Battle map and Fight sandboxes
// use too, wrecks and all. Drag to pan, pinch to zoom, twist to turn;
// long-press a tile of the map to read it.
// Input -> generateShip -> new ship -> redraw.
import { MAX_NAME, MAX_SLOTS } from '../../sim/builds.js';
import { loadContent } from '../../platform/content.js';
import { battleBoxes } from '../../render/battleScene.js';
import { BATTLE_VIEW, createBattleBoard } from '../../render/battleView.js';
import { traceHull } from '../../render/hull.js';
import { clampOrbit, fitOrbit, panOrbit, pinchOrbit, turnOrbit, unproject, zoomOrbit } from '../../render/orbit.js';
import { palette, skinFor } from '../../render/palette.js';
import { BOARD_VIEW, boardBox, createBoard } from '../../render/shipView.js';
import { openings } from '../../sim/builder.js';
import { canLaunch, flightChecklist } from '../../sim/constraints.js';
import { generateShip } from '../../sim/gen/ship.js';
import { mapFromShip } from '../../sim/mapFromShip.js';
import { placedCells } from '../../sim/modules.js';
import { logFor } from '../../sim/replay.js';
import { tileText } from '../battle/tileText.js';
import { keepWrecks } from '../battle/wrecks.js';
import { attachGestures, onTap } from '../gestures.js';
import { icons } from '../icons.js';

const MARGIN = 14; // pixels around the ship when the view is fitted
const TOP = 60; // the preset and seed buttons along the top, at least (they wrap to a second row when they don't fit)...
const BOTTOM = 64; // ...and the tools along the bottom, which the fitted ship keeps clear of
const MAX_ZOOM = 3; // times the fitted scale
const MIN_ZOOM = 0.6;
const TURN_SLOP = 0.17; // radians of twist before a pinch turns the ship
const KEY_TURN = Math.PI / 12; // Q and E on a keyboard
const SETTLE_MS = 150; // still this long after a camera move, the board sharpens
const LOOKS = [
  { id: 'hull', label: 'Hull', icon: icons.hull, hint: 'The ship from outside.' },
  { id: 'plans', label: 'Plans', icon: icons.plans, hint: 'Its plans, as the builder draws them.' },
  { id: 'map', label: 'Map', icon: icons.map, hint: 'Its boarding map. Long-press a tile to read it.' },
];
const NO_MIN = [0, 0]; // the fitted view is the ship, with no room round it to build

// Which ship is shown, kept until the page reloads.
let kept = { preset: null, seed: 1, look: 'hull' };

export const shipsScreen = {
  // game: the game's store; Open in builder adds a slot to its builds.
  mount(root, { store: game }) {
    const el = node('section', 'ships');
    const board = node('div', 'shp-board');
    const top = node('div', 'shp-top');
    const presets = node('div', 'shp-presets');
    const prevButton = iconButton(icons.prev, 'The seed before');
    const seedChip = node('p', 'shp-seed');
    const nextButton = iconButton(icons.next, 'The next seed');
    // The seed buttons as one, so they wrap below the presets together.
    const seeds = node('div', 'shp-seeds');
    seeds.append(prevButton, seedChip, nextButton);
    top.append(presets, seeds);
    const lines = node('div', 'shp-lines');
    const info = node('p', 'shp-info');
    const status = node('p', 'shp-status');
    lines.append(info, status);
    const card = node('div', 'shp-card');
    const tools = node('div', 'shp-tools');
    const lookButtons = LOOKS.map((look) => toolButton(look.icon, look.label, look.hint));
    const fitButton = toolButton(icons.fit, 'Fit', 'Reset the view');
    const openButton = toolButton(icons.open, 'Builder', 'Open this ship in the builder');
    tools.append(...lookButtons, fitButton, openButton);
    info.hidden = card.hidden = true;
    board.append(card);
    el.append(board, top, lines, tools);
    root.append(el);
    setStatus({ tone: 'info', text: 'Loading parts…' });

    let shipBoard = { scenes: null, frame: null }; // the Hull and Plans looks, for one frame's yard
    const mapBoard = createBattleBoard();
    let defs = null;
    let made = null; // generateShip's result for the preset and seed
    let map = null;
    let rect = null;
    let box = null; // what the fitted view shows, and the camera keeps in view
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
        if (!defs.ships.has(kept.preset)) kept = { ...kept, preset: defs.ships.keys().next().value ?? null };
        presets.replaceChildren(
          ...[...defs.ships.values()].map((preset) => {
            const button = textButton(preset.name, `Ships from the ${preset.name} preset`);
            button.dataset.preset = preset.id;
            cleanups.push(onTap(button, () => show({ preset: preset.id })));
            return button;
          }),
        );
        show({});
      })
      .catch((err) => {
        if (alive) setStatus({ tone: 'bad', text: `Couldn't load the parts list: ${err.message}` });
      });

    cleanups.push(
      onTap(prevButton, () => kept.seed > 1 && show({ seed: kept.seed - 1 })),
      onTap(nextButton, () => show({ seed: kept.seed + 1 })),
      ...LOOKS.map((look, i) => onTap(lookButtons[i], () => show({ look: look.id }))),
      onTap(fitButton, () => fit && setCamera(fit)),
      onTap(openButton, openInBuilder),
      attachGestures(board, {
        longPress(x, y) {
          const at = kept.look === 'map' && tileAt(x, y);
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
      }, { ignore: 'button, .shp-card' }),
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
    const closeOnTouch = () => closeCard();
    el.addEventListener('pointerdown', closeOnTouch, true);

    const observer = new ResizeObserver(() => layout());
    observer.observe(board);
    cleanups.push(() => observer.disconnect());

    // Shows the preset, seed and look as changed: a new ship when the preset
    // or seed changes, and the view fitted to whatever is shown.
    function show(change) {
      if (!defs) return;
      const next = { ...kept, ...change };
      const remake = !made || next.preset !== kept.preset || next.seed !== kept.seed;
      kept = next;
      closeCard();
      for (const button of presets.children) button.setAttribute('aria-pressed', String(button.dataset.preset === kept.preset));
      LOOKS.forEach((look, i) => lookButtons[i].setAttribute('aria-pressed', String(look.id === kept.look)));
      seedChip.textContent = `Seed ${kept.seed}`;
      prevButton.disabled = kept.seed <= 1;
      if (remake) make();
      if (!made?.ok) return;
      if (kept.look === 'map') {
        mapBoard.setMap({ map, skin: skinFor('yard') });
      } else {
        shipBoard.scenes.setShip({ ship: made.ship, defs, frame: frameOf(), doors: openings(made.ship, defs), hull: made.hull, selected: null, lifted: null, flagged: new Set() });
        if (kept.look === 'hull') shipBoard.scenes.setHull({ ship: made.ship, defs, hull: made.hull, skin: skinFor('yard') });
      }
      setStatus({ tone: 'info', text: LOOKS.find((look) => look.id === kept.look).hint });
      refit();
    }

    // Generates the ship for the preset and seed, with what each look needs.
    function make() {
      const result = generateShip(defs, kept.preset, kept.seed);
      made = result.ok ? { ...result, hull: traceHull(result.ship, defs) } : result;
      map = result.ok ? mapFromShip(result.ship, defs, { wrecked: result.wrecked }) : null;
      if (shipBoard.frame !== frameOf()) shipBoard = { scenes: createBoard(frameOf()), frame: frameOf() };
      openButton.disabled = fitButton.disabled = !result.ok;
      if (!result.ok) {
        info.hidden = true;
        setStatus({ tone: 'bad', text: result.error });
        return;
      }
      const cells = result.ship.modules.flatMap((m) => placedCells(defs.modules.get(m.type), m));
      const span = (i) => Math.max(...cells.map((c) => c[i])) - Math.min(...cells.map((c) => c[i])) + 1;
      const ready = canLaunch(flightChecklist(result.ship, defs, result.crew));
      const wrecks = Object.keys(result.wrecked).length;
      // The hull's style is rolled with the ship (M23d), and its side's look
      // worn (M23f).
      const style = defs.hulls.get(result.ship.hull)?.name ?? result.ship.hull;
      const colors = `${defs.paints.get(result.ship.paint)?.name ?? result.ship.paint} and ${(defs.trims.get(result.ship.trim)?.name ?? result.ship.trim).toLowerCase()}`;
      const pieces = result.ship.styling?.length ?? 0;
      setText(info, {
        tone: ready ? 'good' : 'bad',
        text: `${result.ship.modules.length} parts · ${span(0)} × ${span(1)} cells · ${style} hull · ${colors}, ${pieces} styling piece${pieces === 1 ? '' : 's'} · crew ${result.crew}${wrecks ? ` · ${wrecks} wrecked` : ''} · ${ready ? 'flight check passes' : 'flight check fails'}`,
      });
      info.hidden = false;
    }

    function frameOf() {
      return defs.frames.get(defs.ships.get(kept.preset).frame);
    }

    // Copies the ship into a new builder slot, which opens; its wrecks go
    // with it to the Battle map and Fight sandboxes.
    function openInBuilder() {
      if (!made?.ok) return;
      if (game.getState().builds.slots.length >= MAX_SLOTS) {
        setStatus({ tone: 'bad', text: `The builder's ${MAX_SLOTS} ship slots are full. Delete one in its Saves tab first.` });
        return;
      }
      const name = `${defs.ships.get(kept.preset).name} ${kept.seed}`.slice(0, MAX_NAME);
      game.dispatch({ type: 'builds/add', slot: { name, ship: made.ship, log: logFor(made.ship) } });
      keepWrecks(made.ship, made.wrecked);
      setStatus({ tone: 'good', text: `Opened in the builder as "${name}". The Battle map and Fight sandboxes use it too.` });
    }

    // The tile under a finger at (x, y) on the map, as [x, y], or null.
    function tileAt(x, y) {
      if (!map || !camera) return null;
      const deck = unproject(camera, x, y);
      if (!deck) return null;
      const [tx, ty] = [Math.floor(deck[0]), Math.floor(deck[1])];
      return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height ? [tx, ty] : null;
    }

    // A card saying what is on a tile, on the half of the board away from
    // the finger.
    function openCard([x, y], fingerX) {
      const { title, lines: text } = tileText(map, x, y, defs);
      card.replaceChildren(node('h3', null, title), ...text.map((line) => node('p', null, line)));
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
      refit();
      dirty = true;
    }

    // Opens the view on what is shown, as large as fits between the buttons
    // along the top and the tools along the bottom.
    function refit() {
      if (!rect || !made?.ok) return;
      const view = kept.look === 'map' ? BATTLE_VIEW : BOARD_VIEW;
      const boxes = kept.look === 'map' ? battleBoxes(map) : null;
      box = boxes ? boxes.all : boardBox(frameOf(), made.hull, NO_MIN);
      const target = boxes ? boxes.fit : box;
      const below = Math.max(TOP, top.getBoundingClientRect().bottom - rect.y + 8);
      const clear = { x: rect.x, y: rect.y + below, w: rect.w, h: Math.max(48, rect.h - below - BOTTOM) };
      fit = fitOrbit({ ...view, pivot: middle(target) }, clear, target, MARGIN);
      limits = { min: fit.scale * MIN_ZOOM, max: fit.scale * MAX_ZOOM };
      setCamera(fit);
    }

    function setCamera(next) {
      camera = clampOrbit(next, rect, box, MARGIN);
      dirty = true;
    }

    return {
      resize() {
        layout();
        dirty = true;
      },
      // For the dev overlay: how the board's frames were drawn.
      frameStats: () => (kept.look === 'map' ? mapBoard.frameStats() : shipBoard.scenes?.frameStats()),
      draw(ctx, view) {
        if (!dirty) return;
        dirty = false;
        ctx.fillStyle = palette.space;
        ctx.fillRect(0, 0, view.width, view.height);
        if (!rect || !camera || !made?.ok) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        // A frame drawn while the camera moved is a rough one; once it has
        // been still for a moment, the board is drawn again in full.
        const rough = kept.look === 'map' ? mapBoard.draw(ctx, camera, rect) : shipBoard.scenes.draw(ctx, camera, rect, kept.look);
        if (rough) {
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

function textButton(text, title) {
  const button = node('button', 'btn shp-button', text);
  button.type = 'button';
  button.setAttribute('aria-label', title);
  return button;
}

function iconButton(icon, title) {
  const button = node('button', 'btn shp-button shp-step');
  button.type = 'button';
  button.innerHTML = icon;
  button.setAttribute('aria-label', title);
  return button;
}

function toolButton(icon, label, title) {
  const button = node('button', 'btn bat-tool');
  button.type = 'button';
  button.innerHTML = icon;
  button.append(node('span', null, label));
  button.setAttribute('aria-label', title);
  return button;
}
