import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backdropTextureKey,
  createFrameScheduler,
  RenderActivity,
} from '../src/renderPerformance.ts';

function frames() {
  let next = 0;
  const queued = new Map();
  return {
    request(callback) {
      queued.set(++next, callback);
      return next;
    },
    cancel(id) {
      queued.delete(id);
    },
    get pending() {
      return queued.size;
    },
    run() {
      const batch = [...queued.values()];
      queued.clear();
      for (const callback of batch) callback(0);
    },
  };
}

test('viewport bursts use the final measurement once before physics continues', () => {
  const clock = frames();
  let viewport = 390;
  const measured = [];
  const scheduler = createFrameScheduler(
    () => measured.push(viewport),
    clock.request,
    clock.cancel,
  );
  scheduler.request();
  viewport = 402;
  scheduler.request();
  viewport = 480;
  scheduler.request();
  assert.equal(clock.pending, 1);
  scheduler.flush();
  assert.deepEqual(measured, [480]);
  clock.run();
  assert.deepEqual(measured, [480]);
  scheduler.request();
  scheduler.cancel();
  clock.run();
  assert.deepEqual(measured, [480]);
});

test('background reuse depends on background, canvas dimensions and derived ground line', () => {
  const key = backdropTextureKey('classic', 390, 844, 687.86);
  assert.equal(key, backdropTextureKey('classic', 390, 844, 687.86));
  assert.equal(key, backdropTextureKey('classic', 390, 844, 688.1));
  assert.notEqual(key, backdropTextureKey('city', 390, 844, 687.86));
  assert.notEqual(key, backdropTextureKey('classic', 480, 844, 687.86));
  assert.notEqual(key, backdropTextureKey('classic', 390, 874, 687.86));
  assert.notEqual(key, backdropTextureKey('classic', 390, 844, 700));
});

test('static rendering sleeps after its frame and resumes without a large physics delta', () => {
  const clock = frames();
  const transitions = [];
  const calls = [];
  const loop = {
    running: true,
    resetDelta() {
      calls.push('reset');
    },
    wake() {
      calls.push('wake');
      this.running = true;
      activity.afterRender();
    },
    sleep() {
      calls.push('sleep');
      this.running = false;
    },
  };
  const activity = new RenderActivity(
    loop,
    (running) => transitions.push(running),
    clock.request,
    clock.cancel,
  );
  activity.setContinuous(false);
  activity.afterRender();
  assert.equal(loop.running, false);
  activity.requestFrame();
  activity.requestFrame();
  assert.equal(clock.pending, 1);
  clock.run();
  assert.deepEqual(calls, ['sleep', 'reset', 'wake', 'sleep']);
  assert.deepEqual(transitions, [false, true, false]);
  activity.setContinuous(true);
  clock.run();
  assert.equal(loop.running, true);
  activity.afterRender();
  assert.equal(loop.running, true);
});

test('crash effects finish before sleep, hidden pages sleep immediately and wake on return', () => {
  const clock = frames();
  const loop = {
    running: true,
    resetDelta() {},
    wake() {
      this.running = true;
    },
    sleep() {
      this.running = false;
    },
  };
  const activity = new RenderActivity(loop, () => {}, clock.request, clock.cancel);
  activity.setContinuous(false);
  activity.afterRender(true);
  assert.equal(loop.running, true);
  activity.afterRender(false);
  assert.equal(loop.running, false);
  activity.requestFrame();
  activity.setVisible(false);
  assert.equal(clock.pending, 0);
  activity.setContinuous(true);
  clock.run();
  assert.equal(loop.running, false);
  activity.setVisible(true);
  clock.run();
  assert.equal(loop.running, true);
  activity.afterRender();
  assert.equal(loop.running, true);
  activity.setVisible(false);
  assert.equal(loop.running, false);
  activity.setVisible(true);
  activity.dispose();
  assert.equal(clock.pending, 0);
});
