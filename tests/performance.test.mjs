import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameMetrics } from '../src/performance.ts';

test('frame metrics retain a bounded recent window and report frame stalls', () => {
  const metrics = new FrameMetrics(3);
  for (const time of [0, 10, 20, 40, 100]) metrics.record(time);
  assert.deepEqual(metrics.snapshot(), {
    sampledFrames: 5,
    windowIntervals: 3,
    fps: 33.33,
    frameMsP50: 20,
    frameMsP95: 60,
    frameMsMax: 60,
    framesOver33Ms: 1,
    framesOver50Ms: 1,
  });
});

test('idle or background pauses do not count as a slow gameplay frame', () => {
  const metrics = new FrameMetrics();
  metrics.record(0);
  metrics.record(20);
  metrics.pause();
  metrics.record(10000);
  metrics.record(10020);
  assert.equal(metrics.snapshot().fps, 50);
  assert.equal(metrics.snapshot().frameMsMax, 20);
  assert.equal(metrics.snapshot().windowIntervals, 2);
  metrics.reset();
  assert.equal(metrics.snapshot().fps, null);
  assert.equal(metrics.snapshot().sampledFrames, 0);
});
