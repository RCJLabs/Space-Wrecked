// Whether a frame drawn while the camera moves can be a full one, as sharp
// as a still frame. A full frame takes as long to draw moving as still, so
// a phone that draws one within the budget gets full frames all the time
// and the board never blurs. A slower phone gets rough frames while the
// camera moves (fewer pixels, none of the costly extras), which keep it
// smooth, and a full frame once it stops. The cost is the middle of the
// last three full frames (the quicker of two), so one slow frame (a
// garbage collection, or a screen's first) doesn't blur a whole gesture.
//   budget = createFrameBudget()
//   budget.full(moving)    true if this frame should be drawn in full; call
//                          it once a frame
//   budget.measure(paint)  calls paint(), timing it as a full frame
//   budget.stats()         { full, rough, cost } for the dev overlay: the
//                          moving frames of each kind since the last call,
//                          and the cost in ms
export const BUDGET_MS = 10;
const KEEP = 3;

export function createFrameBudget({ ms = BUDGET_MS, now = () => performance.now() } = {}) {
  const recent = [];
  const counts = { full: 0, rough: 0 };
  return {
    full(moving) {
      const full = !moving || cost() <= ms;
      if (moving) counts[full ? 'full' : 'rough']++;
      return full;
    },
    measure(paint) {
      const start = now();
      paint();
      recent.push(now() - start);
      if (recent.length > KEEP) recent.shift();
    },
    stats() {
      const out = { ...counts, cost: cost() };
      counts.full = counts.rough = 0;
      return out;
    },
  };

  // 0 until two full frames are timed, so moving frames start full: the
  // first frame on a screen pays for setting up and is no guide.
  function cost() {
    if (recent.length < 2) return 0;
    const sorted = [...recent].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)];
  }
}
