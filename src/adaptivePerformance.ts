export type PerformanceTier = 'high' | 'balanced' | 'economy' | 'low';

export type RenderProfile = {
  tier: PerformanceTier;
  maxDpr: number;
  smokeCount: number;
};

const PROFILES: readonly RenderProfile[] = [
  { tier: 'low', maxDpr: 0.85, smokeCount: 1 },
  { tier: 'economy', maxDpr: 1, smokeCount: 3 },
  { tier: 'balanced', maxDpr: 1.25, smokeCount: 5 },
  { tier: 'high', maxDpr: 1.5, smokeCount: 7 },
];

const WINDOW_MS = 1_500;
const MIN_SAMPLES = 20;
const SAMPLE_CAPACITY = 480;
const FRAME_BUDGET_MS = 1000 / 60;

type DeviceCapabilities = { deviceMemory?: number; hardwareConcurrency?: number };

/** Adjusts rendering cost from frame intervals without coupling it to the game simulation. */
export class AdaptivePerformance {
  private intervals = new Float32Array(SAMPLE_CAPACITY);
  private sorted = new Float32Array(SAMPLE_CAPACITY);
  private count = 0;
  private previousFrame?: number;
  private activeTime = 0;
  private badWindows = 0;
  private goodWindows = 0;
  private profileIndex: number;

  constructor(
    private readonly onTierChange: (profile: RenderProfile) => void,
    { deviceMemory, hardwareConcurrency }: DeviceCapabilities = {},
  ) {
    const limitedMemory = deviceMemory !== undefined && deviceMemory <= 2;
    const limitedThreads = hardwareConcurrency !== undefined && hardwareConcurrency <= 2;
    this.profileIndex = limitedMemory || limitedThreads ? 1 : 2;
  }

  get profile() {
    return PROFILES[this.profileIndex];
  }

  pause() {
    this.previousFrame = undefined;
  }

  sample(now: number) {
    const previous = this.previousFrame;
    this.previousFrame = now;
    if (previous === undefined || now <= previous) return;

    const interval = now - previous;
    this.intervals[this.count++] = interval;
    this.activeTime += interval;
    if (
      (this.activeTime >= WINDOW_MS && this.count >= MIN_SAMPLES) ||
      this.count === SAMPLE_CAPACITY
    ) {
      this.evaluateWindow();
      this.count = 0;
      this.activeTime = 0;
    }
  }

  private evaluateWindow() {
    const intervals = this.intervals.subarray(0, this.count);
    const sorted = this.sorted.subarray(0, this.count);
    sorted.set(intervals);
    sorted.sort();
    const p50 = sorted[Math.ceil(this.count * 0.5) - 1];
    const p95 = sorted[Math.ceil(this.count * 0.95) - 1];
    let missed = 0;
    for (const interval of intervals) {
      if (interval > FRAME_BUDGET_MS * 1.15) missed++;
    }

    const missedRatio = missed / this.count;
    const bad = p95 > 18.2 || missedRatio > 0.08;
    const good = p95 <= 17.5 && missedRatio < 0.02;
    this.badWindows = bad ? this.badWindows + 1 : 0;
    this.goodWindows = good ? this.goodWindows + 1 : 0;

    // A sustained cadence below ~45 Hz warrants an immediate step down.
    if (this.profileIndex > 0 && (p50 > 22 || this.badWindows >= 2)) {
      this.changeProfile(this.profileIndex - 1);
    } else if (
      this.profileIndex < PROFILES.length - 1 &&
      this.goodWindows >= (this.profileIndex === 0 ? 12 : 8)
    ) {
      this.changeProfile(this.profileIndex + 1);
    }
  }

  private changeProfile(index: number) {
    this.profileIndex = index;
    this.badWindows = 0;
    this.goodWindows = 0;
    this.onTierChange(this.profile);
  }
}
