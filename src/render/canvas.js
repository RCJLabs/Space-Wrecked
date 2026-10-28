// Full-screen canvas sized to its CSS box, with devicePixelRatio capped at 2,
// or at 1 on Low quality (M62). Drawing code works in CSS pixels; the frame
// sets the dpr transform.

export const MAX_DPR = 2;

// The pixels a CSS pixel is drawn with: the device's, at most 2, at most 1
// on Low quality.
export function pixelRatio(device, quality = 'high') {
  return Math.min(device || 1, quality === 'low' ? 1 : MAX_DPR);
}

// getQuality: the quality the canvas is drawn at ('high' or 'low').
export function createView(canvas, onResize, getQuality = () => 'high') {
  const view = {
    canvas,
    ctx: canvas.getContext('2d', { alpha: false }),
    width: 0,
    height: 0,
    dpr: 1,
  };

  function measure() {
    const rect = canvas.getBoundingClientRect();
    const dpr = pixelRatio(window.devicePixelRatio, getQuality());
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (width === canvas.width && height === canvas.height && dpr === view.dpr) return;
    canvas.width = width;
    canvas.height = height;
    view.width = rect.width;
    view.height = rect.height;
    view.dpr = dpr;
    onResize?.(view);
  }

  // Folding or unfolding the phone resizes the viewport and can change the
  // pixel ratio, so watch both.
  new ResizeObserver(measure).observe(canvas);
  window.addEventListener('resize', measure);
  // A quality changed: measured again at once (M62).
  view.remeasure = measure;
  measure();
  return view;
}
