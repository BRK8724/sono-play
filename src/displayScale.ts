/** Keep mobile WebGL crisp while limiting pixel work on 60 Hz phones. */
export function cappedPixelRatio(deviceRatio: number): number {
  return Number.isFinite(deviceRatio) ? Math.min(1.5, Math.max(1, deviceRatio)) : 1;
}

export function backingPixels(cssPixels: number, ratio: number): number {
  return Math.max(1, Math.round(cssPixels * ratio));
}
