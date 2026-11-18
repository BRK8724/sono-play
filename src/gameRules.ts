import type { GameConfig } from './services/MiniappService';

/** BRD v2.1, 2026-11-17. These values drive the isolated preview fixtures. */
export const GAME_RULES = {
  freePlaysPerDay: 3,
  pointsPerLife: 20,
  skinTotals: { pilot: 0, santa: 1500, gold: 3000 },
  earnedLives: { onTime: 10, early: 10, overdue: 5, extension: 3, closed: 15, closedOverdue: 5 },
} as const;

export function ulaanbaatarDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function backgroundPeriod(date = new Date()): 'day' | 'night' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ulaanbaatar',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  return hour >= 7 && hour < 18 ? 'day' : 'night';
}

export function unlockedBirds(total: number) {
  return Object.entries(GAME_RULES.skinTotals)
    .filter(([, threshold]) => total >= threshold)
    .map(([id]) => id);
}

/** Thresholds are cumulative 10 + 15 + 20 + 25… cleared pairs. */
export function previewSpeedFactor(score: number) {
  const steps = Math.max(0, Math.floor((Math.sqrt(9 + (8 * Math.max(0, score)) / 5) - 3) / 2));
  return 1 + steps * 0.1;
}

export const PREVIEW_GAME_CONFIG: GameConfig = {
  pipeIntervalMs: 1500,
  speed: { step: 0.1, max: 2, thresholds: [10, 25, 45, 70, 100, 135, 175, 220, 270, 325] },
  gravity: 1800,
  jumpVelocity: -520,
  scrollSpeed: 160,
  pipeGap: 150,
};
