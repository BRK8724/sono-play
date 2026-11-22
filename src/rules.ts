export type RunEndReason =
  'COLLISION' | 'APP_BACKGROUND' | 'CONNECTION_LOST' | 'EXIT' | 'TIME_LIMIT';

/** Display-only score helper. The server verifies and persists run results. */
export function localResult(displayScore: number) {
  return { displayScore };
}

export const BIRD_HALF_HEIGHT = 17;
const BIRD_HALF_WIDTH = 18;
const PIPE_HITBOX_INSET = 6;

type PipeBounds = { x: number; width: number };

function pipeRight(pair: PipeBounds, unit: number) {
  return pair.x + pair.width - PIPE_HITBOX_INSET * unit;
}

export function overlapsPipe(pair: PipeBounds, birdX: number, unit: number) {
  return (
    birdX + BIRD_HALF_WIDTH * unit > pair.x + PIPE_HITBOX_INSET * unit &&
    birdX - BIRD_HALF_WIDTH * unit < pipeRight(pair, unit)
  );
}

export function scorePair(
  pair: PipeBounds & { scored: boolean },
  birdX: number,
  unit: number,
): boolean {
  if (pair.scored || pipeRight(pair, unit) > birdX - BIRD_HALF_WIDTH * unit) return false;
  pair.scored = true;
  return true;
}
