// Boot: load the save, build the store, mount the screen, start the loop.
// State flows one way: input -> action -> reducer (src/sim/) -> state -> render.
import { config } from './config.js';
import { makeSave, parseSave } from './core/save.js';
import { createStore } from './core/store.js';
import { lockLandscape } from './platform/orientation.js';
import { registerServiceWorker } from './platform/serviceWorker.js';
import * as storage from './platform/storage.js';
import { createView } from './render/canvas.js';
import { createLoop } from './render/loop.js';
import { applyCssVars } from './render/palette.js';
import { initialState, reduce, saveData } from './sim/root.js';
import { createDevMenu } from './ui/dev/menu.js';
import { createFpsOverlay } from './ui/dev/fps.js';
import { syncMotion } from './ui/motion.js';
import { screenFor } from './ui/screens.js';
import { startTips } from './ui/tips.js';
import { showUpdatePrompt } from './ui/updatePrompt.js';

document.title = config.title;
applyCssVars();

const ui = document.getElementById('ui');
const screenRoot = document.getElementById('screen');

// Store and save. A new game gets a random seed; after that the RNG state
// lives in the save, so reloading never rerolls.
const store = createStore(reduce, initialState(crypto.getRandomValues(new Uint32Array(1))[0]));
const bootNote = loadSavedGame();
let saved = saveData(store.getState());
persist(saved); // the first launch writes its seed right away
store.subscribe((state) => {
  const data = saveData(state);
  if (Object.keys(data).some((key) => data[key] !== saved[key])) {
    saved = data;
    persist(data);
  }
});
const persistence = storage.requestPersistence();
syncMotion(store);

// Screens and the render loop.
let activeId = null;
let active = null;
const view = createView(document.getElementById('board'), (v) => active?.resize?.(v));
syncScreen(store.getState());
store.subscribe(syncScreen);
startTips(ui, store);

// ?dev=1 turns dev mode on and ?dev=0 turns it off. It sticks, so the
// installed app (which always opens at start_url) can use it too.
const params = new URLSearchParams(location.search);
if (params.has('dev')) storage.writeFlag('dev', params.get('dev') !== '0');
const dev = storage.readFlag('dev');
// Panels that sit where the DEV button goes make room for it.
if (dev) ui.dataset.dev = '';
const fps = dev ? createFpsOverlay(ui) : null;
if (dev) createDevMenu(ui, { store, getStatus });

const loop = createLoop({
  getCap: () => store.getState().settings.fpsCap,
  frame(timeMs) {
    view.ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    active.draw(view.ctx, view, timeMs);
  },
  onStats: fps ? (stats) => fps.update(stats, view, active.frameStats?.()) : undefined,
});
loop.start();

// Platform.
lockLandscape();
addEventListener('pointerdown', lockLandscape, { once: true });
addEventListener('load', () => {
  registerServiceWorker({ onUpdateReady: (apply) => showUpdatePrompt(ui, apply) });
});

function loadSavedGame() {
  const raw = storage.readSave();
  if (raw === null) return null;
  const result = parseSave(raw);
  if (result.ok) {
    store.dispatch({ type: 'save/restore', data: result.save.data });
    return null;
  }
  // Keep the broken save before a fresh one replaces it.
  const backupKey = storage.backupBrokenSave(raw);
  const note = `Save not loaded: ${result.error} A copy is kept in localStorage under "${backupKey}".`;
  console.warn(note);
  return note;
}

function persist(data) {
  if (!storage.writeSave(JSON.stringify(makeSave(data)))) console.warn('Could not write the save: storage is unavailable.');
}

function syncScreen(state) {
  if (state.screen === activeId) return;
  active?.unmount();
  activeId = state.screen;
  ui.dataset.screen = activeId; // where the dev overlay sits depends on the screen
  active = screenFor(activeId).mount(screenRoot, { store });
  active.resize?.(view);
}

async function getStatus() {
  const lines = [];
  const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  lines.push(`Running as: ${installed ? 'installed app' : 'browser tab'}`);
  lines.push(`Service worker: ${navigator.serviceWorker?.controller ? 'controlling this page' : 'not controlling yet'}`);
  try {
    const names = (await caches.keys()).filter((name) => name.startsWith(`${config.appId}-`));
    lines.push(`Cache: ${names.join(', ') || 'none'}`);
  } catch {
    lines.push('Cache: unavailable');
  }
  const persisted = await persistence;
  lines.push(`Persistent storage: ${persisted === null ? 'unsupported' : persisted ? 'granted' : 'not granted'}`);
  lines.push(`Orientation: ${screen.orientation?.type ?? 'unknown'}`);
  if (bootNote) lines.push(bootNote);
  return lines;
}
