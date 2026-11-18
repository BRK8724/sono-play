import { GAME_RULES } from './gameRules';
import {
  dailyLeaders,
  previousLeaders,
  scoreHistory,
  lifeHistory,
  freeLifeHistory,
  earnedLifeRows,
} from './mock/uiFixtures';
import { screens, type PreviewScreen } from './preview/screens';
import { newId } from './services/uuid';
import { GameAudio } from './audio/GameAudio';
import { assetUrl } from './assets';
import { ApiError } from './services/ApiClient';
import { errorMessage } from './services/errors';
import { birds, DEMO_POINT_COST } from './mock/fixtures';

import type {
  CatalogItem,
  DemoResult,
  PurchaseOrder,
  MiniappService,
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
  terminate(reason: 'COLLISION' | 'APP_BACKGROUND' | 'CONNECTION_LOST' | 'EXIT'): void;
}
type Panel =
  | 'settings'
  | 'rules'
  | 'store'
  | 'stats'
  | 'gifts'
  | 'buy'
  | 'confirmation'
  | 'success'
  | 'failure'
  | 'demo'
  | 'nickname'
  | 'nickname-success'
  | 'nickname-failure'
  | 'skin-success'
  | 'skin-failure'
  | 'buy-warning'
  | 'pin-preview'
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
const titles: Record<Panel, string> = {
  settings: 'SETTINGS',
  rules: 'ДҮРЭМ',
  store: 'ЗАГВАР',
  stats: 'ЯЛАГЧИД',
  gifts: 'БЭЛЭГ',
  buy: 'АМЬ АВАХ',
  confirmation: 'SONO',
  success: 'АМЖИЛТТАЙ',
  failure: 'ДАХИН ОРОЛДОХ',
  demo: 'ТУРШИЛТ',
  nickname: 'ТОГЛОГЧИЙН НЭР',
  'nickname-success': '',
  'nickname-failure': '',
  'skin-success': '',
  'skin-failure': '',
  'buy-warning': 'АМЬ АВАХ',
  'pin-preview': 'SONO',
  lives: 'АМЬ',
  winner: '',
};

export class Frontend {
  private panel: Panel | null = null;
  private connected = false;
  private nicknameDraft = '';
  private panelLoading = false;
  private catalogLoading = false;
  private orderRetryRequired = false;
  private orderTimer?: ReturnType<typeof setTimeout>;
  private orderPollDelay = 2500;
  private opener: HTMLElement | null = null;
  private quantity = 1;
  private birdIndex = 0;
  private statsTab: 'total' | 'day' | 'history' = 'total';
  private previousDay = false;
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
    private configureDemo: (scenario: 'reset' | 'empty' | 'poor' | 'error' | 'pending') => void,
  ) {
    node('play').onclick = () => void this.prepare();
    node('result-sync').onclick = () => void game.retryResult?.();
    node('ready-start').onclick = () => void game.start();
    node('retry').onclick = () => void this.prepare();
    node('home-button').onclick = () => {
      this.navigationVersion++;
      game.go('HOME');
    };
    node('scene-back').onclick = () => {
      this.navigationVersion++;
      game.terminate('EXIT');
      game.go('HOME');
    };
    for (const panel of ['settings', 'rules', 'store', 'stats', 'gifts', 'lives', 'demo'] as const)
      node(`${panel}-open`).onclick = () => this.open(panel);
    node('music-toggle').onclick = () => {
      this.audio.setMusic(!this.audio.music);
      this.refresh();
    };
    node('info-close').onclick = () => this.close();
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
    this.content.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-action]',
      );
      if (target && !target.disabled && !this.busy)
        this.action(target.dataset.action!, target.dataset.value);
    });
    document.addEventListener('keydown', (event) => this.onKey(event));
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
      if (
        this.service.snapshot().nicknameRequired &&
        !new URLSearchParams(location.search).has('screen')
      )
        this.open('nickname');
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
    return this.panel !== null || !node('host-preview').hidden;
  }
  refresh() {
    const player = this.service.snapshot();
    node('attempt-count').textContent = String(player.attempts);
    node('result-attempts').textContent = String(player.attempts);
    node('result-attempts').parentElement?.classList.toggle('empty', player.attempts === 0);
    node('retry').textContent = player.attempts ? 'ДАХИН ТОГЛОХ' : 'АМЬ АВАХ';
    node('best-label').textContent = 'НИЙТ';
    node('best').textContent = String(player.total);
    const showAttempts = this.game.phase === 'READY' || this.game.phase === 'PLAYING';
    node('attempt-bar').hidden = !showAttempts;
    node('scene-back').hidden = this.game.phase === 'HOME';
    node('demo-open').hidden =
      !import.meta.env.DEV || !this.game.isReady || this.game.phase === 'PLAYING';
    node('demo-open').textContent = this.service.mode === 'api' ? 'API ТЕСТ' : 'ДЭЛГЭЦҮҮД';
    node('music-toggle').setAttribute('aria-pressed', String(this.audio.music));
    const waiting = this.busy || Boolean(this.game.starting);
    node('play').setAttribute('aria-busy', String(waiting));
    (node('play') as HTMLButtonElement).disabled = waiting || !this.connected || !this.game.isReady;
    (node('retry') as HTMLButtonElement).disabled = waiting;
    for (const panel of ['settings', 'rules', 'store', 'stats', 'gifts', 'lives', 'demo'])
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
  async prepare() {
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
      await this.service.refresh?.();
      if (navigationVersion !== this.navigationVersion || document.hidden) return;
      const player = this.service.snapshot();
      this.refresh();
      if (player.nicknameRequired) this.open('nickname');
      else if (this.service.mode === 'api' && !player.tournament)
        this.notify('Одоогоор тэмцээн явагдаагүй байна.');
      else if (!player.attempts) this.open('buy-warning');
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
  showResult(result: DemoResult) {
    node('result-score').textContent = String(result.score);
    const reasons: Record<string, string> = {
      COLLISION: '',
      APP_BACKGROUND: 'Апп арын горимд шилжсэн тул тоглолт дууслаа.',
      CONNECTION_LOST: 'Холболт тасарсан тул тоглолт дууслаа.',
      EXIT: 'Тоглолтоос гарлаа.',
    };
    node('result-reason').textContent = reasons[result.reason] ?? '';
    const statuses = {
      DEMO: 'Жишээ тоглолт',
      PENDING: 'Дүн илгээж байна…',
      ACCEPTED: 'Серверт бүртгэгдлээ',
      REJECTED: 'Оноог сервер хүлээн авсангүй',
    };
    node('result-status').textContent = statuses[result.verification];
    node('result-sync').hidden = this.service.mode !== 'api' || result.verification !== 'PENDING';
    if (result.rejectReason)
      node('result-reason').textContent =
        result.rejectReason === 'DURATION_MISMATCH'
          ? 'Тоглолтын хугацаа зөрсөн байна.'
          : 'Оноо тоглолтын хугацаатай тохирохгүй байна.';
    this.refresh();
  }
  open(panel: Panel) {
    if (!this.connected || !this.game.isReady || this.game.phase === 'PLAYING') return;
    if (!this.panel) this.opener = document.activeElement as HTMLElement;
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
    this.overlay.hidden = false;
    for (const id of ['home', 'ready', 'game-over', 'demo-open', 'scene-back'])
      node(id).inert = true;
    this.render(changed);
    if (panel === 'nickname') this.content.querySelector<HTMLInputElement>('input')?.focus();
    else this.content.querySelector<HTMLButtonElement>('button')?.focus();
    if (panel === 'stats' && changed && this.service.refreshLeaderboard) void this.loadStats();
    if (panel === 'store' && changed && this.service.refreshBirds) void this.loadBirds();
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
    this.navigationVersion++;
    this.overlay.hidden = true;
    for (const id of ['home', 'ready', 'game-over', 'demo-open', 'scene-back'])
      node(id).inert = false;
    this.opener?.focus();
    this.opener = null;
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
    if (this.service.mode !== 'api') return birds;
    return (this.service.birdCatalog ?? []).map((entry) => {
      const asset = birds.find((item) => item.id === entry.id);
      return { id: entry.id, name: entry.name, image: asset?.image ?? '', price: 0 };
    });
  }
  private catalog(items: CatalogItem[], index: number) {
    const item = items[index];
    if (!item) return '<p class="empty-state">Загварын мэдээлэл алга.</p>';
    const player = this.service.snapshot();
    const metadata = this.service.birdCatalog?.find((entry) => entry.id === item.id);
    const threshold =
      metadata?.unlockScore ?? GAME_RULES.skinTotals[item.id as keyof typeof GAME_RULES.skinTotals];
    const unlocked =
      this.service.mode === 'mock' ? player.total >= threshold : metadata?.unlocked === true;
    const selected =
      this.service.mode === 'api' ? metadata?.selected === true : player.selectedBird === item.id;
    return `<section class="catalog-section"><h3>SONO</h3><div class="carousel"><button class="arrow" data-action="bird-prev" aria-label="Өмнөх загвар">◀</button><div class="skin-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}"><span class="skin-name">${escapeText(item.name)}</span>${item.image ? image(item.image, 'catalog-image', item.name) : '<span class="asset-pending">ЗУРАГ ХҮЛЭЭГДЭЖ БАЙНА</span>'}${unlocked ? '' : '<span class="skin-lock" aria-label="Түгжээтэй"></span>'}</div><button class="arrow" data-action="bird-next" aria-label="Дараагийн загвар">▶</button></div>${unlocked ? `<div class="panel-actions"><button class="small-button" data-action="select-bird" ${selected || !item.image ? 'disabled' : ''}>${!item.image ? 'ЗУРАГ ХҮЛЭЭГДЭЖ БАЙНА' : selected ? 'ИДЭВХТЭЙ' : 'ИДЭВХЖҮҮЛЭХ'}</button></div>` : `<p class="skin-threshold">${threshold.toLocaleString()} НИЙТ ОНОО</p><p class="small-note">${player.total.toLocaleString()} / ${threshold.toLocaleString()}</p>`}</section>`;
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
    const tabs = `<div class="stats-tabs" role="tablist" aria-label="Чансааны хэсэг">${[
      ['total', 'НИЙТ'],
      ['day', 'ӨДӨР'],
      ['history', 'МИНИЙ'],
    ]
      .map(
        ([id, title]) =>
          `<button role="tab" aria-selected="${this.statsTab === id}" data-action="stats-tab" data-value="${id}">${title}</button>`,
      )
      .join('')}</div>`;
    if (this.panelLoading && this.service.leaderboard().length === 0)
      return tabs + '<p class="empty-state" role="status">Чансаа ачаалж байна…</p>';
    if (this.error)
      return (
        tabs +
        `<p class="error-copy">${escapeText(this.error)}</p><button class="small-button" data-action="stats-retry">ДАХИН АЧААЛАХ</button>`
      );
    if (this.statsTab === 'history') {
      const history = this.service.history?.();
      if (!history && this.service.mode === 'api')
        return tabs + '<p class="empty-state">Амжилтын түүхийн API холболт хүлээгдэж байна.</p>';
      return (
        tabs +
        `<h3>МИНИЙ АМЖИЛТУУД</h3><table class="history-table"><thead><tr><th>ОГНОО</th><th>ОНОО</th><th>БАЙР</th></tr></thead><tbody>${(history?.scores ?? scoreHistory).map((row) => `<tr><td>${escapeText(row.date)}</td><td>${row.score}</td><td>${row.rank}${row.rank >= 1 && row.rank <= 3 ? medal(row.rank, 'mini-medal') : ''}</td></tr>`).join('')}</tbody></table>`
      );
    }
    const daily = this.statsTab === 'day';
    const standings = daily
      ? this.service.standings?.(this.previousDay ? 'previous' : 'today')
      : undefined;
    if (daily && !standings && this.service.mode === 'api')
      return tabs + '<p class="empty-state">Өдрийн чансааны API холболт хүлээгдэж байна.</p>';
    const rows = daily
      ? (standings?.entries ?? (this.previousDay ? previousLeaders : dailyLeaders))
      : this.service.leaderboard();
    const own = daily
      ? standings
        ? standings.me
        : (rows.find((row) => row.name === this.service.snapshot().name) ?? {
            rank: this.previousDay ? 62 : 58,
            name: this.service.snapshot().name,
            score: this.previousDay ? 22 : 78,
          })
      : this.service.ownRank();
    const hero = daily
      ? `<div class="leader-hero">${medal(1)}<div><strong>${escapeText(rows[0]?.name ?? 'SONO')}</strong><span>${rows[0]?.score ?? 0}</span></div></div><div class="day-selector"><button data-action="stats-day" data-value="today" aria-pressed="${!this.previousDay}">ӨНӨӨДӨР</button><button data-action="stats-day" data-value="previous" aria-pressed="${this.previousDay}">ӨМНӨХ ӨДӨР</button></div>`
      : '';
    return (
      tabs +
      hero +
      `<table class="leaderboard" aria-label="Шилдэг 10"><tbody>${rows.map((row) => `<tr class="${own?.rank === row.rank ? 'is-me' : ''}"><td>${row.rank >= 1 && row.rank <= 5 ? medal(row.rank, 'mini-medal') : String(row.rank).padStart(2, '0')}</td><td>${escapeText(row.name)}</td><td>${row.score}</td></tr>`).join('')}</tbody></table>${own && !rows.some((row) => row.rank === own.rank) ? `<p class="rank-caption">ТАНЫ БАЙР</p><div class="own-rank"><span>${own.rank}</span><span>${escapeText(own.name)}</span><span>${own.score}</span></div>` : ''}`
    );
  }
  private ledgerContent() {
    const history = this.service.history?.();
    if (!history && this.service.mode === 'api')
      return '<p class="empty-state">Амийн түүхийн API холболт хүлээгдэж байна.</p>';
    const table = (rows: typeof lifeHistory) =>
      `<table class="ledger-table"><thead><tr><th>ОГНОО</th><th>ТӨРӨЛ</th><th>ТОО</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeText(row.date)}</td><td>${escapeText(row.reason)}</td><td class="${row.amount > 0 ? 'credit' : 'debit'}">${row.amount > 0 ? '+' : ''}${row.amount}</td></tr>`).join('')}</tbody></table>`;
    return `<section class="ledger-block"><h3>АМЬ АВСАН ЖАГСААЛТ</h3>${table(history?.earned ?? lifeHistory)}</section><section class="ledger-block"><h3>ӨДРИЙН ҮНЭГҮЙ АМЬ</h3>${table(history?.free ?? freeLifeHistory)}</section>${this.service.mode === 'mock' ? '<p class="small-note">Жишээ бүртгэл</p>' : ''}`;
  }
  private render(resetScroll = false) {
    if (!this.panel) return;
    const scrollTop = resetScroll ? 0 : this.content.scrollTop;
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
    this.card.setAttribute(
      'aria-busy',
      String(
        this.busy ||
          (this.panel === 'stats' && this.panelLoading) ||
          (this.panel === 'store' && this.catalogLoading),
      ),
    );
    switch (this.panel) {
      case 'nickname':
        this.content.innerHTML = `<form id="nickname-form"><div class="nickname-row">${image('fine-gold/pilot.webp')}<div class="nickname-field"><input id="nickname-input" class="nickname-input" name="nickname" autocomplete="off" enterkeyhint="done" minlength="3" maxlength="16" placeholder="НЭР" required value="${escapeText(this.nicknameDraft)}" aria-label="Тоглогчийн нэр" ${this.busy ? 'readonly' : ''} /><button type="submit" aria-label="Нэр хадгалах" ${this.busy ? 'disabled' : ''}>▶</button></div></div>${this.error ? `<p class="error-copy" role="alert">${escapeText(this.error)}</p>` : ''}<p class="nickname-hint">3–16 тэмдэгт · Монгол эсвэл латин үсэг</p></form>`;
        this.content.querySelector('form')!.onsubmit = (event) => {
          event.preventDefault();
          void this.saveNickname();
        };
        break;
      case 'nickname-success':
        this.content.innerHTML = this.feedback(
          'НЭР АМЖИЛТТАЙ ҮҮСЛЭЭ',
          'АМЖИЛТ ХҮСЬЕ!',
          'nickname-done',
          true,
          p.name,
        );
        break;
      case 'nickname-failure':
        this.content.innerHTML = this.feedback(
          'ӨӨӨ...',
          'ТАНЫ НЭР ДАВХАРДАЖ БАЙНА. ӨӨР НЭР СОНГООРОЙ.',
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
      case 'buy-warning':
        this.content.innerHTML = `<section class="feedback"><h3>АНХААР!</h3><p>ТА ДАХИН ТОГЛОХ ЭРХ АВАХЫН ТУЛД SONO ПОЙНТООР АМЬ АВНА УУ.</p><div class="exchange-icon">${image('final/exchange.svg')}</div><button class="small-button" data-action="open-buy">ОК</button></section>`;
        break;
      case 'pin-preview':
        this.content.innerHTML = `<section class="native-pin-preview"><span class="sheet-handle"></span><p>SONO ПИН</p><div class="confirmation-dots" aria-label="Баталгаажуулалтын загвар"><span></span><span></span><span></span><span></span></div><div class="pin-keypad" aria-hidden="true">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((digit) => `<span>${digit}</span>`).join('')}</div><button class="small-button" data-action="approve">ТУРШИЛТААР БАТЛАХ</button><small>Баталгаажуулалтын загвар</small></section>`;
        break;
      case 'lives':
        this.content.innerHTML = this.ledgerContent();
        break;
      case 'winner':
        this.content.innerHTML = `<section class="winner-content"><h3 id="panel-feedback-title" class="winner-brand">${image('fine-gold/winner-logo.webp', 'winner-logo', 'SONO PLAY')}</h3><p>ТА ӨНӨӨДРИЙН ШИЛДЭГ ТОГЛОГЧ БОЛЛОО!</p><p>Бэлгийн мэдээллийг SONO апп-аас хүлээн авна уу.</p>${medal(1, 'winner-medal')}<button class="small-button" data-action="close-feedback">ОК</button><small>Ялагчийн popup · жишээ</small></section>`;
        break;
      case 'settings':
        this.content.innerHTML = `<div class="player-settings">${image('final/shop-2-f322f500.png')}<div><label>ТОГЛОГЧИЙН НЭР</label><span class="player-name">${escapeText(p.name)}</span>${p.phone ? `<small>УТАС · ${escapeText(p.phone)}</small>` : ''}</div></div>
          <div class="sound-toggles"><button class="small-button" data-action="music" aria-label="Хөгжим" aria-pressed="${this.audio.music}">${image('final/music.svg')}</button><button class="small-button" data-action="effects" aria-label="Дууны эффект" aria-pressed="${this.audio.effects}">${image('final/effects.svg')}</button><button class="small-button" data-action="haptics" aria-label="Чичиргээ" aria-pressed="${this.game.hapticsEnabled}">${image('final/phone-vibration-icon-96b2b300.png')}</button></div>`;
        break;
      case 'rules':
        this.content.innerHTML = `<section class="rules-block purple"><h3>АМЬ ЦУГЛУУЛАХ АРГА</h3>${earnedLifeRows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</section><section class="rules-block yellow"><h3>НИЙТ ОНООНЫ ТОП 5 ТОГЛОГЧ</h3><p>Тэмцээний нийт оноогоор шилдэг 5 тоглогчийг шалгаруулна.</p></section><section class="rules-block yellow"><h3>ӨДӨР БҮР НЭГ ЯЛАГЧ</h3><p>Өдрийн нийт оноогоор 1 ялагч шалгаруулна.</p></section><section class="rules-block red">${image('fine-gold/attention.webp', 'rule-warning')}<h3>ӨДӨР БҮР 3 ҮНЭГҮЙ ЭРХ</h3><p>00:00-д шинэчлэгдэнэ. Ашиглаагүй эрх дараагийн өдөрт шилжихгүй.</p></section><details class="rule-details"><summary>ДЭЛГЭРЭНГҮЙ ДҮРЭМ</summary><p>Хуваарьт төлбөрийг бүтэн төлсөн үед эрх олгоно. Эрт төлөлтийн +10 нь хугацаандаа төлөлтийн +10-ыг орлоно. Нэг хуваарьт нэг удаа, зээл бүрд тусад нь олгоно. Өдрийн дээд хязгааргүй.</p><p>Зээл 7 ба түүнээс дээш хоног ашиглан хаахад +15, хоцорч хаахад +5 эрх авна. Өдрийн үнэгүй эрхийг эхэлж зарцуулна. Олсон эрх тэмцээн дуустал хүчинтэй.</p><p>Нэг хос хоолой +1 оноо. Хурд 10, 25, 45, 70… хоолойд 0.1-ээр нэмэгдэнэ. Апп арын горимд шилжвэл тоглолт дуусна.</p><p>Santa 1,500, Goldie 3,000 нийт оноогоор нээгдэнэ. Өдрийн зураг 07:00–18:00, шөнийн зураг 18:00–07:00 үйлчилнэ.</p></details>`;
        break;
      case 'store':
        if (this.catalogLoading) {
          this.content.innerHTML =
            '<p class="empty-state" role="status">Загварууд ачаалж байна…</p>';
        } else if (this.service.mode === 'api' && (!this.catalogBirds.length || this.error)) {
          this.content.innerHTML = `<p class="error-copy" role="alert">${escapeText(this.error || 'Загварын мэдээллийг ачаалж чадсангүй.')}</p><div class="panel-actions"><button class="small-button" data-action="birds-retry">ДАХИН АЧААЛАХ</button></div>`;
        } else this.content.innerHTML = this.catalog(this.catalogBirds, this.birdIndex);
        break;
      case 'stats':
        this.content.innerHTML = this.statsContent();
        break;
      case 'gifts':
        this.content.innerHTML = `<section class="gift-block"><h3>НИЙТ ДҮНГИЙН ЯЛАГЧИД</h3><div class="gift-grid">${[1, 2, 3, 4, 5].map((rank) => `<div>${medal(rank)}<span>${rank}-Р БАЙР</span></div>`).join('')}</div><div class="gift-grid gift-items">${[2.5, 2, 1.5, 1, 0.5].map((grams, index) => `<div>${image(`fine-gold/gold-${index + 1}.webp`)}<span>${grams} ГР АЛТ</span></div>`).join('')}</div></section><section class="gift-block daily-gift"><h3>ӨДӨР БҮРИЙН ЯЛАГЧ</h3><div class="daily-prize"><div>${image('final/gold-sono-871113b4.png')}<span>1-Р БАЙР</span></div><div>${image('fine-gold/gold-5.webp')}<span>0.5 ГР АЛТ</span></div></div></section><p class="small-note">Бэлгийн загварын жишээ</p>`;
        break;
      case 'buy':
        this.content.innerHTML = `${image('fine-gold/pilot.webp', 'buy-avatar')}<div class="quantity-cost">${image('final/coin-2a011ea2.png')}<span>${this.quantity * this.pointCost} SONO POINT</span></div><div class="quantity-controls"><button data-action="minus" aria-label="Эрх хасах" ${this.quantity === 1 ? 'disabled' : ''}>−</button><output aria-live="polite">${this.quantity}</output><button data-action="plus" aria-label="Эрх нэмэх" ${this.quantity === this.maxQuantity ? 'disabled' : ''}>+</button></div><div class="panel-actions"><button class="small-button" data-action="buy-attempts">АВАХ</button></div>${this.error ? `<p class="error-copy" role="alert">${escapeText(this.error)}</p>` : ''}${p.points === null ? '' : `<div class="points-card"><h3>ТАНЫ SONO ПОЙНТ</h3><strong>${image('final/coin-2a011ea2.png')}${p.points.toLocaleString()}</strong><button data-action="refresh-points" aria-label="Пойнт шинэчлэх">${image('final/exchange.svg')}</button></div>`}`;
        break;
      case 'confirmation':
        if (this.service.mode === 'api') {
          const order = this.service.pendingOrder;
          this.content.innerHTML = `<h3>ТӨЛБӨР ХҮЛЭЭГДЭЖ БАЙНА</h3><p class="feedback-copy">${order?.lives ?? this.quantity} тоглох эрх · ${order?.pointsCost ?? this.orderCost()} SP</p><p class="small-note">Төлбөрийг SONO апп-аар баталгаажуулсны дараа эрх нэмэгдэнэ.</p><p class="error-copy">${escapeText(this.error)}</p><div class="panel-actions">${this.service.canPay ? '<button class="small-button" data-action="pay-order">SONO АППААР БАТЛАХ</button>' : ''}<button class="small-button" data-action="check-order">ТӨЛӨВ ШАЛГАХ</button></div>`;
          break;
        }
        this.content.innerHTML = `<div class="confirm-card"><h3>ТУРШИЛТЫН БАТАЛГААЖУУЛАЛТ</h3><div class="confirmation-dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p class="feedback-copy">${this.order?.kind === 'attempts' ? `${this.order.quantity} тоглох эрх` : 'Store загвар'} · ${this.orderCost()} SP</p><p class="small-note">SONO аппын баталгаажуулалтын жишээ</p><div class="panel-actions"><button class="small-button" data-action="approve" ${this.busy ? 'disabled' : ''}>${this.busy ? 'ХҮЛЭЭНЭ ҮҮ…' : 'БАТЛАХ'}</button><button class="text-button" data-action="cancel-order" ${this.busy ? 'disabled' : ''}>БУЦАХ</button></div></div>`;
        break;
      case 'success':
        this.content.innerHTML = this.feedback(
          'COOL...',
          `${this.order?.kind === 'attempts' ? this.order.quantity : 2} ТОГЛОХ ЭРХ АМЖИЛТТАЙ НЭМЭГДЛЭЭ!`,
          'done',
          true,
        );
        break;
      case 'failure':
        this.content.innerHTML = this.feedback(
          'ӨӨӨ...',
          this.error === 'INSUFFICIENT_POINTS'
            ? 'ТАНЫ SONO ПОЙНТ ХҮРЭЛЦЭХГҮЙ БАЙНА.'
            : this.error || 'ХҮСЭЛТИЙГ ГҮЙЦЭТГЭЖ ЧАДСАНГҮЙ.',
          this.orderRetryRequired ? 'retry-order' : 'purchase-back',
          false,
          '',
          this.orderRetryRequired ? 'ДАХИН ОРОЛДОХ' : 'ОК',
        );
        break;
      case 'demo':
        if (this.service.mode === 'api') {
          this.content.innerHTML = `<p>Backend холболт идэвхтэй</p><p>Үнэгүй эрх ${p.freePlaysLeft ?? 0} · Нэмэлт эрх ${p.lives ?? 0}</p><p class="small-note">${escapeText(p.tournament?.name ?? 'Тэмцээн явагдаагүй')}</p><div class="demo-options">${this.service.canGrantLives ? '<button data-action="grant-lives">Туршилтын 5 амь нэмэх</button>' : ''}<button data-action="open-buy">Амь авах</button><button data-action="api-refresh">Мэдээлэл шинэчлэх</button></div><p class="error-copy">${escapeText(this.error)}</p>`;
          break;
        }
        this.content.innerHTML = `<a class="preview-gallery-link" href="?screens=1">БҮХ ДЭЛГЭЦИЙГ ҮЗЭХ ↗</a><p>Туршилтын SP ${p.points?.toLocaleString()} · эрх ${p.attempts}</p><div class="demo-options"><button data-action="scenario" data-value="reset">5,000 SP + 3 эрхээр шинэчлэх</button><button data-action="scenario" data-value="empty">Эрх дууссан төлөв</button><button data-action="scenario" data-value="poor">SP хүрэлцэхгүй төлөв</button><button data-action="scenario" data-value="error">Дараагийн худалдан авалт алдаатай</button><button data-action="scenario" data-value="pending">Дараагийн оноо шалгагдах төлөв</button><button data-action="host">SONO аппын нэвтрэх дэлгэц</button></div>`;
        break;
    }
    if (this.busy)
      this.content.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.disabled = true;
      });
    this.content.scrollTop = scrollTop;
    if (active) {
      const replacement = Array.from(
        this.content.querySelectorAll<HTMLElement>('[id], [data-action]'),
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
      await this.service.selectItem('bird', item.id);
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
    return this.service.price?.pointsPerLife ?? DEMO_POINT_COST;
  }
  private get maxQuantity() {
    return this.service.price?.maxLivesPerOrder ?? 50;
  }
  private async saveNickname() {
    if (this.busy) return;
    this.nicknameDraft = this.content.querySelector<HTMLInputElement>('input')!.value.trim();
    this.busy = true;
    this.error = '';
    this.render();
    try {
      await this.service.setNickname?.(this.nicknameDraft);
      this.open('nickname-success');
      this.refresh();
    } catch (error) {
      this.error = errorMessage(error);
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
    if (order.kind === 'attempts') return order.quantity * this.pointCost;
    return birds.find((item) => item.id === order.itemId)?.price ?? 0;
  }
  private beginOrder(order: PurchaseOrder, origin: 'buy' | 'store') {
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
    if (this.service.mode === 'api') void this.approveOrder();
    else this.open('pin-preview');
  }
  private async approveOrder() {
    if (!this.order || this.busy) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.service.purchase(this.orderId, this.order);
      this.orderRetryRequired = false;
      this.panel = result === 'PENDING' ? 'confirmation' : 'success';
      this.overlay.hidden = false;
      for (const id of ['home', 'ready', 'game-over', 'demo-open', 'scene-back'])
        node(id).inert = true;
      if (result === 'PENDING') this.scheduleOrderCheck();
    } catch (error) {
      this.orderRetryRequired =
        error instanceof ApiError && (error.status === 0 || error.status >= 500);
      this.error = errorMessage(error);
      this.panel = 'failure';
      this.overlay.hidden = false;
    } finally {
      this.busy = false;
      this.refresh();
      this.render();
      this.content.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }
  }
  private action(action: string, value?: string) {
    const focusAction = action;
    if (action === 'music') {
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
    } else if (action === 'grant-lives' || action === 'api-refresh') {
      void this.apiAction(action === 'grant-lives');
      return;
    } else if (action === 'open-buy') {
      this.open('buy');
      return;
    } else if (action === 'birds-retry') {
      void this.loadBirds();
      return;
    } else if (action === 'stats-retry') {
      this.error = '';
      void this.loadStats();
      return;
    } else if (action === 'nickname-done' || action === 'close-feedback') {
      this.close(true);
      return;
    } else if (action === 'nickname-back') {
      this.open('nickname');
      return;
    } else if (action === 'stats-tab') {
      this.statsTab = value as 'total' | 'day' | 'history';
      this.content.scrollTop = 0;
    } else if (action === 'stats-day') {
      this.previousDay = value === 'previous';
      this.content.scrollTop = 0;
    } else if (action === 'refresh-points') {
      if (this.service.mode === 'api') {
        void this.apiAction(false);
        return;
      }
      this.notify('Жишээ пойнтын мэдээлэл шинэчлэгдлээ');
    } else if (action === 'done') {
      if (this.purchaseOrigin === 'store') this.open('store');
      else {
        this.close(true);
        this.prepare();
      }
      return;
    } else if (action === 'scenario') {
      this.configureDemo(value as 'reset' | 'empty' | 'poor' | 'error' | 'pending');
      if (value === 'reset') this.game.go('HOME');
      this.refresh();
      if (value === 'empty' || value === 'poor' || value === 'error') this.open('buy');
      else {
        this.close(true);
        this.notify(
          value === 'reset'
            ? 'Туршилтын өгөгдөл шинэчлэгдлээ'
            : 'Дараагийн дүн шалгагдаж буй төлөвтэй гарна',
        );
      }
      return;
    } else if (action === 'host') {
      this.showHost();
      return;
    }
    this.render();
    this.content.querySelector<HTMLButtonElement>(`[data-action="${focusAction}"]`)?.focus();
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
  private async apiAction(grant: boolean) {
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
    this.busy = true;
    this.error = '';
    this.render();
    try {
      if (grant) await this.service.grantLives?.(5);
      else await this.service.refresh?.();
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
  showHost() {
    this.close(true);
    this.game.go('HOME');
    const host = node('host-preview');
    host.innerHTML = `<div class="host-inner"><div class="host-header"><span>☉</span><span>♧</span></div><div class="host-points"><small>Таны Sono пойнт</small>${this.service.snapshot().points?.toLocaleString()}</div><div class="host-grid"><button id="host-game">${image('fine-gold/pilot.webp')}<small>Нөхцөл<br>сайжруулах</small></button><button data-host-card>${image('final/host-pay.png', '', 'PAY TO PLAY')}</button><button id="host-miniapp">${image('final/host-play.png', '', 'SONO PLAY')}</button><button data-host-card>Play</button><button data-host-card>${image('final/host-rank.png', '', 'Зэрэглэл')}</button><button data-host-card>SONO<br>Foundation</button></div><div class="host-nav"><span>♧<br>Sono пойнт</span><span>☆<br>Plus</span><span>⌂<br>Нүүр</span><span>♧<br>Sono шоп</span><span>♧<br>Sono Egg</span></div><button class="text-button" id="host-close">ТОГЛООМ НЭЭХ</button><p class="host-note">SONO аппын жишээ</p></div>`;
    host.hidden = false;
    node('home').hidden = true;
    node('demo-open').hidden = true;
    for (const id of ['host-close', 'host-game', 'host-miniapp'])
      node(id).onclick = () => {
        host.hidden = true;
        this.game.go('HOME');
        node('play').focus();
      };
    host
      .querySelectorAll<HTMLButtonElement>('[data-host-card]')
      .forEach((button) => (button.onclick = () => this.notify('SONO аппын жишээ цэс')));
    node('host-game').focus();
  }
  previewScreen(screen: PreviewScreen) {
    this.close(true);
    this.statsTab = screen.tab ?? 'total';
    this.previousDay = screen.previous ?? false;
    this.quantity = screen.id === 'buy-two' || screen.id === 'purchase-success' ? 2 : 1;
    this.audio.setMusic(!screen.muted);
    this.refresh();
    this.order = { kind: 'attempts', quantity: this.quantity };
    this.orderId = newId();
    if (screen.host) this.showHost();
    if (screen.panel) this.open(screen.panel as Panel);
    if (screen.skin !== undefined) {
      this.birdIndex = screen.skin;
      this.render();
    }
    if (screen.panel === 'failure') {
      this.error = 'INSUFFICIENT_POINTS';
      this.render();
    }
    if (screen.id === 'winner') {
      node('host-preview')
        .querySelector('.host-points')
        ?.insertAdjacentHTML(
          'afterend',
          '<div class="winner-host-card"><small>Боломжит үлдэгдэл</small><br>5,000,000₮</div>',
        );
    }
    const params = new URLSearchParams(location.search);
    document.body.classList.toggle('embedded-preview', params.has('embed'));
    const tools = node('preview-tools');
    tools.hidden = params.has('embed');
    if (params.has('embed') && document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    const index = screens.findIndex((item) => item.id === screen.id);
    tools.innerHTML = `<a href="?screens=1">‹ ДЭЛГЭЦҮҮД</a><span>${escapeText(screen.title)}</span><a href="?screen=${screens[(index + 1) % screens.length].id}" aria-label="Дараагийн дэлгэц">›</a>`;
  }
  private onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.panel) {
        event.preventDefault();
        this.close();
        return;
      }
      if (!node('host-preview').hidden) {
        node('host-preview').hidden = true;
        this.game.go('HOME');
        node('play').focus();
        return;
      }
      this.close();
    }
    if (event.key !== 'Tab' || !this.modalOpen) return;
    const root = this.panel ? this.overlay : node('host-preview');
    const buttons = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex="0"]',
      ),
    ).filter((button) => button.offsetParent !== null);
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
