// How the game looks for its player (M42): the colors (standard or
// colorblind-safe, src/render/palette.js) and the text size; and from M45
// fog of war, <html data-fog="on" or "off">, which the fight reads. Sets the
// palette, its CSS custom properties, <html style="--ts"> that every
// font-size in style.css multiplies by (and <html data-text>, for the rules
// bigger text needs), and the canvas's text scale; now,
// and again whenever either setting changes. A screen mounted after that
// draws in them. From M47 the controls too: <html data-hand> (right or left,
// which the CSS mirrors the columns by), data-confirm (taps or hold, which
// src/ui/confirm.js reads), data-speed (the playback's, in percent) and
// data-vibration (on or off, which src/platform/haptics.js reads).
import { applyCssVars, usePalette } from '../render/palette.js';
import { setTextScale } from '../render/textScale.js';

const KEYS = ['colors', 'textSize', 'fog', 'hand', 'confirm', 'speed', 'vibration'];

export function syncLook(store) {
  const apply = ({ colors, textSize, fog, hand, confirm, speed, vibration }) => {
    usePalette(colors);
    applyCssVars();
    const root = document.documentElement;
    root.dataset.colors = colors;
    root.dataset.text = String(textSize);
    root.dataset.fog = fog ? 'on' : 'off';
    root.dataset.hand = hand;
    root.dataset.confirm = confirm;
    root.dataset.speed = String(speed);
    root.dataset.vibration = vibration ? 'on' : 'off';
    root.style.setProperty('--ts', String(textSize / 100));
    setTextScale(textSize / 100);
  };
  apply(store.getState().settings);
  store.subscribe((state, prev) => {
    if (KEYS.some((key) => state.settings[key] !== prev.settings[key])) apply(state.settings);
  });
}
