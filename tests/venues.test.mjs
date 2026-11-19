import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync(new URL('../data/venues.json', import.meta.url), 'utf8'));
test('exatamente cinco bares e cinco hamburguerias', () => {
  assert.equal(items.length, 10);
  assert.equal(items.filter(v => v.category === 'bars').length, 5);
  assert.equal(items.filter(v => v.category === 'burgers').length, 5);
});
test('todos os locais têm IDs únicos e dados para mapa/voto', () => {
  assert.equal(new Set(items.map(v => v.id)).size, items.length);
  for (const venue of items) {
    assert.match(venue.address, /São Paulo/);
    assert.match(venue.id, /^(bar|burger)-/);
    assert.equal(typeof venue.enabled, 'boolean');
    assert.ok(venue.name && venue.neighborhood && venue.tagline);
    assert.equal(venue.images.length, 3);
  }
});
test('local apontado como encerrado não aceita voto', () => {
  const ferreiro = items.find(item => item.id === 'burger-ferreiro');
  assert.equal(ferreiro.enabled, false);
  assert.ok(ferreiro.notice?.length > 15);
});
