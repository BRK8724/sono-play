/** Viewport geometry. Artwork is cropped to cover; gameplay geometry remains proportional. */
export type Insets = { top: number; right: number; bottom: number; left: number };
export type GameLayout = {
  width: number;
  height: number;
  unit: number;
  ground: number;
  birdX: number;
  birdSize: number;
  pipeWidth: number;
  safe: Insets;
};
const zero: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
// Gameplay owns this line. Artwork is anchored to it, never the reverse.
export const GROUND_HEIGHT_FRACTION = 0.185;
export function layoutFor(width: number, height: number, insets: Partial<Insets> = {}): GameLayout {
  const w = Math.max(1, width),
    h = Math.max(1, height);
  const safe = {
    top: Math.max(0, insets.top ?? zero.top),
    right: Math.max(0, insets.right ?? zero.right),
    bottom: Math.max(0, insets.bottom ?? zero.bottom),
    left: Math.max(0, insets.left ?? zero.left),
  };
  const unit = Math.max(0.45, Math.min(1.25, w / 390, h / 700));
  const ground = Math.min(h * (1 - GROUND_HEIGHT_FRACTION), h - safe.bottom - 12 * unit);
  return {
    width: w,
    height: h,
    unit,
    ground,
    birdX: w * 0.287,
    birdSize: 74 * unit,
    pipeWidth: 86 * unit,
    safe,
  };
}
export function pipeCenterRange(layout: GameLayout, gap: number): [number, number] {
  const margin = 12 * layout.unit;
  const min = layout.safe.top + gap / 2 + margin;
  const max = layout.ground - gap / 2 - margin;
  return [min, Math.max(min, max)];
}
/** Limit the next center so consecutive safe openings overlap vertically. */
export function reachableCenterRange(
  layout: GameLayout,
  gap: number,
  previous?: { top: number; bottom: number },
): [number, number] {
  const [minimum, maximum] = pipeCenterRange(layout, gap);
  if (!previous) return [minimum, maximum];

  const previousCenter = (previous.top + previous.bottom) / 2;
  const previousGap = previous.bottom - previous.top;
  const birdRadius = 17 * layout.unit;
  const safetyMargin = 8 * layout.unit;
  const maximumChange = Math.max(0, (previousGap + gap) / 2 - 2 * birdRadius - safetyMargin);
  const lower = Math.max(minimum, previousCenter - maximumChange);
  const upper = Math.min(maximum, previousCenter + maximumChange);
  if (lower <= upper) return [lower, upper];

  // A dramatic viewport change may move the old opening outside the new field.
  const nearest = Math.max(minimum, Math.min(maximum, previousCenter));
  return [nearest, nearest];
}
/** Resize a live opening without stretching its clearance relative to the bird. */
export function resizeOpening(
  previous: GameLayout,
  next: GameLayout,
  opening: { top: number; bottom: number },
) {
  const progress =
    ((opening.top + opening.bottom) / 2 - previous.safe.top) /
    Math.max(1, previous.ground - previous.safe.top);
  const gap = Math.min(
    ((opening.bottom - opening.top) * next.unit) / previous.unit,
    (next.ground - next.safe.top) * 0.5,
  );
  const [minimum, maximum] = pipeCenterRange(next, gap);
  const desired = next.safe.top + progress * (next.ground - next.safe.top);
  const center = Math.max(minimum, Math.min(maximum, desired));
  return { top: center - gap / 2, bottom: center + gap / 2 };
}
/** Keep the opening proportional to the bird across normal phone sizes. */
export function responsiveGap(layout: GameLayout, gap: number, baseGap: number): number {
  const available = layout.ground - layout.safe.top;
  // 0.9 is a demo tuning value close to the prior 390×844 presentation.
  // The viewport cap applies only when the normal opening cannot fit comfortably.
  const desiredScale = 0.9;
  const viewportScale = (available * 0.34) / (baseGap * layout.unit);
  const scale = Math.min(desiredScale, viewportScale);
  return gap * layout.unit * scale;
}
