import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readData } from '../tools/data.js';
import { validateData } from '../tools/validate-data.js';

test('the shipped data is valid', () => {
  assert.deepEqual(validateData(readData()), []);
});

test('the shipped data has the 12 v0.1 module types', () => {
  const ids = readData().modules.modules.map((m) => m.id).sort();
  assert.deepEqual(ids, [
    'airlock', 'armory', 'bridge', 'cargo', 'corridor', 'engine',
    'lifesupport', 'medbay', 'quarters', 'reactor', 'shield', 'weapon',
  ]);
});

// Each case breaks one thing in a copy of the real data and expects the
// validator to name it. The starter frame is an open yard, so the shape
// cases cut a small frame of their own.
const engine = (d) => d.modules.modules.find((m) => m.id === 'engine');
const small = (d) => Object.assign(d.frames.frames[0], { width: 4, height: 4 });
const cases = [
  ['duplicate id', (d) => d.modules.modules.push(structuredClone(d.modules.modules[0])), /duplicate id "bridge"/],
  ['unknown manufacturer', (d) => (d.modules.modules[0].manufacturer = 'acme'), /unknown manufacturer "acme"/],
  ['side facing space that is no side', (d) => (engine(d).facesSpace.side = 'x'), /facesSpace\.side must be one of n, e, s, w/],
  ['side facing space with no name', (d) => (engine(d).facesSpace.what = ''), /facesSpace\.what must name what faces space/],
  ['side facing space as a bare string', (d) => (engine(d).facesSpace = 'w'), /facesSpace must be \{ side, what \}/],
  ['door sockets, which parts no longer have', (d) => (d.modules.modules[0].doors = [{ side: 's', at: 0 }]), /unknown field "doors"/],
  ['interior too short', (d) => d.modules.modules[0].interior.pop(), /interior must have 2 rows/],
  ['interior too narrow', (d) => (d.modules.modules[0].interior[0] = 'c.'), /row 0 must be 3 tiles wide/],
  ['tile not in the legend', (d) => (d.modules.modules[0].interior[0] = 'c.Z'), /"Z" is not in the tiles legend/],
  ['unknown tag', (d) => d.modules.modules[0].tags.push('airlok'), /unknown tag "airlok"/],
  ['missing stat', (d) => delete d.modules.modules[0].stats.hp, /stats\.hp must be a whole number, 1 or more/],
  ['negative mass', (d) => (d.modules.modules[0].stats.mass = -1), /stats\.mass must be a whole number, 0 or more/],
  ['unknown stat', (d) => (d.modules.modules[0].stats.speed = 3), /unknown stat "speed"/],
  ['misspelled field', (d) => (d.modules.modules[0].rotate = true), /unknown field "rotate"/],
  ['size too big', (d) => (d.modules.modules[0].size = [5, 1]), /size must be \[width, height\]/],
  ['glyph used twice', (d) => (d.modules.modules[1].glyph = 'B'), /glyph "B" is already used/],
  ['no bridge', (d) => d.modules.modules.forEach((m) => (m.tags = m.tags.filter((t) => t !== 'bridge'))), /no module is tagged "bridge"/],
  ['frame too narrow', (d) => (d.frames.frames[0].width = 0), /width must be an integer from 1/],
  ['bad tilesPerCell', (d) => (d.modules.tilesPerCell = 0), /tilesPerCell must be an integer/],
  ['manufacturers not a list', (d) => (d.manufacturers.manufacturers = {}), /"manufacturers" must be a list/],
  ['frame without a thrust minimum', (d) => delete d.frames.frames[0].minThrustToMass, /minThrustToMass must be a number/],
  ['misspelled frame field', (d) => (d.frames.frames[0].maxModule = 20), /unknown field "maxModule"/],
  ['frame shape with a row missing', (d) => (small(d).shape = ['.##.', '####', '####']), /shape must be a list of 4 rows/],
  ['frame shape with a stray character', (d) => (small(d).shape = ['.##.', '##x#', '####', '.##.']), /shape row 1 must be 4 characters/],
  ['frame shape in two pieces', (d) => (small(d).shape = ['##..', '##..', '..##', '..##']), /shape must be one piece/],
  ['frame shape with no hull', (d) => (small(d).shape = ['....', '....', '....', '....']), /shape has no hull cells/],
  ['crew of zero', (d) => (d.balance.startingCrew = 0), /startingCrew must be a whole number from 1/],
  ['unknown balance number', (d) => (d.balance.crewSize = 4), /unknown number "crewSize"/],
  ['balance not an object', (d) => (d.balance = [4]), /balance\.json: must be an object/],
  ['middle range nearer than close', (d) => (d.balance.midRange = 2), /midRange must be at least closeRange/],
  ['weapon damage back to front', (d) => (d.weapons.weapons[0].damage = [5, 3]), /damage must be \[least, most\]/],
  ['weapon missing a range band', (d) => delete d.weapons.weapons[0].accuracy.long, /accuracy\.long must be a whole number/],
  ['weapon with an unknown range band', (d) => (d.weapons.weapons[0].accuracy.far = 0), /unknown range band "far"/],
  ['weapon with an empty clip', (d) => (d.weapons.weapons[0].clip = 0), /clip must be a whole number from 1/],
  ['job with an unknown weapon', (d) => (d.jobs.jobs[0].weapon = 'laser'), /unknown weapon "laser"/],
  ['job aiming past 100', (d) => (d.jobs.jobs[0].aim = 120), /aim must be a whole number from 0 to 100/],
  ['enemy with a job\'s id', (d) => (d.enemies.enemies[0].id = 'marine'), /id "marine" is also a job's/],
  ['misspelled enemy field', (d) => (d.enemies.enemies[0].hitpoints = 5), /unknown field "hitpoints"/],
  ['jobs not a list', (d) => (d.jobs.jobs = {}), /"jobs" must be a list/],
  ['tile with no rules', (d) => delete d.tiles.tiles.console, /no rules for the tile "console"/],
  ['map tile with no rules', (d) => delete d.tiles.tiles.space, /no rules for the tile "space"/],
  ['tile with a quarter of cover', (d) => (d.tiles.tiles['half cover'].cover = 'quarter'), /cover must be "half" or "full"/],
  ['cover you can stand on', (d) => (d.tiles.tiles.floor.cover = 'half'), /a tile units stand on gives no cover/],
  ['squad with an enemy in it', (d) => (d.encounters.squad[0] = 'pirate'), /squad: unknown job "pirate"/],
  ['squad of six', (d) => d.encounters.squad.push('marine', 'marine', 'marine'), /squad must be a list of 1 to 5/],
  ['encounter with a crew job for an enemy', (d) => (d.encounters.encounters[0].enemies[0] = 'medic'), /unknown enemy "medic"/],
  ['encounter with no enemies', (d) => (d.encounters.encounters[0].enemies = []), /enemies must be a list of 1 to 8/],
  ['misspelled encounter field', (d) => (d.encounters.encounters[0].enemy = ['pirate']), /unknown field "enemy"/],
];

test('the validator names each kind of mistake', () => {
  for (const [name, breakIt, expected] of cases) {
    const data = structuredClone(readData());
    breakIt(data);
    const problems = validateData(data);
    assert.ok(problems.some((p) => expected.test(p)), `${name}: got ${JSON.stringify(problems)}`);
  }
});

test('the validator reports malformed files instead of throwing', () => {
  const junk = [
    {},
    { modules: null, frames: 5, manufacturers: 'x' },
    { modules: { modules: [null, 7] }, frames: { frames: [] }, manufacturers: { manufacturers: [] } },
  ];
  for (const data of junk) {
    let problems;
    assert.doesNotThrow(() => (problems = validateData(data)));
    assert.ok(problems.length > 0);
  }
});

test('the validator runs from the command line', () => {
  const tool = fileURLToPath(new URL('../tools/validate-data.js', import.meta.url));
  const run = spawnSync(process.execPath, [tool], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /OK \(12 modules, 1 frame, 1 manufacturer, 4 weapons, 3 jobs, 2 enemies, 1 encounter\)/);
});
