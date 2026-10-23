// Vibration (M47): the phone buzzes through navigator.vibrate, where it has
// one, while the setting is on (<html data-vibration="on">, src/ui/look.js)
// and only after the player's first tap, as the sound starts (audio.js).
// A pattern is ms on, or [on, off, on, ...] (src/ui/vibrations.js).
let woken = false;

// Once, at boot: waits for the first tap.
export function startHaptics() {
  addEventListener('pointerdown', () => (woken = true), { capture: true, once: true });
}

export function buzz(pattern) {
  if (!woken || !pattern || document.documentElement.dataset.vibration !== 'on') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // A phone that refuses is a phone that doesn't vibrate.
  }
}
