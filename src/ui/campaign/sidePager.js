// The side column's pager (M57): on a folded screen the column shows one
// panel at a time, with ‹ and › either side of its name to step between
// them, where a single column of every panel needed a scroll (the
// hangar's, the chart's, the colony's). On a taller screen the pager is
// hidden and every panel shows, as before (style.css, .hgr-pager).
// A panel is the column's child: its name is its heading's first text,
// and a hidden or empty one is passed over. The pager watches the column
// and steps past a panel that goes as the screen draws again. With
// pages (a selector), only the children it matches are panels, and with
// fewer than two of them every child shows and the pager hides.
import { node } from '../fight/panels.js';
import { onTap } from '../gestures.js';

export function createSidePager(side, { pages = null } = {}) {
  const bar = node('nav', 'hgr-pager');
  const back = node('button', 'btn hgr-page-back', '‹');
  const name = node('p', 'hgr-page-name', '');
  const on = node('button', 'btn hgr-page-on', '›');
  back.type = on.type = 'button';
  back.setAttribute('aria-label', 'Panel before');
  on.setAttribute('aria-label', 'Panel after');
  // The panel's own heading names it; the bar says where it is among them.
  bar.append(back, name, on);
  side.prepend(bar);
  side.classList.add('hgr-paged');
  let at = 0;

  const panels = () => [...side.children].filter((el) => el !== bar && !el.hidden && el.childElementCount > 0 && (!pages || el.matches(pages)));
  const title = (el) => ((el.querySelector('h2 span') ?? el.querySelector('h2'))?.textContent ?? '').trim();

  function refresh() {
    const shown = panels();
    side.dataset.pages = String(shown.length > 1);
    if (!shown.length) return;
    at = Math.min(Math.max(at, 0), shown.length - 1);
    for (const el of [...side.children]) el.classList.toggle('hgr-page-shown', el === shown[at]);
    // Where it is among them, and the name of the one › goes to, so what
    // lies past the arrow can be read before it is tapped.
    const next = shown[at + 1];
    name.replaceChildren(node('span', null, `${at + 1} / ${shown.length}`), node('small', null, next ? `then ${title(next)}` : 'the last'));
    name.setAttribute('aria-label', `${title(shown[at])}, ${at + 1} of ${shown.length}`);
    back.disabled = at === 0;
    on.disabled = at === shown.length - 1;
  }

  const step = (by) => () => {
    at += by;
    refresh();
  };
  // A screen that draws the column afresh (replaceChildren) takes the bar
  // with it: put it back at the top.
  const watch = new MutationObserver((changes) => {
    if (!changes.some((change) => !bar.contains(change.target))) return;
    if (side.firstElementChild !== bar) side.prepend(bar);
    refresh();
  });
  watch.observe(side, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const cleanups = [onTap(back, step(-1)), onTap(on, step(1)), () => watch.disconnect()];
  refresh();
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
