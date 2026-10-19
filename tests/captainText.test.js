import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOOK_LAYERS } from '../src/sim/looks.js';
import { captainText, effectText, LAYER_NAMES, LOOK_WORDS } from '../src/ui/campaign/captainText.js';
import { rules } from './battleKit.js';

test('making a captain: the background, the jobs with their numbers, and every trait with its effect', () => {
  const text = captainText(rules, { name: 'Rosa Vint', job: 'marine', traits: [] });
  assert.deepEqual(text.background, { name: 'Debt-bound miner', blurb: rules.backgrounds.get('miner').blurb, pursuer: 'Con-Reg Recovery' });
  assert.deepEqual(text.jobs.map((job) => [job.name, job.picked]), [['Marine', true], ['Engineer', false], ['Medic', false]]);
  assert.equal(text.jobs[0].line, '10 hit points · aim 70 · defense 0 · moves 4 · armor 1 · Rifle');
  assert.equal(text.traits.length, 20);
  assert.deepEqual(text.traits.find((trait) => trait.id === 'hothead'), { id: 'hothead', name: 'Hothead', text: rules.traits.get('hothead').text, effect: 'Aim +10, defense −5', picked: false });
  assert.equal(text.captain, '10 hit points · aim 70 · defense 0 · moves 4 · armor 1 · Rifle');
  assert.deepEqual(text.hint, { tone: 'info', text: 'Pick 2 traits: 2 to go.' });
  assert.equal(text.ready, false);
});

test("the captain's numbers follow the traits, and the hint says what is left", () => {
  const text = captainText(rules, { name: ' Rosa Vint ', job: 'medic', traits: ['quick', 'thick-skull'] });
  assert.equal(text.captain, '10 hit points · aim 60 · defense 10 · moves 6 · armor 0 · Pistol');
  assert.deepEqual(text.hint, { tone: 'good', text: 'Rosa Vint, medic: Quick feet and Thick skull. Tap Next.' });
  assert.equal(text.ready, true);
  assert.deepEqual(captainText(rules, { name: 'Rosa', job: 'medic', traits: ['quick'] }).hint.text, 'Pick 2 traits: 1 to go.');
  assert.deepEqual(captainText(rules, { name: '', job: 'medic', traits: ['quick', 'patched'] }).hint.text, 'Give your captain a name.');
  assert.equal(captainText(rules, { name: 'Rosa', job: null, traits: [] }).captain, '');
});

test('effects in words', () => {
  assert.equal(effectText({ hp: 2 }), 'Hit points +2');
  assert.equal(effectText({ defense: -5, aim: 10 }), 'Aim +10, defense −5');
  assert.equal(effectText({ mobility: 1, armor: -1 }), 'Moves +1, armor −1');
});

test("the captain's look in words: each layer and its choice, and a word for every choice", () => {
  const look = { face: 3, skin: 'tan', hair: 'sidepart', hairColor: 'darkBrown', eyes: 'grey', beard: 'none', mark: 'cybereye' };
  const text = captainText(rules, { name: 'Rosa', job: 'marine', traits: [], look });
  assert.deepEqual(
    text.look.map(({ label, value }) => `${label}: ${value}`),
    ['Face: 4 of 12', 'Skin: Tan', 'Hair: Side part', 'Hair color: Dark brown', 'Eyes: Gray', 'Beard: None', 'Mark: Cyber eye'],
  );
  assert.deepEqual(captainText(rules, { name: 'Rosa', job: 'marine', traits: [] }).look, [], 'no look, no words');
  for (const [key, choices] of Object.entries(LOOK_LAYERS)) {
    assert.ok(LAYER_NAMES[key], key);
    for (const choice of choices) assert.match(LOOK_WORDS[key][choice] ?? '', /^[A-Z][a-z]+( [a-z]+)?$/, `${key} ${choice}`);
  }
});
