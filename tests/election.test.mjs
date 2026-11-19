import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { topTwo, eligibleForRound } from '../server/election.js';
const venues = JSON.parse(fs.readFileSync(new URL('../data/venues.json', import.meta.url), 'utf8'));

test('os dois finalistas são os mais votados por categoria', () => {
  const counts = Object.fromEntries(venues.map(v => [v.id, 0]));
  counts['bar-atlanta'] = 10; counts['bar-porao'] = 7; counts['bar-curtica'] = 2;
  counts['burger-cantagalo'] = 17; counts['burger-bigboss'] = 9; counts['burger-gigante'] = 1;
  assert.deepEqual(topTwo(venues, 'bars', counts), ['bar-atlanta', 'bar-porao']);
  assert.deepEqual(topTwo(venues, 'burgers', counts), ['burger-cantagalo', 'burger-bigboss']);
});

test('local inativo não pode ir à final, mesmo se tiver votos antigos', () => {
  const counts = Object.fromEntries(venues.map(v => [v.id, 0]));
  counts['burger-ferreiro'] = 1000; counts['burger-bigboss'] = 3;
  assert.equal(topTwo(venues, 'burgers', counts).includes('burger-ferreiro'), false);
});

test('só os finalistas podem votar no segundo turno', () => {
  const election = { round: 2, phase: 'open', finalists: { bars: ['bar-curtica', 'bar-porao'], burgers: ['burger-bigboss', 'burger-cantagalo'] } };
  assert.equal(eligibleForRound(venues.find(v => v.id === 'bar-curtica'), election), true);
  assert.equal(eligibleForRound(venues.find(v => v.id === 'bar-atlanta'), election), false);
  assert.equal(eligibleForRound(venues.find(v => v.id === 'burger-ferreiro'), election), false);
  assert.equal(eligibleForRound(venues.find(v => v.id === 'bar-curtica'), { ...election, phase: 'closed' }), false);
});
