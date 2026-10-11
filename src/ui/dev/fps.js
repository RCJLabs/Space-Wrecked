// FPS and frame-time overlay for ?dev=1. Updated twice a second by the loop.

export function createFpsOverlay(root) {
  const el = document.createElement('div');
  el.className = 'fps';
  el.textContent = '-- fps';
  root.append(el);

  return {
    update(stats, view) {
      const ratio = view.width / view.height;
      el.textContent =
        `${stats.fps.toFixed(0)} fps  ${stats.frameMs.toFixed(1)} ms  worst ${stats.worstMs.toFixed(0)} ms\n` +
        `draw ${stats.drawMs.toFixed(2)} ms  cap ${stats.cap}  screen ${stats.refreshHz.toFixed(0)} Hz\n` +
        `${Math.round(view.width)}×${Math.round(view.height)} (${ratio.toFixed(2)}:1) @${view.dpr}x`;
    },
  };
}
