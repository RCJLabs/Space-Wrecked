// FPS and frame-time overlay for ?dev=1. Updated twice a second by the loop.
// A screen with a 3D board adds a line: how its frames were drawn while the
// camera moved (full or rough, frameBudget.js) and what a full frame costs.
import { BUDGET_MS } from '../../render/frameBudget.js';

export function createFpsOverlay(root) {
  const el = document.createElement('div');
  el.className = 'fps';
  el.textContent = '-- fps';
  root.append(el);

  return {
    // frames: { full, rough, cost } or undefined.
    update(stats, view, frames) {
      const ratio = view.width / view.height;
      el.textContent =
        `${stats.fps.toFixed(0)} fps  ${stats.frameMs.toFixed(1)} ms  worst ${stats.worstMs.toFixed(0)} ms\n` +
        `draw ${stats.drawMs.toFixed(2)} ms  cap ${stats.cap}  screen ${stats.refreshHz.toFixed(0)} Hz\n` +
        `${Math.round(view.width)}×${Math.round(view.height)} (${ratio.toFixed(2)}:1) @${view.dpr}x` +
        (frames ? `\nmoving ${frames.full} full ${frames.rough} rough  full ${frames.cost.toFixed(1)}/${BUDGET_MS} ms` : '');
    },
  };
}
