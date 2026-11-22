// Bound the Canvas2D backing store for tall viewports and large device pixel ratios.
const MAX_BACKING_PIXELS = 900_000;
const MAX_BACKING_EDGE = 4_096;

export function gamePixelRatio(
  cssWidth: number,
  cssHeight: number,
  deviceRatio: number,
  maxDpr: number,
): number {
  const width = Math.max(1, cssWidth);
  const height = Math.max(1, cssHeight);
  const screenRatio = Number.isFinite(deviceRatio) ? Math.max(1, deviceRatio) : 1;
  return Math.min(
    screenRatio,
    maxDpr,
    Math.sqrt(MAX_BACKING_PIXELS / (width * height)),
    MAX_BACKING_EDGE / Math.max(width, height),
  );
}

export function backingPixels(cssPixels: number, ratio: number): number {
  return Math.max(1, Math.round(cssPixels * ratio));
}
