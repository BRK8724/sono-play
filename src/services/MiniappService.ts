export type CatalogItem = {
  id: string;
  name: string;
  image: string;
  price: number;
};
export type BirdCatalogItem = {
  id: string;
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
  selectedBackground: string;
  owned: string[];
  nicknameRequired?: boolean;
  freePlaysLeft?: number;
  lives?: number;
  tournament?: { id: number; name: string; endsAt: string; rankingMode: 'TOTAL' | 'BEST' } | null;
};
export type PurchaseOrder =
  { kind: 'attempts'; quantity: number } | { kind: 'item'; itemId: string };
export type DemoResult = {
  score: number;
  reason: string;
  verification: 'DEMO' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  rejectReason?: string;
};
export type LeaderboardRow = { rank: number; name: string; score: number };
export type StandingsPeriod = 'today' | 'previous';
export type Standings = { entries: LeaderboardRow[]; me: LeaderboardRow | null };
export type ScoreHistoryRow = { date: string; score: number; rank: number };
export type LifeHistoryRow = { date: string; reason: string; amount: number };
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
  readonly mode: 'mock' | 'api';
  readonly gameConfig?: GameConfig;
  readonly gameSeed?: string;
  readonly price?: { pointsPerLife: number; maxLivesPerOrder: number };
  readonly pendingOrder?: LifeOrder;
  readonly canPay?: boolean;
  readonly canGrantLives?: boolean;
  readonly birdCatalog?: BirdCatalogItem[];
  initialize?(): Promise<void>;
  refresh?(): Promise<void>;
  refreshLeaderboard?(): Promise<void>;
  refreshBirds?(): Promise<void>;
  setNickname?(nickname: string): Promise<void>;
  grantLives?(lives: number): Promise<void>;
  checkOrder?(): Promise<LifeOrder>;
  payOrder?(): Promise<void>;
  checkConnection?(): Promise<void>;
  snapshot(): PlayerSnapshot;
  startRun(): Promise<string>;
  finishRun(runId: string, score: number, reason: string): DemoResult | Promise<DemoResult>;
  purchase(orderId: string, order: PurchaseOrder): Promise<void | 'PENDING'>;
  selectItem(kind: 'bird' | 'background', id: string): void | Promise<void>;
  leaderboard(): LeaderboardRow[];
  ownRank(): LeaderboardRow | null;
  standings?(period: StandingsPeriod): Standings;
  history?(): PlayerHistory;
}
