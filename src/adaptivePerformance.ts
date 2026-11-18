export type PerformanceTier = 'high' | 'balanced' | 'economy' | 'low';

export type RenderProfile = {
  tier: PerformanceTier;
  maxDpr: number;
  smokeCount: number;
};

export const RENDER_PROFILES: Record<PerformanceTier, RenderProfile> = {
  high: { tier: 'high', maxDpr: 1.5, smokeCount: 7 },
  balanced: { tier: 'balanced', maxDpr: 1.25, smokeCount: 5 },
  economy: { tier: 'economy', maxDpr: 1, smokeCount: 3 },
  low: { tier: 'low', maxDpr: 1, smokeCount: 1 },
};

const WINDOW_MS = 2_500;
const MIN_SAMPLES = 30;
const SAMPLE_CAPACITY = 180;

/**
 * Adjusts render quality from real frame intervals. It never changes gameplay
 * physics, collision sizes, server tuning, or score. Fixed-size buffers avoid
 * allocating arrays in the render callback.
 */
export class AdaptivePerformance {
  private intervals = new Float32Array(SAMPLE_CAPACITY);
  private sorted = new Float32Array(SAMPLE_CAPACITY);
  private count = 0;
  private lastFrame = 0;
  private windowStarted = 0;
  private badWindows = 0;
  private goodWindows = 0;
  private tier: PerformanceTier = 'balanced';

  constructor(private readonly onTierChange: (profile: RenderProfile) => void) {}

  get profile() {
    return RENDER_PROFILES[this.tier];
  }

  resetWindow() {
    this.count = 0;
    this.lastFrame = 0;
    this.windowStarted = 0;
    this.badWindows = 0;
    this.goodWindows = 0;
  }

  sample(now: number) {
    if (this.lastFrame > 0) {
      if (this.count < SAMPLE_CAPACITY) this.intervals[this.count++] = now - this.lastFrame;
      if (this.windowStarted === 0) this.windowStarted = now;
      if (now - this.windowStarted >= WINDOW_MS && this.count >= MIN_SAMPLES) {
        this.evaluateWindow();
        this.count = 0;
        this.windowStarted = now;
      }
    }
    this.lastFrame = now;
  }

  private evaluateWindow() {
    const budget = 1000 / 60;
    this.sorted.set(this.intervals.subarray(0, this.count), 0);
    this.sorted.subarray(0, this.count).sort();
    const p95 = this.sorted[Math.min(this.count - 1, Math.floor(this.count * 0.95))];
    let missed = 0;
    for (let index = 0; index < this.count; index++) {
      if (this.intervals[index] > budget * 1.15) missed++;
    }
    const missedRatio = missed / this.count;
    const bad =
      this.tier === 'high' || this.tier === 'balanced'
        ? p95 > 17.8 || missedRatio > 0.08
        : p95 > 18.2 || missedRatio > 0.1;
    this.badWindows = bad ? this.badWindows + 1 : 0;

    if (this.tier === 'high' && this.badWindows >= 2) {
      this.changeTier('balanced');
      return;
    }
    if (this.tier === 'balanced' && this.badWindows >= 2) {
      this.changeTier('economy');
      return;
    }
    if (this.tier === 'economy' && this.badWindows >= 2) {
      this.changeTier('low');
      return;
    }

    // Recover visual sharpness only after a long stable period. Staying at
    // 30 FPS requires a new launch before moving up, avoiding mode oscillation.
    if ((this.tier === 'balanced' || this.tier === 'economy') && p95 < 16.7 && missedRatio < 0.02) {
      this.goodWindows++;
      if (this.goodWindows >= 6) this.changeTier(this.tier === 'balanced' ? 'high' : 'balanced');
    } else {
      this.goodWindows = 0;
    }
  }

  private changeTier(tier: PerformanceTier) {
    if (tier === this.tier) return;
    this.tier = tier;
    this.badWindows = 0;
    this.goodWindows = 0;
    this.count = 0;
    this.windowStarted = 0;
    this.onTierChange(this.profile);
  }
}
