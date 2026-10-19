// How the game looks for its player (M42): the colors (standard or
// colorblind-safe, src/render/palette.js) and the text size. Sets the
// palette, its CSS custom properties, <html style="--ts"> that every
// font-size in style.css multiplies by (and <html data-text>, for the rules
// bigger text needs), and the canvas's text scale; now,
// and again whenever either setting changes. A screen mounted after that
// draws in them.
import { applyCssVars, usePalette } from '../render/palette.js';
import { setTextScale } from '../render/textScale.js';

export function syncLook(store) {
  const apply = ({ colors, textSize }) => {
    usePalette(colors);
    applyCssVars();
    const root = document.documentElement;
    root.dataset.colors = colors;
    root.dataset.text = String(textSize);
    root.style.setProperty('--ts', String(textSize / 100));
    setTextScale(textSize / 100);
  };
  apply(store.getState().settings);
  store.subscribe((state, prev) => {
    if (state.settings.colors !== prev.settings.colors || state.settings.textSize !== prev.settings.textSize) apply(state.settings);
  });
}
