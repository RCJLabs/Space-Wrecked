// Captions (M49, Settings' Captions): each sound the game makes written at
// the foot of the screen as it would play, sound on or off. The words are
// each sound's caption in data/sounds.json; src/platform/audio.js tells the
// sounds of each go (one tap, one change, one moment of a fight's playback)
// as they come, a tap's own click left out: what a tap does shows already.
// <html data-captions> (src/ui/look.js) says whether they show.
//
//   startCaptions()   once, at boot
//   captionWords(ids, sounds)   the words for a go's sounds, in order. Pure
import { onSounds } from '../platform/audio.js';
import { loadContent } from '../platform/content.js';

// How long a caption stays, in ms, and how many show at once: the oldest
// goes first.
const SHOWN = 1800;
const MOST = 3;

export function captionWords(ids, sounds) {
  return ids.map((id) => sounds.get(id)?.caption).filter(Boolean);
}

export function startCaptions() {
  const strip = document.createElement('div');
  strip.className = 'captions';
  // Read aloud, the captions would repeat what a screen reader's user hears.
  strip.setAttribute('aria-hidden', 'true');
  document.body.append(strip);
  let sounds = null;
  loadContent().then((content) => (sounds = content.sounds), () => {});
  onSounds((ids) => {
    if (document.documentElement.dataset.captions !== 'on' || !sounds) return;
    const words = captionWords(ids, sounds);
    if (!words.length) return;
    const line = document.createElement('p');
    line.className = 'caption';
    line.textContent = `[${words.join(', ')}]`;
    strip.append(line);
    while (strip.children.length > MOST) strip.firstElementChild.remove();
    setTimeout(() => line.remove(), SHOWN);
  });
}
