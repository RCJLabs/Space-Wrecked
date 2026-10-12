// The launch: the end of act 1 (src/sim/launch.js). The ship's engines
// light, it climbs off the pad and flies away (render/liftOff.js), while
// the background's words come up, then the pursuer's if a raid was at the
// door. Skip goes to the end; at the end, Continue goes on to where the
// campaign is now: the stub that stands in for act 2 (stub.js). The
// campaign was saved as it launched, so quitting part way reopens there
// too. With reduced motion nothing moves: the ship stands with its engines
// lit, and the words are all there.
import { loadContent } from '../../platform/content.js';
import { traceHull } from '../../render/hull.js';
import { CLIMB, END, flameGlows, IGNITE, liftOffAt, liftOffCamera, liftOffScene } from '../../render/liftOff.js';
import { fitOrbit } from '../../render/orbit.js';
import { paintSolid } from '../../render/painter.js';
import { palette, skinFor } from '../../render/palette.js';
import { BOARD_VIEW, boardBox, drawSpace } from '../../render/shipView.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { launchText } from './launchText.js';

const MARGIN = 10; // pixels around the ship at rest
const NO_MIN = [0, 0]; // the view fits the ship alone
// The ship at rest takes up to this much of its place across, and of its
// height: room for the flames behind it, and for the climb.
const AT_REST = [0.6, 0.85];
// The ship at rest with its engines lit: the one moment reduced motion shows.
const STILL = { flame: 1, shake: 0, rise: 0, away: 0, gone: false, over: true };

export const launchScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'lnc');
    const head = node('header', 'lnc-head');
    const from = node('p', 'lnc-from');
    head.append(node('h1', null, 'Lift-off'), from);
    const shipArea = node('div', 'lnc-ship');
    const words = node('div', 'lnc-words');
    const line = node('p', 'lnc-line');
    const escaped = node('p', 'lnc-escaped');
    escaped.hidden = true;
    words.append(line, escaped);
    const go = toolButton('lnc-go', icons.skip, 'Skip');
    el.append(head, shipArea, words, go);
    el.dataset.shown = 'none';
    root.append(el);

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let alive = true;
    let scene = null; // the ship lifting off (liftOff.js)
    let box = null;
    let stage = null; // the ship's place on screen
    let base = null; // the camera on the ship at rest in the middle of it
    let start = null; // when the sequence began, in the loop's time
    let skip = false;
    let over = false;
    let dirty = true; // a frame to draw though nothing moves
    const cleanups = [
      onTap(go, () => {
        if (over) game.dispatch({ type: 'campaign/continue' });
        else if (!scene) finish(); // nothing to watch yet
        else skip = true;
      }),
    ];
    const observer = new ResizeObserver(() => layout());
    observer.observe(shipArea);
    cleanups.push(() => observer.disconnect());

    loadContent()
      .then((defs) => {
        const { campaign } = game.getState();
        if (!alive || !campaign) return;
        const text = launchText(campaign, defs);
        setText(from, text.from);
        setText(line, text.line);
        setText(escaped, text.escaped ?? '');
        escaped.hidden = !text.escaped;
        go.setAttribute('aria-label', 'Skip the launch');
        const { ship } = campaign;
        const frame = defs.frames.get(ship.frame);
        if (!frame) {
          finish();
          return;
        }
        const hull = traceHull(ship, defs);
        scene = liftOffScene({ ship, defs, hull, skin: skinFor('yard') });
        box = boardBox(frame, hull, NO_MIN);
        layout();
        if (still) finish();
      })
      .catch((err) => {
        if (!alive) return;
        setText(line, `Couldn't load the game data: ${err.message}`);
        finish();
      });

    function layout() {
      dirty = true;
      if (!alive || !box) return;
      const r = shipArea.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) return; // hidden, e.g. behind the rotate prompt
      stage = { x: r.left, y: r.top, w: r.width, h: r.height };
      const [w, h] = [r.width * AT_REST[0], r.height * AT_REST[1]];
      const rest = { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
      base = fitOrbit({ ...BOARD_VIEW, pivot: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] }, rest, box, MARGIN);
    }

    // The words as far as the sequence has come: the background's as the
    // ship climbs, the pursuer's as it flies off.
    function reveal(t) {
      const shown = t >= CLIMB ? 'all' : t >= IGNITE ? 'line' : 'none';
      if (el.dataset.shown !== shown) el.dataset.shown = shown;
    }

    // The end: every word up, and Continue in place of Skip.
    function finish() {
      if (over) return;
      over = true;
      dirty = true;
      el.dataset.shown = 'all';
      go.dataset.done = 'true';
      go.querySelector('svg').outerHTML = icons.next;
      setText(go.querySelector('span'), 'Continue');
      go.setAttribute('aria-label', 'Continue');
    }

    return {
      resize() {
        layout();
      },
      // Every frame while the ship lifts off; once it is over, only when
      // the screen changes.
      draw(ctx, view, timeMs) {
        if (over && !dirty) return;
        dirty = false;
        const all = { x: 0, y: 0, w: view.width, h: view.height };
        if (!scene || !base) {
          ctx.fillStyle = palette.space;
          ctx.fillRect(0, 0, view.width, view.height);
          dirty = true;
          return;
        }
        if (start === null || skip) {
          start = timeMs - (skip ? END * 1000 : 0);
          skip = false;
        }
        const t = (timeMs - start) / 1000;
        const moment = still ? STILL : liftOffAt(over ? END : t);
        drawSpace(ctx, all, scene.skin.space);
        if (!moment.gone) {
          const cam = still ? base : liftOffCamera(base, stage, box, moment, t);
          paintSolid(ctx, scene.faces, [...scene.glows, ...flameGlows(scene, moment, t)], cam);
        }
        if (!over) {
          reveal(t);
          if (moment.over) finish();
        }
      },
      unmount() {
        alive = false;
        for (const cleanup of cleanups) cleanup();
        el.remove();
      },
    };
  },
};
