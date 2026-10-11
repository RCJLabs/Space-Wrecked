// Registers sw.js and reports when an update is waiting. It never skips waiting
// on its own: the player taps the prompt, so a running game never mixes old
// and new files.

export function registerServiceWorker({ onUpdateReady }) {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  // Reload once the new worker takes over. Only pages that already had a
  // worker reload; a first visit has nothing old to replace.
  const hadController = Boolean(sw.controller);
  let reloading = false;
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  sw.register('./sw.js')
    .then((reg) => {
      // A worker that is "installed" while another controls the page is a
      // waiting update. One may already be waiting or installing by the time
      // registration resolves, so check those as well as future updates.
      const offer = (worker) => onUpdateReady(() => worker.postMessage({ type: 'SKIP_WAITING' }));
      const track = (worker) => {
        if (!worker) return;
        const check = () => worker.state === 'installed' && sw.controller && offer(worker);
        check();
        worker.addEventListener('statechange', check);
      };
      track(reg.waiting);
      track(reg.installing);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // An installed app can stay open for days, so check for a new sw.js
      // whenever it comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
      });
    })
    .catch((err) => console.warn('Service worker registration failed:', err));
}
