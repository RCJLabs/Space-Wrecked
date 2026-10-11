// Placeholder title screen: the title over a seeded starfield.
import { config } from '../config.js';
import { seedFrom } from '../core/rng.js';
import { drawStars, makeStarfield, paintBackdrop } from '../render/starfield.js';

// A fixed seed, so the title sky is the same on every launch.
const field = makeStarfield(seedFrom('title'));

export const titleScreen = {
  mount(root) {
    const el = document.createElement('section');
    el.className = 'title';
    const heading = document.createElement('h1');
    heading.textContent = config.title;
    const tag = document.createElement('p');
    tag.className = 'tag';
    tag.textContent = 'Scaffold build. Nothing to play yet.';
    el.append(heading, tag);
    root.append(el);

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let backdrop = null;
    return {
      resize(view) {
        backdrop = paintBackdrop(field, view);
      },
      draw(ctx, view, timeMs) {
        backdrop ??= paintBackdrop(field, view);
        ctx.drawImage(backdrop, 0, 0, view.width, view.height);
        drawStars(ctx, field, view, still.matches ? 0 : timeMs);
      },
      unmount() {
        el.remove();
      },
    };
  },
};
