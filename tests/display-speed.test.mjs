import test from 'node:test';
import assert from 'node:assert/strict';
import { approachSpeedFactor, speedFactor } from '../src/gameplay.ts';
import { backingPixels, cappedPixelRatio } from '../src/displayScale.ts';

const config = {
  speed: { step: 0.1, max: 2, thresholds: [10, 25, 45] },
};

test('the canvas backing ratio is capped at 1.5 while CSS geometry stays independent', () => {
  assert.equal(cappedPixelRatio(1), 1);
  assert.equal(cappedPixelRatio(1.5), 1.5);
  assert.equal(cappedPixelRatio(3), 1.5);
  assert.equal(cappedPixelRatio(NaN), 1);
  assert.equal(backingPixels(390, cappedPixelRatio(3)), 585);
  assert.equal(backingPixels(844, cappedPixelRatio(3)), 1266);
  assert.equal(backingPixels(320, cappedPixelRatio(1)), 320);
});

for (const fps of [30, 60, 120]) {
  test(`server step ramps over 0.4 seconds at ${fps} FPS without overshooting`, () => {
    const target = speedFactor(config, 10);
    let actual = 1;
    for (let frame = 0; frame < fps * 0.2; frame++)
      actual = approachSpeedFactor(actual, target, config.speed.step, 1 / fps);
    assert.ok(Math.abs(actual - 1.05) < 1e-10);
    for (let frame = 0; frame < fps * 0.2; frame++)
      actual = approachSpeedFactor(actual, target, config.speed.step, 1 / fps);
    assert.ok(Math.abs(actual - target) < 1e-10);
    assert.equal(approachSpeedFactor(actual, target, config.speed.step, 1 / fps), target);
    assert.equal(approachSpeedFactor(actual, 1, config.speed.step, 1 / fps), 1);
  });
}

test('a later threshold ramps from the current factor and respects the server maximum', () => {
  let actual = 1.1;
  const target = speedFactor(config, 25);
  for (let frame = 0; frame < 60; frame++) {
    actual = approachSpeedFactor(actual, target, config.speed.step, 1 / 60);
    assert.ok(actual <= target);
  }
  assert.equal(actual, target);
  assert.equal(speedFactor(config, 100), 1.3);
  assert.equal(speedFactor({ ...config, speed: { ...config.speed, max: 1.2 } }, 100), 1.2);
});
