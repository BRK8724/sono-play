import test from 'node:test';
import assert from 'node:assert/strict';
import { birdBodyDisplaySize } from '../src/birdAppearance.ts';

test('Pilot, Santa and Gold have the same opaque width and height', () => {
  const pilot = birdBodyDisplaySize('pilot');
  const santa = birdBodyDisplaySize('santa');
  const gold = birdBodyDisplaySize('gold');

  assert.deepEqual(pilot, { width: 54.2, height: 52.8 });
  assert.ok(Math.abs(pilot.width - 54.2) < 0.02, 'default opaque width');
  assert.ok(Math.abs(pilot.height - 52.8) < 0.02, 'default opaque height');
  for (const [name, skin, opaqueHeight] of [
    ['Santa', santa, 464 / 512],
    ['Gold', gold, 460 / 512],
  ]) {
    assert.ok(Math.abs(skin.width - 54.22) < 0.02, `${name} opaque width`);
    assert.ok(Math.abs(skin.height * opaqueHeight - 52.79) < 0.02, `${name} opaque height`);
  }
});
