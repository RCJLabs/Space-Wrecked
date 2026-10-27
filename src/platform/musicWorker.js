// The music's worker (M60): makes a bed's loop (src/core/music.js) off the
// page's thread, so a bed starting never costs the game a frame. It is sent
// a bed from data/music.json and sends back { id, samples }, the samples
// handed over, not copied. ZzFX makes its AudioContext as it loads, which a
// worker has none of; nothing plays here, so a stand-in does.
import { renderBed } from '../core/music.js';
import { zzfxArgs } from '../core/soundParams.js';

globalThis.AudioContext ??= class {};
// Loaded behind the stand-in; a bed asked for meanwhile waits for it.
const zzfx = import('./zzfx.js').then(({ ZZFX }) => ZZFX);

addEventListener('message', async ({ data: bed }) => {
  const ZZFX = await zzfx;
  const samples = renderBed(bed, (params) => ZZFX.buildSamples(...zzfxArgs(params)), ZZFX.sampleRate);
  postMessage({ id: bed.id, samples, sampleRate: ZZFX.sampleRate }, [samples.buffer]);
});
