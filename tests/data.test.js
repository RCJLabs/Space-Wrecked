import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readData } from '../tools/data.js';
import { validateData } from '../tools/validate-data.js';

test('the shipped data is valid', () => {
  assert.deepEqual(validateData(readData()), []);
});

test("the shipped data has the 12 v0.1 module types, first, then M23e's nine, then M39's nineteen, then Bastion's version of each (M23g), Kestrel's of each that weighs 2 or more but the reactors, and Scrapline's of each (M31)", () => {
  const modules = readData().modules.modules;
  const ids = modules.map((m) => m.id);
  assert.deepEqual(ids.slice(0, 12).sort(), [
    'airlock', 'armory', 'bridge', 'cargo', 'corridor', 'engine',
    'lifesupport', 'medbay', 'quarters', 'reactor', 'shield', 'weapon',
  ]);
  assert.deepEqual(ids.slice(12, 21).sort(), [
    'bunks', 'cannon', 'heavyengine', 'largehold', 'lightengine',
    'pointdefense', 'shieldarray', 'smallreactor', 'surgery',
  ]);
  // M39's (Evan's pick, 2026-10-19): five doing a job's ship effect, five
  // with rules of their own, and nine versions of parts already there.
  assert.deepEqual(ids.slice(21, 40).sort(), [
    'airrecycler', 'baffles', 'cargopod', 'cockpit', 'dormitory', 'ecm', 'emitter', 'firecontrol', 'flak', 'grapple',
    'hydroponics', 'largereactor', 'railgun', 'scanner', 'surveylab', 'thruster', 'torpedobay', 'turret', 'workshop',
  ]);
  // Kestrel makes no reactor but the small one (Evan's call, 2026-10-15; the
  // large reactor too, M39).
  const heavy = modules.slice(0, 40).filter((m) => m.stats.mass >= 2 && !['reactor', 'largereactor'].includes(m.id)).map((m) => m.id);
  const parts = ids.slice(0, 40);
  // Each maker's versions in the order of its base parts: those of M23e's
  // and before first, then M39's.
  const inOrder = (bases) => [...bases.filter((id) => parts.indexOf(id) < 21), ...bases.filter((id) => parts.indexOf(id) >= 21)];
  const lines = [['bastion', 'Bastion', parts], ['kestrel', 'Kestrel', heavy], ['scrapline', 'Scrapline', parts]];
  let at = 40;
  for (const [maker, name, bases] of lines) {
    const made = modules.slice(at, at + bases.length);
    assert.deepEqual(made.map((m) => m.base), inOrder(bases), `${maker}: every part it makes, M23e's and M39's included, in the same order`);
    for (const m of made) assert.ok(m.manufacturer === maker && m.id === `${maker}-${m.base}` && m.name.startsWith(`${name} `), m.id);
    at += bases.length;
  }
  assert.equal(at, modules.length);
  assert.equal(heavy.length, 27, 'all but the eleven that weigh 1, and the reactors but the small one');
});

// Each case breaks one thing in a copy of the real data and expects the
// validator to name it. The starter frame is an open yard, so the shape
// cases cut a small frame of their own.
const engine = (d) => d.modules.modules.find((m) => m.id === 'engine');
const version = (d) => d.modules.modules.find((m) => m.id === 'bastion-engine');
const start = (d) => d.backgrounds.backgrounds[0].start;
const district = (d) => d.districts.districts[0];
const twist = (d, id) => d.contracts.twists.find((t) => t.id === id);
const job = (d, id) => d.contracts.jobs.find((j) => j.id === id);
const event = (d, id) => d.events.events.find((e) => e.id === id);
const small = (d) => Object.assign(d.frames.frames[0], { width: 4, height: 4 });
const hostile = (d) => d.sectors.nodes.find((node) => node.id === 'hostile');
const hull = (d) => d.hulls.hulls[0];
const cases = [
  ['hull style out over half a cell', (d) => (hull(d).margin = 0.6), /margin must be more than 0 and at most 0.5/],
  ['hull style with corners of no kind', (d) => (hull(d).corners = 'blob'), /corners must be one of round, cut/],
  ['hull profile going back up', (d) => (hull(d).profile[2] = [0.33, 0.99]), /profile must go out and down/],
  ['hull profile not ending at the side', (d) => hull(d).profile.pop(), /profile must end with the side/],
  ['hull nose longer than the camera keeps room for', (d) => (hull(d).nose.max = 3), /nose must have base and max \(at most 2.2 cells\)/],
  ['hull nose rings growing', (d) => (hull(d).nose.rings[2] = [0.65, 0.99]), /nose rings must go forward and get smaller/],
  ['misspelled hull field', (d) => (hull(d).margins = 0.5), /unknown field "margins"/],
  ['no default hull style', (d) => (hull(d).id = 'smooth'), /there must be a "rounded" style/],
  ['duplicate id', (d) => d.modules.modules.push(structuredClone(d.modules.modules[0])), /duplicate id "bridge"/],
  ['unknown manufacturer', (d) => (d.modules.modules[0].manufacturer = 'acme'), /unknown manufacturer "acme"/],
  // M23g: makers, and their versions of the parts.
  ['a maker with no short name', (d) => delete d.manufacturers.manufacturers[1].short, /bastion: short must be a name of up to 9 letters/],
  ['a maker with no card line', (d) => (d.manufacturers.manufacturers[1].blurb = ''), /bastion: blurb must be a non-empty string/],
  ['a mark nobody draws', (d) => (d.manufacturers.manufacturers[1].mark = 'stars'), /bastion: mark must be one of chevrons/],
  ['a maker with no skin', (d) => d.manufacturers.manufacturers.push({ id: 'orrery', name: 'Orrery Works', short: 'Orrery', blurb: 'Odd.' }), /orrery: has no skin in src\/render\/palette\.js/],
  ['a misspelled maker field', (d) => (d.manufacturers.manufacturers[1].colour = 'grey'), /bastion: unknown field "colour"/],
  ['a version with a shape of its own', (d) => (version(d).size = [3, 3]), /bastion-engine: unknown field "size"/],
  ['a version of nothing', (d) => (version(d).base = 'galley'), /base "galley" must be a part earlier in the file/],
  ['a version of a version', (d) => (d.modules.modules.at(-1).base = 'bastion-engine'), /base "bastion-engine" must be a part earlier in the file that isn't a version itself/],
  ['a version by its base part\'s maker', (d) => (version(d).manufacturer = 'yard'), /a version is by another maker than its base part's \("yard"\)/],
  ['two versions by one maker', (d) => d.modules.modules.push({ ...structuredClone(version(d)), id: 'bastion-engine-two' }), /bastion has a version of engine already/],
  ['a version with a stat in pieces', (d) => (version(d).stats.hp = 22.5), /bastion-engine: stats\.hp must be a whole number, 1 or more/],
  ['a version with a stat nobody has', (d) => (version(d).stats.armor = 2), /bastion-engine: unknown stat "armor"/],
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
  ['no bridge', (d) => d.modules.modules.forEach((m) => m.tags && (m.tags = m.tags.filter((t) => t !== 'bridge'))), /no module is tagged "bridge"/],
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
  ['ship preset with an unknown part', (d) => (d.ships.ships[0].parts.warpcore = 2), /parts: unknown module "warpcore"/],
  ['ship preset count back to front', (d) => (d.ships.ships[0].parts.engine = [3, 2]), /parts\.engine must be a whole number, or \[least, most\]/],
  ['ship preset on an unknown frame', (d) => (d.ships.ships[0].frame = 'barge'), /unknown frame "barge"/],
  ['ship preset with no crew', (d) => (d.ships.ships[0].crew = 0), /crew must be a whole number from 1/],
  // The cutter flies the small-craft hull (M39), 9 cells high.
  ['ship preset wider than its frame', (d) => (d.ships.ships[0].beam = [4, 30]), /beam must be \[least, most\] cells across, from 1 to 9/],
  ['ship preset half symmetric', (d) => (d.ships.ships[0].symmetric = 'yes'), /symmetric must be true or false/],
  ['ship preset wrecks back to front', (d) => (d.ships.ships[0].wrecks = [3, 1]), /wrecks must be \[least, most\] rooms/],
  ['ship preset past its frame\'s cap', (d) => (d.ships.ships[0].parts.corridor = 40), /parts: up to \d+, but the Small-craft hull holds at most 20/],
  ['ship preset with no parts', (d) => (d.ships.ships[0].parts = {}), /parts must be an object of module types and counts/],
  ['misspelled ship preset field', (d) => (d.ships.ships[0].part = {}), /unknown field "part"/],
  ['campaign acts out of order', (d) => (d.campaign.acts[1].act = 3), /acts must be acts 1 to 3 in order/],
  ['campaign act with no home', (d) => (d.campaign.acts[0].home = ''), /act #1: name and home must be non-empty strings/],
  ['campaign with a fourth act', (d) => d.campaign.acts.push({ act: 4, name: 'Epilogue', hub: 'ship', home: 'Your ship' }), /acts must be acts 1 to 3/],
  ['act that may or may not heal', (d) => (d.campaign.acts[0].heals = 'yes'), /act #1: heals must be true or false/],
  ['campaign start left in campaign.json', (d) => (d.campaign.start = {}), /campaign\.json: unknown field "start"/],
  ['too few traits for a captain', (d) => (d.traits.traits = d.traits.traits.slice(0, 1)), /needs at least 2 traits for a captain to pick/],
  ['a captain name too long to keep', (d) => d.backgrounds.backgrounds[0].captains.push('Maximilian Bartholomew Oyelaran'), /captains must be a list of 1 to 20 names of up to 24 letters/],
  ['trait that does nothing', (d) => (d.traits.traits[0].effects = {}), /traits\.json steady: effects must change something/],
  ['trait moving a number fights have not got', (d) => (d.traits.traits[0].effects = { luck: 5 }), /effects: unknown number "luck"/],
  ['trait far past its range', (d) => (d.traits.traits[0].effects = { aim: 50 }), /effects\.aim must be a whole number from -30 to 30/],
  ['misspelled trait field', (d) => (d.traits.traits[0].effect = {}), /traits\.json steady: unknown field "effect"/],
  ['sector with no jump point', (d) => (d.sectors.nodes = d.sectors.nodes.filter((n) => n.id !== 'exit')), /the "exit" node kind is missing/],
  ['more stations than columns between', (d) => (d.sectors.counts.station = [1, 9]), /counts take up to 11 columns, but only 5 lie between/],
  ['too few places for a full sector', (d) => (d.sectors.names.places = d.sectors.names.places.slice(0, 4)), /mix\.empty: needs 15 names in its list, has 4/],
  ['a mix kind that is not a node kind', (d) => (d.sectors.mix.wreck = 2), /mix\.wreck: must be a node kind other than start, exit and the counted kinds/],
  ['a kind holding events with none of its kind', (d) => (d.events.events = d.events.events.filter((e) => e.kind !== 'derelict')), /node derelict: holds events, but events\.json has none of its kind/],
  ['an event at a kind that holds none', (d) => (event(d, 'ion-storm').kind = 'station'), /event ion-storm: kind must be a node kind that holds events/],
  ['outcome chances that miss 100', (d) => (event(d, 'ion-storm').choices[0].outcomes[0].chance = 50), /choice ride: outcome chances must add up to 100, not 90/],
  ['an effect the sim does not know', (d) => (event(d, 'dead-hauler').choices[1].outcomes[0].effects.fuel = 3), /unknown field "fuel"/],
  ['a drop table that is not there', (d) => (event(d, 'gutted-tug').choices[0].outcomes[0].effects.drop = 'loot'), /drop "loot" is not a drop table in drops/],
  ['an outcome taking more than its choice needs', (d) => (event(d, 'stalled-miner').choices[0].needs.supplies = 1), /takes 3 supplies, so the choice must need at least that many/],
  ['a sale without a part needed', (d) => delete event(d, 'scrap-dealer').choices[0].needs, /sells 1, so the choice must need at least that many parts/],
  ['an event that can hold the ship forever', (d) => (event(d, 'ion-storm').choices[0].needs = { supplies: 1 }), /event ion-storm: needs a choice that needs nothing/],
  ['a wound of nothing', (d) => (event(d, 'loose-rock').choices[0].outcomes[1].effects.wound.hp = 0), /wound must be \{ hp: 1 to 20/],
  ['a scan that reaches nothing', (d) => (d.balance.scanRange = 0), /scanRange must be a whole number from 1 to 4/],
  ['a place named twice', (d) => d.sectors.names.places.push('Dust Bank'), /names\.places: has a name twice/],
  ['fewer sector names than a run has sectors', (d) => (d.sectors.names.sectors = ['The Shoals']), /needs 5 names for a run of 5 sectors, has 1/],
  ['node kind naming a list that is not there', (d) => (d.sectors.nodes.find((n) => n.id === 'station').names = 'pubs'), /names "pubs" is not a list in names/],
  ['a run of no sectors', (d) => (d.campaign.acts[1].sectors = 0), /sectors must be a whole number from 1 to 20/],
  ['a jump that eats nothing past its range', (d) => (d.balance.longJumpFactor = 0), /longJumpFactor must be a whole number from 1 to 10/],
  ['an easy setting that makes enemies better', (d) => (d.balance.easyEnemyAim = 10), /easyEnemyAim must be a whole number from -50 to 0/],
  ['act with no words for what is to come', (d) => (d.campaign.acts[2].ahead = ''), /act #3: ahead must be a non-empty string/],
  ['act with its old stub words', (d) => (d.campaign.acts[2].stub = 'Coming soon.'), /act #3: unknown field "stub"/],
  ['an act lifting off from a scene not drawn', (d) => (d.campaign.acts[0].scene = 'moon'), /act #1: scene must be one drawn: homeworld, rock, desert, ice, jungle, ocean/],
  ['a world landing on a scene not drawn', (d) => (d.worlds.kinds[0].scene = 'swamp'), /kind ocean: scene must be one drawn: /],
  ['background with no words for lifting off', (d) => delete d.backgrounds.backgrounds[0].launch, /miner launch: must be \{ text, escaped \}/],
  ['launch with nothing for an empty hangar', (d) => (d.backgrounds.backgrounds[0].launch.escaped = ''), /launch: text and escaped must be non-empty strings/],
  ['misspelled launch field', (d) => (d.backgrounds.backgrounds[0].launch.escape = 'Gone.'), /launch: unknown field "escape"/],
  ['misspelled start field', (d) => (start(d).credit = 5), /start: unknown field "credit"/],
  ['start in debt', (d) => (start(d).credits = -5), /credits must be a whole number, 0 or more/],
  ['start with an unknown part', (d) => (start(d).parts.warpcore = 1), /start\.parts: unknown module "warpcore"/],
  ['start with none of a part', (d) => (start(d).parts.engine = 0), /engine must be a whole number, 1 or more/],
  ['start crew with an enemy in it', (d) => (start(d).crew[0] = 'pirate'), /start\.crew: unknown job "pirate"/],
  ['start crew of six', (d) => start(d).crew.push('marine', 'marine', 'marine'), /crew must be a list of 1 to 5 crew jobs/],
  ['start ship on an unknown frame', (d) => (start(d).ship.frame = 'barge'), /start\.ship: unknown frame "barge"/],
  ['start ship with a half turn of nothing', (d) => (start(d).ship.placements[0].rot = 5), /placement 1 must be \{ type, x, y, rot \}/],
  ['start ship with parts on top of each other', (d) => start(d).ship.placements.push({ type: 'corridor', x: 9, y: 7, rot: 0 }), /placement 8 \(corridor\) is rejected/],
  ['start ship with no airlock', (d) => (start(d).ship.placements = start(d).ship.placements.filter((p) => p.type !== 'airlock')), /start\.ship: No airlock on the hull edge/],
  ['no backgrounds', (d) => (d.backgrounds.backgrounds = []), /needs at least one background/],
  ['background in an unknown district', (d) => (d.backgrounds.backgrounds[0].district = 'docks'), /unknown district "docks"/],
  ['background with no pursuer', (d) => delete d.backgrounds.backgrounds[0].pursuer, /pursuer: must be \{ name, side, blurb, levels, hunters, raiders, payment\?, run, colony \}/],
  ['client in two districts', (d) => d.districts.districts.push({ ...structuredClone(district(d)), id: 'docks', sites: [{ id: 'pier', name: 'Pier', map: 'yard', blurb: 'Wet.' }] }), /duplicate client id "marta"/],
  ['site on an unknown map', (d) => (district(d).sites[0].map = 'moon'), /unknown or broken map "moon"/],
  ['site map with a stray character', (d) => (d.sites.maps[0].rows[1] = d.sites.maps[0].rows[1].replace('k', 'Z')), /"Z" is no site tile/],
  ['site map short of spawn tiles', (d) => (d.sites.maps[0].rows[1] = d.sites.maps[0].rows[1].replace(' s', ' .')), /5 spawn tiles: it needs 6/],
  ['site map with a pen no one can walk into', (d) => (d.sites.maps[3].rows[14] = ` -${d.sites.maps[3].rows[14].slice(2)}`) && (d.sites.maps[3].rows[15] = ` .|${d.sites.maps[3].rows[15].slice(3)}`), /\(0, 7\) can't be walked to/],
  ['site map with the hull for a wall', (d) => (d.sites.maps[0].rows[0] = ` =${d.sites.maps[0].rows[0].slice(2)}`), /a hull on an edge: a site has only walls and doors/],
  ['tiles with no rule for rock', (d) => delete d.tiles.tiles.rock, /no rules for the tile "rock"/],
  ['board bigger than the jobs allow', (d) => (d.contracts.boardSize = 5) && (d.contracts.jobs = d.contracts.jobs.filter((job) => !['rent', 'strikefund', 'backdoor', 'yardwatch', 'pumps', 'nephew'].includes(job.id))), /district "tailings" has 8 jobs that come back \(of 9\): a board of 5 needs 10/],
  ['job done once as a word', (d) => (job(d, 'repo').once = 'yes'), /job repo: once must be true or false/],
  ['mission the rules don\'t know', (d) => d.contracts.missions.push({ id: 'heist', name: 'Heist', brief: 'Crack the vault.' }), /unknown mission: the rules know clear, grab, hack, extract, escort, defend, sabotage, rescue/],
  ['brief with a word that can\'t be filled in', (d) => (d.contracts.missions[0].brief = 'Clear {site}.'), /"\{site\}" can't be filled in/],
  ['twist that does nothing', (d) => (d.contracts.twists[0] = { id: 'quiet', name: 'Quiet night', text: 'Nothing happens.' }), /does nothing/],
  ['twist with a hazard of its own', (d) => (d.contracts.twists[1].hazard = 'acid'), /hazard must be one of fire, rubble/],
  ['twist with a hazard and no patches', (d) => delete d.contracts.twists[1].patches, /a hazard comes with its patches/],
  ['twist text naming a number it has not got', (d) => (d.contracts.twists[0].text = 'Done by round {deadline}.'), /"\{deadline\}" can't be filled in/],
  ['twist with no missions in its list', (d) => (twist(d, 'rush').missions = []), /missions must be a list of the missions/],
  ['job with an unknown mission', (d) => (job(d, 'repo').mission = 'steal'), /unknown mission "steal"/],
  ['grab job with no crates', (d) => delete job(d, 'repo').crates, /a grab job needs crates/],
  ['clear job with crates', (d) => (job(d, 'jumpers').crates = 2), /crates is only for grab and extract jobs/],
  ['hack job with too many turns', (d) => (job(d, 'payroll').turns = 9), /needs turns, a whole number from 1 to 5/],
  ['sabotage job with no targets', (d) => delete job(d, 'pumps').targets, /a sabotage job needs targets, a whole number from 1 to 3/],
  ['defend job holding too long', (d) => (job(d, 'yardwatch').rounds = 12), /a defend job needs rounds, a whole number from 3 to 10/],
  ['grab job with rounds to hold', (d) => (job(d, 'repo').rounds = 5), /rounds is only for defend jobs/],
  ['rescue job with no captive', (d) => delete job(d, 'nephew').captive, /a rescue job needs its captive's name, up to 24 letters/],
  ['captive on a job that rescues no one', (d) => (job(d, 'repo').captive = 'Ann Doe'), /captive is only for rescue jobs/],
  ['no captive among the people', (d) => (d.contracts.people = d.contracts.people.filter((p) => p.id !== 'captive')), /needs "captive", whom the rules bring out/],
  ['a person the rules don\'t bring out', (d) => d.contracts.people.push({ ...structuredClone(d.contracts.people[0]), id: 'guide' }), /unknown person: the rules bring out client and captive/],
  ['a client too tough to need an escort', (d) => (d.contracts.people[0].hp = 40), /hp must be a whole number from 1 to 20/],
  ['site map with no far gate', (d) => (d.sites.maps[3].rows = d.sites.maps[3].rows.map((row) => row.replaceAll('x', '.'))), /sites.json bar: 0 exit tiles: it needs 2/],
  ['site map with nowhere to hold a captive', (d) => (d.sites.maps[1].rows = d.sites.maps[1].rows.map((row) => row.replaceAll('v', '.'))), /sites.json depot: 0 captive tiles: it needs 1/],
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
  ['payment that is no payment', (d) => (d.backgrounds.backgrounds[0].pursuer.payment = 50), /payment must be \{ name, text, credits, heat \}, or left out for a pursuer that takes none/],
  ['tiles with no rule for the deck', (d) => delete d.tiles.tiles.deck, /no rules for the tile "deck"/],
  ['job paying odd credits', (d) => (job(d, 'rent').credits = [61, 90]), /multiples of 5/],
  ['act lifting off on nothing', (d) => (d.campaign.acts[0].liftOff = 0), /liftOff must be a number above 0, up to 4/],
  ['shop run by a stranger', (d) => (d.districts.districts[0].shop.dealer = 'nobody'), /dealer "nobody" isn't one of the district's clients/],
  ['shop stocking more than its table has', (d) => (d.districts.districts[0].shop.parts = { engine: 3, reactor: 1 }), /a stock of 4 needs as many different parts/],
  ['shop selling an unknown part', (d) => (d.districts.districts[0].shop.parts.warpcore = 1), /shop parts: unknown module "warpcore"/],
  ['selling dearer than buying', (d) => (d.balance.sellPercent = 120), /sellPercent must be a whole number from 0 to 100|sellPercent must be at most buyPercent/],
  ['selling for more than the price', (d) => (d.balance.buyPercent = 40), /sellPercent must be at most buyPercent/],
  ['job drops with no chance', (d) => (job(d, 'repo').drops.chance = 0), /job repo drops: chance must be a whole number from 1 to 100/],
  ['job dropping an unknown part', (d) => (job(d, 'repo').drops.parts = { warpcore: 1 }), /job repo drops parts: unknown module "warpcore"/],
  ['job drop weighted at nothing', (d) => (job(d, 'scrap').drops.parts.engine = 0), /engine's weight must be a whole number from 1 to 100/],
  ['job drops with nothing in them', (d) => (job(d, 'repo').drops.parts = {}), /with at least one/],
  ['job pitch with a word that can\'t be filled in', (d) => (job(d, 'rent').pitch = 'Pay {rent}.'), /"\{rent\}" can't be filled in: use \{client\}, \{site\}/],
  // M21: the approach phase.
  ['tactics aiming at the bridge', (d) => (d.ships.ships[0].tactics.aim = ['bridge']), /cutter tactics: aim must list kinds to fire at/],
  ['tactics boarding in round 0', (d) => (d.ships.ships[0].tactics.board = 0), /board must be the round it closes from/],
  ['tactics with an unknown field', (d) => (d.ships.ships[0].tactics.taunt = true), /cutter tactics: unknown field "taunt"/],
  ['scrap that is not a range', (d) => (d.ships.ships[0].scrap = 20), /scrap must be \[least, most\] credits/],
  ['hostile ships of an unknown preset', (d) => (hostile(d).ships[0].ship = 'dreadnought'), /unknown ship preset "dreadnought"/],
  ['hostile ships with no tactics', (d) => hostile(d).ships.push({ ship: 'hauler', weight: 1 }), /the Derelict hauler has no tactics/],
  ['hostile ships none of them in the first sector', (d) => (hostile(d).ships = [{ ship: 'corvette', weight: 1, from: 2 }]), /needs a ship for the first sector/],
  ['hostile ships from past the last sector', (d) => (hostile(d).ships[1].from = 9), /from must be a sector from 1 to 5/],
  ['a kind with ships and events', (d) => (hostile(d).events = true), /a kind with ships holds no events/],
  ['approach rounds of none', (d) => (d.balance.approachRounds = 0), /approachRounds must be a whole number from 1 to 10/],
  // M22: boarding both ways.
  ['a boarding party that is no encounter', (d) => (d.ships.ships[0].party = 'navy'), /cutter: party: unknown encounter "navy"/],
  ['a hostile preset with no party', (d) => delete d.ships.ships[1].party, /corvette: a preset with tactics needs a party/],
  ['salvage of half a part', (d) => (d.ships.ships[0].salvage = 1.5), /salvage must be the parts stripped from her/],
  ['patching for a fortune', (d) => (d.balance.patchPrice = 500), /patchPrice must be a whole number from 0 to 100/],
  // M23: recruits, the squad and the med bay.
  ['a squad of six', (d) => (d.balance.squadSize = 6), /squadSize must be a whole number from 1 to 5/],
  ['a station offering a crowd', (d) => (d.balance.recruitOffer = 9), /recruitOffer must be a whole number from 0 to 4/],
  ['a med bay that heals nothing', (d) => (d.modules.modules.find((m) => m.id === 'medbay').heal = 0), /medbay: heal must be the hit points it heals each of the wounded a jump, 1 to 10/],
  ['a medic with an unknown station effect', (d) => (d.jobs.jobs.find((j) => j.id === 'medic').station = { cook: 1 }), /medic station: unknown effect "cook"/],
  ['a station effect on an enemy', (d) => (d.enemies.enemies[0].station = { heal: 1 }), /enemies\.json \w+: unknown field "station"/],
  ['a ship effect past its range', (d) => (d.jobs.jobs.find((j) => j.id === 'quartermaster').station = { lockers: 500 }), /quartermaster station: lockers must be a whole number from 1 to 99/],
  ['an unknown colony effect', (d) => (d.jobs.jobs.find((j) => j.id === 'scout').colony = { cook: 1 }), /scout colony: unknown effect "cook"/],
  ['a colony effect as a word', (d) => (d.jobs.jobs.find((j) => j.id === 'engineer').colony = { mines: 'two' }), /engineer colony: mines must be a whole number from 1 to 5/],
  ['an order of an unknown kind', (d) => (d.jobs.jobs.find((j) => j.id === 'marine').order.type = 'fireball'), /marine order: type must be one of suppress, weld/],
  ['an order with no uses', (d) => (d.jobs.jobs.find((j) => j.id === 'scout').order.uses = 0), /scout order: uses must be a whole number from 1 to 9/],
  ['an order missing its number', (d) => delete d.jobs.jobs.find((j) => j.id === 'medic').order.hp, /medic order: hp must be a whole number from 1 to 99/],
  ['an order with a number its kind lacks', (d) => (d.jobs.jobs.find((j) => j.id === 'pilot').order.aim = 10), /pilot order: unknown field "aim" for hustle/],
  ['a Suppress that helps', (d) => (d.jobs.jobs.find((j) => j.id === 'marine').order.aim = 30), /marine order: aim must be a whole number from -100 to -1/],
  ['an order with no name', (d) => (d.jobs.jobs.find((j) => j.id === 'engineer').order.name = ''), /engineer order: name must be a non-empty string/],
  ['an order on an enemy', (d) => (d.enemies.enemies[0].order = { type: 'hustle', name: 'Hustle', uses: 1, ap: 1 }), /enemies\.json \w+: unknown field "order"/],
  ['a recruit name twice', (d) => d.recruits.first.push(d.recruits.first[0]), /recruits\.json: first has a name twice/],
  ['a recruit name too long for a crew member', (d) => d.recruits.last.push('Wolfeschlegelsteinhausen'), /recruits\.json: last must be a list of 2 to 200 names of up to 11 letters/],
  // M23b: figures.
  ['a job with no look', (d) => delete d.jobs.jobs[0].look, /jobs\.json marine: look must be \{ suit, build, helmet, back, marks \}/],
  ['an enemy in a suit nobody makes', (d) => (d.enemies.enemies[0].look.suit = 'kimono'), /enemies\.json pirate: look\.suit must be one of eva, skinsuit/],
  ['a helmet from the other suit', (d) => (d.jobs.jobs.find((j) => j.id === 'engineer').look.helmet = 'fin'), /engineer: look\.helmet for a eva suit must be one of bubble, lamps, bar/],
  ['an enemy of no build', (d) => (d.enemies.enemies[1].look.build = 'huge'), /brute: look\.build must be one of light, standard, heavy/],
  ['a look with a hat', (d) => (d.jobs.jobs[0].look.hat = 'cap'), /marine: look: unknown field "hat"/],
  ['a weapon drawn as long as a corridor', (d) => (d.weapons.weapons[0].held.length = 3), /rifle: held\.length must be a number from 0\.08 to 0\.6/],
  ['a weapon for three hands', (d) => (d.weapons.weapons[0].held.hands = 3), /rifle: held\.hands must be 1 or 2/],
  // M23e: the catalog and part variants.
  ['a part in no category', (d) => delete engine(d).category, /modules\.json engine: category must be one of command, power, engines, weapons, defense, crew, cargo, utility/],
  ['a part in an unknown category', (d) => (engine(d).category = 'toys'), /engine: category must be one of command, power/],
  ['a category with no parts', (d) => d.modules.categories.push({ id: 'science', name: 'Science' }), /category science: no part is in it/],
  ['a category with no name', (d) => (d.modules.categories[0].name = ''), /category command: name must be a non-empty string/],
  ['a gun with no damage', (d) => delete d.modules.modules.find((m) => m.id === 'cannon').damage, /cannon: damage must be a whole number from 1 to 100/],
  ['damage on an engine', (d) => (engine(d).damage = 10), /engine: only a part tagged "weapon" has damage/],
  ['a shield that holds nothing', (d) => (d.modules.modules.find((m) => m.id === 'shieldarray').shield = 0), /shieldarray: shield must be a whole number from 1 to 100/],
  ['point defense that takes off half the odds', (d) => (d.modules.modules.find((m) => m.id === 'pointdefense').intercept = 60), /pointdefense: intercept must be a whole number from 1 to 50/],
  ['an intercept on a gun', (d) => (d.modules.modules.find((m) => m.id === 'weapon').intercept = 5), /weapon: only a part tagged "pointdefense" has intercept/],
  ['point defense with no most', (d) => delete d.balance.interceptMax, /interceptMax must be a whole number from 0 to 100/],
  ['the old gun damage left in the balance', (d) => (d.balance.gunDamage = 15), /unknown number "gunDamage"/],
  // M39: the new parts' and frames' numbers.
  ['a part doing an effect no job has', (d) => (d.modules.modules.find((m) => m.id === 'scanner').station = { sight: 1 }), /scanner station: unknown effect "sight"/],
  ['a scanner past the cap', (d) => (d.modules.modules.find((m) => m.id === 'scanner').station = { scan: 4 }), /scanner station: scan must be a whole number from 1 to 3/],
  ['a grapple on a gun', (d) => (d.modules.modules.find((m) => m.id === 'weapon').grapple = 10), /weapon: only a part tagged "grapple" has grapple/],
  ['a grapple that pulls nothing', (d) => (d.modules.modules.find((m) => m.id === 'grapple').grapple = 0), /grapple: grapple must be a whole number from 1 to 50/],
  ['a turret with no unit', (d) => delete d.modules.modules.find((m) => m.id === 'turret').unit, /turret: a part tagged "turret", and only one, has a unit/],
  ['a unit on a part that is no turret', (d) => (d.modules.modules.find((m) => m.id === 'armory').unit = { ...d.modules.modules.find((m) => m.id === 'turret').unit }), /armory: a part tagged "turret", and only one, has a unit/],
  ['a turret that walks', (d) => (d.modules.modules.find((m) => m.id === 'turret').unit.mobility = 2), /turret unit: mobility must be a whole number from 0 to 0/],
  ['a turret with an unknown gun', (d) => (d.modules.modules.find((m) => m.id === 'turret').unit.weapon = 'phaser'), /turret unit: unknown weapon "phaser"/],
  ['a turret dressed as a person', (d) => (d.modules.modules.find((m) => m.id === 'turret').unit.look = { suit: 'eva' }), /turret unit: look must be a machine's/],
  ['a turret of an unknown machine', (d) => (d.modules.modules.find((m) => m.id === 'turret').unit.look = { machine: 'drone' }), /look\.machine must be one of turret/],
  ['a turret named like a job', (d) => (d.modules.modules.find((m) => m.id === 'turret').unit.id = 'marine'), /turret unit: id "marine" is also a job's or an enemy's/],
  ['a frame with no price', (d) => delete d.frames.frames.find((f) => f.id === 'courier').cost, /courier: cost must be a whole number from 1 to 99999/],
  ['an enemy frame for sale', (d) => (d.frames.frames.find((f) => f.id === 'patrolhull').cost = 900), /patrolhull: an enemy's frame has no cost or traits/],
  ['a frame half an enemy', (d) => (d.frames.frames.find((f) => f.id === 'courier').enemy = false), /courier: enemy must be true or left out/],
  ['a frame with a trait no job has', (d) => (d.frames.frames.find((f) => f.id === 'courier').traits = { luck: 5 }), /courier traits: unknown effect "luck"/],
  ['a building with an unknown effect', (d) => (d.colony.buildings.find((b) => b.part === 'scanner').effects = { radar: 1 }), /unknown effect "radar"/],
  ['a greenhouse that grows ore', (d) => (d.colony.buildings.find((b) => b.part === 'hydroponics').makes = { ore: 2 }), /makes/],
  // M23f: styling.
  ['a frame with no styling cap', (d) => delete d.frames.frames[0].maxStyling, /starter: maxStyling must be a whole number from 0 to 255/],
  ['a piece named like a part', (d) => (d.styling.pieces[0].id = 'engine'), /styling\.json engine: id must differ from every module's/],
  ['a piece in no group', (d) => (d.styling.pieces[0].group = 'hats'), /sweptwing: group must be one of wings, gear, sculpt/],
  ['a piece too big', (d) => (d.styling.pieces[0].size = [5, 2]), /sweptwing: size must be \[w, h\], each 1 to 4 cells/],
  ['a piece turned two ways at once', (d) => (d.styling.pieces[0].turns = [0, 0]), /sweptwing: turns must list different turns, each 0 to 7/],
  ['a piece of an unknown shape', (d) => (d.styling.pieces.find((p) => p.id === 'wedge').shape = 'blob'), /wedge: shape must be one of wedge, curve/],
  ['a standing piece with no model', (d) => d.styling.pieces.push({ id: 'banner', name: 'Banner', group: 'gear', size: [1, 1], turns: [0] }), /banner: a piece without a shape needs a model of its own/],
  ['a group with no pieces', (d) => d.styling.groups.push({ id: 'decals', name: 'Decals' }), /group decals: every group must have pieces/],
  ['a paint with no color', (d) => d.styling.paints.push({ id: 'gold', name: 'Gold' }), /styling\.json gold: has no color in src\/render\/palette\.js paints/],
  ['no slate paint', (d) => (d.styling.paints = d.styling.paints.filter((p) => p.id !== 'slate')), /paints must have "slate": ships from before paint have it/],
  ['no sky trim', (d) => (d.styling.trims = d.styling.trims.filter((p) => p.id !== 'sky')), /trims must have "sky"/],
  ['an enemy look in an unknown paint', (d) => (d.ships.ships[0].look.paint = 'gold'), /ships\.json cutter: look\.paint must be one of the paints in styling\.json/],
  ['an enemy look with a part for a piece', (d) => (d.ships.ships[0].look.pieces.engine = 1), /cutter: look\.pieces: unknown styling piece "engine"/],
  ['an enemy look with a bad count', (d) => (d.ships.ships[1].look.pieces.deltawing = [3, 1]), /corvette: look\.pieces\.deltawing must be a whole number, or \[least, most\]/],
  ['an enemy look past the cap', (d) => (d.ships.ships[2].look.pieces.armorplate = 30), /hauler: look\.pieces: up to \d+, but the Starter hull takes at most 24/],
  ['an enemy look with a stray field', (d) => (d.ships.ships[2].look.decals = []), /hauler look: unknown field "decals"/],
  // M24: heat on the run.
  ['hunters past certain', (d) => (d.balance.huntChance = 101), /huntChance must be a whole number from 0 to 100/],
  ['a task force less likely than the hunters', (d) => (d.balance.taskForceChance = d.balance.huntChance - 1), /taskForceChance must be at least huntChance/],
  ['heat after facing them still at the hunters', (d) => (d.balance.heatAfterRaid = 60), /heatAfterRaid must be under huntHeat/],
  ['hiding that adds heat', (d) => (d.balance.hideHeat = 5), /hideHeat must be a whole number from -100 to 0/],
  ['a transponder swap that adds heat', (d) => (d.balance.swapHeat = 10), /swapHeat must be a whole number from -100 to 0/],
  ['a pursuer with nothing to say of the task force', (d) => delete pursuerRun(d).levels.taskForce, /run: levels must say something for each of calm, rumors, hunters, taskForce, cornered/],
  ['hunters in a ship with no tactics', (d) => (pursuerRun(d).hunters = 'hauler'), /run: hunters: the Derelict hauler needs tactics for the approach and a party/],
  ['a task force in an unknown ship', (d) => (pursuerRun(d).taskForce = 'dreadnought'), /run: taskForce: unknown ship preset "dreadnought"/],
  ['a pursuer with no words once faced', (d) => (pursuerRun(d).faced = ''), /run: faced must be a non-empty string/],
  ['a pursuer with a stray field on the run', (d) => (pursuerRun(d).bounty = 50), /run: unknown field "bounty"/],
  ['a nebula with events', (d) => (nodeKind(d, 'nebula').events = true), /node nebula: a place to hide holds no events and no ships/],
  ['a kind charted as a word', (d) => (nodeKind(d, 'station').charted = 'yes'), /node station: charted must be true, or left out/],
  ['a way in safe from the hunters', (d) => (nodeKind(d, 'start').safe = true), /node start: the way in and the jump point are on the charts, and never safe/],
  ['a nebula safe twice over', (d) => (nodeKind(d, 'nebula').safe = true), /node nebula: a place to hide is safe already/],
  // M25: the worlds past the charts.
  ['a survey that cools the ship', (d) => (d.balance.surveyHeat = -2), /surveyHeat must be a whole number from 0 to 50/],
  ['a system of one world', (d) => (d.worlds.system.worlds = 1), /worlds.json system: worlds must be a whole number from 2 to 5/],
  ['a system with no words', (d) => (d.worlds.system.text = ''), /worlds.json system: text must be a non-empty string/],
  ['a world kind with too rich a soil', (d) => (d.worlds.kinds[0].soil = [0, 4]), /worlds.json kind ocean: soil must be \[least, most\], from 0 to 3/],
  ['a world kind with its danger backwards', (d) => (d.worlds.kinds[0].danger = [2, 1]), /worlds.json kind ocean: danger must be \[least, most\]/],
  ['a world kind with a stray field', (d) => (d.worlds.kinds[0].gold = [1, 2]), /worlds.json kind ocean: unknown field "gold"/],
  ['a world kind with no words for the landing', (d) => delete d.worlds.kinds[0].landing, /worlds.json kind ocean: landing must be a non-empty string/],
  ['fewer kinds of world than a system has worlds', (d) => (d.worlds.kinds = d.worlds.kinds.slice(0, 2)), /worlds.json: needs 3 kinds of world, one for each world in a system; has 2/],
  ['a world name twice', (d) => (d.worlds.names.worlds[1] = d.worlds.names.worlds[0]), /worlds.json names.worlds: has a name twice/],
  ['too few world names for a system', (d) => (d.worlds.names.worlds = ['Harrow', 'Tarn']), /worlds.json names.worlds: needs 3 names/],
  ['a line missing from the lanes', (d) => d.worlds.lanes.pop(), /worlds.json: lanes must be 3 lines/],
  ['no node kind for the worlds to stand on', (d) => (d.sectors.nodes = d.sectors.nodes.filter((node) => node.id !== 'world')), /sectors.json: the "world" node kind is missing/],
  // M38d: the systems a voyage crosses past the colony's.
  ['no word on the systems a voyage crosses', (d) => delete d.worlds.voyage, /worlds.json: voyage must be an object/],
  ['a voyage system with no worlds', (d) => (d.worlds.voyage.worlds = 0), /worlds.json voyage: worlds must be a whole number from 1 to 5/],
  ['a voyage system with no words', (d) => (d.worlds.voyage.text = ' '), /worlds.json voyage: text must be a non-empty string/],
  // M38d's fix: its jump point's words, a system's, not a sector's.
  ['a voyage system with no words for its jump point', (d) => delete d.worlds.voyage.exit, /worlds.json voyage: exit must be a non-empty string/],
  ['a voyage system with a stray field', (d) => (d.worlds.voyage.stations = 2), /worlds.json voyage: unknown field "stations"/],
  ['more worlds in a voyage system than kinds', (d) => Object.assign(d.worlds, { voyage: { ...d.worlds.voyage, worlds: 4 }, kinds: d.worlds.kinds.slice(0, 3) }), /worlds.json: needs 4 kinds of world, one for each world in a system; has 3/],
  ['no name to spare past the colony for a voyage system', (d) => Object.assign(d.worlds, { system: { ...d.worlds.system, worlds: 2 }, voyage: { ...d.worlds.voyage, worlds: 2 }, names: { ...d.worlds.names, worlds: ['Harrow', 'Tarn'] } }), /worlds.json names.worlds: needs 3 names, one for each world in a voyage's system and the colony's; has 2/],
  ['one system name, so a voyage would name the next as the last', (d) => (d.worlds.names.systems = ['The Hush']), /worlds.json names.systems: needs 2 names/],
  // M26: the colony.
  ['a colony grid too small', (d) => (d.colony.site.width = 4), /colony.json site: width must be a whole number from 8 to 40/],
  ['a colony with no path between buildings to speak of', (d) => (d.colony.site.gap = 3), /colony.json site: gap must be a whole number from 0 to 2/],
  ['a tag aboard that no part has', (d) => d.colony.aboard.push('galley'), /colony.json: aboard must be a list of the tags of parts that stay aboard/],
  ['a building of an unknown part', (d) => (d.colony.buildings[0].part = 'fusion'), /colony.json building fusion: part: unknown part "fusion"/],
  ["a building of a maker's version", (d) => (d.colony.buildings[0].part = 'bastion-reactor'), /colony.json building bastion-reactor: part: "bastion-reactor" is a maker's version of reactor: name the base part/],
  ['a building of a part that stays aboard', (d) => (d.colony.buildings[0].part = 'engine'), /colony.json building engine: part: stays aboard/],
  ['a part with two buildings', (d) => (d.colony.buildings[1].part = 'reactor'), /colony.json building reactor: part named twice/],
  ['a building name twice', (d) => (d.colony.buildings[1].name = d.colony.buildings[0].name), /colony.json building smallreactor: name used twice/],
  ['a building with no words', (d) => delete d.colony.buildings[0].text, /colony.json building reactor: text must be a non-empty string/],
  ['a building with a stray field', (d) => (d.colony.buildings[0].power = 9), /colony.json building reactor: unknown field "power"/],
  ['a building too big for the grid', (d) => Object.assign(d.colony.site, { width: 8, height: 6 }) && (d.modules.modules.find((m) => m.id === 'reactor').size = [9, 3]), /colony.json building reactor: part: doesn't fit on the colony's grid/],
  // M27: what the colony builds.
  ['a colony that lands with materials past counting', (d) => (d.colony.materials = 500), /colony.json: materials must be a whole number from 0 to 200/],
  ['no builds', (d) => (d.colony.builds = []), /colony.json: needs a build at least/],
  ["a build with a part's id", (d) => (d.colony.builds[0].id = 'reactor'), /colony.json build reactor: id: "reactor" is a part's: a build needs an id of its own/],
  ['a build id twice', (d) => (d.colony.builds[1].id = 'farm'), /colony.json build farm: id used twice/],
  ["a build with a building's name", (d) => (d.colony.builds[0].name = 'Power plant'), /colony.json building reactor: name used twice/],
  ['a build too big for the grid', (d) => (d.colony.builds[0].size = [5, 2]), /colony.json build farm: size must be \[width, height\], each from 1 to 4/],
  ['a build that costs nothing', (d) => (d.colony.builds[0].cost = 0), /colony.json build farm: cost must be a whole number from 1 to 100/],
  ['a build that makes credits', (d) => (d.colony.builds[0].makes = 'credits'), /colony.json build farm: makes must be one of food, materials/],
  ['a build that makes from danger', (d) => (d.colony.builds[0].from = ['soil', 'danger']), /colony.json build farm: from must be a list of the world's numbers it makes from: soil, water, ore, each once/],
  ['a build that makes from soil twice', (d) => (d.colony.builds[0].from = ['soil', 'soil']), /colony.json build farm: from must be a list/],
  ['a build that makes nothing from nothing', (d) => (d.colony.builds[0].from = []), /colony.json build farm: from must be a list/],
  ['a build whose least is unbounded', (d) => (d.colony.builds[0].least = -1), /colony.json build farm: least must be a whole number from 0 to 9/],
  ['a build with a stray field', (d) => (d.colony.builds[0].power = 2), /colony.json build farm: unknown field "power"/],
  ['a build with no words', (d) => delete d.colony.builds[1].text, /colony.json build mine: text must be a non-empty string/],
  // M38f: the colonist a citizen fights a raid as, and the citizens' numbers.
  ['no colonist', (d) => delete d.colony.citizen, /colony.json citizen: must be an object: the colonist a citizen fights a raid as/],
  ['a colonist with a stray field', (d) => (d.colony.citizen.rank = 1), /colony.json citizen: unknown field "rank"/],
  ['a colonist past counting', (d) => (d.colony.citizen.hp = 50), /colony.json citizen: hp must be a whole number from 1 to 20/],
  ['a colonist with an unknown gun', (d) => (d.colony.citizen.weapon = 'railgun'), /colony.json citizen: weapon: unknown weapon "railgun"/],
  ["a colonist with a job's id", (d) => (d.colony.citizen.id = 'medic'), /colony.json citizen: id: "medic" is a job's, an enemy's or a person's/],
  ['a colonist in an unknown suit', (d) => (d.colony.citizen.look.suit = 'tuxedo'), /colony.json citizen: .*suit/],
  ['citizens that never grow', (d) => (d.balance.citizenDays = 0), /balance.json: citizenDays must be a whole number from 1 to 60/],
  ['citizens past counting in a raid', (d) => (d.balance.raidCitizens = 40), /balance.json: raidCitizens must be a whole number from 0 to 12/],
  // M32b: ranks, the fee and recruits' backgrounds.
  ['a job with one rank', (d) => (d.jobs.jobs[0].ranks = d.jobs.jobs[0].ranks.slice(0, 1)), /jobs\.json marine ranks: must be a list of 2 ranks/],
  ['a rank with no name', (d) => (d.jobs.jobs[1].ranks[1].name = ''), /jobs\.json engineer ranks 2: name must be a non-empty string/],
  ['a rank that sharpens nothing', (d) => delete d.jobs.jobs.find((j) => j.id === 'medic').ranks[0].order, /medic ranks 1: must sharpen at least one of order, station, colony/],
  ['a rank setting a number its job lacks', (d) => (d.jobs.jobs.find((j) => j.id === 'pilot').ranks[0].order.aim = 10), /pilot ranks 1: order can't set "aim": the job's order has no such number/],
  ['a rank past its order\'s range', (d) => (d.jobs.jobs.find((j) => j.id === 'scout').ranks[0].order.aim = 500), /scout ranks 1 order: aim must be a whole number from 1 to 100/],
  ['a rank past its effect\'s range', (d) => (d.jobs.jobs.find((j) => j.id === 'quartermaster').ranks[1].station.lockers = 500), /quartermaster ranks 2 station: lockers must be a whole number from 1 to 99/],
  ['rank 2 before rank 1', (d) => (d.balance.rankTwoFights = 2), /rankTwoFights must be more than rankOneFights/],
  ['a rank priced in the thousands', (d) => (d.balance.recruitRankFee = 5000), /recruitRankFee must be a whole number from 0 to 1000/],
  ['no recruits\' backgrounds', (d) => (d.recruits.backgrounds = []), /recruits\.json: backgrounds must be a list of 1 to 40/],
  ['a background id twice', (d) => (d.recruits.backgrounds[1].id = 'green-hand'), /recruits\.json backgrounds: duplicate id "green-hand"/],
  ['a background with no line', (d) => delete d.recruits.backgrounds[3].text, /background survey-hand: text must be a non-empty string/],
  ['a background rolling an unknown job', (d) => d.recruits.backgrounds[1].jobs.push('cook'), /background station-kid: jobs: unknown job "cook"/],
  ['a background rolling a job twice', (d) => d.recruits.backgrounds[1].jobs.push('pilot'), /background station-kid: jobs must be a list of crew jobs, none twice/],
  ['a background rolling an unknown trait', (d) => d.recruits.backgrounds[1].traits.push('lucky'), /background station-kid: traits: unknown trait "lucky"/],
  ['a background giving more traits than a captain picks', (d) => (d.recruits.backgrounds[6].traitCount = 3), /background hired-gun: traitCount must be a whole number from 0 to 2/],
  ['a background giving more traits than it lists', (d) => (d.recruits.backgrounds[0].traitCount = 1), /background green-hand: traitCount must be a whole number from 0 to 2, and no more than its traits/],
  ['a background with its fights backwards', (d) => (d.recruits.backgrounds[7].fights = [12, 8]), /background fleet-veteran: fights must be \[least, most\]/],
  ['a background with its own fee', (d) => (d.recruits.backgrounds[2].fee = 10), /background laid-off-miner: unknown field "fee"/],
  // M33: the sides, and every side the rest of the data names.
  ['no sides', (d) => (d.factions.sides = []), /factions\.json: needs at least one side/],
  ['a side id twice', (d) => (d.factions.sides[1].id = 'conreg'), /factions\.json: duplicate id "conreg"/],
  ['a side with no line', (d) => delete d.factions.sides[0].blurb, /factions\.json side conreg: blurb must be a non-empty string/],
  ['a side in a color the palette lacks', (d) => (d.factions.sides[0].color = 'plaid'), /factions\.json side conreg: color must be one of src\/render\/palette\.js sideColors/],
  ['a side met at the nodes with no patrol words', (d) => delete d.factions.sides[1].patrol, /factions\.json side fleet: its ships are met at the sectors' nodes/],
  ['patrol words missing a line', (d) => delete d.factions.sides[1].patrol.fired, /factions\.json side fleet patrol: fired must be a non-empty string/],
  ['a station no sector names', (d) => (d.factions.stations['Fort Nowhere'] = 'union'), /factions\.json stations: "Fort Nowhere" isn't a station's or a shipyard's name in sectors\.json/],
  ['a station of an unknown side', (d) => (d.factions.stations['Dock Seven'] = 'guild'), /factions\.json stations: Dock Seven: unknown side "guild"/],
  ['a shipyard leaning to a maker nobody knows', (d) => (d.factions.sides[0].yard = { orrery: 3 }), /factions\.json side conreg yard: "orrery" is not a maker \(manufacturers\.json\)/],
  ['a shipyard leaning by nothing', (d) => (d.factions.sides[1].yard = { bastion: 0 }), /factions\.json side fleet yard: bastion's weight must be a whole number from 1 to 100/],
  ['a shipyard leaning to nobody', (d) => (d.factions.sides[1].yard = {}), /factions\.json side fleet yard: must be an object of makers/],
  ['a shipyard of a side nobody knows', (d) => (d.factions.stations['Slipway Four'] = 'guild'), /factions\.json stations: Slipway Four: unknown side "guild"/],
  ['a shipyard giving parts away', (d) => (d.balance.yardPercent = 0), /yardPercent must be a whole number from 1 to 100/],
  ['a shipyard too big for its slots', (d) => (d.balance.yardSize = 30), /yardSize must be a whole number from 0 to 20/],
  ['a client of an unknown side', (d) => (district(d).clients[0].side = 'guild'), /districts\.json tailings client marta: side: unknown side "guild"/],
  ['a job against an unknown side', (d) => (job(d, 'payroll').against = 'guild'), /contracts\.json job payroll: against: unknown side "guild"/],
  ["a job against its own client's side", (d) => (job(d, 'payroll').against = 'union'), /contracts\.json job payroll: is against union, the side one of its clients works for/],
  ['a pursuer on no side', (d) => delete d.backgrounds.backgrounds[0].pursuer.side, /backgrounds\.json miner pursuer: side must be one of the sides in factions\.json/],
  ["a pursuer's hunters on another side", (d) => (d.backgrounds.backgrounds[0].pursuer.side = 'union'), /backgrounds\.json miner pursuer run: hunters: the Con-Reg repo tug must be on the pursuer's side, "union"/],
  ['a ship of an unknown side', (d) => (d.ships.ships.find((s) => s.id === 'cutter').side = 'guild'), /ships\.json cutter: side: unknown side "guild"/],
  ['an event moving an unknown side', (d) => (event(d, 'company-wreck').choices[0].outcomes[0].effects.standing = { guild: -1 }), /event company-wreck choice fast outcome 1 effects standing: unknown side "guild"/],
  ['an event moving a side by nothing', (d) => (event(d, 'company-wreck').choices[0].outcomes[0].effects.standing = { conreg: 0 }), /event company-wreck choice fast outcome 1 effects standing: conreg must be a whole number other than 0/],
  ['an event at a place moving a side', (d) => (event(d, 'cold-hauler').choices[0].outcomes[0].effects.standing = { union: 1 }), /event cold-hauler choice \S+ outcome 1 effects: unknown field "standing"/],
  ['levels of standing out of order', (d) => (d.balance.friendlyStanding = 7), /the levels of standing must rise/],
  ['a campaign starting the other sides cold', (d) => (d.balance.neutralStanding = 1), /a side a campaign starts at 0 with must be neutral/],
  ["the pursuer's side starting cold", (d) => (d.balance.pursuerStanding = -4), /pursuerStanding must be under coldStanding/],
  ['prices rising with standing', (d) => (d.balance.trustedPrice = 95), /a station's prices must fall as standing rises/],
  ['a trusted side paying less than a friendly one', (d) => (d.balance.trustedPay = 5), /trustedPay must be at least friendlyPay/],
  ['docking heat past the meter', (d) => (d.balance.dockHeat = 80), /dockHeat must be a whole number from 0 to 50/],
  // The stations' jobs (M38c).
  ['a station board of nothing', (d) => (d.docks.board = 0), /docks\.json: board must be a whole number from 1 to 5/],
  ["a station client with a district client's id", (d) => (d.docks.clients[0].id = 'marta'), /docks\.json client marta: duplicate client id "marta"/],
  ['a station site on an unknown map', (d) => (d.docks.sites[0].map = 'moon'), /docks\.json site cargoring: unknown or broken map "moon"/],
  ['a site map of a look with no skin', (d) => (d.sites.maps.find((m) => m.id === 'ring').look = 'moon'), /sites\.json ring: look must be one of dock, rock/],
  ["a station's job at a district's site too", (d) => job(d, 'undeclared').sites.push('pit9'), /contracts\.json job undeclared: its sites must all be in one district, or all at the stations/],
  ["a station's job for a district's client", (d) => job(d, 'undeclared').clients.push('marta'), /client "marta" isn't one of the stations' \(docks\.json\)/],
  ["a station's job done once", (d) => (job(d, 'undeclared').once = true), /job undeclared: a station's job comes back with every board: it can't be a quest's or done once/],
  ["a district's job naming a station", (d) => (job(d, 'rent').pitch += ' On {station}.'), /job rent pitch: "\{station\}" can't be filled in/],
  ["too few jobs for a side's stations", (d) => (d.contracts.jobs = d.contracts.jobs.filter((j) => j.id !== 'undeclared')), /docks\.json: the stations of side "hallorans" have 5 jobs to post: a board of 3 needs 6/],
  // The quests (M33b).
  ['a quest that is nobody\'s', (d) => delete quest(d, 'debt').background, /quests\.json quest debt: is a background's thread \(background\), a side's chain \(side\) or a companion's loyalty quest \(companion\), one of the three/],
  ['two threads for a background', (d) => (quest(d, 'pardon').background = 'miner'), /quests\.json quest pardon: miner has a thread already/],
  ["a side's chain with no start", (d) => delete quest(d, 'tender').start, /quests\.json quest tender: a side's chain needs its start/],
  ["a side's chain started at a choice its event lacks", (d) => (quest(d, 'tender').start.choice = 'salute'), /quests\.json quest tender start: "fleet-tender" has no choice "salute"/],
  ['steps out of the order of their acts', (d) => quest(d, 'debt').steps.reverse(), /quests\.json quest debt step 2: steps go in the order of their acts/],
  ["a quest's job off in another district", (d) => (quest(d, 'debt').steps[0].job = 'warrant'), /quests\.json quest debt step 1: job "warrant" must be marked quest: "debt"/],
  ["a quest's job that comes once", (d) => (job(d, 'losepaper').once = true), /quests\.json quest debt step 1: job "losepaper" is a quest's: no once and no drops/],
  ["a quest's job marked for no step", (d) => (job(d, 'payroll').quest = 'debt'), /contracts\.json job payroll: quest "debt" must be a quest one of whose steps names it/],
  ["a quest's event that only does the step", (d) => (quest(d, 'debt').steps[1].done = ['board', 'fly']), /quests\.json quest debt step 2: "refiled" needs a choice that leaves it for the next sector and needs nothing/],
  ["a quest's event with a choice both done and cold", (d) => (quest(d, 'tender').steps[0].cold = ['tag']), /quests\.json quest tender step 1: a choice is done or cold, not both/],
  ["a quest's event marked for no step", (d) => (event(d, 'dead-hauler').quest = 'debt'), /events\.json event dead-hauler: quest "debt" must be a quest one of whose steps names it/],
  ["a quest's place on a ship no preset makes", (d) => (quest(d, 'debt').steps[2].place.ship = 'barge'), /quests\.json quest debt step 3 place: ship: unknown ship preset "barge"/],
  ["a quest's place too far away", (d) => (quest(d, 'debt').steps[2].place.days = 12), /quests\.json quest debt step 3 place: days must be a whole number from 1 to 9/],
  ["a side's chain easing the pursuer off", (d) => (quest(d, 'tender').payoff = { eased: true, said: 'Off they go.' }), /quests\.json quest tender payoff: standing and eased are the pursuer's/],
  ['a pay-off raising standing to hostile', (d) => (quest(d, 'debt').payoff.standing = 'hostile'), /quests\.json quest debt payoff: standing must be a level to raise the pursuer's side to/],
  // The companions (M33c).
  ['a companion of an unknown side', (d) => (companion(d, 'varga').side = 'guild'), /companions\.json companion varga: side: unknown side "guild"/],
  ['two companions for a side', (d) => (companion(d, 'brandt').side = 'fleet'), /companions\.json companion brandt: fleet has a companion already \(varga\)/],
  ['a companion of an unknown job', (d) => (companion(d, 'osei').job = 'cook'), /companions\.json companion osei: job: unknown job "cook"/],
  ['a companion with one trait', (d) => (companion(d, 'osei').traits = ['quick']), /companions\.json companion osei: traits must be 2 different traits/],
  ['a companion with a face no portrait draws', (d) => (companion(d, 'osei').look.hair = 'wig'), /companions\.json companion osei: look must be a face's every layer/],
  ['a companion with no past', (d) => delete companion(d, 'halloran').past, /companions\.json companion halloran: past must be a non-empty string/],
  // Their busts (M34).
  ['a companion in clothes the bust does not draw', (d) => (companion(d, 'varga').bust.wear = 'tuxedo'), /companions\.json companion varga bust: wear must be one the bust draws: coverall, dockcoat, surveyjacket, medcoat/],
  ['a companion with gear the bust does not draw', (d) => (companion(d, 'osei').bust.gear = 'jetpack'), /companions\.json companion osei bust: gear must be one the bust draws: goggles, armband, headset, stethoscope/],
  ['a misspelled bust field', (d) => (companion(d, 'brandt').bust.hat = 'cap'), /companions\.json companion brandt bust: unknown field "hat"/],
  ["a companion on another side's chain", (d) => (companion(d, 'varga').chain = 'foodrun'), /companions\.json companion varga: chain: "foodrun" must be a side's chain of fleet/],
  ["a companion signed on by a choice that doesn't do the step", (d) => (quest(d, 'tender').steps[0].done = ['tag']), /companions\.json companion varga: chain: "storespod"'s choice "tagjoin" signs them on, so it must do the step/],
  ['a choice signing a companion on with no berth', (d) => delete event(d, 'storespod').choices[1].needs, /event storespod choice tagjoin outcome 1 effects: signs a companion on, so the choice must need a berth/],
  ['a berth needed by a choice that signs no one on', (d) => (event(d, 'storespod').choices[0].needs = { berth: 1 }), /event storespod choice tag: needs a berth, so every outcome must sign someone on/],
  ['a companion signed on at the wrong event', (d) => (event(d, 'foodrun').choices[0].outcomes[0].effects.joins = 'varga'), /events\.json event foodrun choice carryjoin: signs on varga, who signs on only at their chain's step/],
  ['an unknown companion signed on', (d) => (event(d, 'runner').choices[0].outcomes[0].effects.joins = 'nobody'), /event runner choice towjoin outcome 1 effects: joins: unknown companion "nobody"/],
  ["a companion's loyalty quest that is someone else's", (d) => (companion(d, 'varga').loyalty = 'brandt-loyal'), /companions\.json companion varga: loyalty: quest "brandt-loyal" must be marked companion: "varga"/],
  ['a loyalty quest started at an event', (d) => (quest(d, 'varga-loyal').start = { event: 'fleet-tender', choice: 'help' }), /quests\.json quest varga-loyal: a loyalty quest starts as its companion signs on: no start/],
  ['a loyalty quest with a step on the run', (d) => quest(d, 'varga-loyal').steps.unshift({ act: 2, event: 'storespod', done: ['tag'], next: 'The pod.' }), /quests\.json quest varga-loyal step 1: a loyalty quest's steps are at the colony/],
  ["a loyalty quest's pay-off with heat", (d) => (quest(d, 'varga-loyal').payoff.heat = -10), /quests\.json quest varga-loyal payoff: a loyalty quest's pay-off is the companion's loyalty, and its words: said alone/],
  ['a talent duller than rank 2', (d) => (companion(d, 'osei').talent.order.aim = 10), /companions\.json companion osei talent order: aim must be as sharp as rank 2's \(20\) or sharper/],
  ['a talent that sharpens nothing', (d) => (companion(d, 'osei').talent.order = { uses: 3 }), /companions\.json companion osei talent order: must sharpen one of rank 2's numbers/],
  ['a talent setting a number its order lacks', (d) => (companion(d, 'osei').talent.order.hp = 5), /companions\.json companion osei talent order: unknown field "hp"/],
  ['a talent past its order\'s range', (d) => (companion(d, 'brandt').talent.order.armor = 9), /companions\.json companion brandt talent order: armor must be a whole number from 1 to 5/],
  ["a talent's reach past its range", (d) => (companion(d, 'halloran').talent.order.reach = 9), /companions\.json companion halloran talent order: reach must be a whole number from 2 to 6/],
  ["a talent's aim on a kit past its range", (d) => (companion(d, 'brandt').talent.order.aim = 60), /companions\.json companion brandt talent order: aim must be a whole number from 1 to 50/],
  ['a talent with an extra its order kind lacks', (d) => (companion(d, 'brandt').talent.order.reach = 3), /companions\.json companion brandt talent order: unknown field "reach"/],
  ["an order's extra past its range", (d) => (d.jobs.jobs.find((j) => j.id === 'medic').order.reach = 1), /medic order: reach must be a whole number from 2 to 6/],
  ['an extra its order kind lacks', (d) => (d.jobs.jobs.find((j) => j.id === 'medic').order.aim = 5), /medic order: unknown field "aim" for patch/],
];

function companion(d, id) {
  return d.companions.companions.find((c) => c.id === id);
}

function quest(d, id) {
  return d.quests.quests.find((q) => q.id === id);
}

function pursuerRun(d) {
  return d.backgrounds.backgrounds[0].pursuer.run;
}

function nodeKind(d, id) {
  return d.sectors.nodes.find((node) => node.id === id);
}

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
  assert.match(run.stdout, /OK \(147 modules, 6 frames, 4 manufacturers, 2 hull styles, 12 styling pieces, 15 weapons, 7 crew jobs, 20 traits, 8 recruits' backgrounds, 20 enemies, 28 encounters, 9 ship presets, 3 acts, 3 backgrounds, 3 districts, 8 site maps, 59 job templates, 12 kinds of sector node, 5 kinds of world, 28 colony buildings, 4 colony builds, 4 kinds of place, 100 events, 4 sides, 11 quests, 4 companions, 37 sounds\)/);
});
