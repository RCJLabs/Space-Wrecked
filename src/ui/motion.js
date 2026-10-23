// Reduced motion: the motion setting (src/sim/settings.js), or with 'auto',
// what the phone asks for. The title's stars and the lift-off ask
// motionReduced; CSS reads <html data-motion>, which syncMotion keeps in
// step.
const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function motionReduced(settings) {
  if (settings.motion === 'reduce') return true;
  if (settings.motion === 'full') return false;
  return Boolean(query?.matches);
}

// Sets <html data-motion="reduce" or "full"> now, and again whenever the
// setting or the phone's preference changes.
export function syncMotion(store) {
  const apply = () => {
    document.documentElement.dataset.motion = motionReduced(store.getState().settings) ? 'reduce' : 'full';
  };
  apply();
  store.subscribe((state, prev) => state.settings.motion !== prev.settings.motion && apply());
  query?.addEventListener('change', apply);
}

// The playback's speed (M47): how many times as fast as drawn a fight's and
// an approach's playback runs, from <html data-speed> (look.js).
export function playbackSpeed() {
  const speed = Number(document.documentElement.dataset.speed);
  return speed > 0 ? speed / 100 : 1;
}
