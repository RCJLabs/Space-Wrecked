// The screens' cross-fade (M59): as one screen gives way to the next, a still
// copy of the board as the old one drew it lies over the new board and fades
// out in FADE_MS, while the new screen's panels fade in. The old panels are
// not copied: a copy's buttons would be found by anything that looks for a
// screen's buttons (the tips, a screen reader, the browser checks). The copy
// takes no touches. None with reduced motion: main.js doesn't call it then.
export const FADE_MS = 160;

// Lays the copy over board and fades screenRoot in: call it before the old
// screen unmounts.
export function crossFade(board, screenRoot) {
  if (board.width && board.height) {
    const sky = document.createElement('canvas');
    sky.width = board.width;
    sky.height = board.height;
    sky.getContext('2d').drawImage(board, 0, 0);
    sky.className = 'fade-board';
    sky.setAttribute('aria-hidden', 'true');
    board.after(sky);
    const fade = sky.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
    fade.finished.finally(() => sky.remove());
  }
  screenRoot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-in' });
}
