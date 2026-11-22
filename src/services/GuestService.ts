import type {
  GameConfig,
  LeaderboardRow,
  BirdCatalogItem,
  MiniappService,
  PlayerSnapshot,
  PurchaseOrder,
  RunResult,
} from './MiniappService';
import { ApiError } from './ApiClient';
import { newId } from './uuid';

// Practice physics follow the documented pipe and speed schedule. The Player API
// does not expose its current run config or create a session without a token.
const PRACTICE_CONFIG: GameConfig = {
  pipeIntervalMs: 1600,
  gravity: 1200,
  jumpVelocity: -315,
  scrollSpeed: 155,
  pipeGap: 155,
  speed: { step: 0.1, max: 1.4, thresholds: [10, 25, 45, 70] },
};

export class GuestService implements MiniappService {
  readonly isGuest = true;
  readonly gameConfig = PRACTICE_CONFIG;
  gameSeed?: string;
  runDeadline?: number;
  private active: string | null = null;
  private best = 0;
  private total = 0;
  private selectedBird = 'pilot';

  get birdCatalog(): BirdCatalogItem[] {
    return [
      { id: 'pilot', name: 'PILOT', unlockScore: 0, unlocked: true },
      { id: 'santa', name: 'SANTA', unlockScore: 0, unlocked: true },
      { id: 'gold', name: 'GOLD', unlockScore: 0, unlocked: true },
    ].map((bird) => ({ ...bird, selected: bird.id === this.selectedBird }));
  }

  snapshot(): PlayerSnapshot {
    return {
      name: 'Зочин',
      phone: '',
      points: null,
      attempts: 0,
      best: this.best,
      total: this.total,
      selectedBird: this.selectedBird,
      nicknameRequired: false,
      tournament: null,
    };
  }

  async startRun() {
    if (this.active) throw new ApiError('RESULT_PENDING');
    this.active = newId();
    this.gameSeed = String(Date.now());
    this.runDeadline = performance.now() + 15 * 60 * 1000;
    return this.active;
  }

  finishRun(runId: string, score: number, reason: string): RunResult {
    if (this.active !== runId) throw new ApiError('SESSION_NOT_FOUND');
    this.active = null;
    this.runDeadline = undefined;
    this.best = Math.max(this.best, score);
    this.total += score;
    return { score, reason, verification: 'LOCAL' };
  }

  async purchase(_orderId: string, _order: PurchaseOrder): Promise<void> {
    throw new ApiError('HOST_REQUIRED');
  }

  selectBird(id: string) {
    if (!this.birdCatalog.some((bird) => bird.id === id)) throw new ApiError('BIRD_LOCKED');
    this.selectedBird = id;
  }

  leaderboard(): LeaderboardRow[] {
    return [];
  }

  ownRank(): LeaderboardRow | null {
    return null;
  }
}
