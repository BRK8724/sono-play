export type CatalogItem = {
  id: string;
  name: string;
  image: string;
};
export type BirdCatalogItem = {
  id: string;
  code?: string;
  name: string;
  unlockScore: number;
  unlocked: boolean;
  selected?: boolean;
};
export type PlayerSnapshot = {
  name: string;
  phone: string;
  points: number | null;
  attempts: number;
  best: number;
  total: number;
  selectedBird: string;
  nicknameRequired?: boolean;
  freePlaysLeft?: number;
  lives?: number;
  tournament?: { id: number; name: string; endsAt: string; rankingMode: 'TOTAL' | 'BEST' } | null;
};
export type PurchaseOrder = { kind: 'attempts'; quantity: number };
export type RunResult = {
  score: number;
  reason: string;
  verification: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'LOCAL';
  rejectReason?: string;
  newlyUnlocked?: string[];
};
export type LeaderboardRow = { rank: number; name: string; score: number; reachedAt?: string };
export type StandingsPeriod = 'today' | 'previous';
export type Standings = { entries: LeaderboardRow[]; me: LeaderboardRow | null };
export type DailyStandings = Standings & {
  day: string;
  winner: LeaderboardRow | null;
};
export type LeaderboardDay = { day: string; winner: LeaderboardRow | null };
export type ScoreHistoryRow = { date: string; score: number; rank: number };
export type LifeHistoryRow = { date: string; reason: string; amount: number };
export type LifeHistoryPage = {
  tournamentId: number | null;
  earned: LifeHistoryRow[];
  free: LifeHistoryRow[];
  nextCursor: string | null;
};
export type PlayerHistory = {
  scores: ScoreHistoryRow[];
  earned: LifeHistoryRow[];
  free: LifeHistoryRow[];
};
export type GameConfig = {
  pipeIntervalMs: number;
  speed: { step: number; max: number; thresholds: number[] };
  gravity: number;
  jumpVelocity: number;
  scrollSpeed: number;
  pipeGap: number;
};
export type LifeOrder = {
  orderId: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  pointsCost: number;
  lives: number;
  expiresAt: string;
};
export interface MiniappService {
  readonly isGuest?: boolean;
  readonly isMock?: boolean;
  readonly canGrantTestLives?: boolean;
  readonly gameConfig?: GameConfig;
  readonly gameSeed?: string;
  readonly runDeadline?: number;
  readonly price?: { pointsPerLife: number; maxLivesPerOrder: number };
  readonly pendingOrder?: LifeOrder;
  readonly canPay?: boolean;
  readonly birdCatalog?: BirdCatalogItem[];
  initialize?(): Promise<void>;
  refresh?(): Promise<void>;
  refreshLeaderboard?(): Promise<void>;
  refreshBirds?(): Promise<void>;
  refreshPrice?(): Promise<void>;
  setNickname?(nickname: string): Promise<void>;
  checkOrder?(): Promise<LifeOrder>;
  payOrder?(): Promise<void>;
  checkConnection?(): Promise<void>;
  grantTestLives?(): Promise<void>;
  addMockScore?(): void;
  resetMock?(): void;
  snapshot(): PlayerSnapshot;
  startRun(): Promise<string>;
  finishRun(runId: string, score: number, reason: string): RunResult | Promise<RunResult>;
  purchase(orderId: string, order: PurchaseOrder): Promise<void | 'PENDING'>;
  selectBird(id: string): void | Promise<void>;
  leaderboard(): LeaderboardRow[];
  ownRank(): LeaderboardRow | null;
  standings?(period: StandingsPeriod): Standings;
  loadDailyLeaderboard?(day?: string): Promise<DailyStandings>;
  loadLeaderboardDays?(): Promise<LeaderboardDay[]>;
  history?(): PlayerHistory;
  loadLifeHistory?(cursor?: string): Promise<LifeHistoryPage>;
}
