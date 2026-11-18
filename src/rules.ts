/** Shared local score helpers. Product rules and preview tuning live in gameRules.ts. */
export function scorePair(
  pair: { scored: boolean; x: number; width: number },
  birdX: number,
): boolean {
  if (pair.scored || pair.x + pair.width >= birdX) return false;
  pair.scored = true;
  return true;
}
/** The frontend has no verified score, skin unlock or financial authority. */
export function localResult(displayScore: number, reason: string) {
  return {
    displayScore,
    verifiedScore: null,
    verificationStatus: 'LOCAL_DEMO_ONLY' as const,
    rewardStatus: 'NOT_ELIGIBLE' as const,
    reason,
  };
}
