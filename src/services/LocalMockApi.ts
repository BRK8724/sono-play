import { ApiClient, ApiError } from './ApiClient';
import { ApiMiniappService } from './ApiMiniappService';
import type { GameConfig, MiniappService } from './MiniappService';
import { newId } from './uuid';

// Local preview only. Vite removes this module from builds without VITE_LOCAL_MOCK_API=1.
const storageKey = 'sono.local-mock.v1';
const mockPlayerId = 987654321;
const pointsPerLife = 20;
const maxLivesPerOrder = 10;
const unlocks = [
  { code: 'sono', name: 'SONO', unlockScore: 0 },
  { code: 'santa_sono', name: 'SANTA SONO', unlockScore: 1500 },
  { code: 'goldy_sono', name: 'GOLDY SONO', unlockScore: 3000 },
] as const;
const opponents = [
  { nickname: 'ROCKET', score: 172 },
  { nickname: 'BILGEE', score: 138 },
  { nickname: 'SONO_FAN', score: 117 },
  { nickname: 'PILOT', score: 94 },
  { nickname: 'GOLDEN', score: 76 },
  { nickname: 'FLAPPY', score: 61 },
  { nickname: 'BIRD', score: 48 },
  { nickname: 'SKY', score: 32 },
  { nickname: 'CLOUD', score: 19 },
  { nickname: 'TURBO', score: 8 },
] as const;
const gameConfig: GameConfig = {
  pipeIntervalMs: 1600,
  gravity: 1200,
  jumpVelocity: -315,
  scrollSpeed: 155,
  pipeGap: 155,
  speed: { step: 0.1, max: 1.4, thresholds: [10, 25, 45, 70] },
};

type MockScore = { score: number; finishedAt: string };
type MockHistory = { type: string; title: string; lives: number; createdAt: string };
type MockFinish = {
  status: 'FINISHED';
  score: number;
  bestScore: number;
  totalScore: number;
  newlyUnlocked: string[];
};
type MockRun = {
  sessionId: string;
  seed: string;
  startedAt: string;
  paidWith: 'FREE' | 'LIFE';
  freePlaysLeft: number;
  livesLeft: number;
  result?: MockFinish;
};
type MockOrder = {
  orderId: string;
  status: 'PENDING' | 'PAID';
  lives: number;
  pointsCost: number;
  createdAt: string;
  expiresAt: string;
};
type MockState = {
  version: 1;
  nickname: string | null;
  freeDay: string;
  freePlaysLeft: number;
  lives: number;
  points: number;
  totalScore: number;
  bestScore: number;
  selectedBird: string;
  scores: MockScore[];
  lifeHistory: MockHistory[];
  runs: Record<string, MockRun>;
  startKeys: Record<string, string>;
  orders: Record<string, MockOrder>;
  orderKeys: Record<string, string>;
};
type BoardEntry = {
  rank: number;
  nickname: string | null;
  totalScore: number;
  reachedAt: string | null;
};

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ulaanbaatar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function dayOf(value: Date | string) {
  const parts = Object.fromEntries(
    dayFormatter.formatToParts(new Date(value)).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function daysBack(today: string, count: number) {
  const first = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(first - index * 86_400_000).toISOString().slice(0, 10),
  );
}
function sampleLifeHistory(): MockHistory[] {
  const createdAt = new Date().toISOString();
  return [
    ['LOAN_PAYMENT', 'Зээл төлсөн', 10],
    ['LOAN_CLOSED', 'Зээл хаасан', 15],
    ['GAME', 'Тоглосон', -1],
    ['GAME', 'Тоглосон', -1],
    ['LOAN_EXTENDED', 'Зээл сунгасан', 3],
    ['POINTS', 'SONO point-р авсан', 2],
    ['SCHEDULE_PAYMENT', 'ХХЗ төлсөн', 5],
    ['LOAN_PAYMENT', 'Зээл төлсөн', 10],
  ].map(([type, title, lives]) => ({
    type: String(type),
    title: String(title),
    lives: Number(lives),
    createdAt,
  }));
}
function freshState(): MockState {
  return {
    version: 1,
    nickname: null,
    freeDay: dayOf(new Date()),
    freePlaysLeft: 3,
    lives: 0,
    points: 1750,
    totalScore: 0,
    bestScore: 0,
    selectedBird: 'sono',
    scores: [],
    lifeHistory: [],
    runs: {},
    startKeys: {},
    orders: {},
    orderKeys: {},
  };
}
function readState(): MockState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as MockState | null;
    if (
      saved?.version === 1 &&
      Array.isArray(saved.scores) &&
      Array.isArray(saved.lifeHistory) &&
      saved.runs &&
      saved.orders &&
      saved.startKeys &&
      saved.orderKeys
    )
      return saved;
  } catch {
    // Private browsing may deny storage. The in-memory fixture still works.
  }
  return freshState();
}
function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function problem(code: string, status: number): Response {
  return response({ code }, status);
}

class LocalMockApi {
  private state = readState();

  get points() {
    return this.state.points;
  }
  addScore() {
    this.state.totalScore += 50;
    this.state.scores.push({ score: 50, finishedAt: new Date().toISOString() });
    this.save();
  }
  reset() {
    this.state = freshState();
    try {
      localStorage.removeItem(storageKey);
      const pending = JSON.parse(sessionStorage.getItem('sono.pending-order') ?? 'null');
      if (pending?.owner === mockPlayerId) sessionStorage.removeItem('sono.pending-order');
    } catch {
      // Reset the in-memory state even when storage is unavailable.
    }
  }
  private save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.state));
    } catch {
      // Local-only preview remains usable without persistent storage.
    }
  }
  private rollDay() {
    const today = dayOf(new Date());
    if (this.state.freeDay !== today) {
      this.state.freeDay = today;
      this.state.freePlaysLeft = 3;
      this.save();
    }
  }
  private tournament() {
    return {
      id: 1,
      name: 'ТУРШИЛТЫН ТЭМЦЭЭН',
      endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      rankingMode: 'TOTAL' as const,
      running: true,
    };
  }
  private board(day?: string) {
    const mockDate = day ?? dayOf(new Date());
    const offset = daysBack(dayOf(new Date()), 32).indexOf(mockDate);
    const samples: {
      nickname: string;
      totalScore: number;
      reachedAt: string;
      own: boolean;
    }[] = opponents.map(({ nickname, score }, index) => ({
      nickname,
      totalScore: day ? Math.max(1, Math.floor(score / 4) + ((offset + index) % 5)) : score,
      reachedAt: `${mockDate}T${String(9 + (index % 10)).padStart(2, '0')}:15:00+08:00`,
      own: false,
    }));
    const runs = day
      ? this.state.scores.filter((entry) => dayOf(entry.finishedAt) === day)
      : this.state.scores;
    const ownScore = day
      ? runs.reduce((sum, entry) => sum + entry.score, 0)
      : this.state.totalScore;
    samples.push({
      nickname: this.state.nickname ?? 'ТА',
      totalScore: ownScore,
      reachedAt: runs.at(-1)?.finishedAt ?? `${mockDate}T00:00:00+08:00`,
      own: true,
    });
    samples.sort(
      (left, right) =>
        right.totalScore - left.totalScore ||
        Date.parse(left.reachedAt) - Date.parse(right.reachedAt),
    );
    const entries = samples.map((item, index) => ({
      rank: index + 1,
      nickname: item.nickname,
      totalScore: item.totalScore,
      reachedAt: item.reachedAt,
    }));
    const ownIndex = samples.findIndex((item) => item.own);
    return { entries, me: entries[ownIndex] as BoardEntry };
  }
  async confirmOrder(orderId: string) {
    const order = this.state.orders[orderId];
    if (!order) throw new ApiError('ORDER_NOT_FOUND', 404);
    if (order.status === 'PAID') return;
    if (this.state.points < order.pointsCost) throw new ApiError('INSUFFICIENT_POINTS', 409);
    this.state.points -= order.pointsCost;
    this.state.lives += order.lives;
    this.state.lifeHistory.unshift({
      type: 'MOCK_PURCHASE',
      title: 'Туршилтын оноогоор авсан',
      lives: order.lives,
      createdAt: new Date().toISOString(),
    });
    order.status = 'PAID';
    this.save();
  }
  fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const path = url.pathname;
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    this.rollDay();

    if (method === 'POST' && path === '/api/v1/auth/exchange')
      return body.launchToken === 'local-mock'
        ? response({ accessToken: 'local-mock-access', refreshAvailable: false })
        : problem('INVALID_LAUNCH_TOKEN', 401);
    if (headers.get('Authorization') !== 'Bearer local-mock-access')
      return problem('UNAUTHORIZED', 401);
    if (method === 'GET' && path === '/api/v1/me')
      return response({
        playerId: mockPlayerId,
        nickname: this.state.nickname,
        freePlaysLeft: this.state.freePlaysLeft,
        lives: this.state.lives,
        playsLeft: this.state.freePlaysLeft + this.state.lives,
        bestScore: this.state.bestScore,
        totalScore: this.state.totalScore,
        selectedBird: this.state.selectedBird,
      });
    if (method === 'GET' && path === '/api/v1/tournament')
      return response({ current: this.tournament(), next: null });
    if (method === 'PUT' && path === '/api/v1/me/nickname') {
      const nickname = String(body.nickname ?? '').trim();
      if (nickname.length < 3 || nickname.length > 16) return problem('VALIDATION_FAILED', 400);
      if (opponents.some((entry) => entry.nickname.toLowerCase() === nickname.toLowerCase()))
        return problem('NICKNAME_TAKEN', 409);
      if (this.state.nickname && this.state.nickname !== nickname)
        return problem('NICKNAME_ALREADY_SET', 409);
      this.state.nickname = nickname;
      this.save();
      return response({ nickname });
    }
    if (method === 'POST' && path === '/api/v1/games/start') {
      if (!this.state.nickname) return problem('NICKNAME_REQUIRED', 409);
      const key = headers.get('Idempotency-Key');
      if (!key) return problem('IDEMPOTENCY_KEY_REQUIRED', 400);
      const oldRun = this.state.runs[this.state.startKeys[key]];
      if (oldRun) return response(this.startPayload(oldRun));
      if (this.state.freePlaysLeft + this.state.lives < 1)
        return problem('INSUFFICIENT_LIVES', 409);
      const paidWith = this.state.freePlaysLeft > 0 ? 'FREE' : 'LIFE';
      if (paidWith === 'FREE') this.state.freePlaysLeft--;
      else {
        this.state.lives--;
        this.state.lifeHistory.unshift({
          type: 'GAME',
          title: 'Тоглолтод зарцуулсан',
          lives: -1,
          createdAt: new Date().toISOString(),
        });
      }
      const run: MockRun = {
        sessionId: newId(),
        seed: String(crypto.getRandomValues(new Uint32Array(1))[0]),
        startedAt: new Date().toISOString(),
        paidWith,
        freePlaysLeft: this.state.freePlaysLeft,
        livesLeft: this.state.lives,
      };
      this.state.runs[run.sessionId] = run;
      this.state.startKeys[key] = run.sessionId;
      this.save();
      return response(this.startPayload(run), 201);
    }
    const finishMatch = path.match(/^\/api\/v1\/games\/([^/]+)\/finish$/);
    if (method === 'POST' && finishMatch) {
      const run = this.state.runs[decodeURIComponent(finishMatch[1])];
      if (!run) return problem('SESSION_NOT_FOUND', 404);
      const score = Number(body.score);
      if (!Number.isSafeInteger(score) || score < 0) return problem('VALIDATION_FAILED', 400);
      if (run.result)
        return run.result.score === score
          ? response(run.result)
          : problem('SESSION_ALREADY_FINISHED', 409);
      const previousTotal = this.state.totalScore;
      this.state.totalScore += score;
      this.state.bestScore = Math.max(this.state.bestScore, score);
      this.state.scores.push({ score, finishedAt: new Date().toISOString() });
      const newlyUnlocked = unlocks
        .filter(
          (bird) => previousTotal < bird.unlockScore && this.state.totalScore >= bird.unlockScore,
        )
        .map((bird) => bird.code);
      run.result = {
        status: 'FINISHED',
        score,
        bestScore: this.state.bestScore,
        totalScore: this.state.totalScore,
        newlyUnlocked,
      };
      this.save();
      return response(run.result);
    }
    if (method === 'GET' && path === '/api/v1/birds')
      return response({
        totalScore: this.state.totalScore,
        selected: this.state.selectedBird,
        birds: unlocks.map((bird) => ({
          ...bird,
          unlocked: this.state.totalScore >= bird.unlockScore,
          selected: this.state.selectedBird === bird.code,
        })),
      });
    if (method === 'PUT' && path === '/api/v1/me/bird') {
      const bird = unlocks.find((entry) => entry.code === body.code);
      if (!bird) return problem('BIRD_NOT_FOUND', 404);
      if (this.state.totalScore < bird.unlockScore) return problem('BIRD_LOCKED', 409);
      this.state.selectedBird = bird.code;
      this.save();
      return response({ selected: bird.code });
    }
    if (method === 'GET' && path === '/api/v1/leaderboard') {
      const board = this.board();
      return response({
        tournament: this.tournament(),
        entries: board.entries.slice(0, Math.min(100, Number(url.searchParams.get('limit')) || 10)),
        me: board.me,
      });
    }
    if (method === 'GET' && path === '/api/v1/leaderboard/days') {
      const today = dayOf(new Date());
      return response({
        days: daysBack(today, 32).map((day) => ({
          day,
          winner: day === today ? null : this.board(day).entries[0],
        })),
      });
    }
    if (method === 'GET' && path === '/api/v1/leaderboard/daily') {
      const today = dayOf(new Date());
      const day = url.searchParams.get('day') ?? today;
      if (!daysBack(today, 32).includes(day)) return problem('VALIDATION_FAILED', 400);
      const board = this.board(day);
      return response({
        day,
        entries: board.entries.slice(0, Math.min(100, Number(url.searchParams.get('limit')) || 10)),
        me: board.me,
        winner: day === today ? null : board.entries[0],
      });
    }
    if (method === 'GET' && path === '/api/v1/lives/price')
      return response({ pointsPerLife, maxLivesPerOrder });
    if (method === 'POST' && path === '/api/v1/lives/orders') {
      const quantity = Number(body.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxLivesPerOrder)
        return problem('VALIDATION_FAILED', 400);
      if (this.state.points < quantity * pointsPerLife) return problem('INSUFFICIENT_POINTS', 409);
      const key = headers.get('Idempotency-Key');
      if (!key) return problem('IDEMPOTENCY_KEY_REQUIRED', 400);
      const prior = this.state.orders[this.state.orderKeys[key]];
      if (prior)
        return prior.lives === quantity ? response(prior) : problem('ORDER_STATE_CONFLICT', 409);
      const order: MockOrder = {
        orderId: newId(),
        status: 'PENDING',
        lives: quantity,
        pointsCost: quantity * pointsPerLife,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      };
      this.state.orders[order.orderId] = order;
      this.state.orderKeys[key] = order.orderId;
      this.save();
      return response(order, 201);
    }
    const orderMatch = path.match(/^\/api\/v1\/lives\/orders\/([^/]+)$/);
    if (method === 'GET' && orderMatch) {
      const order = this.state.orders[decodeURIComponent(orderMatch[1])];
      return order ? response(order) : problem('ORDER_NOT_FOUND', 404);
    }
    if (method === 'GET' && path === '/api/v1/lives/history') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
      const offset = Math.max(0, Number(url.searchParams.get('cursor')) || 0);
      const previewEntries = [...this.state.lifeHistory, ...sampleLifeHistory()];
      const entries = previewEntries.slice(offset, offset + limit);
      const nextCursor =
        offset + entries.length < previewEntries.length ? String(offset + entries.length) : null;
      return response({
        tournament: this.tournament(),
        entries,
        freePlays: daysBack(dayOf(new Date()), 6).map((day) => ({
          day,
          type: 'DAILY_FREE',
          title: 'Өдрийн үнэгүй тоглолт',
          lives: 3,
        })),
        nextCursor,
      });
    }
    if (method === 'POST' && path === '/api/v1/dev/lives') {
      this.state.lives += 10;
      this.state.lifeHistory.unshift({
        type: 'TEST',
        title: 'Туршилтын амь',
        lives: 10,
        createdAt: new Date().toISOString(),
      });
      this.save();
      return response({ lives: this.state.lives });
    }
    return problem('NOT_FOUND', 404);
  };
  private startPayload(run: MockRun) {
    return {
      sessionId: run.sessionId,
      seed: run.seed,
      paidWith: run.paidWith,
      freePlaysLeft: run.freePlaysLeft,
      livesLeft: run.livesLeft,
      config: gameConfig,
    };
  }
}

export function createLocalMockService(): MiniappService {
  const api = new LocalMockApi();
  const client = new ApiClient({
    baseUrl: 'http://local.mock',
    getLaunchToken: async () => 'local-mock',
    fetch: api.fetch,
  });
  const service = new ApiMiniappService({
    client,
    testLivesEnabled: true,
    paymentAvailable: () => true,
    // Answers like the SONO host: a refused debit is FAILED, not an exception.
    payWithPoints: async ({ orderId }) => {
      try {
        await api.confirmOrder(orderId);
        return 'COMPLETED';
      } catch (error) {
        if (error instanceof ApiError && error.code === 'INSUFFICIENT_POINTS') return 'FAILED';
        throw error;
      }
    },
    pointBalance: async () => api.points,
  });
  return Object.assign(service, {
    isMock: true as const,
    addMockScore: () => api.addScore(),
    resetMock: () => api.reset(),
    snapshot: () => ({ ...ApiMiniappService.prototype.snapshot.call(service), points: api.points }),
  });
}
