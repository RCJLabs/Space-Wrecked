// How big the canvas's words are drawn (M42, Settings' Text size): the
// labels a renderer draws in px multiply by this. syncLook (src/ui/look.js)
// sets it from the settings; it is 1 under Node.
let scale = 1;

export const textScale = () => scale;

export function setTextScale(k) {
  scale = k;
}
