import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { GAME_FRAME_TIMING } from '../src/renderPerformance.ts';

const require = createRequire(import.meta.url);
const TimeStep = require('phaser/src/core/TimeStep.js');

function withTimeStep(check) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let now = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { performance: { now: () => now } },
  });
  let loop;
  try {
    loop = new TimeStep({}, GAME_FRAME_TIMING);
    const frames = { starts: 0, stops: 0 };
    let elapsed = 0;
    let callbacks = 0;
    loop.raf.start = () => {
      loop.raf.isRunning = true;
      frames.starts++;
    };
    loop.raf.stop = () => {
      loop.raf.isRunning = false;
      frames.stops++;
    };
    loop.start((_time, delta) => {
      elapsed += delta;
      callbacks++;
    });
    const clock = {
      loop,
      frames,
      get elapsed() {
        return elapsed;
      },
      get callbacks() {
        return callbacks;
      },
      advance(fps, seconds) {
        const start = now;
        for (let frame = 1; frame <= fps * seconds; frame++) {
          now = start + (frame * 1000) / fps;
          loop.step(now);
        }
      },
      idle(milliseconds) {
        now += milliseconds;
      },
    };
    check(clock);
  } finally {
    loop?.sleep();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
}

function assertElapsed(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `${actual} ms elapsed, expected ${expected} ms`,
  );
}

for (const fps of [30, 60, 120]) {
  test(`simulation clock follows wall time immediately and after six seconds at ${fps} FPS`, () => {
    withTimeStep((clock) => {
      clock.advance(fps, 1);
      assertElapsed(clock.elapsed, 1000);
      clock.advance(fps, 5);
      assertElapsed(clock.elapsed, 6000);
    });
  });
}

test('changing display frame rates keeps one continuous simulation clock', () => {
  withTimeStep((clock) => {
    let expected = 0;
    for (const fps of [30, 60, 120, 30]) {
      clock.advance(fps, 1);
      expected += 1000;
      assertElapsed(clock.elapsed, expected);
    }
  });
});

test('visible rendering preserves clock speed when the browser focus flag is false', () => {
  withTimeStep((clock) => {
    clock.loop.blur();
    clock.advance(30, 6);
    assertElapsed(clock.elapsed, 6000);
    clock.loop.focus();
    clock.advance(30, 1);
    assertElapsed(clock.elapsed, 7000);
  });
});

test('repeated static sleep and wake exclude idle time without slowing subsequent frames', () => {
  withTimeStep((clock) => {
    clock.advance(30, 1);
    assertElapsed(clock.elapsed, 1000);
    for (const fps of [30, 60, 120]) {
      const before = clock.elapsed;
      const starts = clock.frames.starts;
      clock.loop.sleep();
      assert.equal(clock.loop.running, false);
      clock.idle(60000);
      clock.loop.resetDelta();
      clock.loop.wake();
      assert.equal(clock.loop.running, true);
      assert.equal(clock.frames.starts, starts + 1);
      assertElapsed(clock.elapsed, before);
      const callbacks = clock.callbacks;
      clock.loop.wake();
      assert.equal(clock.callbacks, callbacks);
      assert.equal(clock.frames.starts, starts + 1);
      clock.advance(fps, 1);
      assertElapsed(clock.elapsed, before + 1000);
    }
  });
});
