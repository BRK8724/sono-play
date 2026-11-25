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
import { BIRD_HALF_HEIGHT, localResult, overlapsPipe, scorePair, type RunEndReason } from './rules';
import { Frontend, type Phase } from './Frontend';
import { service } from './services/createService';
import { errorMessage } from './services/errors';
import { ApiError } from './services/ApiClient';
import { approachSpeedFactor, seededRandom, speedFactor } from './gameplay';
import { backingPixels, gamePixelRatio } from './displayScale';
import { AdaptivePerformance } from './adaptivePerformance';
import { birdBodyDisplaySize, birdBodyOffsetY, SONO_SHEET_SIZE } from './birdAppearance';
import { backgroundPeriod, backgroundVariant } from './gameRules';
import { assetUrl } from './assets';
import {
  backdropTextureKey,
  createFrameScheduler,
  GAME_FRAME_TIMING,
  RenderActivity,
} from './renderPerformance';
import './style.css';

type PipeView = { shaft: Phaser.GameObjects.TileSprite; cap: Phaser.GameObjects.Image };
type PanoramaLayer = readonly [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
type Pair = {
  upper: PipeView;
  lower: PipeView;
  x: number;
  previousX: number;
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
// Crop boundary in the supplied gameplay composite; separate ground art is pending.
const classicGroundArtY = 1305;
const node = (id: string) => document.getElementById(id)!;
const audio = new GameAudio();
// Keep collision simulation independent of the display's 60/90/120 Hz cadence.
const FIXED_STEP_MS = 1000 / 60;
const FIXED_STEP_SECONDS = FIXED_STEP_MS / 1000;
const MAX_FRAME_DELTA_MS = FIXED_STEP_MS * 4;
const STEP_EPSILON_MS = 1e-7;
const adaptivePerformance = new AdaptivePerformance(() => {
  scheduleResize();
}, navigator);
const sceneParent = node('game');
function viewportPixelRatio(width: number, height: number) {
  return gamePixelRatio(width, height, window.devicePixelRatio, adaptivePerformance.profile.maxDpr);
}
let renderRatio = viewportPixelRatio(sceneParent.clientWidth, sceneParent.clientHeight);
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
  const style = getComputedStyle(node('viewport'));
  // The canvas already excludes the horizontal insets in CSS.
  return {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
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
class Scene extends Phaser.Scene {
  phase: Phase = 'HOME';
  isReady = false;
  loadFailed = false;
  displayScore = 0;
  verifiedScore: number | null = null;
  layout!: GameLayout;
  bird!: Phaser.GameObjects.Container;
  body!: Phaser.GameObjects.Image;
  private wingImages: Phaser.GameObjects.Image[] = [];
  private wingPose = -1;
  private flapAge = 0;
  runId: string | null = null;
  starting = false;
  private renderActivity?: RenderActivity;
  private appearanceTask: Promise<void> = Promise.resolve();
  private appearanceRevision = 0;
  private textureTasks = new Map<string, Promise<void>>();
  private backdropKey = '';
  private panorama?: {
    texture: Phaser.Textures.Texture;
    sky: Phaser.GameObjects.Image;
    ground: PanoramaLayer;
  };
  private scroll = 0;
  private previousScroll = 0;
  private birdY = 0;
  private previousBirdY = 0;
  private birdRotation = 0;
  private previousBirdRotation = 0;
  private smoke = new Set<Phaser.GameObjects.Arc>();
  private startGeneration = 0;
  private canceledStartReason: 'APP_BACKGROUND' | 'EXIT' | 'CONNECTION_LOST' | null = null;
  private period = backgroundPeriod();
  private variant = backgroundVariant();
  private random = Math.random;
  private spawnX = 0;
  private spawnProgressMs = 0;
  actualSpeedFactor = 1;
  private pendingFinish: { runId: string; score: number; reason: string } | null = null;
  private resultPosting = false;
  get resultPending() {
    return this.pendingFinish !== null;
  }
  appearance = '';
  private bodyDisplaySize = SONO_SHEET_SIZE;
  backgroundId = 'classic';
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
    this.load.image('defaultBird', asset('sono-body.png'));
    for (let index = 1; index <= 3; index++)
      this.load.image(`sonoWing${index}`, asset(`sono-wing-${index}.png`));
    this.load.image('pipeShaft', asset('pipe-shaft.webp'));
    this.load.image('pipeCap', asset('pipe-cap.webp'));
    for (const variant of ['evening', 'night'] as const) {
      this.load.image(`${variant}PipeShaft`, asset(`pipe-${variant}-shaft.webp`));
      this.load.image(`${variant}PipeLowerCap`, asset(`pipe-${variant}-lower-cap.webp`));
      this.load.image(`${variant}PipeUpperCap`, asset(`pipe-${variant}-upper-cap.webp`));
    }
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
    for (const variant of ['evening', 'night'] as const) {
      // The supplied shaft has a dark top and bottom border. Crop those edges
      // before tiling so a long pipe has no horizontal line at each repeat.
      this.textures.get(`${variant}PipeShaft`).add('repeat', 0, 0, 8, 192, 378);
    }
    // Zoom around the canvas's top-left so CSS layout and world coordinates align.
    this.cameras.main.setOrigin(0, 0).setZoom(renderRatio);
    this.layout = layoutFor(node('game').clientWidth, node('game').clientHeight, nativeInsets());
    this.buildBackdrop();
    this.body = this.add
      .image(0, 0, 'defaultBird')
      .setDisplaySize(SONO_SHEET_SIZE.width, SONO_SHEET_SIZE.height);
    this.wingImages = [1, 2, 3].map((index) =>
      this.add
        .image(0, 0, `sonoWing${index}`)
        .setDisplaySize(SONO_SHEET_SIZE.width, SONO_SHEET_SIZE.height)
        .setVisible(index === 2),
    );
    this.bird = this.add
      .container(this.layout.birdX, this.readyY(), [this.body, ...this.wingImages])
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
    scheduleResize();
    void frontend.connect().then(async () => {
      await this.applyAppearance();
    });
  }
  private buildBackdrop() {
    const { width, height, ground } = this.layout;
    const key = backdropTextureKey(this.backgroundId, width, height, ground);
    if (key === this.backdropKey && this.panorama) return;
    this.backdropKey = key;
    if (this.panorama) {
      for (const sprite of [this.panorama.sky, ...this.panorama.ground]) sprite.destroy();
      this.panorama.texture.remove('sky-panorama');
      this.panorama.texture.remove('ground-panorama');
    }
    const texture = this.textures.get(this.backgroundId === 'classic' ? 'day' : this.backgroundId);
    const source = texture.getSourceImage() as HTMLImageElement;
    const artGroundY = this.backgroundId === 'classic' ? classicGroundArtY : 1310;
    const groundY = Math.round(ground);
    const layerImage = (
      name: string,
      sourceTop: number,
      sourceHeight: number,
      y: number,
      outputHeight: number,
      anchorBottom: boolean,
      depth: number,
    ) => {
      const targetAspect = width / outputHeight;
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
      // Both copies share the source image. Moving them avoids redrawing an
      // intermediate TileSprite canvas on every scrolling frame.
      const left = Math.round(sx);
      const top = Math.round(sy);
      const cropWidth = Math.max(1, Math.round(sx + sw) - left);
      const cropHeight = Math.max(1, Math.round(sy + sh) - top);
      texture.add(name, 0, left, top, cropWidth, cropHeight);
      return (x: number, overdraw = 0) =>
        this.add
          .image(x, y, texture, name)
          .setOrigin(0)
          .setDisplaySize(width + overdraw, outputHeight)
          .setDepth(depth)
          .setVisible(this.phase !== 'HOME');
    };
    const sky = layerImage('sky-panorama', 0, artGroundY, 0, groundY, true, -2)(0);
    const makeGround = layerImage(
      'ground-panorama',
      artGroundY,
      source.height - artGroundY,
      groundY,
      height - groundY,
      false,
      4,
    );
    this.panorama = {
      texture,
      // The sky art has slightly different edge colors. A static full-width
      // frame avoids a vertical join through the open sky during flight.
      sky,
      ground: [makeGround(0, 1), makeGround(width, 1).setFlipX(true)],
    };
    this.drawBackdrop(this.scroll);
    document.body.dataset.period = this.period;
  }
  private drawBackdrop(scroll: number) {
    if (!this.panorama) return;
    this.positionPanorama(this.panorama.ground, scroll * 80);
  }
  private positionPanorama([first, second]: PanoramaLayer, distance: number) {
    const width = this.layout.width;
    const offset = distance % (width * 2);
    first.x = offset < width ? -offset : width * 2 - offset;
    second.x = width - offset;
  }
  private setBackdropVisible(visible: boolean) {
    if (!this.panorama) return;
    for (const sprite of [this.panorama.sky, ...this.panorama.ground]) sprite.setVisible(visible);
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
    this.bird.setScale(next.unit);
    const scale = next.unit / old.unit;
    this.velocity *= scale;
    const gap = this.pipeGap();
    const playing = this.phase === 'PLAYING';
    const reanchorX = (x: number) => next.birdX + (x - old.birdX) * scale;
    if (playing) this.spawnX = Math.max(next.width + 18 * next.unit, reanchorX(this.spawnX));
    let oldMinY = old.safe.top;
    let oldMaxY = old.ground;
    let nextMinY = next.safe.top;
    let nextMaxY = next.ground;
    for (const pair of this.pipes) {
      pair.x = this.phase === 'READY' ? next.width * 0.57 : reanchorX(pair.x);
      pair.previousX = pair.x;
      const opening = resizeOpening(old, next, pair, gap);
      pair.width = next.pipeWidth;
      // Keep the bird's relative clearance when resizing mid-obstacle.
      if (playing && overlapsPipe(pair, next.birdX, next.unit)) {
        oldMinY = Math.max(oldMinY, pair.top + BIRD_HALF_HEIGHT * old.unit);
        oldMaxY = Math.min(oldMaxY, pair.bottom - BIRD_HALF_HEIGHT * old.unit);
        nextMinY = Math.max(nextMinY, opening.top + BIRD_HALF_HEIGHT * next.unit);
        nextMaxY = Math.min(nextMaxY, opening.bottom - BIRD_HALF_HEIGHT * next.unit);
      }
      pair.top = opening.top;
      pair.bottom = opening.bottom;
      this.drawPair(pair);
    }
    const oldY = playing ? this.birdY : this.bird.y;
    const progress = (oldY - oldMinY) / Math.max(1, oldMaxY - oldMinY);
    if (this.phase === 'READY') this.birdY = this.readyY();
    else if (playing) {
      const ceiling = next.safe.top + 28 * next.unit;
      const floor = next.ground - 28 * next.unit;
      const lower = Math.max(ceiling, nextMinY);
      const upper = Math.min(floor, nextMaxY);
      this.birdY =
        lower <= upper
          ? Phaser.Math.Clamp(nextMinY + progress * (nextMaxY - nextMinY), lower, upper)
          : ceiling + (floor - ceiling) * 0.5;
    } else {
      this.birdY = nextMinY + progress * (nextMaxY - nextMinY);
    }
    this.bird.y = this.previousBirdY = this.birdY;
    if (this.phase === 'READY' && this.pipes.length > 0) {
      this.positionReadyAction(this.pipes[0]);
    }
    this.syncRendering();
  }
  private afterRender() {
    const animatedPhase = this.phase === 'READY' || this.phase === 'PLAYING';
    const hasEffects =
      !animatedPhase && (this.smoke.size > 0 || (this.body && this.tweens.isTweening(this.body)));
    if (this.phase === 'PLAYING') adaptivePerformance.sample(this.game.loop.now);
    else adaptivePerformance.pause();
    this.renderActivity?.afterRender(Boolean(hasEffects));
  }
  private syncRendering() {
    this.renderActivity?.setContinuous(this.phase === 'READY' || this.phase === 'PLAYING');
  }
  requestRender() {
    this.renderActivity?.requestFrame();
  }
  setRenderingVisible(visible: boolean) {
    if (!visible) adaptivePerformance.pause();
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
    this.phase = next;
    if (next === 'READY') {
      void this.applyAppearance();
    }
    show(next);
    this.setBackdropVisible(next !== 'HOME');
    this.bird.setVisible(next === 'READY' || next === 'PLAYING');
    if (next === 'HOME' || next === 'READY') {
      this.clearEffects();
      this.clearPairs();
      this.displayScore = 0;
      ui.score.textContent = '0';
      this.velocity = 0;
      this.actualSpeedFactor = 1;
      this.resetBirdPose(this.readyY());
    }
    if (next === 'READY') {
      this.elapsed = 0;
      this.scroll = 0;
      this.previousScroll = 0;
      this.drawBackdrop(0);
      frontend.refresh();
      ui.theme.textContent = this.period === 'day' ? 'Өдөр' : 'Шөнө';
      const { width, ground, safe } = this.layout;
      const gap = this.pipeGap();
      const top = safe.top + (ground - safe.top) * 0.5 - gap / 2;
      this.placeReadyPipe(width * 0.57, top, top + gap);
      this.positionReadyAction(this.pipes[0]);
    }
    this.syncRendering();
  }
  private resetBirdPose(y: number) {
    this.birdY = this.previousBirdY = y;
    this.birdRotation = this.previousBirdRotation = 0;
    this.bird.setPosition(this.layout.birdX, y).setRotation(0);
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
    const backgroundId = this.variant === 'day' ? 'classic' : this.variant;
    const appearance = player.selectedBird;
    const revision = ++this.appearanceRevision;
    const backgroundKey = backgroundId === 'classic' ? 'day' : backgroundId;
    const backgroundFile =
      backgroundId === 'classic' ? 'game-background.webp' : `${backgroundId}-background.webp`;
    const tasks = [this.ensureImage(backgroundKey, asset(backgroundFile))];
    if (appearance === 'santa') tasks.push(this.ensureImage('santaBody', asset('santa-body.webp')));
    if (appearance === 'gold') {
      tasks.push(this.ensureImage('goldBody', asset('gold-body.webp')));
      for (let index = 1; index <= 3; index++)
        tasks.push(this.ensureImage(`goldWing${index}`, asset(`gold-wing-${index}.webp`)));
    }
    this.appearanceTask = Promise.all(tasks)
      .then(() => {
        if (revision !== this.appearanceRevision) return;
        this.backgroundId = backgroundId;
        this.appearance = appearance;
        for (const pair of [...this.pipes, ...this.pool]) this.setPipeTextures(pair);
        node('sky').style.backgroundImage = `url("${asset(backgroundFile)}")`;
        this.buildBackdrop();
        this.bodyDisplaySize = birdBodyDisplaySize(appearance);
        this.body
          .setTexture(
            appearance === 'pilot'
              ? 'defaultBird'
              : appearance === 'gold'
                ? 'goldBody'
                : 'santaBody',
          )
          .setDisplaySize(this.bodyDisplaySize.width, this.bodyDisplaySize.height)
          .setY(birdBodyOffsetY(appearance));
        this.configureWings(appearance);
        this.setWingPose(1);
        this.bird.setScale(this.layout.unit);
        this.requestRender();
      })
      .catch(() => {
        if (revision !== this.appearanceRevision) return;
        this.appearance = 'pilot';
        this.backgroundId = 'classic';
        this.bodyDisplaySize = SONO_SHEET_SIZE;
        this.body
          .setTexture('defaultBird')
          .setDisplaySize(SONO_SHEET_SIZE.width, SONO_SHEET_SIZE.height)
          .setY(0);
        this.configureWings('pilot');
        this.setWingPose(1);
        node('sky').style.backgroundImage = `url("${asset('game-background.webp')}")`;
        this.buildBackdrop();
        frontend.notify('Зарим зураг ачаалсангүй. Үндсэн загварыг ашиглаж байна.');
        this.requestRender();
      });
    return this.appearanceTask;
  }
  private configureWings(appearance: string) {
    this.wingImages.forEach((wing, index) => {
      if (appearance === 'gold') {
        wing
          .setTexture(`goldWing${index + 1}`)
          .setDisplaySize(this.bodyDisplaySize.width, this.bodyDisplaySize.height)
          // The gold frames have different source positions; align their roots.
          .setY(([0, 27, 29][index] * this.bodyDisplaySize.height) / 118);
      } else {
        wing
          .setTexture(`sonoWing${index + 1}`)
          .setDisplaySize(SONO_SHEET_SIZE.width, SONO_SHEET_SIZE.height)
          .setY(0);
      }
    });
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
      this.displayScore = 0;
      ui.score.textContent = '0';
      this.velocity = 0;
      this.elapsed = 0;
      this.accumulator = 0;
      this.spawnX = this.layout.width + 18 * this.layout.unit;
      this.spawnProgressMs = 0;
      this.actualSpeedFactor = 1;
      this.clearPairs();
      this.resetBirdPose(this.playingY());
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
    const config = service.gameConfig;
    if (!config) throw new ApiError('GAME_CONFIG_REQUIRED');
    this.velocity = config.jumpVelocity * this.layout.unit;
    this.bird.rotation = this.birdRotation = this.previousBirdRotation = -0.25;
    this.flapAge = 0;
    this.setWingPose(2);
    audio.tone(530, 0.07, 'sine', 0.12);
    if (this.hapticsEnabled) navigator.vibrate?.(8);
  }
  private setWingPose(pose: number) {
    if (this.wingPose === pose) return;
    this.wingPose = pose;
    this.wingImages.forEach((wing, index) => wing.setVisible(index === pose));
  }
  private makePair(): Pair {
    const shaftKey = this.variant === 'day' ? 'pipeShaft' : `${this.variant}PipeShaft`;
    const upperCapKey = this.variant === 'day' ? 'pipeCap' : `${this.variant}PipeUpperCap`;
    const lowerCapKey = this.variant === 'day' ? 'pipeCap' : `${this.variant}PipeLowerCap`;
    const makeView = (capKey: string): PipeView => ({
      shaft: this.add
        .tileSprite(0, 0, 1, 1, shaftKey, this.variant === 'day' ? undefined : 'repeat')
        .setDepth(2),
      cap: this.add.image(0, 0, capKey).setOrigin(0.5, 0).setDepth(3),
    });
    return {
      upper: makeView(upperCapKey),
      lower: makeView(lowerCapKey),
      x: 0,
      previousX: 0,
      width: this.layout.pipeWidth,
      top: 0,
      bottom: 0,
      scored: false,
    };
  }
  private setPipeTextures(pair: Pair) {
    const variant = this.backgroundId === 'classic' ? 'day' : this.backgroundId;
    const shaft = variant === 'day' ? 'pipeShaft' : `${variant}PipeShaft`;
    const shaftFrame = variant === 'day' ? undefined : 'repeat';
    pair.upper.shaft.setTexture(shaft, shaftFrame);
    pair.lower.shaft.setTexture(shaft, shaftFrame);
    pair.upper.cap.setTexture(variant === 'day' ? 'pipeCap' : `${variant}PipeUpperCap`);
    pair.lower.cap.setTexture(variant === 'day' ? 'pipeCap' : `${variant}PipeLowerCap`);
    if (this.pipes.includes(pair)) this.drawPair(pair);
  }
  private drawPair(pair: Pair) {
    const { pipeWidth, ground } = this.layout;
    const themed = this.backgroundId !== 'classic';
    const artScale = pipeWidth / (themed ? 192 : pipeArt.shaft.width);
    const capWidth = (themed ? 250 : pipeArt.collar.width) * artScale;
    const upperCapHeight = (themed ? 138 : pipeArt.collar.height) * artScale;
    const lowerCapHeight = (themed ? 125 : pipeArt.collar.height) * artScale;
    const upperCapY = pair.top - upperCapHeight;
    const lowerShaftY = pair.bottom + (themed ? 110 : pipeArt.lowerJoin) * artScale;
    const upperShaftHeight = Math.max(1, upperCapY + (themed ? 20 : pipeArt.upperJoin) * artScale);
    const lowerShaftHeight = Math.max(1, ground - lowerShaftY + 8 * this.layout.unit);
    const x = pair.x + pipeWidth / 2;
    pair.width = pipeWidth;
    pair.upper.shaft
      .setPosition(x, 0)
      .setOrigin(0.5, 0)
      // Continue beneath the opaque snow so transparent padding cannot expose a gap.
      .setSize(pipeWidth, upperShaftHeight)
      .setTileScale(artScale, themed ? upperShaftHeight / 378 : artScale)
      .setVisible(true);
    pair.upper.cap
      .setPosition(x, upperCapY)
      .setDisplaySize(capWidth, upperCapHeight)
      .setVisible(true);
    pair.lower.cap
      .setPosition(x, pair.bottom)
      .setDisplaySize(capWidth, lowerCapHeight)
      .setVisible(true);
    pair.lower.shaft
      .setPosition(x, lowerShaftY)
      .setOrigin(0.5, 0)
      .setSize(pipeWidth, lowerShaftHeight)
      .setTileScale(artScale, themed ? lowerShaftHeight / 378 : artScale)
      .setVisible(true);
  }
  private placePair(pair: Pair, x: number, top: number, bottom: number) {
    pair.x = pair.previousX = x;
    pair.top = top;
    pair.bottom = bottom;
    pair.scored = false;
    this.drawPair(pair);
    this.pipes.push(pair);
  }
  private placeReadyPipe(x: number, top: number, bottom: number) {
    this.placePair(this.pool.pop() ?? this.makePair(), x, top, bottom);
  }
  private pipeGap() {
    const configuredGap = service.gameConfig?.pipeGap ?? 150;
    return Math.min(
      configuredGap * this.layout.unit,
      (this.layout.ground - this.layout.safe.top) * 0.5,
    );
  }
  spawn() {
    const gap = this.pipeGap();
    const previous = this.pipes.at(-1) ?? {
      top: this.birdY - gap / 2,
      bottom: this.birdY + gap / 2,
    };
    const [minimum, maximum] = reachableCenterRange(this.layout, gap, previous);
    const center = minimum + this.random() * (maximum - minimum);
    this.placePair(
      this.pool.pop() ?? this.makePair(),
      this.spawnX,
      center - gap / 2,
      center + gap / 2,
    );
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
  terminate(reason: RunEndReason) {
    if (this.starting) {
      this.startGeneration++;
      this.canceledStartReason =
        reason === 'COLLISION' || reason === 'TIME_LIMIT' ? 'EXIT' : reason;
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
          Math.min(this.birdY, this.layout.ground - 35 * this.layout.unit),
        );
      for (let i = 0; i < adaptivePerformance.profile.smokeCount; i++) {
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
      score: localResult(this.displayScore).displayScore,
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
    if (this.phase === 'READY') {
      this.elapsed += Math.min(delta, MAX_FRAME_DELTA_MS) / 1000;
      this.setWingPose([2, 1, 0, 1][Math.floor(this.elapsed * 8) % 4]);
      this.bird.y = this.readyY() + Math.sin(this.elapsed * 3) * 8 * this.layout.unit;
      return;
    }
    if (this.phase !== 'PLAYING') return;
    this.flapAge += delta;
    this.setWingPose(this.flapAge < 80 ? 2 : this.flapAge < 160 ? 1 : 0);
    if (service.runDeadline !== undefined && performance.now() >= service.runDeadline) {
      this.terminate('TIME_LIMIT');
      return;
    }
    this.accumulator = Math.min(this.accumulator + delta, MAX_FRAME_DELTA_MS);
    while (this.accumulator + STEP_EPSILON_MS >= FIXED_STEP_MS && this.phase === 'PLAYING') {
      this.step(FIXED_STEP_SECONDS);
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP_MS);
    }
    if (this.phase === 'PLAYING') this.renderFlight(this.accumulator / FIXED_STEP_MS);
  }
  private renderFlight(alpha: number) {
    // Interpolate render positions independently of the 60 Hz collision state.
    this.bird.y = Phaser.Math.Linear(this.previousBirdY, this.birdY, alpha);
    this.bird.rotation = Phaser.Math.Linear(this.previousBirdRotation, this.birdRotation, alpha);
    this.drawBackdrop(Phaser.Math.Linear(this.previousScroll, this.scroll, alpha));
    for (const pair of this.pipes) {
      const x = Phaser.Math.Linear(pair.previousX, pair.x, alpha) + pair.width / 2;
      pair.upper.shaft.x = x;
      pair.upper.cap.x = x;
      pair.lower.shaft.x = x;
      pair.lower.cap.x = x;
    }
  }
  step(dt: number) {
    if (this.phase !== 'PLAYING') return;
    const { unit, ground, birdX, pipeWidth } = this.layout;
    this.elapsed += dt;
    this.previousScroll = this.scroll;
    this.scroll += unit * dt;
    const config = service.gameConfig;
    if (!config) {
      this.terminate('CONNECTION_LOST');
      return;
    }
    this.velocity += config.gravity * unit * dt;
    this.previousBirdY = this.birdY;
    this.previousBirdRotation = this.birdRotation;
    this.birdY += this.velocity * dt;
    this.birdRotation = Phaser.Math.Clamp(this.velocity / (750 * unit), -0.36, 0.78);
    const ceiling = this.layout.safe.top + 28 * unit;
    if (this.birdY < ceiling) {
      this.birdY = ceiling;
      this.velocity = 0;
    }
    if (this.birdY + 19 * unit >= ground - 8 * unit) {
      this.terminate('COLLISION');
      return;
    }
    const targetFactor = speedFactor(config, this.displayScore);
    this.actualSpeedFactor = approachSpeedFactor(
      this.actualSpeedFactor,
      targetFactor,
      config.speed.step,
      dt,
    );
    const factor = this.actualSpeedFactor;
    const speed = config.scrollSpeed * factor * unit;
    this.spawnProgressMs += dt * 1000 * factor;
    if (this.spawnProgressMs >= config.pipeIntervalMs) {
      // Retain fractional progress across fixed steps and speed transitions.
      this.spawnProgressMs %= config.pipeIntervalMs;
      this.spawn();
    }
    for (const pair of this.pipes) {
      pair.previousX = pair.x;
      pair.x -= speed * dt;
      if (
        overlapsPipe(pair, birdX, unit) &&
        (this.birdY < pair.top + BIRD_HALF_HEIGHT * unit ||
          this.birdY > pair.bottom - BIRD_HALF_HEIGHT * unit)
      ) {
        this.terminate('COLLISION');
        return;
      }
      if (scorePair(pair, birdX, unit)) {
        this.displayScore++;
        ui.score.textContent = String(this.displayScore);
        audio.play('pipe');
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
frontend = new Frontend(service, audio, scene);
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  transparent: true,
  antialias: true,
  fps: GAME_FRAME_TIMING,
  scale: {
    mode: Phaser.Scale.NONE,
    parent: 'game',
    width: backingPixels(sceneParent.clientWidth, renderRatio),
    height: backingPixels(sceneParent.clientHeight, renderRatio),
    zoom: 1 / renderRatio,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene,
});
let fitting = false;
const resizeFrames = createFrameScheduler(fit);
function scheduleResize() {
  if (!fitting) resizeFrames.request();
}
function unzoomedVisualViewport() {
  const view = window.visualViewport;
  return view && Math.abs(view.scale - 1) < 0.01 ? view : undefined;
}
function scheduleVisualResize() {
  if (unzoomedVisualViewport()) scheduleResize();
}
function fit() {
  fitting = true;
  try {
    const view = unzoomedVisualViewport();
    const width = Math.min(window.innerWidth, view?.width ?? window.innerWidth);
    const height = Math.min(window.innerHeight, view?.height ?? window.innerHeight);
    const insets =
      (window as typeof window & { __SONO_SAFE_AREA__?: Partial<Insets> }).__SONO_SAFE_AREA__ ?? {};
    const host = node('viewport');
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    host.style.top = `${Math.max(0, view?.offsetTop ?? 0)}px`;
    host.style.left = `${Math.max(0, view?.offsetLeft ?? 0)}px`;
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const inset = insets[side];
      if (typeof inset === 'number' && Number.isFinite(inset))
        host.style.setProperty(`--safe-${side}`, `${Math.max(0, inset)}px`);
      else host.style.removeProperty(`--safe-${side}`);
    }
    if (scene.bird) {
      const parent = sceneParent;
      const cssWidth = parent.clientWidth;
      const cssHeight = parent.clientHeight;
      const nextRatio = viewportPixelRatio(cssWidth, cssHeight);
      if (nextRatio !== renderRatio) {
        renderRatio = nextRatio;
        game.scale.setZoom(1 / renderRatio);
        scene.cameras.main.setZoom(renderRatio);
      }
      const backingWidth = backingPixels(cssWidth, renderRatio);
      const backingHeight = backingPixels(cssHeight, renderRatio);
      if (game.scale.width !== backingWidth || game.scale.height !== backingHeight)
        game.scale.resize(backingWidth, backingHeight);
      // Phaser does not clear an older CSS zoom size when the ratio returns to 1.
      game.canvas.style.width = `${cssWidth}px`;
      game.canvas.style.height = `${cssHeight}px`;
      scene.resizeForViewport();
      scene.requestRender();
    }
  } finally {
    fitting = false;
  }
}
window.addEventListener('resize', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleVisualResize);
window.visualViewport?.addEventListener('scroll', scheduleVisualResize, { passive: true });
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
// A flight needs no connection: the result is sent at game over and again once the network is back,
// and the server accepts a late result. So losing the connection only shows a notice.
window.addEventListener('offline', () => {
  ui.offline.hidden = false;
});
window.addEventListener('online', () => {
  ui.offline.hidden = true;
  if (scene.resultPending) void scene.retryResult();
});
