// Best-effort landscape lock. Chrome only allows it in fullscreen, which the
// installed app is (display: fullscreen in the manifest). In a normal tab it
// rejects, and the CSS rotate overlay covers that case. Failures are ignored.

export function lockLandscape() {
  try {
    const pending = screen.orientation?.lock?.('landscape');
    pending?.catch?.(() => {});
  } catch {
    // Not supported here.
  }
}
