// The Fight sandbox: the squad against a boarding party on the builder's
// open ship, as its battle map (with any wrecks made on the Battle map
// sandbox). Each fight is rolled from a new seed, and nothing here is
// saved: a reload starts a new fight. The board is view.js's.
import { createBattle } from '../../sim/battle.js';
import { activeSlot } from '../../sim/builds.js';
import { deploy } from '../../sim/deploy.js';
import { mapFromShip } from '../../sim/mapFromShip.js';
import { wrecksOf } from '../battle/wrecks.js';
import { icons } from '../icons.js';
import { mountFight } from './view.js';

const ENCOUNTER = 'boarders'; // data/encounters.json

export const fightScreen = {
  // game: the game's store; the ship is its builder's open slot.
  mount(root, { store: game }) {
    let defs = null;
    let fights = null;
    let ship = null;
    let setup = null; // { map, units }: where the fight starts

    // A fight on another ship (or none).
    function open(next) {
      ship = next;
      const map = ship && defs.frames.has(ship.frame) ? mapFromShip(ship, defs, { wrecked: wrecksOf(ship) }) : null;
      setup = null;
      if (!map) return fights.stop(ship ? 'The open ship has no parts yet. Build one in the Builder, then come back.' : 'No ship yet. Build one in the Builder, then come back.');
      const placed = deploy(map, defs.squad, defs.encounters.get(ENCOUNTER).enemies, defs);
      if (!placed.ok) return fights.stop(`${placed.error} Then come back.`);
      setup = { map, units: placed.units };
      begin();
    }

    // A new fight from the start, rolled from a new seed.
    function begin() {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const { battle, events } = createBattle({ ...setup, seed }, defs);
      fights.show({ map: setup.map, battle, log: events, seed });
    }

    return mountFight(root, {
      over: { icon: icons.again, label: 'Fight again' },
      start(content, handle) {
        defs = content;
        fights = handle;
        open(activeSlot(game.getState().builds)?.ship ?? null);
        return game.subscribe((state) => {
          const next = activeSlot(state.builds)?.ship ?? null;
          if (next !== ship) open(next);
        });
      },
      onOver() {
        if (setup) begin();
      },
    });
  },
};
