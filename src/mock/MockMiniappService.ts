import type {
  DemoResult,
  MiniappService,
  PlayerSnapshot,
  PlayerHistory,
  PurchaseOrder,
  Standings,
  StandingsPeriod,
} from '../services/MiniappService';
import {
  backgrounds,
  birds,
  DEMO_POINT_COST,
  initialPlayer,
  leaderboard,
  otherPlayers,
} from './fixtures.ts';
import { GAME_RULES, PREVIEW_GAME_CONFIG, ulaanbaatarDay, unlockedBirds } from '../gameRules.ts';
import { ApiError } from '../services/ApiClient.ts';
import {
  dailyLeaders,
  previousLeaders,
  scoreHistory,
  lifeHistory,
  freeLifeHistory,
} from './uiFixtures.ts';

function dateBefore(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
const dateLabel = (day: string) => day.replaceAll('-', '.');

/** In-memory demo ledger. This adapter never calls SONO core or stores verified scores. */
export class MockMiniappService implements MiniappService {
  readonly mode = 'mock' as const;
  readonly gameConfig = PREVIEW_GAME_CONFIG;
  readonly gameSeed = 'sono-offline-preview';
  readonly price = { pointsPerLife: GAME_RULES.pointsPerLife, maxLivesPerOrder: 50 };
  private freeDay: string;
  private now: () => Date;
  private player = structuredClone(initialPlayer);
  private activeRun: string | null = null;
  private completedRuns = new Map<string, DemoResult>();
  private completedOrders = new Map<string, string>();
  private sequence = 0;
  private historyData: PlayerHistory;
  failNextPurchase = false;
  pendingNextResult = false;

  constructor(options: { requireNickname?: boolean; now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
    this.freeDay = ulaanbaatarDay(this.now());
    this.player.nicknameRequired = options.requireNickname ?? false;
    this.historyData = this.initialHistory();
    this.historyData.scores[0].rank = this.standings('today').me!.rank;
    this.historyData.scores[1].rank = this.standings('previous').me!.rank;
  }

  private initialHistory(): PlayerHistory {
    return {
      scores: scoreHistory.map((row, index) => ({
        ...row,
        date: dateLabel(dateBefore(this.freeDay, index)),
        rank: 58,
      })),
      earned: lifeHistory.map((row, index) => ({
        ...row,
        date: `${dateBefore(this.freeDay, Math.floor(index / 2) + 1)
          .slice(5)
          .replace('-', '.')} ${row.date.split(' ')[1]}`,
      })),
      free: freeLifeHistory.flatMap((row, index) => {
        const grant = { ...row, date: dateLabel(dateBefore(this.freeDay, index)) };
        if (index === 0) return [grant];
        return [
          {
            date: `${dateLabel(dateBefore(this.freeDay, index - 1))} 00:00`,
            reason: 'Хугацаа дууссан эрх',
            amount: -row.amount,
          },
          grant,
        ];
      }),
    };
  }
  private timestamp() {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ulaanbaatar',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(this.now());
    return `${this.freeDay.slice(5).replace('-', '.')} ${time}`;
  }

  snapshot(): PlayerSnapshot {
    this.refreshDaily();
    const player = structuredClone(this.player);
    player.owned = [...unlockedBirds(player.total), 'classic', 'city', 'sunset'];
    return player;
  }
  private refreshDaily() {
    const day = ulaanbaatarDay(this.now());
    if (day !== this.freeDay) {
      if (this.player.freePlaysLeft > 0)
        this.historyData.free.unshift({
          date: `${dateLabel(dateBefore(this.freeDay, -1))} 00:00`,
          reason: 'Хугацаа дууссан эрх',
          amount: -this.player.freePlaysLeft,
        });
      this.freeDay = day;
      this.player.freePlaysLeft = GAME_RULES.freePlaysPerDay;
      this.historyData.free.unshift({
        date: dateLabel(day),
        reason: 'Өдрийн үнэгүй эрх',
        amount: GAME_RULES.freePlaysPerDay,
      });
      this.historyData.scores.unshift({ date: dateLabel(day), score: 0, rank: 58 });
    }
    this.player.attempts = this.player.freePlaysLeft + this.player.lives;
  }
  setPreviewState(patch: Partial<PlayerSnapshot>) {
    this.refreshDaily();
    const previousFree = this.player.freePlaysLeft;
    const previousLives = this.player.lives;
    Object.assign(this.player, patch);
    if (
      patch.attempts !== undefined &&
      patch.freePlaysLeft === undefined &&
      patch.lives === undefined
    ) {
      this.player.freePlaysLeft = Math.min(GAME_RULES.freePlaysPerDay, patch.attempts);
      this.player.lives = Math.max(0, patch.attempts - GAME_RULES.freePlaysPerDay);
    }
    this.player.freePlaysLeft = Number.isFinite(this.player.freePlaysLeft)
      ? Math.max(0, Math.min(GAME_RULES.freePlaysPerDay, Math.floor(this.player.freePlaysLeft)))
      : 0;
    this.player.lives = Number.isFinite(this.player.lives)
      ? Math.max(0, Math.floor(this.player.lives))
      : 0;
    this.player.attempts = this.player.freePlaysLeft + this.player.lives;
    for (const [group, amount] of [
      ['free', this.player.freePlaysLeft - previousFree],
      ['earned', this.player.lives - previousLives],
    ] as const)
      if (amount !== 0)
        this.historyData[group].unshift({
          date: this.timestamp(),
          reason: 'Эрхийн тохируулга',
          amount,
        });
    if (patch.total !== undefined) {
      this.player.total = Number.isFinite(patch.total) ? Math.max(0, Math.floor(patch.total)) : 0;
      const scores = this.historyData.scores;
      const today = scores[0];
      const previousTotal = scores.slice(1).reduce((sum, row) => sum + row.score, 0);
      today.score = Math.max(0, this.player.total - previousTotal);
      // When a fixture lowers the total below prior days, trim the oldest sample scores first.
      let excess = Math.max(0, previousTotal - this.player.total);
      for (let index = scores.length - 1; index > 0 && excess > 0; index--) {
        const removed = Math.min(scores[index].score, excess);
        scores[index].score -= removed;
        excess -= removed;
      }
      today.rank = this.standings('today').me!.rank;
      const yesterday = scores.find((row) => row.date === dateLabel(dateBefore(this.freeDay, 1)));
      if (yesterday) yesterday.rank = this.standings('previous').me!.rank;
    }
  }
  async setNickname(nickname: string) {
    if (this.player.nicknameRequired === false && this.player.name !== nickname)
      throw new ApiError('NICKNAME_ALREADY_SET');
    if (
      nickname.length < 3 ||
      nickname.length > 16 ||
      !/^([A-Za-z0-9_]+|[А-Яа-яЁёӨөҮү0-9_]+)$/.test(nickname) ||
      !/[A-Za-zА-Яа-яЁёӨөҮү]/.test(nickname)
    )
      throw new ApiError('VALIDATION_FAILED');
    if (
      [
        'ADMIN',
        'SONO',
        'TAKEN',
        ...leaderboard.map((row) => row.name),
        ...otherPlayers.map((row) => row.name),
      ].some((name) => name.toUpperCase() === nickname.toUpperCase())
    )
      throw new ApiError('NICKNAME_TAKEN');
    this.player.name = nickname;
    this.player.nicknameRequired = false;
  }
  async startRun() {
    this.refreshDaily();
    if (this.activeRun) throw new Error('Тоглолт аль хэдийн эхэлсэн байна.');
    if (this.player.attempts < 1) throw new Error('Тоглох эрх дууссан байна.');
    if (this.player.nicknameRequired) throw new ApiError('NICKNAME_REQUIRED');
    const free = this.player.freePlaysLeft > 0;
    if (free) this.player.freePlaysLeft--;
    else this.player.lives--;
    this.historyData[free ? 'free' : 'earned'].unshift({
      date: this.timestamp(),
      reason: 'Тоглолт',
      amount: -1,
    });
    this.refreshDaily();
    this.activeRun = `demo-run-${++this.sequence}`;
    return this.activeRun;
  }
  finishRun(runId: string, score: number, reason: string) {
    const previous = this.completedRuns.get(runId);
    if (previous) return { ...previous };
    if (this.activeRun !== runId) throw new Error('Идэвхтэй тоглолт олдсонгүй.');
    const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
    const result = {
      score: safeScore,
      reason,
      verification: this.pendingNextResult ? ('PENDING' as const) : ('DEMO' as const),
    };
    this.pendingNextResult = false;
    this.activeRun = null;
    if (result.verification === 'DEMO') {
      this.player.best = Math.max(this.player.best, safeScore);
      this.player.total += safeScore;
      this.refreshDaily();
      const day = this.historyData.scores.find((row) => row.date === dateLabel(this.freeDay))!;
      day.score += safeScore;
      day.rank = this.standings('today').me!.rank;
    }
    this.completedRuns.set(runId, result);
    return { ...result };
  }
  async purchase(orderId: string, order: PurchaseOrder) {
    this.refreshDaily();
    const signature = JSON.stringify(order);
    const previous = this.completedOrders.get(orderId);
    if (previous) {
      if (previous !== signature) throw new Error('Захиалгын дугаар давхардсан байна.');
      return;
    }
    if (this.failNextPurchase) {
      this.failNextPurchase = false;
      throw new Error('Холболт тасарлаа. Дахин оролдоно уу.');
    }
    let cost: number;
    if (order.kind === 'attempts') {
      if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 50)
        throw new Error('Эрхийн тоо 1–50 байна.');
      cost = order.quantity * DEMO_POINT_COST;
    } else {
      const item = [...birds, ...backgrounds].find((item) => item.id === order.itemId);
      if (!item) throw new Error('Бүтээгдэхүүн олдсонгүй.');
      if (this.snapshot().owned.includes(item.id)) {
        this.completedOrders.set(orderId, signature);
        return;
      }
      throw new Error('SKIN_LOCKED');
    }
    if (cost > this.player.points) throw new Error('INSUFFICIENT_POINTS');
    this.player.points -= cost;
    if (order.kind === 'attempts') {
      this.player.lives += order.quantity;
      this.historyData.earned.unshift({
        date: this.timestamp(),
        reason: 'SONO пойнт',
        amount: order.quantity,
      });
    }
    this.refreshDaily();
    this.completedOrders.set(orderId, signature);
  }
  selectItem(kind: 'bird' | 'background', id: string) {
    const catalog = kind === 'bird' ? birds : backgrounds;
    if (!catalog.some((item) => item.id === id) || !this.snapshot().owned.includes(id))
      throw new Error('Эхлээд энэ загварыг авна уу.');
    if (kind === 'bird') this.player.selectedBird = id;
    else this.player.selectedBackground = id;
  }
  leaderboard() {
    return this.rankings().slice(0, 10);
  }
  ownRank() {
    return this.rankings().find((row) => row.name === this.player.name)!;
  }
  standings(period: StandingsPeriod): Standings {
    this.refreshDaily();
    const day = period === 'today' ? this.freeDay : dateBefore(this.freeDay, 1);
    const score = this.historyData.scores.find((row) => row.date === dateLabel(day))?.score ?? 0;
    const leaders = period === 'today' ? dailyLeaders : previousLeaders;
    const rows = [
      ...leaders,
      ...otherPlayers.map((row) => ({
        ...row,
        score: Math.floor(row.score * (period === 'today' ? 0.35 : 0.25)),
      })),
      { rank: 0, name: this.player.name, score },
    ]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    return { entries: rows.slice(0, 10), me: rows.find((row) => row.name === this.player.name)! };
  }
  history(): PlayerHistory {
    this.refreshDaily();
    return structuredClone(this.historyData);
  }
  private rankings() {
    return [
      ...leaderboard,
      ...otherPlayers,
      { rank: 0, name: this.player.name, score: this.player.total },
    ]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  setScenario(scenario: 'reset' | 'empty' | 'poor' | 'error' | 'pending') {
    if (this.activeRun) return;
    if (scenario === 'reset') {
      this.player = structuredClone(initialPlayer);
      this.freeDay = ulaanbaatarDay(this.now());
      this.historyData = this.initialHistory();
      this.historyData.scores[0].rank = this.standings('today').me!.rank;
      this.historyData.scores[1].rank = this.standings('previous').me!.rank;
      this.completedOrders.clear();
      this.completedRuns.clear();
      this.failNextPurchase = false;
      this.pendingNextResult = false;
    }
    if (scenario === 'empty') {
      this.player.freePlaysLeft = 0;
      this.player.lives = 0;
      this.refreshDaily();
    }
    if (scenario === 'poor') this.player.points = 0;
    if (scenario === 'error') this.failNextPurchase = true;
    if (scenario === 'pending') this.pendingNextResult = true;
  }
}
