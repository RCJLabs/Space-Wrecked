// Which music plays (M60): the bed of the screen showing, as data/music.json
// lists them (src/core/music.js bedFor), or none. The audio module
// (platform/audio.js) makes it, plays it from the first tap with sound on,
// and cross-fades from one bed to the next.
import { bedFor } from '../core/music.js';
import { playMusic } from '../platform/audio.js';
import { loadContent } from '../platform/content.js';

export function startMusic(store) {
  loadContent()
    .then(({ music }) => {
      const follow = (state) => playMusic(bedFor(music, state.screen));
      follow(store.getState());
      store.subscribe((state, prev) => state.screen !== prev.screen && follow(state));
    })
    .catch(() => {}); // no content, no music: the screens say why
}
