// requestAnimationFrame loop with a frame cap (60, or 30 for battery).
//
// Frames are skipped by accumulated time rather than by counting, so a cap
// holds on 60, 90 and 120 Hz screens (the Fold 6 runs at up to 120 Hz).

const MAX_DELTA = 250;
const STATS_WINDOW = 500;

export function createLoop({ frame, getCap, onStats }) {
  let rafId = 0;
  let prev = 0;
  let acc = 0;
  let period = 1000 / 60; // estimated display frame period
  let windowStart = 0;
  let drawn = 0;
  let drawCost = 0;
  let worstGap = 0;
  let lastDrawAt = 0;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const first = prev === 0;
    const gap = first ? 0 : now - prev;
    prev = now;
    if (gap > MAX_DELTA) windowStart = 0; // back from the background: restart the stats
    const delta = Math.min(gap, MAX_DELTA);
    if (delta > 0 && delta < 100) period += (delta - period) * 0.1;

    const interval = 1000 / getCap();
    acc += delta;
    if (!first && acc + period / 2 < interval) return;
    acc = Math.min(Math.max(acc - interval, 0), interval);

    const t0 = performance.now();
    frame(now);
    const cost = performance.now() - t0;

    // Stats count the frames drawn after the window opens.
    if (!windowStart) {
      windowStart = now;
      lastDrawAt = now;
      return;
    }
    worstGap = Math.max(worstGap, now - lastDrawAt);
    lastDrawAt = now;
    drawn += 1;
    drawCost += cost;
    if (onStats && now - windowStart >= STATS_WINDOW) {
      onStats({
        fps: (drawn * 1000) / (now - windowStart),
        frameMs: (now - windowStart) / drawn,
        worstMs: worstGap,
        drawMs: drawCost / drawn,
        refreshHz: 1000 / period,
        cap: getCap(),
      });
      windowStart = now;
      drawn = 0;
      drawCost = 0;
      worstGap = 0;
    }
  }

  return {
    start() {
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      prev = 0;
      windowStart = 0;
    },
  };
}
