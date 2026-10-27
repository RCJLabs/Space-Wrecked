// The screens' cross-fade (M59): as one screen gives way to the next, a still
// copy of the old one (the board as drawn and the screen's panels) lies over
// the new and fades out in FADE_MS. It takes no touches and a screen reader
// never finds it. None with reduced motion: main.js doesn't call it then.
export const FADE_MS = 160;

// A <canvas> holding what `from` shows now.
function still(from) {
  const copy = document.createElement('canvas');
  copy.width = from.width;
  copy.height = from.height;
  if (from.width && from.height) copy.getContext('2d').drawImage(from, 0, 0);
  return copy;
}

// Lays the copies over board and screenRoot: call it before the old screen
// unmounts.
export function crossFade(board, screenRoot) {
  const sky = still(board);
  sky.className = 'fade-ghost fade-board';
  const panels = screenRoot.cloneNode(true);
  panels.removeAttribute('id');
  panels.className = 'fade-ghost fade-screen';
  const drawn = screenRoot.querySelectorAll('canvas');
  panels.querySelectorAll('canvas').forEach((copy, i) => copy.replaceWith(Object.assign(still(drawn[i]), { className: drawn[i].className })));
  for (const ghost of [sky, panels]) {
    ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
  }
  board.after(sky);
  screenRoot.after(panels);
  for (const ghost of [sky, panels]) {
    const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
    fade.finished.finally(() => ghost.remove());
  }
}
