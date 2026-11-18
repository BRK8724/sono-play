import type { GameConfig } from './services/MiniappService';

export function speedFactor(config: GameConfig, score: number) {
  let steps = 0;
  for (const threshold of config.speed.thresholds) {
    if (score < threshold) break;
    steps++;
  }
  return Math.min(config.speed.max, 1 + steps * config.speed.step);
}

/** Ramp upward at one server-issued speed step per transition; never exceed the current target. */
export function approachSpeedFactor(
  current: number,
  target: number,
  step: number,
  dt: number,
  duration = 0.4,
) {
  if (target <= current) return target;
  return Math.min(target, current + (step * dt) / duration);
}

/** Seeded pipe placement stays reproducible for the server-issued run. */
export function seededRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++)
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
