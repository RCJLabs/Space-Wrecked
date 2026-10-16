// Loads the content files in data/ once, through the service worker's cache
// when it is controlling the page, and indexes them for the simulation.
import { CONTENT_FILES, indexDefs } from '../sim/defs.js';

// The ?dev=1 menu's switches (src/ui/dev/cheats.js), which the content
// carries to the simulation as rules.dev: { god } (src/sim/god.js). Off
// unless the dev menu turns one on; never saved.
export const devSwitches = { god: false };

let pending = null;

export function loadContent() {
  pending ??= Promise.all(CONTENT_FILES.map(fetchJson)).then((files) => ({
    ...indexDefs(Object.fromEntries(CONTENT_FILES.map((name, i) => [name, files[i]]))),
    dev: devSwitches,
  }));
  // A failed load can be retried by mounting the screen again.
  pending.catch(() => (pending = null));
  return pending;
}

async function fetchJson(name) {
  const response = await fetch(`./data/${name}.json`);
  if (!response.ok) throw new Error(`data/${name}.json: HTTP ${response.status}`);
  return response.json();
}
