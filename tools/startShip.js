// The launched start ship the harnesses fly and fight on (tools/approach.js,
// tools/boarding.js): the background's start ship as act 1 leaves it, with
// the parts the test runs fit before launch.
import { buildShip } from '../src/sim/builder.js';
import { fitPart } from './run.js';

// What the start ship gets in act 1 to launch: the parts on hand at the
// start, and the three engines lifting off takes.
const LAUNCH_PARTS = ['quarters', 'lifesupport', 'engine', 'engine', 'engine'];

// The launched start ship: the background's start ship, with LAUNCH_PARTS
// fitted where the test runs fit them (run.js fitPart).
export function launchedShip(rules) {
  const { start } = rules.backgrounds.values().next().value;
  let { ship } = buildShip(rules, start.ship.frame, start.ship.placements);
  for (const type of LAUNCH_PARTS) ship = withPart(ship, rules, type);
  return ship;
}

// The ship with one part more, fitted.
export function withPart(ship, rules, type) {
  const fitted = fitPart(ship, rules, type);
  if (!fitted) throw new Error(`No room for a ${type} on the ship.`);
  return fitted.ship;
}
