import { newId } from './services/uuid';
import { GameAudio } from './audio/GameAudio';
import { assetUrl } from './assets';
import { ApiError } from './services/ApiClient';
import { errorMessage, isTransient, NICKNAME_RULES, validNickname } from './services/errors';
import { openExternalUrl } from './services/HostBridge';
import type { RunEndReason } from './rules';

import type {
  CatalogItem,
  RunResult,
  LifeHistoryPage,
  LifeHistoryRow,
  PurchaseOrder,
  MiniappService,
  DailyStandings,
  LeaderboardDay,
  LeaderboardRow,
} from './services/MiniappService';

export type Phase = 'HOME' | 'READY' | 'PLAYING' | 'GAME_OVER';
export interface GameControls {
  isReady: boolean;
  starting?: boolean;
  resultPending?: boolean;
  retryResult?(): Promise<void>;
  phase: Phase;
  hapticsEnabled: boolean;
  go(phase: Phase): void;
  start(): Promise<void>;
  terminate(reason: RunEndReason): void;
}
type Panel =
  | 'settings'
  | 'rules'
  | 'store'
  | 'stats'
  | 'gifts'
  | 'gift-video'
  | 'buy'
  | 'confirmation'
  | 'success'
  | 'failure'
  | 'nickname'
  | 'nickname-success'
  | 'nickname-failure'
  | 'skin-success'
  | 'skin-failure'
  | 'bird-unlocked'
  | 'buy-warning'
  | 'lives'
  | 'winner';
const node = (id: string) => document.getElementById(id)!;
const url = (path: string) => assetUrl(`assets/${path}`);
const image = (path: string, className = '', alt = '') =>
  `<img src="${url(path)}" class="${className}" alt="${escapeText(alt)}" />`;
const medal = (rank: number, className = '') =>
  `<span class="rank-medal ${className}">${image(`fine-gold/rank-${rank}.webp`, '', `${rank}-р байр`)}</span>`;
const escapeText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const scoreClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ulaanbaatar',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
function scoreTimeParts(value: string) {
  return Object.fromEntries(
    scoreClock.formatToParts(new Date(value)).map(({ type, value }) => [type, value]),
  );
}
function scoreTime(value: string) {
  const parts = scoreTimeParts(value);
  return `${parts.month}/${parts.day}<br>${parts.hour}:${parts.minute}:${parts.second}`;
}
function scoreTimeOnly(value: string) {
  const parts = scoreTimeParts(value);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}
const earnedLifeRules = [
  ['ӨДӨРТ ҮНЭГҮЙ', '+3'],
  ['ХУГАЦААНДАА ЗЭЭЛ ТӨЛӨЛТ', '+10'],
  ['ХУГАЦАА ХЭТЭРСЭН ТӨЛӨЛТ', '+5'],
  ['ЗЭЭЛ СУНГАЛТ', '+3'],
  ['ЗЭЭЛ ХААХ', '+15'],
];
const titles: Record<Panel, string> = {
  settings: 'SETTINGS',
  rules: 'ДҮРЭМ',
  store: 'ЗАГВАР',
  stats: 'ЯЛАГЧИД',
  gifts: 'БЭЛЭГ',
  'gift-video': 'БЭЛЭГ ХАРАХ',
  buy: 'АМЬ АВАХ',
  confirmation: 'SONO',
  success: 'АМЖИЛТТАЙ',
  failure: 'ДАХИН ОРОЛДОХ',
  nickname: 'ТОГЛОГЧИЙН НЭР',
  'nickname-success': '',
  'nickname-failure': '',
  'skin-success': '',
  'skin-failure': '',
  'bird-unlocked': '',
  'buy-warning': 'АМЬ АВАХ',
  lives: 'АМЬ',
  winner: '',
};

export class Frontend {
  private panel: Panel | null = null;
  private connected = false;
  private nicknameDraft = '';
  private panelLoading = false;
  private lifeHistory = this.newLifeHistory();
  private catalogLoading = false;
  private orderRetryRequired = false;
  private orderTimer?: ReturnType<typeof setTimeout>;
  private orderPollDelay = 2500;
  private opener: HTMLElement | null = null;
  private quantity = 1;
  private birdIndex = 0;
  private statsTab: 'total' | 'day' | 'history' = 'total';
  private dailyBoard: DailyStandings | null = null;
  private leaderboardDays: LeaderboardDay[] | null = null;
  private statsTournamentId: number | null = null;
  private selectedDay: string | null = null;
  private calendarMonth: string | null = null;
  private unlockedBirdNames: string[] = [];
  private purchasePreview: HTMLElement | null = null;
  private dailyLoading = false;
  private daysLoading = false;
  private daysReadAt = 0;
  private dailyError = '';
  private daysError = '';
  private dailyRequestVersion = 0;
  private daysRequestVersion = 0;
  private order: PurchaseOrder | null = null;
  private orderId = '';
  private purchaseOrigin: 'buy' | 'store' = 'buy';
  private busy = false;
  private navigationVersion = 0;
  private error = '';
  private toastTimer?: ReturnType<typeof setTimeout>;
  private content = node('panel-content');
  private overlay = node('info-overlay');
  private card = this.overlay.querySelector<HTMLElement>('.info-card')!;

  constructor(
    private service: MiniappService,
    private audio: GameAudio,
    private game: GameControls,
  ) {
    node('mock-banner').hidden = !service.isMock;
    node('mock-score').onclick = () => {
      service.addMockScore?.();
      window.location.reload();
    };
    node('mock-buy').onclick = () => this.open('buy');
    node('mock-reset').onclick = () => {
      service.resetMock?.();
      window.location.reload();
    };
    node('play').onclick = () => void this.prepare(node('play'));
    node('result-sync').onclick = () => void game.retryResult?.();
    node('ready-start').onclick = () => void game.start();
    node('retry').onclick = () => void this.prepare(node('retry'));
    node('dev-lives').onclick = () => void this.grantTestLives();
    node('home-button').onclick = () => {
      this.navigationVersion++;
      game.go('HOME');
    };
    node('scene-back').onclick = () => {
      this.navigationVersion++;
      game.terminate('EXIT');
      game.go('HOME');
    };
    for (const panel of ['settings', 'rules', 'store', 'stats', 'gifts', 'lives'] as const) {
      const trigger = node(`${panel}-open`);
      trigger.onclick = () => this.open(panel, trigger);
    }
    node('music-toggle').onclick = () => {
      this.audio.setMusic(!this.audio.music);
      this.refresh();
    };
    node('info-close').onclick = () => this.close();
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
    this.card.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-action]',
      );
      if (target && !target.disabled && !this.busy)
        this.action(target.dataset.action!, target.dataset.value);
    });
    document.addEventListener('keydown', (event) => this.onKey(event));
    // Every enabled button clicks, including ones re-rendered inside panels.
    document.addEventListener('click', (event) => {
      if ((event.target as Element | null)?.closest?.('button:not(:disabled)'))
        this.audio.play('click');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.navigationVersion++;
    });
    window.setInterval(() => {
      if (this.panel === 'stats' && !document.hidden && !this.panelLoading && !this.busy)
        void this.loadStats();
    }, 60000);
    this.refresh();
  }
  async connect() {
    const loading = node('loading');
    loading.hidden = false;
    loading.textContent = 'SONO ачаалж байна…';
    try {
      await this.service.initialize?.();
      this.connected = true;
      this.refresh();
      loading.hidden = true;
      if (this.service.snapshot().nicknameRequired) this.open('nickname');
      else if (this.service.pendingOrder?.status === 'PENDING') {
        this.open('confirmation');
        this.scheduleOrderCheck();
      }
    } catch (error) {
      loading.replaceChildren();
      const message = document.createElement('p');
      message.textContent = errorMessage(error);
      const retry = document.createElement('button');
      retry.className = 'small-button';
      retry.textContent = 'ДАХИН ХОЛБОХ';
      retry.onclick = () => void this.connect();
      loading.append(message, retry);
    }
  }
  get modalOpen() {
    return this.panel !== null;
  }
  refresh() {
    const player = this.service.snapshot();
    node('attempt-count').textContent = String(player.attempts);
    node('result-attempts').textContent = String(player.attempts);
    node('result-attempts').parentElement?.classList.toggle('empty', player.attempts === 0);
    node('retry').textContent =
      this.service.isGuest || player.attempts ? 'ДАХИН ТОГЛОХ' : 'АМЬ АВАХ';
    node('best-label').textContent = 'ӨНДӨР';
    node('best').textContent = String(player.best);
    const showAttempts = this.game.phase === 'READY' || this.game.phase === 'PLAYING';
    node('attempt-bar').hidden = this.service.isGuest || !showAttempts;
    node('result-attempts').parentElement!.hidden = Boolean(this.service.isGuest);
    node('result-total-score').textContent = String(player.total);
    node('result-total').hidden = Boolean(this.service.isGuest);
    node('guest-note').hidden = !this.service.isGuest;
    node('dev-lives').hidden = !this.service.canGrantTestLives;
    node('dev-lives').textContent = `+10 ТЕСТ АМЬ · НЭМЭЛТ ${player.lives ?? 0}`;
    (node('dev-lives') as HTMLButtonElement).disabled = this.busy;
    for (const panel of ['stats', 'gifts', 'lives'])
      node(`${panel}-open`).hidden = Boolean(this.service.isGuest);
    node('scene-back').hidden = this.game.phase === 'HOME';
    node('music-toggle').setAttribute('aria-pressed', String(this.audio.music));
    const waiting = this.busy || Boolean(this.game.starting);
    node('play').setAttribute('aria-busy', String(waiting));
    (node('play') as HTMLButtonElement).disabled = waiting || !this.connected || !this.game.isReady;
    (node('retry') as HTMLButtonElement).disabled = waiting;
    for (const panel of ['settings', 'rules', 'store', 'stats', 'gifts', 'lives'])
      (node(`${panel}-open`) as HTMLButtonElement).disabled = this.busy;
    const start = node('ready-start') as HTMLButtonElement;
    start.disabled = waiting;
    start.setAttribute('aria-busy', String(Boolean(this.game.starting)));
    start.setAttribute(
      'aria-label',
      this.game.starting ? 'Тоглолт эхэлж байна' : 'Нислэг эхлүүлэх',
    );
    start.textContent = this.game.starting ? '…' : '▶';
  }
  async prepare(trigger?: HTMLElement) {
    if (this.busy || !this.connected || !this.game.isReady || this.game.phase === 'PLAYING') return;
    const navigationVersion = this.navigationVersion;
    if (this.game.resultPending) {
      this.game.go('GAME_OVER');
      await this.game.retryResult?.();
      if (this.game.resultPending || navigationVersion !== this.navigationVersion) return;
    }
    this.busy = true;
    this.refresh();
    try {
      if (this.service.refreshIfStale) await this.service.refreshIfStale(60000);
      else await this.service.refresh?.();
      if (navigationVersion !== this.navigationVersion || document.hidden) return;
      const player = this.service.snapshot();
      this.refresh();
      if (this.service.isGuest) {
        this.close(true);
        this.game.go('READY');
      } else if (player.nicknameRequired) this.open('nickname', trigger);
      else if (!player.tournament) this.notify('Одоогоор тэмцээн явагдаагүй байна.');
      else if (!player.attempts) this.open('buy-warning', trigger);
      else {
        this.close(true);
        this.game.go('READY');
      }
    } catch (error) {
      this.notify(errorMessage(error));
    } finally {
      this.busy = false;
      this.refresh();
      if (this.panel) this.render();
    }
  }
  showResult(result: RunResult) {
    node('result-score').textContent = String(result.score);
    const reasons: Record<string, string> = {
      COLLISION: '',
      APP_BACKGROUND: 'Апп арын горимд шилжсэн тул тоглолт дууслаа.',
      CONNECTION_LOST: 'Холболт тасарсан тул тоглолт дууслаа.',
      EXIT: 'Тоглолтоос гарлаа.',
      TIME_LIMIT: 'Тоглох хугацаа дууслаа.',
    };
    node('result-reason').textContent = reasons[result.reason] ?? '';
    const statuses = {
      PENDING: 'Дүн илгээж байна…',
      ACCEPTED: this.service.isMock ? 'Туршилтын дүнд бүртгэгдлээ' : 'Серверт бүртгэгдлээ',
      REJECTED: 'Оноог сервер хүлээн авсангүй',
      LOCAL: 'Зочны тоглолт · оноо зөвхөн энэ удаагийн нээлтэд',
    };
    node('result-status').textContent = statuses[result.verification];
    node('result-sync').hidden = result.verification !== 'PENDING';
    if (result.rejectReason)
      node('result-reason').textContent =
        result.rejectReason === 'DURATION_MISMATCH'
          ? 'Тоглолтын хугацаа зөрсөн байна.'
          : 'Оноо тоглолтын хугацаатай тохирохгүй байна.';
    this.refresh();
    if (result.verification === 'ACCEPTED' && result.newlyUnlocked?.length)
      void this.showUnlockedBirds(result.newlyUnlocked);
  }
  private async showUnlockedBirds(codes: string[]) {
    await this.service.refreshBirds?.().catch(() => undefined);
    this.unlockedBirdNames = codes.map(
      (code) => this.service.birdCatalog?.find((bird) => bird.code === code)?.name ?? code,
    );
    this.audio.play('getBird');
    if (this.game.phase === 'GAME_OVER' && !this.panel) this.open('bird-unlocked');
    else this.notify(`Шинэ SONO нээгдлээ: ${this.unlockedBirdNames.join(', ')}`);
  }
  open(panel: Panel, trigger?: HTMLElement) {
    if (!this.connected || !this.game.isReady || this.game.phase === 'PLAYING') return;
    if (panel === 'stats') {
      const tournamentId = this.service.snapshot().tournament?.id ?? null;
      if (tournamentId !== this.statsTournamentId) {
        this.statsTournamentId = tournamentId;
        this.dailyRequestVersion++;
        this.daysRequestVersion++;
        this.dailyBoard = null;
        this.leaderboardDays = null;
        this.selectedDay = null;
        this.calendarMonth = null;
        this.dailyLoading = false;
        this.daysLoading = false;
        this.daysReadAt = 0;
      }
    }
    if (!this.panel) this.opener = trigger ?? (document.activeElement as HTMLElement);
    if (panel === 'store') {
      const p = this.service.snapshot();
      const selected =
        this.service.birdCatalog?.find((item) => item.selected)?.id ?? p.selectedBird;
      this.birdIndex = Math.max(
        0,
        this.catalogBirds.findIndex((item) => item.id === selected),
      );
    }
    const changed = this.panel !== panel;
    if (changed) this.navigationVersion++;
    if (panel === 'confirmation' && this.service.pendingOrder)
      this.order = { kind: 'attempts', quantity: this.service.pendingOrder.lives };
    this.panel = panel;
    if (changed && panel !== 'failure') this.error = '';
    this.setModalVisible(true);
    this.render(changed);
    this.focusPanel();
    if (panel === 'stats' && changed) {
      if (this.statsTab === 'total') void this.loadStats();
      else if (this.statsTab === 'day') {
        void this.loadDays();
        void this.loadDaily();
      } else void this.loadDays();
    }
    if (panel === 'store' && changed && this.service.refreshBirds) void this.loadBirds();
    if (panel === 'lives' && changed) {
      this.lifeHistory = this.newLifeHistory();
      void this.loadLives();
    }
    if (panel === 'buy' && changed && !this.service.price)
      void this.service.refreshPrice?.().then(() => {
        if (this.panel === 'buy') this.render();
      });
    if (panel === 'buy' && changed && this.service.refreshPoints)
      void this.service.refreshPoints().then(() => {
        if (this.panel === 'buy' && !this.busy) this.render();
      });
  }
  private newLifeHistory() {
    return { page: null as LifeHistoryPage | null, loading: false, error: '' };
  }
  private async loadLives() {
    const state = this.lifeHistory;
    if (!this.service.loadLifeHistory || state.loading || this.panel !== 'lives') return;
    if (state.page && !state.page.nextCursor) return;
    const lastPage = state.page;
    const restoreFocus = this.content.contains(document.activeElement);
    state.loading = true;
    state.error = '';
    this.render();
    try {
      const page = await this.service.loadLifeHistory(lastPage?.nextCursor ?? undefined);
      if (lastPage && page.tournamentId !== lastPage.tournamentId) {
        // Cursor pages must belong to the same tournament, including across a rollover.
        state.page = null;
        if (this.lifeHistory !== state || this.panel !== 'lives') return;
        state.page = await this.service.loadLifeHistory();
      } else {
        state.page = lastPage ? { ...page, earned: [...lastPage.earned, ...page.earned] } : page;
      }
    } catch (error) {
      state.error = errorMessage(error);
    } finally {
      state.loading = false;
      if (this.lifeHistory === state && this.panel === 'lives') {
        this.render();
        if (restoreFocus && !this.card.contains(document.activeElement))
          (
            this.content.querySelector<HTMLElement>('[data-action="lives-more"]') ??
            node('info-close')
          ).focus({ preventScroll: true });
      }
    }
  }
  private async loadBirds() {
    if (this.catalogLoading) return;
    const restoreFocus = this.card.contains(document.activeElement);
    this.catalogLoading = true;
    this.error = '';
    this.render();
    try {
      await this.service.refreshBirds?.();
      const selected = this.service.birdCatalog?.find((item) => item.selected)?.id;
      this.birdIndex = Math.max(
        0,
        this.catalogBirds.findIndex((item) => item.id === selected),
      );
    } catch (error) {
      if (this.panel === 'store') this.error = errorMessage(error);
    } finally {
      this.catalogLoading = false;
      this.refresh();
      if (this.panel === 'store') {
        this.render();
        if (restoreFocus && !this.card.contains(document.activeElement))
          this.content.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
      }
    }
  }
  private async loadStats() {
    if (this.panel !== 'stats' || this.panelLoading) return;
    this.panelLoading = true;
    this.error = '';
    this.render();
    try {
      await this.service.refreshLeaderboard?.();
    } catch (error) {
      if (this.panel === 'stats') this.error = errorMessage(error);
    } finally {
      this.panelLoading = false;
      if (this.panel === 'stats') this.render();
    }
  }
  private async loadDaily(day: string | null = this.selectedDay) {
    if (!this.service.loadDailyLeaderboard) return;
    const version = ++this.dailyRequestVersion;
    this.dailyBoard = null;
    this.dailyLoading = true;
    this.dailyError = '';
    if (this.panel === 'stats') this.render();
    try {
      const board = await this.service.loadDailyLeaderboard(day ?? undefined);
      if (version === this.dailyRequestVersion) this.dailyBoard = board;
    } catch (error) {
      if (version === this.dailyRequestVersion) this.dailyError = errorMessage(error);
    } finally {
      if (version === this.dailyRequestVersion) {
        this.dailyLoading = false;
        if (this.panel === 'stats') this.render();
      }
    }
  }
  private async loadDays(force = false) {
    if (
      !this.service.loadLeaderboardDays ||
      this.daysLoading ||
      (this.leaderboardDays && !force && Date.now() - this.daysReadAt < 60_000)
    )
      return;
    const version = ++this.daysRequestVersion;
    this.daysLoading = true;
    this.daysError = '';
    if (this.panel === 'stats') this.render();
    try {
      const days = await this.service.loadLeaderboardDays();
      if (version === this.daysRequestVersion) {
        this.leaderboardDays = days;
        this.daysReadAt = Date.now();
      }
    } catch (error) {
      if (version === this.daysRequestVersion) this.daysError = errorMessage(error);
    } finally {
      if (version === this.daysRequestVersion) {
        this.daysLoading = false;
        if (this.panel === 'stats') this.render();
      }
    }
  }
  close(force = false) {
    if (
      (this.busy || (this.panel === 'nickname' && this.service.snapshot().nicknameRequired)) &&
      !force
    )
      return;
    clearTimeout(this.orderTimer);
    if (this.panel === 'confirmation' && !force) {
      this.open(this.purchaseOrigin);
      return;
    }
    this.panel = null;
    // Remove the iframe so YouTube playback stops when the modal closes.
    this.content.querySelector('.gift-video-frame')?.remove();
    this.overlay.querySelector('.purchase-preview')?.remove();
    this.navigationVersion++;
    this.setModalVisible(false);
    this.opener?.focus();
    this.opener = null;
  }
  private setModalVisible(visible: boolean) {
    this.overlay.hidden = !visible;
    document.body.toggleAttribute('data-modal-open', visible);
    for (const id of ['home', 'ready', 'game-over', 'scene-back'])
      node(id).toggleAttribute('inert', visible);
  }
  private focusPanel() {
    const close = node('info-close');
    const target =
      this.content.querySelector<HTMLInputElement>('#nickname-input') ??
      (close.hidden ? this.content : close);
    target.focus({ preventScroll: true });
  }
  notify(message: string) {
    const toast = node('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  }
  private get catalogBirds(): CatalogItem[] {
    return (this.service.birdCatalog ?? []).map((entry) => {
      const imageById: Record<string, string> = {
        pilot: 'sono/store-pilot.webp',
        santa: 'sono/store-santa.webp',
        gold: 'sono/store-gold.webp',
      };
      return { id: entry.id, name: entry.name, image: imageById[entry.id] ?? '' };
    });
  }
  private catalog(items: CatalogItem[], index: number) {
    const item = items[index];
    if (!item) return '<p class="empty-state">Загварын мэдээлэл алга.</p>';
    const player = this.service.snapshot();
    const metadata = this.service.birdCatalog?.find((entry) => entry.id === item.id);
    const threshold = metadata?.unlockScore;
    const unlocked = metadata?.unlocked === true;
    const selected = metadata?.selected === true;
    const thresholdLabel = threshold === undefined ? '—' : String(threshold);
    const progress =
      threshold === undefined
        ? ''
        : `<span class="sr-only">Таны баталгаажсан оноо ${player.total.toLocaleString()}, нээх босго ${thresholdLabel} оноо.</span>`;
    const displayName = item.id === 'pilot' ? 'FLAPPY SONO' : item.name;
    return `<section class="catalog-section"><h3>SONO</h3><div class="carousel"><button class="arrow" data-action="bird-prev" aria-label="Өмнөх загвар">◀</button><div class="skin-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}"><span class="skin-name">${escapeText(displayName)}</span>${item.image ? image(item.image, 'catalog-image', item.name) : '<span class="asset-pending">ЗУРАГ ХҮЛЭЭГДЭЖ БАЙНА</span>'}${unlocked ? '' : '<span class="skin-lock" aria-label="Түгжээтэй"></span>'}</div><button class="arrow" data-action="bird-next" aria-label="Дараагийн загвар">▶</button></div>${unlocked ? (selected ? '' : `<div class="panel-actions"><button class="small-button" data-action="select-bird" ${!item.image ? 'disabled' : ''}>${!item.image ? 'ЗУРАГ ХҮЛЭЭГДЭЖ БАЙНА' : 'ИДЭВХЖҮҮЛЭХ'}</button></div>`) : `<p class="skin-threshold">${thresholdLabel} ДЭЭШ</p>${progress}`}</section>`;
  }
  private feedback(
    title: string,
    copy: string,
    okAction: string,
    success: boolean,
    badge = '',
    okLabel = 'ОК',
  ) {
    return `<section class="feedback"><h3 id="panel-feedback-title">${escapeText(title)}</h3><p>${escapeText(copy)}</p>${badge ? `<strong class="feedback-badge">${escapeText(badge)}</strong>` : ''}${image(success ? 'final/emoji-1-55041f66.png' : 'final/emotes-1-33046200.png', 'purchase-feedback')}<button class="small-button" data-action="${okAction}">${escapeText(okLabel)}</button></section>`;
  }
  private statsContent() {
    const tabs = `<div class="stats-tabs" role="tablist" aria-label="Чансааны хэсэг">${(
      [
        ['total', 'НИЙТ'],
        ['day', 'ӨНӨӨДӨР'],
        ['history', 'ӨМНӨХ'],
      ] as const
    )
      .map(
        ([id, title]) =>
          `<button role="tab" aria-selected="${this.statsTab === id}" data-action="stats-tab" data-value="${id}">${title}</button>`,
      )
      .join('')}</div>`;
    if (this.statsTab === 'total' && this.panelLoading && this.service.leaderboard().length === 0)
      return tabs + '<p class="empty-state" role="status">Чансаа ачаалж байна…</p>';
    if (this.statsTab === 'total' && this.error)
      return (
        tabs +
        `<p class="error-copy">${escapeText(this.error)}</p><button class="small-button" data-action="stats-retry">ДАХИН АЧААЛАХ</button>`
      );
    if (this.statsTab === 'history') {
      if (this.daysError)
        return (
          tabs +
          `<p class="error-copy">${escapeText(this.daysError)}</p><button class="small-button" data-action="stats-retry">ДАХИН АЧААЛАХ</button>`
        );
      if (this.daysLoading || !this.leaderboardDays)
        return tabs + '<p class="empty-state" role="status">Өдрүүдийг ачаалж байна…</p>';
      const days = this.leaderboardDays;
      if (!days.length)
        return tabs + '<p class="empty-state">Тэмцээний өдөр бүртгэгдээгүй байна.</p>';
      const months = [...new Set(days.map(({ day }) => day.slice(0, 7)))].sort();
      const month =
        this.calendarMonth && months.includes(this.calendarMonth)
          ? this.calendarMonth
          : months.at(-1)!;
      const monthIndex = months.indexOf(month);
      const [year, monthNumber] = month.split('-').map(Number);
      const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
      const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      const allowed = new Set(days.map(({ day }) => day));
      const cells = [
        ...Array.from({ length: firstWeekday }, () => '<span aria-hidden="true"></span>'),
        ...Array.from({ length: count }, (_, index) => {
          const number = index + 1;
          const date = `${month}-${String(number).padStart(2, '0')}`;
          const enabled = allowed.has(date);
          return `<button data-action="stats-pick-day" data-value="${date}" ${enabled ? '' : 'disabled'} ${this.selectedDay === date ? 'aria-current="date"' : ''} aria-label="${year} оны ${monthNumber} сарын ${number}">${number}</button>`;
        }),
      ].join('');
      return (
        tabs +
        `<div class="calendar-heading"><button data-action="stats-month" data-value="${months[monthIndex - 1] ?? ''}" aria-label="Өмнөх сар" ${monthIndex === 0 ? 'disabled' : ''}>‹</button><strong>${monthNumber} САР</strong><button data-action="stats-month" data-value="${months[monthIndex + 1] ?? ''}" aria-label="Дараагийн сар" ${monthIndex === months.length - 1 ? 'disabled' : ''}>›</button></div><div class="calendar-weekdays">${['НЯМ', 'ДАВ', 'МЯГ', 'ЛХА', 'ПҮР', 'БАА', 'БЯМ'].map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar-days">${cells}</div>`
      );
    }
    const daily = this.statsTab === 'day';
    if (daily && this.dailyError)
      return (
        tabs +
        `<p class="error-copy">${escapeText(this.dailyError)}</p><button class="small-button" data-action="stats-retry">ДАХИН АЧААЛАХ</button>`
      );
    if (daily && (this.dailyLoading || !this.dailyBoard))
      return tabs + '<p class="empty-state" role="status">Өдрийн чансааг ачаалж байна…</p>';
    const rows = daily ? this.dailyBoard!.entries : this.service.leaderboard();
    const own = daily ? this.dailyBoard!.me : this.service.ownRank();
    const player = this.service.snapshot();
    const ownCard = `<p class="rank-caption">ТАНЫ БАЙР</p><div class="own-rank"><span>${own?.rank ?? '—'}</span><span>${escapeText(own?.name || player.name || 'ТОГЛОГЧ')}</span><span>${own?.score ?? (daily ? '—' : player.total)}</span></div>`;
    const displayRows: (LeaderboardRow & { placeholder?: boolean })[] =
      !daily && rows.length
        ? [
            ...rows,
            ...Array.from({ length: Math.max(0, 10 - rows.length) }, (_, index) => ({
              rank: rows.length + index + 1,
              name: '—',
              score: 0,
              placeholder: true,
            })),
          ]
        : rows;
    const leader = daily ? (this.dailyBoard!.winner ?? rows[0]) : null;
    const dateHeading =
      daily && this.selectedDay
        ? `<div class="daily-heading"><button data-action="stats-back-calendar" aria-label="Календарь руу буцах">‹</button><strong>${this.selectedDay.slice(5).replace('-', '/')}</strong></div>`
        : '';
    const hero = daily
      ? `${dateHeading}<div class="leader-hero"><div class="hero-medal">${leader ? medal(1) : ''}</div><div class="leader-pills"><strong>${escapeText(leader?.name ?? 'ТЭРГҮҮЛЭГЧ АЛГА')}</strong><span>${leader?.score ?? '—'}</span><small>${leader?.reachedAt ? scoreTimeOnly(leader.reachedAt) : '—'}</small></div></div>`
      : '';
    const tableRow = (row: LeaderboardRow & { placeholder?: boolean }) =>
      `<tr class="${row.placeholder ? 'is-placeholder' : own?.rank === row.rank ? 'is-me' : ''}"><td>${row.rank >= 1 && row.rank <= 5 && !daily ? medal(row.rank, 'mini-medal') : String(row.rank).padStart(2, '0')}</td><td>${escapeText(row.name)}</td><td>${row.placeholder ? '—' : row.score}</td><td class="score-day">${row.reachedAt ? scoreTime(row.reachedAt) : '—'}</td></tr>`;
    const table = daily
      ? `<table class="leaderboard daily-board" aria-label="Өдрийн шилдэг 10"><tbody>${rows.slice(1).map(tableRow).join('')}</tbody></table>`
      : `<div class="leaderboard-top"><table class="leaderboard" aria-label="Нийт шилдэг 5"><thead><tr><th scope="col">БАЙР</th><th scope="col">ТОГЛОГЧ</th><th scope="col">ОНОО</th><th scope="col">ЦАГ</th></tr></thead><tbody>${displayRows.slice(0, 5).map(tableRow).join('')}</tbody></table></div><table class="leaderboard leaderboard-rest" aria-label="Нийт 6–10 байр"><tbody>${displayRows.slice(5).map(tableRow).join('')}</tbody></table>`;
    return (
      tabs +
      hero +
      `${rows.length ? table : '<p class="empty-state">Одоогоор оноо бүртгэгдээгүй байна.</p>'}${ownCard}`
    );
  }
  private ledgerContent() {
    const { page, loading, error } = this.lifeHistory;
    const history = page ?? this.service.history?.();
    const table = (rows: LifeHistoryRow[], showHeader = true) =>
      rows.length
        ? `<table class="ledger-table">${showHeader ? '<thead><tr><th scope="col">ОГНОО</th><th scope="col">ТӨРӨЛ</th><th scope="col">ТОО</th></tr></thead>' : ''}<tbody>${rows.map((row) => `<tr><td>${escapeText(row.date)}</td><td>${escapeText(row.reason)}</td><td class="${row.amount > 0 ? 'credit' : 'debit'}">${row.amount > 0 ? '+' : ''}${row.amount}</td></tr>`).join('')}</tbody></table>`
        : '<p class="empty-state">Бүртгэл алга.</p>';
    const status = loading
      ? '<p class="empty-state" role="status">Амийн түүхийг ачаалж байна…</p>'
      : error
        ? `<p class="error-copy" role="alert">${escapeText(error)}</p>`
        : '';
    const more =
      !loading && (page?.nextCursor || error)
        ? `<div class="panel-actions"><button class="small-button" data-action="lives-more">${error ? 'ДАХИН АЧААЛАХ' : 'ЦААШ ҮЗЭХ'}</button></div>`
        : '';
    // Each list keeps its size and scrolls inside; further pages load at the end of the earned list.
    if (history)
      return `<div class="ledger-heading-icon">${image('final/hearth-icon-fee12fa6.png', '', 'Амь')}</div><section class="ledger-block"><h3>АМЬ АВСАН ЖАГСААЛТ</h3><div class="ledger-scroll">${table(history.earned)}${status}${more}</div></section><section class="ledger-block"><h3>ӨДРИЙН ҮНЭГҮЙ АМЬ</h3><div class="ledger-scroll">${table(history.free, false)}</div></section>`;
    return status + more || '<p class="empty-state">Амийн түүх одоогоор алга.</p>';
  }
  private rulesContent() {
    if (this.service.isGuest)
      return `<section class="rules-block yellow"><h3>ЗОЧНЫ ТОГЛОЛТ</h3><p>Нэвтрэхгүйгээр шууд тоглоно. Нэг хос хоолойг давах бүрд 1 оноо авна. Оноо өсөхөд хурд нэмэгдэнэ. Нэг тоглолт 15 минут хүртэл үргэлжилнэ.</p><p>Оноо зөвхөн энэ нээлтэд хадгалагдана. Серверийн чансаа, шагнал, амь болон худалдан авалтад тооцогдохгүй. Загваруудыг энд түр сонгон туршиж болно.</p></section>`;
    const price = this.service.price?.pointsPerLife;
    const purchases = `<div><span>${price === undefined ? '—' : price.toLocaleString('mn-MN')} SONO POINT</span><strong>+1</strong></div>`;
    const thresholds = this.service.birdCatalog
      ?.filter((bird) => bird.unlockScore > 0)
      .map((bird) => `${escapeText(bird.name)} — ${bird.unlockScore.toLocaleString('mn-MN')}`)
      .join(', ');
    const skins = thresholds
      ? `<p>Загвар нээхэд шаардагдах тэмцээний нийт оноо · ${thresholds}</p>`
      : '<p>Загварууд тэмцээний нийт оноогоор нээгдэнэ. Босгыг Загвар хэсгээс харна уу.</p>';
    const lifeRows = earnedLifeRules
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
      .join('');

    return `<div class="rules-heading-icon">${image('final/hearth-icon-fee12fa6.png')}</div><section class="rules-block purple"><h3>АМЬ ЦУГЛУУЛАХ АРГА</h3>${lifeRows}${purchases}</section>
      <section class="rules-block white">${medal(1, 'rule-medal')}<h3>НИЙТ ӨДРИЙН ЯЛАГЧ ТОДРУУЛАХ</h3><p>Тоглогчид өөрсдийн тоглосон нийт өдрийн нийлбэр оноогоор өрсөлдөж, эхний 5 байр шагналтай.</p></section>
      <section class="rules-block white">${image('final/gold-sono-871113b4.png', 'rule-medal')}<h3>НЭГ ӨДРИЙН ЯЛАГЧ ТОДРУУЛАХ</h3><p>Тоглогчид өөрсдийн тоглосон 1 өдрийн нийлбэр оноогоор өрсөлдөж, эхний 1 байр шагналтай.</p></section>
      <section class="rules-block red">${image('fine-gold/attention.webp', 'rule-warning')}<p>Өдөрт олгогдох 3 эрх ашиглагдаагүй тохиолдолд дараа өдөрт шилжихгүй.</p></section>
      <details class="rule-details"><summary>ДЭЛГЭРЭНГҮЙ ДҮРЭМ</summary>
        <p>Хуваарьт төлбөрийг бүтэн төлсөн үед эрх олгоно. Эрт төлөлтийн +10 нь хугацаандаа төлөлтийн +10-ыг орлоно. Нэг хуваарьт нэг удаа, зээл бүрд тусад нь олгоно. Өдрийн дээд хязгааргүй.</p>
        <p>Өдрийн үнэгүй эрхийг эхэлж зарцуулна. Олсон эрх тэмцээн дуустал хүчинтэй.</p>
        <p>Нэг хос хоолойг амжилттай давахад +1 оноо нэмэгдэнэ. Оноо өсөхөд тоглолтын хурд шатлалтай нэмэгдэнэ. Нэг тоглолт 15 минут хүртэл үргэлжилнэ. Апп арын горимд шилжвэл тоглолт дуусна.</p>
        ${skins}
        <p>Улаанбаатарын цагаар өдрийн зураг 07:00–18:00, шөнийн зураг 18:00–07:00 харагдана.</p>
      </details>`;
  }
  private render(resetScroll = false) {
    if (!this.panel) return;
    this.overlay.querySelector('.purchase-preview')?.remove();
    if ((this.panel === 'success' || this.panel === 'failure') && this.purchasePreview) {
      const preview = this.purchasePreview.cloneNode(true) as HTMLElement;
      preview.classList.add('purchase-preview');
      preview.setAttribute('aria-hidden', 'true');
      preview.inert = true;
      preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      preview.querySelector<HTMLElement>('div')?.classList.add('preview-content');
      this.overlay.insertBefore(preview, this.card);
    }
    this.card.querySelector(':scope > .stats-tabs')?.remove();
    const scrollTop = resetScroll ? 0 : this.content.scrollTop;
    const listScroll = Array.from(
      this.content.querySelectorAll<HTMLElement>('.ledger-scroll'),
      (list) => (resetScroll ? 0 : list.scrollTop),
    );
    const active =
      !resetScroll && this.content.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
    const activeInput = active instanceof HTMLInputElement ? active : null;
    const selectionStart = activeInput?.selectionStart;
    const selectionEnd = activeInput?.selectionEnd;
    node('info-close').hidden =
      this.panel === 'nickname' ||
      [
        'nickname-success',
        'nickname-failure',
        'skin-success',
        'skin-failure',
        'success',
        'failure',
        'winner',
      ].includes(this.panel);
    const p = this.service.snapshot();
    node('info-title').textContent = titles[this.panel];
    this.overlay.setAttribute(
      'aria-labelledby',
      titles[this.panel] ? 'info-title' : 'panel-feedback-title',
    );
    this.card.dataset.panel = this.panel;
    this.card.dataset.statsTab = this.panel === 'stats' ? this.statsTab : '';
    this.card.dataset.selectedDay = this.panel === 'stats' && this.selectedDay ? 'yes' : 'no';
    this.card.setAttribute(
      'aria-busy',
      String(
        this.busy ||
          (this.panel === 'stats' && this.panelLoading) ||
          (this.panel === 'lives' && this.lifeHistory.loading) ||
          (this.panel === 'store' && this.catalogLoading),
      ),
    );
    switch (this.panel) {
      case 'nickname':
        this.content.innerHTML = `<form id="nickname-form"><div class="nickname-row">${image('fine-gold/pilot.webp')}<div class="nickname-field"><input id="nickname-input" class="nickname-input" name="nickname" autocomplete="off" enterkeyhint="done" minlength="3" maxlength="16" placeholder="НЭР:" required value="${escapeText(this.nicknameDraft)}" aria-label="Тоглогчийн нэр" ${this.busy ? 'readonly' : ''} /><button class="nickname-commit" type="submit" aria-label="Нэр бүртгэх" ${this.busy ? 'disabled' : ''}>✓</button></div></div>${this.error ? `<p class="error-copy" role="alert">${escapeText(this.error)}</p>` : ''}</form>`;
        this.content.querySelector('form')!.onsubmit = (event) => {
          event.preventDefault();
          void this.saveNickname();
        };
        break;
      case 'nickname-success':
        this.content.innerHTML = this.feedback(
          'COOL...',
          'ТАНЫ НЭР АМЖИЛТТАЙ ҮҮСЛЭЭ. АМЖИЛТ ХҮСЬЕ!',
          'nickname-done',
          true,
          p.name,
          'ОК',
        );
        break;
      case 'nickname-failure':
        this.content.innerHTML = this.feedback(
          'ӨӨӨ...',
          'ТАНЫ НЭР ДАВХАРДАЖ БАЙГАА ТУЛ ӨӨРЧЛӨӨД ҮЗЭЭРЭЙ.',
          'nickname-back',
          false,
        );
        break;
      case 'skin-success':
        this.content.innerHTML = this.feedback(
          'COOL...',
          'ШИНЭ ЗАГВАР ИДЭВХЖЛЭЭ!',
          'close-feedback',
          true,
        );
        break;
      case 'skin-failure':
        this.content.innerHTML = this.feedback(
          'ӨӨӨ...',
          'ЗАГВАР НЭЭХ ОНОО ХҮРЭЛЦЭХГҮЙ БАЙНА.',
          'close-feedback',
          false,
        );
        break;
      case 'bird-unlocked': {
        const bird = this.catalogBirds.find((item) => this.unlockedBirdNames.includes(item.name));
        const birdName =
          bird?.id === 'gold' ? 'GOLDY SONO' : (bird?.name ?? this.unlockedBirdNames[0] ?? 'SONO');
        this.content.innerHTML = `<section class="feedback unlock-feedback"><h3 id="panel-feedback-title">COOL...</h3><p>ТА <em class="${bird?.id === 'gold' ? 'gold-name' : ''}">“${escapeText(birdName)}”</em>-ТОЙ БОЛЛОО</p>${bird?.image ? image(bird.image, 'unlocked-bird', bird.name) : ''}<button class="small-button" data-action="close-feedback">ОК</button></section>`;
        break;
      }
      case 'buy-warning':
        this.content.innerHTML = this.service.isMock
          ? `<section class="feedback"><h3>ТОГЛОХ ЭРХ ДУУСЛАА</h3><p>Туршилтын амь нэмэх эсвэл туршилтын point-оор авах боломжтой.</p><button class="small-button" data-action="grant-test-lives">+10 ТЕСТ АМЬ</button><button class="small-button" data-action="open-buy">ТЕСТ POINT-ООР АВАХ</button></section>`
          : this.service.canGrantTestLives
            ? `<section class="feedback"><h3>ТОГЛОХ ЭРХ ДУУСЛАА</h3><p>Тест тоглогчдоо 10 амь нэмнэ үү.</p><button class="small-button" data-action="grant-test-lives">+10 ТЕСТ АМЬ</button></section>`
            : `<section class="feedback"><h3>АНХААР!</h3><p>ТА ДАХИН ТОГЛОХ ЭРХ АВАХЫН ТУЛД SONO ПОЙНТООР АМЬ АВНА УУ.</p><div class="exchange-icon">${image('final/exchange.svg')}</div><button class="small-button" data-action="open-buy">ОК</button></section>`;
        break;
      case 'lives':
        this.content.innerHTML = this.ledgerContent();
        break;
      case 'winner':
        this.content.innerHTML = `<section class="winner-content"><h3 id="panel-feedback-title" class="winner-brand">${image('fine-gold/winner-logo.webp', 'winner-logo', 'SONO PLAY')}</h3><p>ТА ӨНӨӨДРИЙН ШИЛДЭГ ТОГЛОГЧ БОЛЛОО!</p><p>Бэлгийн мэдээллийг SONO апп-аас хүлээн авна уу.</p>${medal(1, 'winner-medal')}<button class="small-button" data-action="close-feedback">ОК</button></section>`;
        break;
      case 'settings':
        this.content.innerHTML = `<div class="player-settings">${image('final/shop-2-f322f500.png')}<div><label>ТОГЛОГЧИЙН НЭР</label><span class="player-name">${escapeText(p.name)}</span>${p.phone ? `<small>УТАС · ${escapeText(p.phone)}</small>` : ''}</div></div>
          <div class="sound-toggles"><button class="small-button" data-action="music" aria-label="Хөгжим" aria-pressed="${this.audio.music}">${image('final/music.svg')}</button><button class="small-button" data-action="effects" aria-label="Дууны эффект" aria-pressed="${this.audio.effects}">${image('final/effects.svg')}</button><button class="small-button" data-action="haptics" aria-label="Чичиргээ" aria-pressed="${this.game.hapticsEnabled}">${image('final/phone-vibration-icon-96b2b300.png')}</button></div>`;
        break;
      case 'rules':
        this.content.innerHTML = this.rulesContent();
        break;
      case 'store':
        if (this.catalogLoading) {
          this.content.innerHTML =
            '<p class="empty-state" role="status">Загварууд ачаалж байна…</p>';
        } else if (!this.catalogBirds.length || this.error) {
          this.content.innerHTML = `<p class="error-copy" role="alert">${escapeText(this.error || 'Загварын мэдээллийг ачаалж чадсангүй.')}</p><div class="panel-actions"><button class="small-button" data-action="birds-retry">ДАХИН АЧААЛАХ</button></div>`;
        } else this.content.innerHTML = this.catalog(this.catalogBirds, this.birdIndex);
        break;
      case 'stats':
        this.content.innerHTML = this.statsContent();
        break;
      case 'gifts':
        this.content.innerHTML = `<section class="gift-block"><h3>НИЙТ ӨДРИЙН ЯЛАГЧИД</h3><div class="gift-prizes">${[2.5, 2, 1.5, 1, 0.5].map((grams, index) => `<div class="gift-prize">${medal(index + 1)}<span>${index + 1} БАЙР</span>${image('fine-gold/gold-bar.svg', 'gold-bar')}<span>${grams.toFixed(1)} ГР<br />АЛТ</span></div>`).join('')}</div></section><section class="gift-block daily-gift"><h3>НЭГ ӨДРИЙН ЯЛАГЧИД</h3><div class="daily-prize"><div>${medal(1)}<span>1 БАЙР</span></div><div>${image('fine-gold/gold-bar.svg', 'gold-bar')}<span>0.5 ГР АЛТ</span></div></div></section><div class="gift-actions"><button class="small-button" data-action="see-gifts">БЭЛЭГ ХАРАХ</button><button class="small-button" data-action="see-guide">ЗААВАР ҮЗЭХ</button></div>`;
        break;
      case 'gift-video':
        this.content.innerHTML = `<section class="gift-video-content"><div class="gift-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/q8edb6pi5GQ?start=346&playsinline=1&rel=0" title="Бэлгийн танилцуулга видео" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe></div><button class="small-button gift-youtube-button" data-action="open-gift-youtube">▶ YOUTUBE ДЭЭР ҮЗЭХ ↗</button><p class="gift-video-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><button class="gift-back-button" data-action="back-to-gifts">← БЭЛЭГ РҮҮ БУЦАХ</button></section>`;
        break;
      case 'buy': {
        // The host checks the balance again at its PIN screen; a known shortfall only saves a trip.
        const shortOfPoints =
          p.points !== null &&
          Boolean(this.service.price) &&
          p.points < this.orderCostOf(this.quantity);
        this.content.innerHTML = `${image('fine-gold/pilot.webp', 'buy-avatar')}<div class="quantity-cost">${image('final/coin-2a011ea2.png')}<span>${this.quantity * this.pointCost} SONO POINT</span></div><div class="quantity-controls"><button data-action="minus" aria-label="Эрх хасах" ${this.quantity === 1 ? 'disabled' : ''}>−</button><output aria-live="polite">${this.quantity}</output><button data-action="plus" aria-label="Эрх нэмэх" ${this.quantity === this.maxQuantity ? 'disabled' : ''}>+</button></div><div class="panel-actions"><button class="small-button" data-action="buy-attempts" ${!this.service.price || shortOfPoints ? 'disabled' : ''}>${!this.service.price ? 'ҮНЭ АЧААЛЖ БАЙНА' : shortOfPoints ? 'ПОЙНТ ХҮРЭЛЦЭХГҮЙ' : 'АВАХ'}</button></div>${this.error ? `<p class="error-copy" role="alert">${escapeText(this.error)}</p>` : ''}${p.points === null ? '' : `<div class="points-card"><h3>ТАНЫ SONO POINT:</h3><strong>${image('final/coin-2a011ea2.png')}${p.points.toLocaleString()}</strong><button data-action="refresh-points" aria-label="Пойнт шинэчлэх">${image('final/exchange.svg')}</button></div>`}`;
        break;
      }
      case 'confirmation':
        {
          const order = this.service.pendingOrder;
          this.content.innerHTML = `<h3>ТӨЛБӨР ХҮЛЭЭГДЭЖ БАЙНА</h3><p class="feedback-copy">${order?.lives ?? this.quantity} тоглох эрх · ${order?.pointsCost ?? this.orderCost()} SP</p><p class="small-note">Төлбөрийг SONO апп-аар баталгаажуулсны дараа эрх нэмэгдэнэ.</p><p class="error-copy">${escapeText(this.error)}</p><div class="panel-actions">${this.service.canPay ? '<button class="small-button" data-action="pay-order">SONO АППААР БАТЛАХ</button>' : ''}<button class="small-button" data-action="check-order">ТӨЛӨВ ШАЛГАХ</button>${this.service.abandonOrder ? '<button class="small-button" data-action="abandon-order">БОЛИХ</button>' : ''}</div>`;
          break;
        }
        break;
      case 'success':
        this.content.innerHTML = this.feedback(
          'COOL...',
          `ТА ${this.order?.kind === 'attempts' ? this.order.quantity : 2} УДАА ТОГЛОХ ЭРХ ХУДАЛДАН АВЛАА.`,
          'done',
          true,
        );
        break;
      case 'failure':
        this.content.innerHTML = this.feedback(
          'ӨӨӨ...',
          this.error || 'ХҮСЭЛТИЙГ ГҮЙЦЭТГЭЖ ЧАДСАНГҮЙ.',
          this.orderRetryRequired ? 'retry-order' : 'purchase-back',
          false,
          '',
          this.orderRetryRequired ? 'ДАХИН ОРОЛДОХ' : 'ОК',
        );
        break;
    }
    if (this.panel === 'stats') {
      const tabs = this.content.querySelector('.stats-tabs');
      if (tabs) this.card.insertBefore(tabs, this.content);
    }
    if (this.busy)
      this.content.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.disabled = true;
      });
    this.content.scrollTop = scrollTop;
    this.content.querySelectorAll<HTMLElement>('.ledger-scroll').forEach((list, index) => {
      list.scrollTop = listScroll[index] ?? 0;
    });
    if (active) {
      const replacement = Array.from(
        this.card.querySelectorAll<HTMLElement>('[id], [data-action]'),
      ).find((element) =>
        active.id
          ? element.id === active.id
          : active.dataset.action &&
            element.dataset.action === active.dataset.action &&
            element.dataset.value === active.dataset.value,
      );
      replacement?.focus({ preventScroll: true });
      if (
        replacement instanceof HTMLInputElement &&
        selectionStart !== undefined &&
        selectionEnd !== undefined
      )
        replacement.setSelectionRange(selectionStart, selectionEnd);
    }
  }
  private async selectBird(item: CatalogItem) {
    if (this.busy || !item.image) return;
    this.busy = true;
    this.error = '';
    this.refresh();
    this.render();
    try {
      await this.service.selectBird(item.id);
      this.open('skin-success');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BIRD_LOCKED') {
        await this.service.refreshBirds?.().catch(() => undefined);
        this.open('skin-failure');
      } else this.error = errorMessage(error);
    } finally {
      this.busy = false;
      this.refresh();
      if (this.panel) this.render();
      this.content.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }
  }
  private get pointCost() {
    return this.service.price?.pointsPerLife ?? 0;
  }
  private get maxQuantity() {
    return this.service.price?.maxLivesPerOrder ?? 1;
  }
  private async saveNickname() {
    if (this.busy) return;
    this.nicknameDraft = this.content.querySelector<HTMLInputElement>('input')!.value.trim();
    if (!validNickname(this.nicknameDraft)) {
      // Same rules as the server; checking here saves the rate-limited request.
      this.error = NICKNAME_RULES;
      this.render();
      this.content.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    this.busy = true;
    this.error = '';
    this.render();
    try {
      await this.service.setNickname?.(this.nicknameDraft);
      this.open('nickname-success');
      this.refresh();
    } catch (error) {
      this.error =
        error instanceof ApiError && error.code === 'VALIDATION_FAILED'
          ? NICKNAME_RULES
          : errorMessage(error);
      if (error instanceof ApiError && error.code === 'NICKNAME_TAKEN')
        this.open('nickname-failure');
    } finally {
      this.busy = false;
      if (this.panel) this.render();
      this.refresh();
      this.content
        .querySelector<HTMLElement>(this.panel === 'nickname' ? 'input' : 'button:not([disabled])')
        ?.focus();
    }
  }
  private orderCost() {
    const order = this.order;
    if (!order) return 0;
    if (order.kind === 'attempts') return this.orderCostOf(order.quantity);
    return 0;
  }
  private orderCostOf(quantity: number) {
    return quantity * this.pointCost;
  }
  private beginOrder(order: PurchaseOrder, origin: 'buy' | 'store') {
    if (this.panel === 'buy') this.purchasePreview = this.card.cloneNode(true) as HTMLElement;
    if (this.orderRetryRequired) {
      void this.approveOrder();
      return;
    }
    if (this.service.pendingOrder?.status === 'PENDING') {
      this.open('confirmation');
      this.scheduleOrderCheck();
      return;
    }
    this.order = order;
    this.orderId = newId();
    this.orderPollDelay = 2500;
    this.purchaseOrigin = origin;
    void this.approveOrder();
  }
  private async approveOrder() {
    if (!this.order || this.busy) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.service.purchase(this.orderId, this.order);
      this.orderRetryRequired = false;
      this.panel = result === 'PENDING' ? 'confirmation' : 'success';
      this.setModalVisible(true);
      if (result === 'PENDING') this.scheduleOrderCheck();
    } catch (error) {
      this.orderRetryRequired = isTransient(error);
      this.error =
        error instanceof ApiError && error.code === 'INSUFFICIENT_POINTS'
          ? 'ТАНЫ ОНОО ХҮРЭЛЦЭХГҮЙ БАЙНА.'
          : errorMessage(error);
      this.panel = 'failure';
      this.setModalVisible(true);
    } finally {
      this.busy = false;
      this.refresh();
      this.render();
      this.content.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }
  }
  private async grantTestLives() {
    if (this.busy || !this.service.canGrantTestLives || !this.service.grantTestLives) return;
    this.busy = true;
    this.refresh();
    try {
      await this.service.grantTestLives();
      if (this.panel === 'buy-warning') this.close(true);
      this.notify(
        this.service.isMock ? '10 туршилтын амь нэмэгдлээ.' : '10 тест амь серверт нэмэгдлээ.',
      );
    } catch (error) {
      this.notify(errorMessage(error));
    } finally {
      this.busy = false;
      this.refresh();
      if (this.panel) this.render();
    }
  }
  private action(action: string, value?: string) {
    const focusAction = action;
    if (action === 'see-gifts') {
      this.open('gift-video');
      return;
    }
    if (action === 'back-to-gifts') {
      this.open('gifts');
      return;
    }
    if (action === 'open-gift-youtube') {
      void openExternalUrl('https://www.youtube.com/watch?v=q8edb6pi5GQ&t=346s').catch((error) =>
        this.notify(errorMessage(error)),
      );
      return;
    }
    if (action === 'see-guide') {
      void openExternalUrl('https://www.youtube.com').catch((error) =>
        this.notify(errorMessage(error)),
      );
      return;
    } else if (action === 'music') {
      this.audio.setMusic(!this.audio.music);
      this.refresh();
    } else if (action === 'effects') this.audio.setEffects(!this.audio.effects);
    else if (action === 'haptics') {
      this.game.hapticsEnabled = !this.game.hapticsEnabled;
      if (this.game.hapticsEnabled) navigator.vibrate?.(20);
    } else if (action === 'bird-prev')
      this.birdIndex = (this.birdIndex + this.catalogBirds.length - 1) % this.catalogBirds.length;
    else if (action === 'bird-next')
      this.birdIndex = (this.birdIndex + 1) % this.catalogBirds.length;
    else if (action === 'select-bird') {
      const item = this.catalogBirds[this.birdIndex];
      if (item) void this.selectBird(item);
      return;
    } else if (action === 'minus') this.quantity = Math.max(1, this.quantity - 1);
    else if (action === 'plus') this.quantity = Math.min(this.maxQuantity, this.quantity + 1);
    else if (action === 'buy-attempts') {
      this.beginOrder({ kind: 'attempts', quantity: this.quantity }, 'buy');
      return;
    } else if (action === 'grant-test-lives') {
      void this.grantTestLives();
      return;
    } else if (action === 'approve') {
      void this.approveOrder();
      return;
    } else if (action === 'retry-order') {
      void this.approveOrder();
      return;
    } else if (action === 'cancel-order' || action === 'purchase-back') {
      this.open(this.purchaseOrigin);
      return;
    } else if (action === 'check-order' || action === 'pay-order') {
      void this.updateOrder(action === 'pay-order');
      return;
    } else if (action === 'api-refresh') {
      void this.apiAction();
      return;
    } else if (action === 'open-store') {
      this.open('store');
      return;
    } else if (action === 'open-buy') {
      this.open('buy');
      return;
    } else if (action === 'birds-retry') {
      void this.loadBirds();
      return;
    } else if (action === 'lives-more') {
      void this.loadLives();
      return;
    } else if (action === 'stats-retry') {
      if (this.statsTab === 'total') {
        this.error = '';
        void this.loadStats();
      } else if (this.statsTab === 'day') {
        void this.loadDays(true);
        void this.loadDaily();
      } else void this.loadDays(true);
      return;
    } else if (action === 'nickname-done') {
      this.close(true);
      void this.prepare();
      return;
    } else if (action === 'close-feedback') {
      this.close(true);
      return;
    } else if (action === 'nickname-back') {
      this.open('nickname');
      return;
    } else if (action === 'stats-tab') {
      if (value === 'day') this.selectedDay = null;
      this.statsTab = value as 'total' | 'day' | 'history';
      this.content.scrollTop = 0;
      if (this.statsTab === 'day') {
        void this.loadDays();
        void this.loadDaily();
      } else if (this.statsTab === 'history') void this.loadDays();
      else void this.loadStats();
    } else if (action === 'stats-month') {
      if (!value || !/^\d{4}-\d{2}$/.test(value)) return;
      this.calendarMonth = value;
    } else if (action === 'stats-pick-day') {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      if (!this.leaderboardDays?.some(({ day }) => day === value)) return;
      this.selectedDay = value;
      this.calendarMonth = value.slice(0, 7);
      this.statsTab = 'day';
      this.content.scrollTop = 0;
      void this.loadDaily(value);
    } else if (action === 'stats-back-calendar') {
      this.statsTab = 'history';
      this.content.scrollTop = 0;
      void this.loadDays();
    } else if (action === 'refresh-points') {
      void this.refreshPoints();
      return;
    } else if (action === 'abandon-order') {
      clearTimeout(this.orderTimer);
      this.service.abandonOrder?.();
      this.orderRetryRequired = false;
      this.open(this.purchaseOrigin);
      return;
    } else if (action === 'done') {
      if (this.purchaseOrigin === 'store') this.open('store');
      else {
        this.close(true);
        this.prepare();
      }
      return;
    }
    this.render();
    this.card.querySelector<HTMLButtonElement>(`[data-action="${focusAction}"]`)?.focus();
  }
  private scheduleOrderCheck() {
    clearTimeout(this.orderTimer);
    this.orderTimer = setTimeout(() => {
      if (this.panel === 'confirmation' && !document.hidden) void this.updateOrder();
      else if (this.panel === 'confirmation') this.scheduleOrderCheck();
    }, this.orderPollDelay);
  }
  private async updateOrder(pay = false) {
    if (this.busy) return;
    const previousPanel = this.panel;
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      if (pay) await this.service.payOrder?.();
      const order = await this.service.checkOrder?.();
      if (order?.status === 'PAID') this.panel = 'success';
      else if (order?.status === 'PENDING') {
        this.orderPollDelay = Math.min(30000, this.orderPollDelay * 1.5);
        this.scheduleOrderCheck();
      } else {
        this.error = errorMessage(new ApiError(`ORDER_${order?.status}`));
        this.panel = 'failure';
      }
    } catch (error) {
      this.error = errorMessage(error);
      if (
        error instanceof ApiError &&
        error.code === 'ORDER_NOT_FOUND' &&
        !this.service.pendingOrder
      ) {
        this.panel = 'failure';
        this.orderRetryRequired = false;
      } else if (this.panel === 'confirmation' && this.service.pendingOrder?.status === 'PENDING') {
        this.orderPollDelay = Math.min(30000, this.orderPollDelay * 1.5);
        this.scheduleOrderCheck();
      }
    } finally {
      this.busy = false;
      this.refresh();
      this.render();
      if (this.panel !== previousPanel)
        this.content.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
      else if (focusedAction)
        this.content
          .querySelector<HTMLButtonElement>(`[data-action="${focusedAction}"]`)
          ?.focus({ preventScroll: true });
    }
  }
  private async refreshPoints() {
    if (!this.service.refreshPoints) return this.apiAction();
    this.busy = true;
    this.render();
    try {
      await this.service.refreshPoints();
    } finally {
      this.busy = false;
      this.render();
      this.content
        .querySelector<HTMLButtonElement>('[data-action="refresh-points"]')
        ?.focus({ preventScroll: true });
    }
  }
  private async apiAction() {
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      await this.service.refresh?.();
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.busy = false;
      this.refresh();
      this.render();
      if (focusedAction)
        this.content
          .querySelector<HTMLButtonElement>(`[data-action="${focusedAction}"]`)
          ?.focus({ preventScroll: true });
    }
  }
  private onKey(event: KeyboardEvent) {
    if (!this.modalOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      this.overlay.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex="0"]',
      ),
    ).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const boundary = event.shiftKey ? first : last;
    if (!active || !focusable.includes(active) || active === boundary) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }
}
