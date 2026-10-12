// The Builder sandbox: the open one of the builder's saved slots
// (builds.js), with endless parts and the Saves tab. Every change goes to
// the game store (builds/save) with its build log, which saves it. The
// board is view.js's.
import { decodeBlueprint, encodeBlueprint } from '../../core/blueprint.js';
import { newShip } from '../../sim/builder.js';
import { activeSlot, MAX_SLOTS, nextSlotName } from '../../sim/builds.js';
import { canLaunch, flightChecklist } from '../../sim/constraints.js';
import { logFor, openBuild } from '../../sim/replay.js';
import { FRAME, mountBuilder } from './view.js';

// The session outlives the screen until the page reloads, so leaving the
// sandbox and coming back keeps the undo history. The ship itself is saved.
let kept = null;

export const builderScreen = {
  // game: the game's store, which holds (and saves) the builder's ships.
  mount(root, { store: game }) {
    let defs = null;

    // The open slot's ship and a log that replays to it (openBuild repairs
    // a damaged or overlong log). A ship on a frame this build doesn't know
    // can't be drawn; a new one stands in (the saved one stays until the
    // first change).
    function openSlot() {
      const slot = activeSlot(game.getState().builds);
      if (!defs.frames.has(slot.ship.frame)) return { ship: newShip(FRAME), log: [] };
      return openBuild(slot.ship, slot.log, defs);
    }

    // Adds a slot holding ship and log, opens it, and returns its name.
    function addSlot(ship, log) {
      const name = nextSlotName(game.getState().builds);
      game.dispatch({ type: 'builds/add', slot: { name, ship, log } });
      return name;
    }

    // Until there is a campaign with real crew, the ship carries the
    // starting crew.
    const crew = () => defs.balance.startingCrew;

    return mountBuilder(root, {
      launch: true,
      leave: null,
      crew,
      // With no saved ships yet, start one. Keep this page's session (and
      // its undo history) if it still holds the open ship; otherwise start
      // from the save.
      open(content) {
        defs = content;
        if (!activeSlot(game.getState().builds)) addSlot(newShip(FRAME), []);
        const opened = openSlot();
        return kept?.ship === opened.ship ? { session: kept } : { ...opened, stock: null };
      },
      onSession(session, prev) {
        kept = session;
        if (session.ship !== prev.ship || session.log !== prev.log) {
          game.dispatch({ type: 'builds/save', ship: session.ship, log: session.log });
        }
      },
      // A ship that arrives from outside (another slot opened, a pasted
      // code, a save imported from the dev menu) replaces the one being
      // built. Only a change to the open slot counts.
      watch(api) {
        let gameSlot = activeSlot(game.getState().builds);
        return game.subscribe((state) => {
          const slot = activeSlot(state.builds);
          if (slot === gameSlot) return;
          gameSlot = slot;
          if (!slot) {
            addSlot(newShip(FRAME), []);
            return;
          }
          const session = api.session();
          if (slot.ship === session.ship && slot.log === session.log) return; // our own save
          const next = openSlot();
          api.load(next.ship, next.log);
        });
      },
      slots(api) {
        return {
          handlers: {
            onOpen: (index) => game.dispatch({ type: 'builds/open', index }),
            onNew: () => addSlot(newShip(FRAME), []),
            onCopy: () => encodeBlueprint(api.session().ship),
            onPaste: (text) => {
              const result = decodeBlueprint(text, defs);
              if (!result.ok) return result;
              if (game.getState().builds.slots.length >= MAX_SLOTS) {
                return { ok: false, error: `Delete a ship first: there's room for ${MAX_SLOTS}.` };
              }
              const name = addSlot(result.ship, logFor(result.ship));
              return { ok: true, name };
            },
            onDelete: () => game.dispatch({ type: 'builds/delete', index: game.getState().builds.active }),
          },
          // Every slot, the open one as it is being built.
          view() {
            const builds = game.getState().builds;
            const slots = builds.slots.map((slot) => {
              const ship = slot === activeSlot(builds) ? api.session().ship : slot.ship;
              const known = ship.modules.every((m) => defs.modules.has(m.type)) && defs.frames.has(ship.frame);
              return { name: slot.name, parts: ship.modules.length, ready: known && canLaunch(flightChecklist(ship, defs, crew())) };
            });
            return { slots, active: builds.active };
          },
          key: () => game.getState().builds,
        };
      },
    });
  },
};
