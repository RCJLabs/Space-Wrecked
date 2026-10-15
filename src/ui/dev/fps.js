// The frame rate for ?dev=1, updated twice a second by the loop. The DEV
// button shows it at a glance, in the corner every screen keeps clear for
// that button, so it covers nothing. The full readout heads the dev menu:
// frame times, the cap, the screen's rate and size, and for a screen with
// a 3D board how its frames were drawn while the camera moved (full or
// rough, frameBudget.js) and what a full frame costs.
import { BUDGET_MS } from '../../render/frameBudget.js';

// menu: the dev menu's { toggle, readout } (menu.js createDevMenu).
export function createFpsReadout(menu) {
  const glance = document.createElement('small');
  glance.className = 'dev-fps';
  glance.textContent = '-- fps';
  menu.toggle.append(glance);
  const el = document.createElement('pre');
  el.className = 'fps';
  el.textContent = '-- fps';
  menu.readout.append(el);

  return {
    // frames: { full, rough, cost } or undefined.
    update(stats, view, frames) {
      const ratio = view.width / view.height;
      glance.textContent = `${stats.fps.toFixed(0)} fps`;
      el.textContent =
        `${stats.fps.toFixed(0)} fps  ${stats.frameMs.toFixed(1)} ms  worst ${stats.worstMs.toFixed(0)} ms\n` +
        `draw ${stats.drawMs.toFixed(2)} ms  cap ${stats.cap}  screen ${stats.refreshHz.toFixed(0)} Hz\n` +
        `${Math.round(view.width)}×${Math.round(view.height)} (${ratio.toFixed(2)}:1) @${view.dpr}x` +
        (frames ? `\nmoving ${frames.full} full ${frames.rough} rough  full ${frames.cost.toFixed(1)}/${BUDGET_MS} ms` : '');
    },
  };
}
