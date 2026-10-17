// The scenes (M34, ROADMAP M34): painted backdrops drawn in code. A world's
// scene is two pictures, its ground from above (ground.js) and the world
// seen whole (world.js): the homeworld's for the lift-off, named by act 1 in
// data/campaign.json, and each kind of world's for the landing, named by the
// kind in data/worlds.json. The hangar (hangar.js) stands behind the title.
import { GROUND_KINDS, groundScene } from './ground.js';
import { hangarScene } from './hangar.js';
import { WORLD_KINDS, worldScene } from './world.js';

// Every world's scene: the ids data may name.
export const SCENES = GROUND_KINDS.filter((id) => WORLD_KINDS.includes(id));

// The scene for an id data gives, or barren rock's for one not drawn.
export function sceneId(id) {
  return SCENES.includes(id) ? id : 'rock';
}

// A world's two pictures: { ground, world }, each { size, shapes }. The
// seed varies its features, not what it is.
export function worldPictures(id, seed = 1) {
  const scene = sceneId(id);
  return { ground: groundScene(scene, seed), world: worldScene(scene, seed) };
}

// The hangar behind the title, the same on every launch.
export function titlePicture() {
  return hangarScene('title');
}
