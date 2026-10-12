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
const start = (d) => d.backgrounds.backgrounds[0].start;
const district = (d) => d.districts.districts[0];
const twist = (d, id) => d.contracts.twists.find((t) => t.id === id);
const job = (d, id) => d.contracts.jobs.find((j) => j.id === id);
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
  ['ship preset with an unknown part', (d) => (d.ships.ships[0].parts.cannon = 2), /parts: unknown module "cannon"/],
  ['ship preset count back to front', (d) => (d.ships.ships[0].parts.engine = [3, 2]), /parts\.engine must be a whole number, or \[least, most\]/],
  ['ship preset on an unknown frame', (d) => (d.ships.ships[0].frame = 'barge'), /unknown frame "barge"/],
  ['ship preset with no crew', (d) => (d.ships.ships[0].crew = 0), /crew must be a whole number from 1/],
  ['ship preset wider than its frame', (d) => (d.ships.ships[0].beam = [4, 30]), /beam must be \[least, most\] cells across, from 1 to 14/],
  ['ship preset half symmetric', (d) => (d.ships.ships[0].symmetric = 'yes'), /symmetric must be true or false/],
  ['ship preset wrecks back to front', (d) => (d.ships.ships[0].wrecks = [3, 1]), /wrecks must be \[least, most\] rooms/],
  ['ship preset past its frame\'s cap', (d) => (d.ships.ships[0].parts.corridor = 40), /parts: up to \d+, but the Starter hull holds at most 40/],
  ['ship preset with no parts', (d) => (d.ships.ships[0].parts = {}), /parts must be an object of module types and counts/],
  ['misspelled ship preset field', (d) => (d.ships.ships[0].part = {}), /unknown field "part"/],
  ['campaign acts out of order', (d) => (d.campaign.acts[1].act = 3), /acts must be acts 1 to 3 in order/],
  ['campaign act with no home', (d) => (d.campaign.acts[0].home = ''), /act #1: name and home must be non-empty strings/],
  ['campaign with a fourth act', (d) => d.campaign.acts.push({ act: 4, name: 'Epilogue', hub: 'ship', home: 'Your ship' }), /acts must be acts 1 to 3/],
  ['act that may or may not heal', (d) => (d.campaign.acts[0].heals = 'yes'), /act #1: heals must be true or false/],
  ['campaign start left in campaign.json', (d) => (d.campaign.start = {}), /campaign\.json: unknown field "start"/],
  ['misspelled start field', (d) => (start(d).credit = 5), /start: unknown field "credit"/],
  ['start in debt', (d) => (start(d).credits = -5), /credits must be a whole number, 0 or more/],
  ['start with an unknown part', (d) => (start(d).parts.cannon = 1), /start\.parts: unknown module "cannon"/],
  ['start with none of a part', (d) => (start(d).parts.engine = 0), /engine must be a whole number, 1 or more/],
  ['start crew with an enemy in it', (d) => (start(d).crew[0] = 'pirate'), /start\.crew: unknown job "pirate"/],
  ['start crew of six', (d) => start(d).crew.push('marine', 'marine', 'marine'), /crew must be a list of 1 to 5 crew jobs/],
  ['start ship on an unknown frame', (d) => (start(d).ship.frame = 'barge'), /start\.ship: unknown frame "barge"/],
  ['start ship with a half turn of nothing', (d) => (start(d).ship.placements[0].rot = 5), /placement 1 must be \{ type, x, y, rot \}/],
  ['start ship with parts on top of each other', (d) => start(d).ship.placements.push({ type: 'corridor', x: 9, y: 7, rot: 0 }), /placement 8 \(corridor\) is rejected/],
  ['start ship with no airlock', (d) => (start(d).ship.placements = start(d).ship.placements.filter((p) => p.type !== 'airlock')), /start\.ship: No airlock on the hull edge/],
  ['no backgrounds', (d) => (d.backgrounds.backgrounds = []), /needs at least one background/],
  ['background in an unknown district', (d) => (d.backgrounds.backgrounds[0].district = 'docks'), /unknown district "docks"/],
  ['background with no pursuer', (d) => delete d.backgrounds.backgrounds[0].pursuer, /pursuer: must be \{ name, blurb, levels, hunters, raiders, payment \}/],
  ['client in two districts', (d) => d.districts.districts.push({ ...structuredClone(district(d)), id: 'docks', sites: [{ id: 'pier', name: 'Pier', map: 'yard', blurb: 'Wet.' }] }), /duplicate client id "marta"/],
  ['site on an unknown map', (d) => (district(d).sites[0].map = 'moon'), /unknown or broken map "moon"/],
  ['site map with a stray character', (d) => (d.sites.maps[0].rows[1] = d.sites.maps[0].rows[1].replace('k', 'Z')), /"Z" is no site tile/],
  ['site map short of spawn tiles', (d) => (d.sites.maps[0].rows[1] = d.sites.maps[0].rows[1].replace(' s', ' .')), /5 spawn tiles: it needs 6/],
  ['site map with a pen no one can walk into', (d) => (d.sites.maps[3].rows[14] = ` -${d.sites.maps[3].rows[14].slice(2)}`) && (d.sites.maps[3].rows[15] = ` .|${d.sites.maps[3].rows[15].slice(3)}`), /\(0, 7\) can't be walked to/],
  ['site map with the hull for a wall', (d) => (d.sites.maps[0].rows[0] = ` =${d.sites.maps[0].rows[0].slice(2)}`), /a hull on an edge: a site has only walls and doors/],
  ['tiles with no rule for rock', (d) => delete d.tiles.tiles.rock, /no rules for the tile "rock"/],
  ['board bigger than the jobs allow', (d) => (d.contracts.boardSize = 5) && d.contracts.jobs.pop(), /has 9 jobs: a board of 5 needs 10/],
  ['mission the rules don\'t know', (d) => d.contracts.missions.push({ id: 'escort', name: 'Escort', brief: 'Walk them home.' }), /unknown mission: the rules know clear, grab, hack/],
  ['brief with a word that can\'t be filled in', (d) => (d.contracts.missions[0].brief = 'Clear {site}.'), /"\{site\}" can't be filled in/],
  ['twist that does nothing', (d) => (d.contracts.twists[0] = { id: 'quiet', name: 'Quiet night', text: 'Nothing happens.' }), /does nothing/],
  ['twist with a hazard of its own', (d) => (d.contracts.twists[1].hazard = 'acid'), /hazard must be one of fire, rubble/],
  ['twist with a hazard and no patches', (d) => delete d.contracts.twists[1].patches, /a hazard comes with its patches/],
  ['twist text naming a number it has not got', (d) => (d.contracts.twists[0].text = 'Done by round {deadline}.'), /"\{deadline\}" can't be filled in/],
  ['twist with no missions in its list', (d) => (twist(d, 'rush').missions = []), /missions must be a list of the missions/],
  ['job with an unknown mission', (d) => (job(d, 'repo').mission = 'steal'), /unknown mission "steal"/],
  ['grab job with no crates', (d) => delete job(d, 'repo').crates, /a grab job needs crates/],
  ['clear job with crates', (d) => (job(d, 'jumpers').crates = 2), /crates is only for grab jobs/],
  ['hack job with too many turns', (d) => (job(d, 'payroll').turns = 9), /needs turns, a whole number from 1 to 5/],
  ['job at an unknown site', (d) => job(d, 'rent').sites.push('moon'), /unknown site "moon"/],
  ['job for a client from another district', (d) => (job(d, 'rent').clients = ['nobody']), /client "nobody" isn't in its sites' district/],
  ['job against an unknown encounter', (d) => (job(d, 'rent').encounter = 'ghosts'), /unknown encounter "ghosts"/],
  ['job with more enemies than spawn tiles', (d) => d.encounters.encounters.find((e) => e.id === 'guards').enemies.push('guard', 'guard', 'guard'), /8 enemies with a twist and the hunters, but depot's map has 6 spawn tiles/],
  ['heat thresholds out of order', (d) => (d.balance.huntHeat = 80), /heat thresholds must rise/],
  ['heat after a raid still a raid', (d) => (d.balance.heatAfterRaid = 75), /heatAfterRaid must be under raidHeat/],
  ['a loud job quieter than a quiet one', (d) => (d.balance.loudJobHeat = 5), /loudJobHeat must be at least jobHeat/],
  ['mission loud as a word', (d) => (d.contracts.missions[0].loud = 'yes'), /mission clear: loud must be true or false/],
  ['pursuer with no words for the hunters', (d) => delete d.backgrounds.backgrounds[0].pursuer.levels.hunters, /levels must say something for each of calm, rumors, hunters, raid/],
  ['pursuer sending a hunter that is no enemy', (d) => (d.backgrounds.backgrounds[0].pursuer.hunters = ['marine']), /hunters must be a list of 1 to 2 enemies/],
  ['pursuer raiding with an unknown encounter', (d) => (d.backgrounds.backgrounds[0].pursuer.raiders = 'army'), /unknown raiders encounter "army"/],
  ['payment of odd credits', (d) => (d.backgrounds.backgrounds[0].pursuer.payment.credits = 52), /credits must be a multiple of 5/],
  ['payment that buys no heat', (d) => (d.backgrounds.backgrounds[0].pursuer.payment.heat = 0), /heat must be a whole number from 1 to 100/],
  ['tiles with no rule for the deck', (d) => delete d.tiles.tiles.deck, /no rules for the tile "deck"/],
  ['job paying odd credits', (d) => (job(d, 'rent').credits = [61, 90]), /multiples of 5/],
  ['job with a part chance and no parts', (d) => (job(d, 'payroll').partChance = 10), /a part comes with a chance/],
  ['job pitch with a word that can\'t be filled in', (d) => (job(d, 'rent').pitch = 'Pay {rent}.'), /"\{rent\}" can't be filled in: use \{client\}, \{site\}/],
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
  assert.match(run.stdout, /OK \(12 modules, 1 frame, 1 manufacturer, 4 weapons, 3 crew jobs, 7 enemies, 8 encounters, 3 ship presets, 3 acts, 1 background, 1 district, 4 site maps, 10 job templates\)/);
});
