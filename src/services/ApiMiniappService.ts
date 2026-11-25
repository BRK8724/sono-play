import { newId } from './uuid.ts';
import { ApiClient, ApiError } from './ApiClient.ts';
import type {
  RunResult,
  GameConfig,
  LeaderboardRow,
  LifeOrder,
  LifeHistoryPage,
  MiniappService,
  PlayerSnapshot,
  PurchaseOrder,
  BirdCatalogItem,
  DailyStandings,
  LeaderboardDay,
} from './MiniappService';

type Tournament = NonNullable<PlayerSnapshot['tournament']>;
type Me = {
  playerId?: number;
  nickname: string | null;
  freePlaysLeft: number;
  lives: number;
  playsLeft: number;
  bestScore: number;
  totalScore: number | null;
  selectedBird?: string;
};
type BirdsResponse = {
  totalScore: number;
  selected: string;
  birds: {
    code: string;
    name: string;
    unlockScore: number;
    unlocked: boolean;
    selected?: boolean;
  }[];
};
const birdCodes: Record<string, string> = {
  pilot: 'sono',
  santa: 'santa_sono',
  gold: 'goldy_sono',
};
const localBirdId = (code: string) => Object.keys(birdCodes).find((id) => birdCodes[id] === code);
const catalogBirdId = (code: string) => localBirdId(code) ?? `server:${code}`;
type Entry = {
  rank: number;
  nickname: string | null;
  totalScore: number;
  reachedAt?: string | null;
};
const validDay = (day: unknown): day is string =>
  typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
function leaderboardRow(entry: Entry): LeaderboardRow {
  if (
    !entry ||
    !Number.isSafeInteger(entry.rank) ||
    entry.rank < 1 ||
    (entry.nickname !== null && typeof entry.nickname !== 'string') ||
    !Number.isSafeInteger(entry.totalScore) ||
    entry.totalScore < 0 ||
    (entry.reachedAt != null &&
      (typeof entry.reachedAt !== 'string' || !Number.isFinite(Date.parse(entry.reachedAt))))
  )
    throw new ApiError('INVALID_RESPONSE');
  return {
    rank: entry.rank,
    name: entry.nickname ?? 'SONO',
    score: entry.totalScore,
    ...(entry.reachedAt ? { reachedAt: entry.reachedAt } : {}),
  };
}
type HistoryResponse = {
  tournament?: { id: number } | null;
  entries: { title: string; lives: number; createdAt: string }[];
  freePlays: { title: string; lives: number; day: string }[];
  nextCursor?: string | null;
};
const ulaanbaatarDate = new Intl.DateTimeFormat('mn-MN', {
  timeZone: 'Asia/Ulaanbaatar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
// The server ends a session 15 minutes after it started. Game over comes 30 s sooner, so the finish
// still arrives in time over a slow network.
const RUN_LIMIT_MS = 15 * 60 * 1000 - 30 * 1000;
type Start = {
  sessionId: string;
  seed: string;
  config: GameConfig;
  freePlaysLeft: number;
  livesLeft: number;
};
type Options = {
  client: ApiClient;
  /** Resolves with the host's outcome: COMPLETED, CANCELLED, FAILED or UNKNOWN. */
  payWithPoints?: (request: { orderId: string }) => Promise<unknown>;
  paymentAvailable?: () => boolean;
  /** The SONO point balance from the host, or null when it cannot tell. */
  pointBalance?: () => Promise<number | null>;
  now?: () => number;
};

function validStart(start: Start) {
  const config = start?.config;
  const speed = config?.speed;
  return (
    typeof start?.sessionId === 'string' &&
    start.sessionId.length > 0 &&
    /^-?\d+$/.test(String(start.seed)) &&
    Number.isSafeInteger(start.freePlaysLeft) &&
    start.freePlaysLeft >= 0 &&
    Number.isSafeInteger(start.livesLeft) &&
    start.livesLeft >= 0 &&
    [config?.pipeIntervalMs, config?.gravity, config?.scrollSpeed, config?.pipeGap].every(
      (value) => Number.isFinite(value) && value > 0,
    ) &&
    Number.isFinite(config?.jumpVelocity) &&
    config.jumpVelocity < 0 &&
    Number.isFinite(speed?.step) &&
    speed.step >= 0 &&
    Number.isFinite(speed?.max) &&
    speed.max >= 1 &&
    Array.isArray(speed?.thresholds) &&
    speed.thresholds.every(
      (value, index, values) =>
        Number.isFinite(value) && value > 0 && (index === 0 || value > values[index - 1]),
    )
  );
}

function validOrder(order: LifeOrder) {
  return (
    typeof order?.orderId === 'string' &&
    order.orderId.length > 0 &&
    ['PENDING', 'PAID', 'FAILED', 'EXPIRED'].includes(order.status) &&
    Number.isSafeInteger(order.lives) &&
    order.lives > 0 &&
    Number.isFinite(order.pointsCost) &&
    order.pointsCost >= 0
  );
}

/** Player API only. Core callbacks and financial operations belong to the host/server. */
export class ApiMiniappService implements MiniappService {
  gameConfig?: GameConfig;
  gameSeed?: string;
  price?: { pointsPerLife: number; maxLivesPerOrder: number };
  pendingOrder?: LifeOrder;
  private player: PlayerSnapshot = {
    name: '',
    phone: '',
    points: null,
    attempts: 0,
    best: 0,
    total: 0,
    selectedBird: 'pilot',
    nicknameRequired: true,
    tournament: null,
  };
  private rows: LeaderboardRow[] = [];
  private me: LeaderboardRow | null = null;
  private boardReadAt = 0;
  private refreshTask: Promise<void> | null = null;
  private refreshedAt = 0;
  private pointsTask: Promise<void> | null = null;
  private priceTask: Promise<void> | null = null;
  private startTask: Promise<string> | null = null;
  private startKey = '';
  private startRequestedAt = 0;
  private active: { id: string; receivedAt: number; deadline: number } | null = null;
  private finishes = new Map<string, { score: number; durationMs: number; reason: string }>();
  private finishTasks = new Map<string, Promise<RunResult>>();
  private results = new Map<string, RunResult>();
  private orders = new Map<string, { signature: string; value?: LifeOrder }>();
  private purchasing = new Map<string, { signature: string; task: Promise<'PENDING' | void> }>();
  private paymentOpened = new Set<string>();
  private paymentTask: Promise<void> | null = null;
  private orderCheckTask: Promise<LifeOrder> | null = null;
  private leaderboardTask: Promise<void> | null = null;
  private now: () => number;
  private options: Options;
  private playerId?: number;
  private catalog?: BirdCatalogItem[];
  private catalogAttempted = false;
  private birdTask: Promise<void> | null = null;
  private birdEpoch = 0;
  private birdTaskEpoch = 0;

  constructor(options: Options) {
    this.options = options;
    this.now = options.now ?? (() => performance.now());
  }
  get canPay() {
    return this.options.paymentAvailable?.() ?? Boolean(this.options.payWithPoints);
  }
  get runDeadline() {
    return this.active?.deadline;
  }
  get birdCatalog() {
    return this.catalog?.map((bird) => ({ ...bird }));
  }
  async initialize() {
    await this.options.client.login();
    await this.refresh();
    try {
      const saved = JSON.parse(sessionStorage.getItem('sono.pending-order') ?? 'null');
      if (
        this.playerId !== undefined &&
        saved?.owner === this.playerId &&
        typeof saved.order?.orderId === 'string'
      ) {
        // Storage supplies a recovery reference. Only the server can settle the order.
        this.pendingOrder = { ...saved.order, status: 'PENDING' };
        await this.checkOrder();
      }
    } catch {
      // Storage denial or a temporarily unavailable order does not block gameplay.
    }
  }
  snapshot(): PlayerSnapshot {
    const { tournament } = this.player;
    return { ...this.player, tournament: tournament ? { ...tournament } : tournament };
  }
  refresh() {
    if (!this.refreshTask) {
      this.refreshTask = (async () => {
        const [me, tournament] = await Promise.all([
          this.options.client.request<Me>('GET', '/api/v1/me'),
          this.options.client.request<{ current: Tournament | null }>('GET', '/api/v1/tournament'),
        ]);
        const changedTournament = this.player.tournament?.id !== tournament.current?.id;
        const hadCatalogAttempt = this.catalogAttempted;
        this.playerId = me.playerId;
        Object.assign(this.player, {
          name: me.nickname ?? '',
          nicknameRequired: me.nickname === null,
          freePlaysLeft: me.freePlaysLeft,
          lives: me.lives,
          attempts: me.playsLeft,
          best: me.bestScore ?? 0,
          total: me.totalScore ?? 0,
          tournament: tournament.current,
        });
        if (me.selectedBird) this.applySelectedBird(me.selectedBird);
        if (changedTournament) {
          this.rows = [];
          this.me = null;
          this.boardReadAt = 0;
          this.invalidateBirds();
          if (hadCatalogAttempt) this.player.selectedBird = 'pilot';
        }
        this.refreshedAt = Date.now();
        if (!this.price) void this.refreshPrice();
        if (!this.catalogAttempted) void this.refreshBirds().catch(() => undefined);
      })().finally(() => {
        this.refreshTask = null;
      });
    }
    return this.refreshTask;
  }
  /**
   * Start and finish answers keep the play rights and totals current, so a new game needs no profile
   * read unless it is old or something would stop the game (the server checks again at start).
   */
  refreshIfStale(maxAgeMs: number) {
    const { attempts, nicknameRequired, tournament } = this.player;
    const tournamentOver = !tournament || Date.parse(tournament.endsAt) <= Date.now();
    if (
      !this.refreshedAt ||
      Date.now() - this.refreshedAt >= maxAgeMs ||
      attempts <= 0 ||
      nicknameRequired ||
      tournamentOver
    )
      return this.refresh();
    return Promise.resolve();
  }
  /** Reads the point balance from the host; the backend never sees it. */
  refreshPoints() {
    if (!this.options.pointBalance) return Promise.resolve();
    if (!this.pointsTask)
      this.pointsTask = this.options
        .pointBalance()
        .then((points) => {
          if (points !== null) this.player.points = points;
        })
        .catch(() => undefined)
        .finally(() => (this.pointsTask = null));
    return this.pointsTask;
  }
  refreshPrice() {
    if (this.price) return Promise.resolve();
    if (this.priceTask) return this.priceTask;
    this.priceTask = this.options.client
      .request<NonNullable<MiniappService['price']>>('GET', '/api/v1/lives/price')
      .then((price) => {
        if (
          Number.isSafeInteger(price?.pointsPerLife) &&
          price.pointsPerLife >= 0 &&
          Number.isSafeInteger(price.maxLivesPerOrder) &&
          price.maxLivesPerOrder > 0
        )
          this.price = price;
      })
      .catch(() => undefined)
      .finally(() => (this.priceTask = null));
    return this.priceTask;
  }
  async setNickname(nickname: string) {
    try {
      const response = await this.options.client.request<{ nickname: string }>(
        'PUT',
        '/api/v1/me/nickname',
        { nickname },
      );
      if (typeof response?.nickname !== 'string' || !response.nickname.length)
        throw new ApiError('INVALID_RESPONSE');
      this.player.name = response.nickname;
      this.player.nicknameRequired = false;
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500 || error.code === 'NICKNAME_ALREADY_SET')
      ) {
        // A lost PUT response can still have committed the one-time nickname.
        await this.refresh().catch(() => undefined);
        if (!this.player.nicknameRequired && this.player.name) return;
      }
      throw error;
    }
  }
  startRun() {
    if (this.startTask) return this.startTask;
    if (this.active) return Promise.reject(new ApiError('RESULT_PENDING'));
    if (!this.startKey) {
      this.startKey = newId();
      this.startRequestedAt = this.now();
    }
    this.startTask = (async () => {
      try {
        const start = await this.options.client.request<Start>(
          'POST',
          '/api/v1/games/start',
          undefined,
          this.startKey,
        );
        if (!validStart(start)) throw new ApiError('INVALID_RESPONSE');
        this.active = {
          id: start.sessionId,
          receivedAt: this.now(),
          // A retry of the same action must not extend the server session.
          deadline: this.startRequestedAt + RUN_LIMIT_MS,
        };
        this.gameConfig = start.config;
        this.gameSeed = String(start.seed);
        this.player.freePlaysLeft = start.freePlaysLeft;
        this.player.lives = start.livesLeft;
        this.player.attempts = start.freePlaysLeft + start.livesLeft;
        this.startKey = '';
        return start.sessionId;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500)
          this.startKey = '';
        throw error;
      }
    })().finally(() => {
      this.startTask = null;
    });
    return this.startTask;
  }
  finishRun(runId: string, score: number, reason: string): Promise<RunResult> {
    const previous = this.results.get(runId);
    if (previous) return Promise.resolve({ ...previous });
    const pending = this.finishTasks.get(runId);
    if (pending) return pending;
    const task = this.finishOnce(runId, score, reason).finally(() =>
      this.finishTasks.delete(runId),
    );
    this.finishTasks.set(runId, task);
    return task;
  }
  private async finishOnce(runId: string, score: number, reason: string) {
    if (!this.finishes.has(runId)) {
      if (this.active?.id !== runId) throw new ApiError('SESSION_NOT_FOUND');
      this.finishes.set(runId, {
        score: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0,
        durationMs: Math.max(0, Math.round(this.now() - this.active.receivedAt)),
        reason,
      });
    }
    const finish = this.finishes.get(runId)!;
    const response = await this.options.client
      .request<{
        status: string;
        score: number;
        bestScore: number;
        rejectReason?: string;
        totalScore?: number | null;
        newlyUnlocked?: string[];
      }>('POST', `/api/v1/games/${encodeURIComponent(runId)}/finish`, {
        score: finish.score,
        durationMs: finish.durationMs,
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApiError &&
          ['SESSION_NOT_ACTIVE', 'SESSION_NOT_FOUND', 'SESSION_ALREADY_FINISHED'].includes(
            error.code,
          )
        ) {
          if (this.active?.id === runId) this.active = null;
          this.finishes.delete(runId);
        }
        throw error;
      });
    if (
      !['FINISHED', 'REJECTED'].includes(response?.status) ||
      !Number.isSafeInteger(response.score) ||
      response.score < 0 ||
      (response.newlyUnlocked !== undefined &&
        (!Array.isArray(response.newlyUnlocked) ||
          response.newlyUnlocked.some((code) => typeof code !== 'string' || !code)))
    )
      throw new ApiError('INVALID_RESPONSE');
    const result: RunResult = {
      score: response.score,
      reason: finish.reason,
      verification: response.status === 'FINISHED' ? 'ACCEPTED' : 'REJECTED',
      rejectReason: response.rejectReason,
      newlyUnlocked: response.status === 'FINISHED' ? (response.newlyUnlocked ?? []) : [],
    };
    this.results.set(runId, result);
    this.finishes.delete(runId);
    if (this.active?.id === runId) this.active = null;
    this.boardReadAt = 0;
    // The answer carries the new totals, so no profile read is needed after a game.
    if (Number.isSafeInteger(response.bestScore) && response.bestScore >= 0)
      this.player.best = response.bestScore;
    if (Number.isSafeInteger(response.totalScore) && response.totalScore! >= 0)
      this.player.total = response.totalScore!;
    // Unlocks follow the tournament total; the catalog changes only when this game unlocked a bird.
    if (result.newlyUnlocked?.length) this.invalidateBirds();
    return { ...result };
  }
  async loadLifeHistory(cursor?: string): Promise<LifeHistoryPage> {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    const history = await this.options.client.request<HistoryResponse>(
      'GET',
      `/api/v1/lives/history?${query}`,
    );
    const { tournament, nextCursor } = history ?? {};
    if (
      !Array.isArray(history?.entries) ||
      !Array.isArray(history.freePlays) ||
      (tournament != null && !Number.isSafeInteger(tournament.id)) ||
      (nextCursor != null &&
        (typeof nextCursor !== 'string' || !/^\d+$/.test(nextCursor) || nextCursor === cursor)) ||
      history.entries.some(
        (row) =>
          typeof row?.title !== 'string' ||
          !Number.isSafeInteger(row.lives) ||
          typeof row.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(row.createdAt)),
      ) ||
      history.freePlays.some(
        (row) =>
          typeof row?.title !== 'string' ||
          !Number.isSafeInteger(row.lives) ||
          typeof row.day !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.day),
      )
    )
      throw new ApiError('INVALID_RESPONSE');
    return {
      tournamentId: tournament?.id ?? null,
      nextCursor: nextCursor ?? null,
      earned: history.entries.map((row) => ({
        date: ulaanbaatarDate.format(new Date(row.createdAt)),
        reason: row.title,
        amount: row.lives,
      })),
      free: history.freePlays.map((row) => ({
        date: row.day,
        reason: row.title,
        amount: row.lives,
      })),
    };
  }
  refreshLeaderboard(): Promise<void> {
    if (this.boardReadAt && Date.now() - this.boardReadAt < 60000) return Promise.resolve();
    if (this.leaderboardTask) return this.leaderboardTask;
    this.leaderboardTask = this.loadLeaderboard().finally(() => (this.leaderboardTask = null));
    return this.leaderboardTask;
  }
  private async loadLeaderboard() {
    const tournamentId = this.player.tournament?.id;
    const board = await this.options.client.request<{ entries: Entry[]; me: Entry | null }>(
      'GET',
      '/api/v1/leaderboard?limit=10',
    );
    if (tournamentId !== this.player.tournament?.id) return;
    if (!Array.isArray(board?.entries)) throw new ApiError('INVALID_RESPONSE');
    this.rows = board.entries.map(leaderboardRow);
    this.me = board.me ? leaderboardRow(board.me) : null;
    this.boardReadAt = Date.now();
  }
  async loadDailyLeaderboard(day?: string): Promise<DailyStandings> {
    if (day !== undefined && !validDay(day)) throw new ApiError('INVALID_DAY');
    const query = day ? `?day=${encodeURIComponent(day)}&limit=10` : '?limit=10';
    const board = await this.options.client.request<{
      day: string;
      entries: Entry[];
      me: Entry | null;
      winner: Entry | null;
    }>('GET', `/api/v1/leaderboard/daily${query}`);
    if (!validDay(board?.day) || !Array.isArray(board.entries) || !('winner' in board))
      throw new ApiError('INVALID_RESPONSE');
    return {
      day: board.day,
      entries: board.entries.map(leaderboardRow),
      me: board.me ? leaderboardRow(board.me) : null,
      winner: board.winner ? leaderboardRow(board.winner) : null,
    };
  }
  async loadLeaderboardDays(): Promise<LeaderboardDay[]> {
    const response = await this.options.client.request<{
      days: { day: string; winner: Entry | null }[];
    }>('GET', '/api/v1/leaderboard/days');
    if (!Array.isArray(response?.days)) throw new ApiError('INVALID_RESPONSE');
    return response.days.map((entry) => {
      if (!validDay(entry?.day) || !('winner' in entry)) throw new ApiError('INVALID_RESPONSE');
      return {
        day: entry.day,
        winner: entry.winner ? leaderboardRow(entry.winner) : null,
      };
    });
  }
  leaderboard() {
    return this.rows.map((row) => ({ ...row }));
  }
  ownRank() {
    return this.me ? { ...this.me } : null;
  }
  purchase(key: string, order: PurchaseOrder): Promise<'PENDING' | void> {
    const signature = JSON.stringify(order);
    const pending = this.purchasing.get(key);
    if (pending)
      return pending.signature === signature
        ? pending.task
        : Promise.reject(new ApiError('ORDER_STATE_CONFLICT'));
    if (
      this.purchasing.size > 0 ||
      this.orderCheckTask ||
      this.paymentTask ||
      (this.pendingOrder?.status === 'PENDING' &&
        this.orders.get(key)?.value?.orderId !== this.pendingOrder.orderId) ||
      [...this.orders].some(
        ([otherKey, intent]) =>
          otherKey !== key && (!intent.value || intent.value.status === 'PENDING'),
      )
    )
      return Promise.reject(new ApiError('ORDER_PENDING'));
    const task = this.createOrder(key, order).finally(() => this.purchasing.delete(key));
    this.purchasing.set(key, { signature, task });
    return task;
  }
  private async createOrder(key: string, order: PurchaseOrder): Promise<'PENDING' | void> {
    if (order.kind !== 'attempts') throw new ApiError('CATALOG_UNAVAILABLE');
    if (
      !Number.isSafeInteger(order.quantity) ||
      order.quantity < 1 ||
      (this.price && order.quantity > this.price.maxLivesPerOrder)
    )
      throw new ApiError('VALIDATION_FAILED');
    const signature = JSON.stringify(order);
    const existing = this.orders.get(key);
    if (existing && existing.signature !== signature) throw new ApiError('ORDER_STATE_CONFLICT');
    if (!existing) this.orders.set(key, { signature });
    const intent = this.orders.get(key)!;
    if (!intent.value) {
      try {
        const value = await this.options.client.request<LifeOrder>(
          'POST',
          '/api/v1/lives/orders',
          { quantity: order.quantity },
          key,
        );
        if (!validOrder(value) || value.lives !== order.quantity)
          throw new ApiError('INVALID_RESPONSE');
        intent.value = value;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500)
          this.orders.delete(key);
        throw error;
      }
    }
    this.pendingOrder = intent.value;
    this.saveOrderReference();
    if (
      this.canPay &&
      this.pendingOrder.status === 'PENDING' &&
      !this.paymentOpened.has(this.pendingOrder.orderId)
    )
      await this.payOrder();
    const result = await this.checkOrder();
    if (result.status === 'PENDING') return 'PENDING';
    if (result.status !== 'PAID') throw new ApiError(`ORDER_${result.status}`);
  }
  payOrder(): Promise<void> {
    if (this.paymentTask) return this.paymentTask;
    this.paymentTask = this.openPayment().finally(() => (this.paymentTask = null));
    return this.paymentTask;
  }
  private async openPayment() {
    if (!this.pendingOrder) throw new ApiError('ORDER_NOT_FOUND');
    if (!this.options.payWithPoints) throw new ApiError('HOST_PAYMENT_REQUIRED');
    const order = await this.checkOrder();
    if (order.status !== 'PENDING') return;
    const outcome = await this.options.payWithPoints({ orderId: order.orderId });
    this.paymentOpened.add(order.orderId);
    // The host did not debit: leave the order to expire on the server and let the player start over.
    // Lives still arrive if the host debits after all, because only the server's callback credits them.
    if (outcome === 'CANCELLED' || outcome === 'FAILED') {
      this.abandonOrder();
      throw new ApiError(`PAYMENT_${outcome}`);
    }
  }
  /** Forgets the pending order on this device only; the server lets it expire. */
  abandonOrder() {
    const orderId = this.pendingOrder?.orderId;
    if (!orderId) return;
    this.pendingOrder = undefined;
    for (const [key, order] of this.orders)
      if (order.value?.orderId === orderId) this.orders.delete(key);
    this.paymentOpened.delete(orderId);
    this.saveOrderReference();
    void this.refreshPoints();
  }
  checkOrder(): Promise<LifeOrder> {
    if (this.orderCheckTask) return this.orderCheckTask;
    this.orderCheckTask = this.loadOrder().finally(() => (this.orderCheckTask = null));
    return this.orderCheckTask;
  }
  private async loadOrder() {
    if (!this.pendingOrder) throw new ApiError('ORDER_NOT_FOUND');
    const previous = this.pendingOrder;
    const response = await this.options.client
      .request<LifeOrder>('GET', `/api/v1/lives/orders/${encodeURIComponent(previous.orderId)}`)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404 && error.code === 'ORDER_NOT_FOUND') {
          if (this.pendingOrder?.orderId === previous.orderId) this.pendingOrder = undefined;
          for (const [key, order] of this.orders)
            if (order.value?.orderId === previous.orderId) this.orders.delete(key);
          this.paymentOpened.delete(previous.orderId);
          this.saveOrderReference();
        }
        throw error;
      });
    if (!validOrder(response) || response.orderId !== previous.orderId)
      throw new ApiError('INVALID_RESPONSE');
    if (this.pendingOrder?.orderId !== previous.orderId) {
      // Abandoned meanwhile; a late payment still credits lives, so show them.
      if (response.status === 'PAID') await this.refresh();
      return { ...response };
    }
    this.pendingOrder =
      previous.status !== 'PENDING' && response.status === 'PENDING' ? previous : response;
    for (const order of this.orders.values())
      if (order.value?.orderId === this.pendingOrder.orderId) order.value = this.pendingOrder;
    this.saveOrderReference();
    const settled = { ...this.pendingOrder };
    if (settled.status === 'PAID') {
      await this.refresh();
      void this.refreshPoints();
    }
    return settled;
  }
  private saveOrderReference() {
    try {
      if (this.pendingOrder?.status === 'PENDING' && this.playerId !== undefined)
        sessionStorage.setItem(
          'sono.pending-order',
          JSON.stringify({ owner: this.playerId, order: this.pendingOrder }),
        );
      else sessionStorage.removeItem('sono.pending-order');
    } catch {
      // Orders remain recoverable within this page when WebView storage is denied.
    }
  }
  private invalidateBirds() {
    this.birdEpoch++;
    this.catalogAttempted = false;
    this.catalog = undefined;
  }
  refreshBirds(): Promise<void> {
    if (this.birdTask) {
      if (this.birdTaskEpoch === this.birdEpoch) return this.birdTask;
      return this.birdTask.catch(() => undefined).then(() => this.refreshBirds());
    }
    this.catalogAttempted = true;
    this.birdTaskEpoch = this.birdEpoch;
    this.birdTask = this.loadBirds(this.birdEpoch).finally(() => (this.birdTask = null));
    return this.birdTask;
  }
  private async loadBirds(epoch: number) {
    try {
      const response = await this.options.client.request<BirdsResponse>('GET', '/api/v1/birds');
      if (epoch !== this.birdEpoch) return;
      if (
        !Number.isSafeInteger(response?.totalScore) ||
        response.totalScore < 0 ||
        typeof response.selected !== 'string' ||
        !response.selected ||
        !Array.isArray(response.birds) ||
        response.birds.some(
          (bird) =>
            typeof bird?.code !== 'string' ||
            !bird.code ||
            typeof bird.name !== 'string' ||
            !Number.isSafeInteger(bird.unlockScore) ||
            bird.unlockScore < 0 ||
            typeof bird.unlocked !== 'boolean',
        ) ||
        new Set(response.birds.map((bird) => bird.code)).size !== response.birds.length
      )
        throw new ApiError('INVALID_RESPONSE');
      this.catalog = response.birds.map((bird) => ({
        id: catalogBirdId(bird.code),
        code: bird.code,
        name: bird.name,
        unlockScore: bird.unlockScore,
        unlocked: bird.unlocked,
        selected: bird.code === response.selected,
      }));
      this.player.total = response.totalScore;
      this.applySelectedBird(response.selected);
    } catch (error) {
      if (epoch === this.birdEpoch) {
        this.catalog = undefined;
      }
      throw error;
    }
  }
  private applySelectedBird(code: string) {
    let selectedId = catalogBirdId(code);
    const selected = this.catalog?.find((bird) => bird.id === selectedId);
    if (selected && !selected.unlocked)
      selectedId = this.catalog?.find((bird) => bird.unlocked && bird.unlockScore === 0)?.id ?? '';
    this.player.selectedBird = Object.prototype.hasOwnProperty.call(birdCodes, selectedId)
      ? selectedId
      : 'pilot';
    if (this.catalog)
      this.catalog = this.catalog.map((bird) => ({
        ...bird,
        selected: bird.id === selectedId,
      }));
  }
  async selectBird(id: string) {
    const code = birdCodes[id];
    if (typeof code !== 'string') throw new ApiError('BIRD_NOT_FOUND');
    if (!this.catalog) await this.refreshBirds();
    const bird = this.catalog?.find((item) => item.id === id);
    if (!bird) throw new ApiError('BIRD_NOT_FOUND');
    if (!bird.unlocked) throw new ApiError('BIRD_LOCKED');
    const epoch = this.birdEpoch;
    try {
      const response = await this.options.client.request<{ selected: string }>(
        'PUT',
        '/api/v1/me/bird',
        { code },
      );
      if (response?.selected !== code) throw new ApiError('INVALID_RESPONSE');
      if (
        epoch !== this.birdEpoch ||
        this.catalog?.find((item) => item.id === id)?.unlocked === false
      ) {
        this.invalidateBirds();
        await this.refreshBirds();
        const current = this.catalog?.find((item) => item.id === id);
        if (!current?.unlocked) throw new ApiError('BIRD_LOCKED');
        if (!current.selected) throw new ApiError('INVALID_RESPONSE');
      } else {
        // An older catalog read must not overwrite this confirmed selection.
        this.birdEpoch++;
        this.applySelectedBird(response.selected);
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 0 ||
          error.status >= 500 ||
          error.code === 'BIRD_LOCKED' ||
          error.code === 'BIRD_NOT_FOUND')
      ) {
        await this.refreshBirds().catch(() => undefined);
        if (
          (error.status === 0 || error.status >= 500) &&
          this.catalog?.some((item) => item.id === id && item.unlocked && item.selected)
        )
          return;
      }
      throw error;
    }
  }
}
