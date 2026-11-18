/// <reference types="vite/client" />
import Phaser from 'phaser';
import { GameAudio } from './audio/GameAudio';
import {
  layoutFor,
  reachableCenterRange,
  resizeOpening,
  type GameLayout,
  type Insets,
} from './layout';
import { localResult, scorePair } from './rules';
import { Frontend, type Phase } from './Frontend';
import { MockMiniappService } from './mock/MockMiniappService';
import { service } from './services/createService';
import { errorMessage } from './services/errors';
import { ApiError } from './services/ApiClient';
import { approachSpeedFactor, seededRandom, speedFactor } from './gameplay';
import { backingPixels, cappedPixelRatio } from './displayScale';
import { AdaptivePerformance, RENDER_PROFILES, type RenderProfile } from './adaptivePerformance';
import { birdBodyDisplaySize } from './birdAppearance';
import { backgroundPeriod, PREVIEW_GAME_CONFIG, previewSpeedFactor } from './gameRules';
import { screens } from './preview/screens';
import { assetUrl } from './assets';
import { installPerformanceDiagnostics } from './performance';
import {
  backdropTextureKey,
  createFrameScheduler,
  GAME_FRAME_TIMING,
  RenderActivity,
} from './renderPerformance';
import './style.css';

type PipeView = { shaft: Phaser.GameObjects.TileSprite; cap: Phaser.GameObjects.Image };
type Pair = {
  upper: PipeView;
  lower: PipeView;
  x: number;
  width: number;
  top: number;
  bottom: number;
  scored: boolean;
};
const asset = (name: string) => assetUrl(`assets/sono/${name}`);
const pipeArt = {
  // Extracted from the supplied pipe sheet; the shaft keeps one stripe repeat.
  shaft: { width: 366, height: 327 },
  collar: { width: 448, height: 204 },
  upperJoin: 60,
  lowerJoin: 200,
};
// Crop boundary in the supplied demo composite; future art provides separate layers.
const demoGroundArtY = 1305;
const node = (id: string) => document.getElementById(id)!;
const audio = new GameAudio();
// Keep collision simulation independent of the display's 60/90/120 Hz cadence.
const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 1000 / 30;
let renderProfile: RenderProfile = RENDER_PROFILES.balanced;
let renderRatio = Math.min(renderProfile.maxDpr, cappedPixelRatio(window.devicePixelRatio));
let frontend: Frontend;
const ui = {
  home: node('home'),
  ready: node('ready'),
  hud: node('hud'),
  over: node('game-over'),
  score: node('score'),
  best: node('best'),
  resultScore: node('result-score'),
  resultStatus: node('result-status'),
  reason: node('result-reason'),
  theme: node('theme-label'),
  loading: node('loading'),
  offline: node('offline-notice'),
};
function nativeInsets(): Partial<Insets> {
  const supplied =
    (window as typeof window & { __SONO_SAFE_AREA__?: Partial<Insets> }).__SONO_SAFE_AREA__ ?? {};
  const style = getComputedStyle(node('viewport'));
  return {
    top: supplied.top ?? parseFloat(style.paddingTop),
    right: supplied.right ?? parseFloat(style.paddingRight),
    bottom: supplied.bottom ?? parseFloat(style.paddingBottom),
    left: supplied.left ?? parseFloat(style.paddingLeft),
  };
}
function show(phase: Phase) {
  ui.home.hidden = phase !== 'HOME';
  ui.ready.hidden = phase !== 'READY';
  ui.hud.hidden = phase !== 'READY' && phase !== 'PLAYING';
  ui.over.hidden = phase !== 'GAME_OVER';
  document.body.dataset.phase = phase;
  frontend?.refresh();
}
async function playAllowed() {
  if (service.mode === 'mock') {
    ui.offline.hidden = true;
    return true;
  }
  if (service.checkConnection) {
    try {
      await service.checkConnection();
      ui.offline.hidden = true;
      return true;
    } catch {
      ui.offline.hidden = false;
      return false;
    }
  }
  ui.offline.hidden = false;
  return false;
}
class Scene extends Phaser.Scene {
  phase: Phase = 'HOME';
  isReady = false;
  loadFailed = false;
  displayScore = 0;
  verifiedScore: number | null = null;
  layout!: GameLayout;
  bird!: Phaser.GameObjects.Container;
  body!: Phaser.GameObjects.Image;
  runId: string | null = null;
  starting = false;
  private staticPreview = false;
  private renderActivity?: RenderActivity;
  private appearanceTask: Promise<void> = Promise.resolve();
  private appearanceRevision = 0;
  private textureTasks = new Map<string, Promise<void>>();
  private backdropKey = '';
  private smoke = new Set<Phaser.GameObjects.Arc>();
  backdropBuilds = 0;
  private startGeneration = 0;
  private canceledStartReason: 'APP_BACKGROUND' | 'EXIT' | 'CONNECTION_LOST' | null = null;
  private period = backgroundPeriod();
  private random = Math.random;
  private spawnElapsed = 0;
  actualSpeedFactor = 1;
  private pendingFinish: { runId: string; score: number; reason: string } | null = null;
  private resultPosting = false;
  get resultPending() {
    return this.pendingFinish !== null;
  }
  appearance = '';
  private bodyDisplaySize = { width: 74, height: 76 };
  backgroundId = 'classic';
  backdrop!: Phaser.GameObjects.TileSprite;
  groundLayer!: Phaser.GameObjects.TileSprite;
  pipes: Pair[] = [];
  pool: Pair[] = [];
  velocity = 0;
  elapsed = 0;
  accumulator = 0;
  terminateCount = 0;
  hapticsEnabled = typeof navigator.vibrate === 'function';
  constructor() {
    super('SonoPhaseOne');
  }
  preload() {
    this.load.image('defaultBird', asset('default-bird.webp'));
    this.load.image('pipeShaft', asset('pipe-shaft.png'));
    this.load.image('pipeCap', asset('pipe-cap.png'));
    this.load.image('day', asset('game-background.webp'));
    this.load.on('loaderror', () => {
      if (this.isReady) return;
      this.loadFailed = true;
      ui.loading.textContent = 'Зураг ачаалж чадсангүй. Хуудсаа дахин нээнэ үү.';
    });
  }
  create() {
    this.renderActivity = new RenderActivity(this.game.loop, (running) => {
      this.game.events.emit(running ? 'wake' : 'sleep');
    });
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.afterRender, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.POST_RENDER, this.afterRender, this);
      this.renderActivity?.dispose();
    });
    this.renderActivity.setVisible(!document.hidden);
    if (this.loadFailed) {
      ui.loading.innerHTML =
        '<p>Зураг ачаалж чадсангүй.</p><button class="small-button" id="reload-assets">Дахин ачаалах</button>';
      node('reload-assets').onclick = () => window.location.reload();
      this.syncRendering();
      return;
    }
    this.isReady = true;
    // Zoom around the canvas's top-left so CSS layout and world coordinates align.
    this.cameras.main.setOrigin(0, 0).setZoom(renderRatio);
    this.layout = layoutFor(node('game').clientWidth, node('game').clientHeight, nativeInsets());
    this.buildBackdrop();
    this.body = this.add.image(0, 0, 'defaultBird').setDisplaySize(54.2, 52.8);
    this.bird = this.add
      .container(this.layout.birdX, this.readyY(), [this.body])
      .setDepth(5)
      .setScale(this.layout.unit);
    this.input.on('pointerdown', () => this.onTap());
    this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
      if (frontend.modalOpen || event.target instanceof HTMLButtonElement || event.repeat) return;
      event.preventDefault();
      this.onTap();
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, scheduleResize);
    this.go('HOME');
    void frontend.connect().then(async () => {
      await this.applyAppearance();
      const params = new URLSearchParams(location.search);
      const screen = screens.find((item) => item.id === params.get('screen'));
      if (!screen || !(service instanceof MockMiniappService)) return;
      service.setPreviewState({ nicknameRequired: false, ...screen.fixture });
      this.showPreview(screen.scene ?? 'HOME', screen.score ?? 0);
      frontend.previewScreen(screen);
      document.body.dataset.previewReady = screen.id;
    });
  }
  private buildBackdrop() {
    const { width, height, ground } = this.layout;
    const key = backdropTextureKey(this.backgroundId, width, height, ground);
    if (key === this.backdropKey && this.backdrop && this.groundLayer) return;
    this.backdropKey = key;
    this.backdropBuilds++;
    this.backdrop?.destroy();
    this.groundLayer?.destroy();
    for (const key of ['sky-panorama', 'ground-panorama']) {
      if (this.textures.exists(key)) this.textures.remove(key);
    }
    const source = this.textures
      .get(this.backgroundId === 'classic' ? 'day' : this.backgroundId)
      .getSourceImage() as HTMLImageElement;
    const artGroundY =
      this.backgroundId === 'city' ? 1347 : this.backgroundId === 'sunset' ? 1375 : demoGroundArtY;
    const tileWidth = Math.min(Math.ceil(width), 1024);
    const groundY = Math.round(ground);
    const drawLayer = (
      key: string,
      sourceTop: number,
      sourceHeight: number,
      outputHeight: number,
      anchorBottom: boolean,
    ) => {
      const texture = this.textures.createCanvas(key, tileWidth * 2, outputHeight)!;
      const targetAspect = tileWidth / outputHeight;
      const sourceAspect = source.width / sourceHeight;
      let sx = 0;
      let sy = sourceTop;
      let sw = source.width;
      let sh = sourceHeight;
      if (targetAspect < sourceAspect) {
        sw = sourceHeight * targetAspect;
        sx = (source.width - sw) / 2;
      } else {
        sh = source.width / targetAspect;
        if (anchorBottom) sy += sourceHeight - sh;
      }
      for (let copy = 0; copy < 2; copy++) {
        texture.context.save();
        if (copy === 1) {
          texture.context.translate(tileWidth * 2, 0);
          texture.context.scale(-1, 1);
        }
        texture.context.drawImage(source, sx, sy, sw, sh, 0, 0, tileWidth, outputHeight);
        texture.context.restore();
      }
      texture.refresh();
    };
    drawLayer('sky-panorama', 0, artGroundY, groundY, true);
    drawLayer('ground-panorama', artGroundY, source.height - artGroundY, height - groundY, false);
    this.backdrop = this.add
      .tileSprite(0, 0, width, groundY, 'sky-panorama')
      .setOrigin(0)
      .setDepth(-2);
    this.groundLayer = this.add
      .tileSprite(0, groundY, width, height - groundY, 'ground-panorama')
      .setOrigin(0)
      .setDepth(4);
    this.backdrop.setVisible(this.phase !== 'HOME');
    this.groundLayer.setVisible(this.phase !== 'HOME');
    // Final night artwork is pending. This tint previews the BRD time-of-day state.
    if (this.period === 'night') {
      this.backdrop.setTint(0x9ea6ce);
      this.groundLayer.setTint(0xc6bdd1);
    }
    document.body.dataset.period = this.period;
  }
  resizeForViewport() {
    if (!this.bird) return;
    const old = this.layout;
    const next = layoutFor(node('game').clientWidth, node('game').clientHeight, nativeInsets());
    if (
      old.width === next.width &&
      old.height === next.height &&
      old.safe.top === next.safe.top &&
      old.safe.bottom === next.safe.bottom &&
      old.safe.left === next.safe.left &&
      old.safe.right === next.safe.right
    )
      return;
    this.layout = next;
    this.buildBackdrop();
    this.bird.x = next.birdX;
    this.bird.y =
      this.phase === 'READY'
        ? this.readyY()
        : next.safe.top +
          ((this.bird.y - old.safe.top) * (next.ground - next.safe.top)) /
            Math.max(1, old.ground - old.safe.top);
    this.bird.setScale(next.unit);
    this.velocity *= next.unit / old.unit;
    for (const pair of this.pipes) {
      pair.x = (pair.x / old.width) * next.width;
      const opening = resizeOpening(old, next, pair);
      pair.top = opening.top;
      pair.bottom = opening.bottom;
      pair.width = next.pipeWidth;
      this.drawPair(pair);
    }
    if (this.phase === 'READY' && this.pipes.length > 0) {
      this.positionReadyAction(this.pipes[0]);
      if (this.staticPreview)
        this.bird.y = (this.pipes[0].top + this.pipes[0].bottom) / 2 + 25 * next.unit;
    }
    this.syncRendering();
  }
  private afterRender() {
    const animatedPhase =
      !this.staticPreview && (this.phase === 'READY' || this.phase === 'PLAYING');
    const hasEffects =
      !animatedPhase && (this.smoke.size > 0 || (this.body && this.tweens.isTweening(this.body)));
    if (animatedPhase) adaptivePerformance.sample(performance.now());
    this.renderActivity?.afterRender(Boolean(hasEffects));
  }
  private syncRendering() {
    this.renderActivity?.setContinuous(
      !this.staticPreview && (this.phase === 'READY' || this.phase === 'PLAYING'),
    );
  }
  requestRender() {
    this.renderActivity?.requestFrame();
  }
  setRenderingVisible(visible: boolean) {
    this.renderActivity?.setVisible(visible);
  }
  private clearEffects() {
    for (const smoke of this.smoke) {
      this.tweens.killTweensOf(smoke);
      smoke.destroy();
    }
    this.smoke.clear();
    this.tweens.killTweensOf(this.body);
  }
  private readyY() {
    return this.layout.safe.top + (this.layout.ground - this.layout.safe.top) * 0.74;
  }
  private playingY() {
    return this.layout.safe.top + (this.layout.ground - this.layout.safe.top) * 0.6;
  }
  go(next: Phase) {
    this.startGeneration++;
    if (this.starting) this.canceledStartReason = 'EXIT';
    this.staticPreview = false;
    this.phase = next;
    if (next === 'READY') {
      adaptivePerformance.resetWindow();
      void this.applyAppearance();
    }
    show(next);
    this.backdrop.setVisible(next !== 'HOME');
    this.groundLayer.setVisible(next !== 'HOME');
    this.bird.setVisible(next === 'READY' || next === 'PLAYING');
    if (next === 'HOME' || next === 'READY') {
      this.clearEffects();
      this.clearPairs();
      this.displayScore = 0;
      ui.score.textContent = '0';
      this.velocity = 0;
      this.actualSpeedFactor = 1;
      this.bird.setPosition(this.layout.birdX, this.readyY()).setRotation(0);
    }
    if (next === 'READY') {
      this.backdrop.tilePositionX = 0;
      this.groundLayer.tilePositionX = 0;
      frontend.refresh();
      ui.theme.textContent = this.period === 'day' ? 'Өдөр' : 'Шөнө';
      const { width, ground, safe } = this.layout;
      const gap = this.pipeGap();
      const top = safe.top + (ground - safe.top) * 0.5 - gap / 2;
      this.previewPair(width * 0.57, top, top + gap);
      this.positionReadyAction(this.pipes[0]);
    }
    this.syncRendering();
  }
  showPreview(phase: Phase, score: number) {
    this.go('READY');
    this.clearPairs();
    const { width, ground, safe, unit } = this.layout;
    const top = safe.top + (ground - safe.top) * 0.38;
    const bottom = top + 166 * unit;
    this.previewPair(width * 0.28, top, bottom);
    this.previewPair(width * 0.98, top - 130 * unit, bottom - 130 * unit);
    this.positionReadyAction(this.pipes[0]);
    this.phase = phase;
    this.displayScore = score;
    ui.score.textContent = String(score);
    this.bird.setPosition(width * 0.3, (top + bottom) / 2 + 25 * unit);
    this.bird.setVisible(phase !== 'HOME');
    this.backdrop.setVisible(phase !== 'HOME');
    this.groundLayer.setVisible(phase !== 'HOME');
    if (phase === 'HOME') this.clearPairs();
    if (phase === 'GAME_OVER') {
      this.bird.setPosition(width * 0.72, ground - 58 * unit).setRotation(1.15);
      frontend.showResult({ score, reason: 'COLLISION', verification: 'DEMO' });
    }
    show(phase);
    this.staticPreview = true;
    this.syncRendering();
  }
  private positionReadyAction(pair: Pair) {
    ui.ready.style.setProperty('--ready-action-y', `${(pair.top + pair.bottom) / 2}px`);
  }
  onTap() {
    if (document.hidden || frontend.modalOpen) return;
    if (this.phase === 'READY') void this.start();
    else if (this.phase === 'PLAYING') this.flap();
  }
  private ensureImage(key: string, url: string) {
    if (this.textures.exists(key)) return Promise.resolve();
    const existing = this.textureTasks.get(key);
    if (existing) return existing;
    const task = new Promise<void>((resolve, reject) => {
      const completeEvent = `filecomplete-image-${key}`;
      const onError = (file: Phaser.Loader.File) => {
        if (file.key !== key) return;
        this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
        this.load.off(completeEvent, onComplete);
        reject(new Error(`Asset failed to load: ${key}`));
      };
      const onComplete = () => {
        this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
        resolve();
      };
      this.load.once(completeEvent, onComplete);
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.load.image(key, url);
      if (!this.load.isLoading()) this.load.start();
    }).finally(() => this.textureTasks.delete(key));
    this.textureTasks.set(key, task);
    return task;
  }

  private applyAppearance() {
    const player = service.snapshot();
    const backgroundId = player.selectedBackground;
    const appearance = player.selectedBird;
    const revision = ++this.appearanceRevision;
    const backgroundKey = backgroundId === 'classic' ? 'day' : backgroundId;
    const backgroundFile =
      backgroundId === 'classic' ? 'game-background.webp' : `${backgroundId}-background.webp`;
    const tasks = [this.ensureImage(backgroundKey, asset(backgroundFile))];
    if (appearance !== 'pilot') {
      const characterFile =
        appearance === 'santa'
          ? 'assets/final/santa-sono-17ec9cf4.png'
          : 'assets/final/gold-sono-871113b4.png';
      tasks.push(this.ensureImage(appearance, assetUrl(characterFile)));
    }
    this.appearanceTask = Promise.all(tasks)
      .then(() => {
        if (revision !== this.appearanceRevision) return;
        this.backgroundId = backgroundId;
        this.appearance = appearance;
        node('sky').style.backgroundImage = `url("${asset(backgroundFile)}")`;
        this.buildBackdrop();
        this.bodyDisplaySize = birdBodyDisplaySize(appearance);
        this.body
          .setTexture(appearance === 'pilot' ? 'defaultBird' : appearance)
          .setDisplaySize(this.bodyDisplaySize.width, this.bodyDisplaySize.height);
        this.bird.setScale(this.layout.unit);
        this.requestRender();
      })
      .catch(() => {
        if (revision !== this.appearanceRevision) return;
        this.appearance = 'pilot';
        this.backgroundId = 'classic';
        this.body.setTexture('defaultBird').setDisplaySize(54.2, 52.8);
        node('sky').style.backgroundImage = `url("${asset('game-background.webp')}")`;
        this.buildBackdrop();
        frontend.notify('Зарим зураг ачаалсангүй. Үндсэн загварыг ашиглаж байна.');
        this.requestRender();
      });
    return this.appearanceTask;
  }
  async start() {
    if (this.phase !== 'READY' || this.starting || frontend.modalOpen) return;
    this.starting = true;
    frontend.refresh();
    const generation = this.startGeneration;
    this.canceledStartReason = null;
    try {
      await this.appearanceTask;
      if (this.phase !== 'READY' || document.hidden || frontend.modalOpen) return;
      this.runId = await service.startRun();
      if (
        generation !== this.startGeneration ||
        this.phase !== 'READY' ||
        document.hidden ||
        frontend.modalOpen
      ) {
        const previousPhase = this.phase as Phase;
        this.phase = 'PLAYING';
        this.terminate(this.canceledStartReason ?? (document.hidden ? 'APP_BACKGROUND' : 'EXIT'));
        if (previousPhase === 'HOME') this.go('HOME');
        return;
      }
      this.random = seededRandom(service.gameSeed ?? String(Date.now()));
      this.staticPreview = false;
      this.displayScore = 0;
      ui.score.textContent = '0';
      this.velocity = 0;
      this.elapsed = 0;
      this.accumulator = 0;
      this.spawnElapsed = 0;
      this.actualSpeedFactor = 1;
      this.clearPairs();
      this.bird.setPosition(this.layout.birdX, this.playingY()).setRotation(0);
      this.phase = 'PLAYING';
      show('PLAYING');
      this.spawn();
      this.flap();
      this.syncRendering();
    } catch (error) {
      frontend.notify(errorMessage(error));
      if (error instanceof ApiError && error.code === 'NICKNAME_REQUIRED')
        frontend.open('nickname');
      if (error instanceof ApiError && error.status === 409) {
        await service.refresh?.().catch(() => {});
        frontend.refresh();
      }
      if (!service.snapshot().attempts) frontend.open('buy');
    } finally {
      this.starting = false;
      frontend.refresh();
    }
  }
  flap() {
    if (this.phase !== 'PLAYING') return;
    const config = service.gameConfig ?? PREVIEW_GAME_CONFIG;
    this.velocity = config.jumpVelocity * this.layout.unit;
    this.bird.rotation = -0.25;
    if (this.appearance !== 'pilot') {
      this.tweens.killTweensOf(this.body);
      this.body.setDisplaySize(this.bodyDisplaySize.width, (this.bodyDisplaySize.height * 70) / 76);
      this.tweens.add({
        targets: this.body,
        scaleY: this.bodyDisplaySize.height / this.body.height,
        duration: 150,
      });
    }
    audio.tone(530, 0.07);
    if (this.hapticsEnabled) navigator.vibrate?.(8);
  }
  private makePair(): Pair {
    const makeView = (): PipeView => ({
      shaft: this.add.tileSprite(0, 0, 1, 1, 'pipeShaft').setDepth(2),
      cap: this.add.image(0, 0, 'pipeCap').setOrigin(0.5, 0).setDepth(3),
    });
    return {
      upper: makeView(),
      lower: makeView(),
      x: 0,
      width: this.layout.pipeWidth,
      top: 0,
      bottom: 0,
      scored: false,
    };
  }
  private drawPair(pair: Pair) {
    const { pipeWidth, ground } = this.layout;
    const artScale = pipeWidth / pipeArt.shaft.width;
    const capWidth = pipeArt.collar.width * artScale;
    const capHeight = pipeArt.collar.height * artScale;
    const upperCapY = pair.top - capHeight;
    const lowerShaftY = pair.bottom + pipeArt.lowerJoin * artScale;
    const x = pair.x + pipeWidth / 2;
    pair.width = pipeWidth;
    pair.upper.shaft
      .setPosition(x, 0)
      .setOrigin(0.5, 0)
      // Continue beneath the opaque snow so transparent padding cannot expose a gap.
      .setSize(pipeWidth, Math.max(1, upperCapY + pipeArt.upperJoin * artScale))
      .setTileScale(artScale)
      .setVisible(true);
    pair.upper.cap.setPosition(x, upperCapY).setDisplaySize(capWidth, capHeight).setVisible(true);
    pair.lower.cap.setPosition(x, pair.bottom).setDisplaySize(capWidth, capHeight).setVisible(true);
    pair.lower.shaft
      .setPosition(x, lowerShaftY)
      .setOrigin(0.5, 0)
      .setSize(pipeWidth, Math.max(1, ground - lowerShaftY + 8 * this.layout.unit))
      .setTileScale(artScale)
      .setVisible(true);
  }
  private placePair(pair: Pair, x: number, top: number, bottom: number) {
    pair.x = x;
    pair.top = top;
    pair.bottom = bottom;
    pair.scored = false;
    this.drawPair(pair);
    this.pipes.push(pair);
  }
  private previewPair(x: number, top: number, bottom: number) {
    this.placePair(this.pool.pop() ?? this.makePair(), x, top, bottom);
  }
  private pipeGap() {
    const config = service.gameConfig ?? PREVIEW_GAME_CONFIG;
    return Math.min(
      config.pipeGap * this.layout.unit,
      (this.layout.ground - this.layout.safe.top) * 0.5,
    );
  }
  spawn() {
    const { width, unit } = this.layout;
    const gap = this.pipeGap();
    const previous = this.pipes.at(-1) ?? {
      top: this.bird.y - gap / 2,
      bottom: this.bird.y + gap / 2,
    };
    const [minimum, maximum] = reachableCenterRange(this.layout, gap, previous);
    const center = minimum + this.random() * (maximum - minimum);
    this.placePair(
      this.pool.pop() ?? this.makePair(),
      width + 18 * unit,
      center - gap / 2,
      center + gap / 2,
    );
    this.spawnElapsed = 0;
  }
  clearPairs() {
    for (const pair of this.pipes) {
      pair.upper.shaft.setVisible(false);
      pair.upper.cap.setVisible(false);
      pair.lower.shaft.setVisible(false);
      pair.lower.cap.setVisible(false);
      this.pool.push(pair);
    }
    this.pipes.length = 0;
  }
  terminate(reason: 'COLLISION' | 'APP_BACKGROUND' | 'CONNECTION_LOST' | 'EXIT') {
    if (this.starting) {
      this.startGeneration++;
      this.canceledStartReason = reason === 'COLLISION' ? 'EXIT' : reason;
    }
    if (this.phase !== 'PLAYING' || !this.runId) return;
    this.terminateCount++;
    this.phase = 'GAME_OVER';
    if (reason === 'COLLISION') {
      audio.crash();
      if (this.hapticsEnabled) navigator.vibrate?.(40);
      this.bird
        .setRotation(1.25)
        .setPosition(
          this.layout.birdX,
          Math.min(this.bird.y, this.layout.ground - 35 * this.layout.unit),
        );
      for (let i = 0; i < renderProfile.smokeCount; i++) {
        const smoke = this.add
          .circle(this.bird.x, this.bird.y, (5 + i) * this.layout.unit, 0xb6b3b6, 0.65)
          .setDepth(6);
        this.smoke.add(smoke);
        this.tweens.add({
          targets: smoke,
          x: smoke.x + Phaser.Math.Between(-25, 25),
          y: smoke.y - 50 * this.layout.unit,
          alpha: 0,
          scale: 2,
          duration: 650 + i * 80,
          onComplete: () => {
            this.smoke.delete(smoke);
            smoke.destroy();
          },
        });
      }
    }
    this.pendingFinish = {
      runId: this.runId,
      score: localResult(this.displayScore, reason).displayScore,
      reason,
    };
    this.runId = null;
    show('GAME_OVER');
    frontend.showResult({ score: this.displayScore, reason, verification: 'PENDING' });
    this.syncRendering();
    void this.retryResult();
  }
  async retryResult() {
    if (!this.pendingFinish || this.resultPosting) return;
    this.resultPosting = true;
    const button = node('result-sync') as HTMLButtonElement;
    button.disabled = true;
    const finish = this.pendingFinish;
    try {
      const result = await service.finishRun(finish.runId, finish.score, finish.reason);
      this.pendingFinish = null;
      if (this.phase === 'GAME_OVER') frontend.showResult(result);
      else frontend.refresh();
    } catch (error) {
      if (
        error instanceof ApiError &&
        ['SESSION_NOT_ACTIVE', 'SESSION_NOT_FOUND', 'SESSION_ALREADY_FINISHED'].includes(error.code)
      ) {
        this.pendingFinish = null;
        if (this.phase === 'GAME_OVER')
          frontend.showResult({
            score: finish.score,
            reason: finish.reason,
            verification: 'REJECTED',
          });
      } else if (this.phase === 'GAME_OVER')
        node('result-status').textContent = errorMessage(error);
    } finally {
      this.resultPosting = false;
      button.disabled = false;
    }
  }
  update(_time: number, delta: number) {
    // Apply a ScaleManager resize before this frame's collision simulation.
    resizeFrames.flush();
    this.accumulator += Math.min(delta, MAX_FRAME_DELTA_MS);
    while (this.accumulator >= FIXED_STEP_MS) {
      this.step(FIXED_STEP_MS / 1000);
      this.accumulator -= FIXED_STEP_MS;
    }
  }
  step(dt: number) {
    if (this.staticPreview) return;
    const { unit, ground, birdX, pipeWidth } = this.layout;
    if (this.phase === 'READY') {
      this.elapsed += dt;
      this.bird.y = this.readyY() + Math.sin(this.elapsed * 3) * 8 * unit;
      return;
    }
    if (this.phase !== 'PLAYING') return;
    this.elapsed += dt;
    this.backdrop.tilePositionX += 30 * unit * dt;
    this.groundLayer.tilePositionX += 80 * unit * dt;
    const config = service.gameConfig ?? PREVIEW_GAME_CONFIG;
    this.velocity += config.gravity * unit * dt;
    this.bird.y += this.velocity * dt;
    this.bird.rotation = Phaser.Math.Clamp(this.velocity / (750 * unit), -0.36, 0.78);
    const ceiling = this.layout.safe.top + 28 * unit;
    if (this.bird.y < ceiling) {
      this.bird.y = ceiling;
      this.velocity = 0;
    }
    if (this.bird.y + 19 * unit >= ground - 8 * unit) {
      this.terminate('COLLISION');
      return;
    }
    const targetFactor =
      service.mode === 'mock'
        ? previewSpeedFactor(this.displayScore)
        : speedFactor(config, this.displayScore);
    this.actualSpeedFactor = approachSpeedFactor(
      this.actualSpeedFactor,
      targetFactor,
      config.speed.step,
      dt,
    );
    const factor = this.actualSpeedFactor;
    const speed = config.scrollSpeed * factor * unit;
    this.spawnElapsed += dt;
    if (this.spawnElapsed >= config.pipeIntervalMs / factor / 1000) this.spawn();
    for (const pair of this.pipes) {
      pair.x -= speed * dt;
      const x = pair.x + pipeWidth / 2;
      pair.upper.shaft.x = x;
      pair.upper.cap.x = x;
      pair.lower.shaft.x = x;
      pair.lower.cap.x = x;
      const overlap =
        birdX + 18 * unit > pair.x + 6 * unit && birdX - 18 * unit < pair.x + pipeWidth - 6 * unit;
      if (
        overlap &&
        (this.bird.y - 17 * unit < pair.top || this.bird.y + 17 * unit > pair.bottom)
      ) {
        this.terminate('COLLISION');
        return;
      }
      if (scorePair(pair, birdX - 10 * unit)) {
        this.displayScore++;
        ui.score.textContent = String(this.displayScore);

        audio.tone(760, 0.12);
      }
    }
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      if (this.pipes[i].x + pipeWidth < -10 * unit) {
        const pair = this.pipes.splice(i, 1)[0];
        pair.upper.shaft.setVisible(false);
        pair.upper.cap.setVisible(false);
        pair.lower.shaft.setVisible(false);
        pair.lower.cap.setVisible(false);
        this.pool.push(pair);
      }
    }
  }
}
const scene = new Scene();
frontend = new Frontend(service, audio, scene, (scenario) => {
  if (service instanceof MockMiniappService) service.setScenario(scenario);
});
if (import.meta.env.DEV) Object.assign(window, { __SONO_SCENE__: scene, __SONO_DEMO__: service });
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  transparent: true,
  antialias: true,
  fps: GAME_FRAME_TIMING,
  scale: {
    mode: Phaser.Scale.NONE,
    parent: 'game',
    width: backingPixels(node('game').clientWidth, renderRatio),
    height: backingPixels(node('game').clientHeight, renderRatio),
    zoom: 1 / renderRatio,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene,
});
const adaptivePerformance = new AdaptivePerformance((profile) => {
  renderProfile = profile;
  renderRatio = Math.min(cappedPixelRatio(window.devicePixelRatio), profile.maxDpr);
  scene.requestRender();
  scheduleResize();
});
if (import.meta.env.DEV)
  installPerformanceDiagnostics(game, () => ({
    phase: scene.phase,
    backdropBuilds: scene.backdropBuilds,
    poolSize: scene.pool.length,
    activePipes: scene.pipes.length,
    textures: game.textures.getTextureKeys().length,
    rawFrameMs: Math.round(game.loop.rawDelta * 100) / 100,
    gameFrameMs: Math.round(game.loop.delta * 100) / 100,
    clockSmoothing: game.loop.smoothStep,
    backingRatio: game.canvas.width / Math.max(1, game.canvas.clientWidth),
    qualityTier: renderProfile.tier,
    speedFactor: scene.actualSpeedFactor,
  }));
let fitting = false;
const resizeFrames = createFrameScheduler(fit);
function scheduleResize() {
  if (!fitting) resizeFrames.request();
}
function fit() {
  fitting = true;
  try {
    const view = window.visualViewport;
    const width = Math.min(window.innerWidth, view?.width ?? window.innerWidth);
    const height = Math.min(window.innerHeight, view?.height ?? window.innerHeight);
    const insets =
      (window as typeof window & { __SONO_SAFE_AREA__?: Partial<Insets> }).__SONO_SAFE_AREA__ ?? {};
    const host = node('viewport');
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      host.style.setProperty(
        `--safe-${side}`,
        insets[side] === undefined
          ? `env(safe-area-inset-${side}, 0px)`
          : `${Math.max(0, insets[side]!)}px`,
      );
    }
    if (scene.bird) {
      const parent = node('game');
      const nextRatio = Math.min(cappedPixelRatio(window.devicePixelRatio), renderProfile.maxDpr);
      if (nextRatio !== renderRatio) {
        renderRatio = nextRatio;
        game.scale.setZoom(1 / renderRatio);
        scene.cameras.main.setZoom(renderRatio);
      }
      const backingWidth = backingPixels(parent.clientWidth, renderRatio);
      const backingHeight = backingPixels(parent.clientHeight, renderRatio);
      if (game.scale.width !== backingWidth || game.scale.height !== backingHeight)
        game.scale.resize(backingWidth, backingHeight);
      // Phaser does not clear an older CSS zoom size when the ratio returns to 1.
      game.canvas.style.width = `${parent.clientWidth}px`;
      game.canvas.style.height = `${parent.clientHeight}px`;
      scene.resizeForViewport();
      scene.requestRender();
    }
  } finally {
    fitting = false;
  }
}
window.addEventListener('resize', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleResize);
window.addEventListener('sono-safe-area', scheduleResize);
function watchPixelRatio() {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const changed = () => {
    watchPixelRatio();
    scheduleResize();
  };
  if (query.addEventListener) query.addEventListener('change', changed, { once: true });
  else {
    const legacyChanged = () => {
      query.removeListener(legacyChanged);
      changed();
    };
    query.addListener(legacyChanged);
  }
}
watchPixelRatio();
fit();
document.addEventListener(
  'pointerdown',
  (event) => {
    void audio.unlock();
    if (event.target === game.canvas) scene.requestRender();
  },
  { capture: true },
);
document.addEventListener(
  'keydown',
  (event) => {
    void audio.unlock();
    if (event.code === 'Space' && !frontend.modalOpen) scene.requestRender();
  },
  { capture: true },
);
document.addEventListener('visibilitychange', () => {
  audio.setActive(!document.hidden);
  if (document.hidden) scene.terminate('APP_BACKGROUND');
  else {
    scheduleResize();
    if (scene.resultPending) void scene.retryResult();
  }
  scene.setRenderingVisible(!document.hidden);
});
window.addEventListener('pagehide', () => {
  scene.terminate('APP_BACKGROUND');
  scene.setRenderingVisible(false);
});
window.addEventListener('pageshow', () => {
  scene.setRenderingVisible(!document.hidden);
  scheduleResize();
});
function checkRunningConnection() {
  const runId = scene.runId;
  void playAllowed().then((ok) => {
    // A delayed response from a finished flight must not terminate its successor.
    if (!ok && runId && scene.runId === runId) scene.terminate('CONNECTION_LOST');
    if (ok && scene.resultPending) void scene.retryResult();
  });
}
window.addEventListener('offline', checkRunningConnection);
window.addEventListener('online', checkRunningConnection);
if (service.mode === 'api')
  window.setInterval(() => {
    if (scene.phase === 'PLAYING' && !document.hidden) checkRunningConnection();
  }, 30000);
