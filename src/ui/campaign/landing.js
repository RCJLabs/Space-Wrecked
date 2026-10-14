// The landing: the end of act 2 (src/sim/settle.js, M25). The launch
// (launch.js) played backwards: the ship comes in stern first, braking on
// its engines, sets down on the world settled and its engines die away
// (render/liftOff.js landingAt), while the world's name and its kind's words
// for the landing come up. Skip goes to the end; at the end, Continue goes
// on to where the campaign is now: act 3's home, the colony (colony.js).
// The campaign was saved as it settled, so quitting part way
// reopens there too. With reduced motion (the motion setting, ../motion.js)
// nothing moves: the ship stands down, and the words are all there.
import { loadContent } from '../../platform/content.js';
import { traceHull } from '../../render/hull.js';
import { AWAY, CLIMB, END, flameGlows, landingAt, liftOffCamera, liftOffScene } from '../../render/liftOff.js';
import { fitOrbit } from '../../render/orbit.js';
import { paintSolid } from '../../render/painter.js';
import { palette, skinFor } from '../../render/palette.js';
import { BOARD_VIEW, boardBox, drawSpace } from '../../render/shipView.js';
import { node, setText, toolButton } from '../fight/panels.js';
import { onTap } from '../gestures.js';
import { icons } from '../icons.js';
import { motionReduced } from '../motion.js';
import { landingText } from './launchText.js';

const MARGIN = 10; // pixels around the ship at rest
const NO_MIN = [0, 0]; // the view fits the ship alone
// The ship at rest takes up to this much of its place across, and of its
// height, as at the launch.
const AT_REST = [0.6, 0.85];

export const landingScreen = {
  mount(root, { store: game }) {
    const el = node('section', 'lnc');
    const head = node('header', 'lnc-head');
    const where = node('p', 'lnc-from');
    head.append(node('h1', null, 'Landing'), where);
    const shipArea = node('div', 'lnc-ship');
    const words = node('div', 'lnc-words');
    const line = node('p', 'lnc-line');
    words.append(line);
    const go = toolButton('lnc-go', icons.skip, 'Skip');
    el.append(head, shipArea, words, go);
    el.dataset.shown = 'none';
    root.append(el);

    const still = motionReduced(game.getState().settings);
    let alive = true;
    let scene = null; // the ship coming down (liftOff.js)
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
        const text = landingText(campaign, defs);
        setText(where, text.world);
        setText(line, text.line);
        go.setAttribute('aria-label', 'Skip the landing');
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

    // The words as far as the sequence has come: the landing's as the ship
    // comes in sight, all of them once it begins to set down.
    function reveal(t) {
      const shown = t >= END - CLIMB ? 'all' : t >= END - AWAY ? 'line' : 'none';
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
      // Every frame while the ship comes down; once it is over, only when
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
        // Down, and still: the moment reduced motion shows, and the end.
        const moment = landingAt(still || over ? END : t);
        drawSpace(ctx, all, scene.skin.space);
        if (!moment.gone) {
          const cam = still || over ? base : liftOffCamera(base, stage, box, moment, t);
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
