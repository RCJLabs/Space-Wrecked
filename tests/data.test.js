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
const event = (d, id) => d.events.events.find((e) => e.id === id);
const small = (d) => Object.assign(d.frames.frames[0], { width: 4, height: 4 });
const hostile = (d) => d.sectors.nodes.find((node) => node.id === 'hostile');
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
  ['too few traits for a captain', (d) => (d.traits.traits = d.traits.traits.slice(0, 1)), /needs at least 2 traits for a captain to pick/],
  ['a captain name too long to keep', (d) => d.backgrounds.backgrounds[0].captains.push('Maximilian Bartholomew Oyelaran'), /captains must be a list of 1 to 20 names of up to 24 letters/],
  ['trait that does nothing', (d) => (d.traits.traits[0].effects = {}), /traits\.json steady: effects must change something/],
  ['trait moving a number fights have not got', (d) => (d.traits.traits[0].effects = { luck: 5 }), /effects: unknown number "luck"/],
  ['trait far past its range', (d) => (d.traits.traits[0].effects = { aim: 50 }), /effects\.aim must be a whole number from -30 to 30/],
  ['misspelled trait field', (d) => (d.traits.traits[0].effect = {}), /traits\.json steady: unknown field "effect"/],
  ['sector with no jump point', (d) => (d.sectors.nodes = d.sectors.nodes.filter((n) => n.id !== 'exit')), /the "exit" node kind is missing/],
  ['more stations than columns between', (d) => (d.sectors.counts.station = [1, 9]), /counts take up to 9 columns, but only 5 lie between/],
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
  ['act standing in with no words', (d) => (d.campaign.acts[1].stub = ''), /act #2: stub must be a non-empty string/],
  ['background with no words for lifting off', (d) => delete d.backgrounds.backgrounds[0].launch, /miner launch: must be \{ text, escaped \}/],
  ['launch with nothing for an empty hangar', (d) => (d.backgrounds.backgrounds[0].launch.escaped = ''), /launch: text and escaped must be non-empty strings/],
  ['misspelled launch field', (d) => (d.backgrounds.backgrounds[0].launch.escape = 'Gone.'), /launch: unknown field "escape"/],
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
  ['board bigger than the jobs allow', (d) => (d.contracts.boardSize = 5) && d.contracts.jobs.pop(), /has 8 jobs that come back \(of 9\): a board of 5 needs 10/],
  ['job done once as a word', (d) => (job(d, 'repo').once = 'yes'), /job repo: once must be true or false/],
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
  ['act lifting off on nothing', (d) => (d.campaign.acts[0].liftOff = 0), /liftOff must be a number above 0, up to 4/],
  ['shop run by a stranger', (d) => (d.districts.districts[0].shop.dealer = 'nobody'), /dealer "nobody" isn't one of the district's clients/],
  ['shop stocking more than its table has', (d) => (d.districts.districts[0].shop.size = 12), /a stock of 12 needs as many different parts/],
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
  ['a medic with an unknown station effect', (d) => (d.jobs.jobs.find((j) => j.id === 'medic').station = { cook: 1 }), /medic: station: unknown effect "cook"/],
  ['a station effect on an enemy', (d) => (d.enemies.enemies[0].station = { heal: 1 }), /enemies\.json \w+: unknown field "station"/],
  ['a recruit name twice', (d) => d.recruits.first.push(d.recruits.first[0]), /recruits\.json: first has a name twice/],
  ['a recruit name too long for a crew member', (d) => d.recruits.last.push('Wolfeschlegelsteinhausen'), /recruits\.json: last must be a list of 2 to 200 names of up to 11 letters/],
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
  assert.match(run.stdout, /OK \(12 modules, 1 frame, 1 manufacturer, 4 weapons, 3 crew jobs, 6 traits, 7 enemies, 9 encounters, 3 ship presets, 3 acts, 1 background, 1 district, 4 site maps, 10 job templates, 9 kinds of sector node, 10 events\)/);
});
