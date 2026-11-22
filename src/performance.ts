import type Phaser from 'phaser';

/** A bounded window of frame intervals; no user or gameplay payloads are retained. */
export class FrameMetrics {
  private intervals: number[] = [];
  private cursor = 0;
  private previous?: number;
  private frames = 0;
  private capacity: number;

  constructor(capacity = 1800) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('Frame metric capacity must be a positive integer');
    this.capacity = capacity;
  }

  record(time: number) {
    if (!Number.isFinite(time)) return;
    this.frames++;
    if (this.previous !== undefined && time > this.previous) {
      const interval = time - this.previous;
      if (this.intervals.length < this.capacity) this.intervals.push(interval);
      else {
        this.intervals[this.cursor] = interval;
        this.cursor = (this.cursor + 1) % this.capacity;
      }
    }
    this.previous = time;
  }

  pause() {
    this.previous = undefined;
  }

  reset() {
    this.intervals = [];
    this.cursor = 0;
    this.previous = undefined;
    this.frames = 0;
  }

  snapshot() {
    const sorted = this.intervals.slice().sort((a, b) => a - b);
    const count = sorted.length;
    const round = (value: number) => Math.round(value * 100) / 100;
    const percentile = (fraction: number) =>
      count ? round(sorted[Math.ceil(count * fraction) - 1]) : null;
    return {
      sampledFrames: this.frames,
      windowIntervals: count,
      fps: count ? round((1000 * count) / sorted.reduce((sum, value) => sum + value, 0)) : null,
      frameMsP50: percentile(0.5),
      frameMsP95: percentile(0.95),
      frameMsMax: count ? round(sorted[count - 1]) : null,
      framesOver33Ms: sorted.filter((value) => value > 1000 / 30).length,
      framesOver50Ms: sorted.filter((value) => value > 50).length,
    };
  }
}

/** Opt-in development diagnostics. Samples only active gameplay, without network telemetry. */
export function installPerformanceDiagnostics(game: Phaser.Game, inspect: () => object) {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get('perf') !== '1')
    return () => {};

  const metrics = new FrameMetrics();
  let renderedFrames = 0;
  const display = document.createElement('pre');
  display.setAttribute('aria-label', 'Хөгжүүлэлтийн performance хэмжүүр');
  display.style.cssText =
    'position:fixed;right:4px;top:4px;z-index:10000;margin:0;padding:6px;' +
    'max-width:190px;background:#101826dd;color:#fff;font:10px/1.4 monospace;' +
    'border-radius:5px;pointer-events:none;white-space:pre-wrap';
  document.body.append(display);

  const snapshot = () => {
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      ...metrics.snapshot(),
      renderedFrames,
      renderer: game.renderer.type === 2 ? 'WebGL' : 'Canvas',
      jsHeapMiB: heap ? Math.round((heap.usedJSHeapSize / 1048576) * 100) / 100 : null,
      ...inspect(),
    };
  };
  const sample = () => {
    renderedFrames++;
    const state = inspect() as { phase?: string };
    if (state.phase === 'PLAYING' && !document.hidden) metrics.record(game.loop.now);
    else metrics.pause();
  };
  const pause = () => metrics.pause();
  const refresh = () => {
    const data = snapshot();
    const state = data as {
      phase?: string;
      backdropBuilds?: number;
      rawFrameMs?: number;
      gameFrameMs?: number;
      backingRatio?: number;
      qualityTier?: string;
      speedFactor?: number;
    };
    display.textContent = [
      `DEV · ${state.phase ?? ''} · ${data.renderer}`,
      `Playing FPS: ${data.fps ?? '—'}`,
      `Frame p95: ${data.frameMsP95 ?? '—'} ms`,
      `Clock raw/game: ${state.rawFrameMs ?? '—'}/${state.gameFrameMs ?? '—'} ms`,
      `Canvas DPR: ${state.backingRatio ?? '—'} · ${state.qualityTier ?? '—'}`,
      `Game speed: ${state.speedFactor?.toFixed(2) ?? '—'}×`,
      `>33ms: ${data.framesOver33Ms} · >50ms: ${data.framesOver50Ms}`,
      `Frame window: ${data.windowIntervals}/1800`,
      `Background builds: ${state.backdropBuilds ?? '—'}`,
      `JS heap: ${data.jsHeapMiB ?? 'N/A'} MiB`,
    ].join('\n');
  };
  const diagnostics = {
    snapshot,
    reset() {
      metrics.reset();
      renderedFrames = 0;
      refresh();
    },
  };
  const host = window as typeof window & { __SONO_PERFORMANCE__?: typeof diagnostics };
  host.__SONO_PERFORMANCE__ = diagnostics;
  game.events.on('postrender', sample);
  game.events.on('hidden', pause);
  document.addEventListener('visibilitychange', pause);
  const timer = window.setInterval(refresh, 1000);
  refresh();
  const destroy = () => {
    window.clearInterval(timer);
    game.events.off('postrender', sample);
    game.events.off('hidden', pause);
    document.removeEventListener('visibilitychange', pause);
    display.remove();
    if (host.__SONO_PERFORMANCE__ === diagnostics) delete host.__SONO_PERFORMANCE__;
  };
  game.events.once('destroy', destroy);
  return destroy;
}
