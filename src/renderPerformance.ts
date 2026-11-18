type RequestFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (id: number) => void;

// The fixed-step simulation needs real elapsed time. Phaser's default smoothing
// clamps startup/wake frames to a 60 Hz target, slowing lower-refresh devices.
export const GAME_FRAME_TIMING = { smoothStep: false } as const;

/** Multiple viewport signals share one update using the latest DOM measurements. */
export function createFrameScheduler(
  callback: () => void,
  requestFrame: RequestFrame = requestAnimationFrame,
  cancelFrame: CancelFrame = cancelAnimationFrame,
) {
  let frame: number | null = null;
  return {
    request() {
      if (frame !== null) return;
      frame = requestFrame(() => {
        frame = null;
        callback();
      });
    },
    flush() {
      if (frame === null) return;
      cancelFrame(frame);
      frame = null;
      callback();
    },
    cancel() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
    },
  };
}

/** Only values affecting the generated layers participate in texture reuse. */
export function backdropTextureKey(
  background: string,
  width: number,
  height: number,
  ground: number,
) {
  return JSON.stringify([background, width, height, Math.round(ground)]);
}

type RenderLoop = {
  running: boolean;
  resetDelta(): void;
  wake(): void;
  sleep(): void;
};

/** Static scenes render once after changes. Animated scenes keep the normal loop. */
export class RenderActivity {
  private loop: RenderLoop;
  private continuous = false;
  private visible = true;
  private onChange: (running: boolean) => void;
  private repaint: ReturnType<typeof createFrameScheduler>;

  constructor(
    loop: RenderLoop,
    onChange: (running: boolean) => void,
    requestFrame?: RequestFrame,
    cancelFrame?: CancelFrame,
  ) {
    this.loop = loop;
    this.onChange = onChange;
    this.repaint = createFrameScheduler(
      () => {
        if (!this.visible || this.loop.running) return;
        // Waking Phaser executes a synchronous tick. Reset time before that tick.
        this.loop.resetDelta();
        this.onChange(true);
        this.loop.wake();
      },
      requestFrame,
      cancelFrame,
    );
  }
  setContinuous(continuous: boolean) {
    this.continuous = continuous;
    this.requestFrame();
  }
  requestFrame() {
    if (this.visible && !this.loop.running) this.repaint.request();
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.requestFrame();
    else {
      this.repaint.cancel();
      this.sleep();
    }
  }
  afterRender(hasAnimations = false) {
    if (!this.visible || (!this.continuous && !hasAnimations)) this.sleep();
  }
  private sleep() {
    if (!this.loop.running) return;
    this.loop.sleep();
    this.onChange(false);
  }
  dispose() {
    this.repaint.cancel();
  }
}
