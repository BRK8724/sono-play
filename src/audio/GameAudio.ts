import { assetUrl } from '../assets';

/** Recorded effects are decoded once after the first tap; the flap and crash stay synthesized. */
const EFFECTS = {
  click: { file: 'assets/sono/audio/click.mp3', volume: 0.4 },
  pipe: { file: 'assets/sono/audio/pipe-pass.mp3', volume: 0.2 },
  getBird: { file: 'assets/sono/audio/get-bird.mp3', volume: 0.4 },
} as const;
export type EffectName = keyof typeof EFFECTS;
/** AAC 64 kbps (~1 MB), streamed rather than decoded. */
const MUSIC_FILE = 'assets/sono/audio/background-music.m4a';
const MUSIC_VOLUME = 0.03;

function readPreference(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    // Some WebView storage policies disable localStorage entirely.
    return true;
  }
}

function savePreference(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? 'on' : 'off');
  } catch {
    // Audio still works for this session when storage is unavailable.
  }
}

export class GameAudio {
  private context?: AudioContext;
  private musicBus?: GainNode;
  private musicElement?: HTMLAudioElement;
  private crashBuffer?: AudioBuffer;
  private buffers = new Map<EffectName, AudioBuffer>();
  private effectsTask?: Promise<void>;
  private active = true;
  music = readPreference('sono-music');
  effects = readPreference('sono-sound');
  get state() {
    return this.context?.state ?? 'locked';
  }
  async unlock() {
    try {
      if (!this.context) {
        const Context =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.musicBus = this.context.createGain();
        this.musicBus.gain.value = MUSIC_VOLUME;
        this.musicBus.connect(this.context.destination);
      }
      // iOS starts a media element only inside the gesture, so this runs before any await.
      this.syncMusic();
      if (this.active && this.context.state !== 'running') await this.context.resume();
      this.effectsTask ??= this.loadEffects(this.context);
    } catch {
      /* A host may disallow audio. Gameplay remains available. */
    }
  }
  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    if (!active) void this.context?.suspend().catch(() => {});
    else void this.context?.resume().catch(() => {});
    this.syncMusic();
  }
  setMusic(enabled: boolean) {
    this.music = enabled;
    savePreference('sono-music', enabled);
    this.syncMusic();
  }
  setEffects(enabled: boolean) {
    this.effects = enabled;
    savePreference('sono-sound', enabled);
  }
  /** Plays a recorded effect; silent until the files have loaded after the first tap. */
  play(name: EffectName) {
    const c = this.context;
    const buffer = this.buffers.get(name);
    if (!buffer || c?.state !== 'running' || !this.active || !this.effects) return;
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = EFFECTS[name].volume;
    source.connect(gain).connect(c.destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  tone(frequency: number, duration = 0.1, wave: OscillatorType = 'sine', volume = 0.07) {
    const c = this.context;
    if (c?.state !== 'running' || !this.active || !this.effects) return;
    const t = c.currentTime;
    const oscillator = c.createOscillator();
    const gain = c.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain).connect(c.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  }
  private async loadEffects(c: AudioContext) {
    await Promise.all(
      (Object.keys(EFFECTS) as EffectName[]).map(async (name) => {
        try {
          const response = await fetch(assetUrl(EFFECTS[name].file));
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          // The callback form also works in WebViews older than the promise form.
          const buffer = await new Promise<AudioBuffer>((resolve, reject) =>
            c.decodeAudioData(data, resolve, reject),
          );
          this.buffers.set(name, buffer);
        } catch {
          /* A missing effect stays silent; gameplay is unaffected. */
        }
      }),
    );
  }
  private syncMusic() {
    if (!this.context || !this.musicBus) return;
    if (!this.music || !this.active) {
      this.musicElement?.pause();
      return;
    }
    if (!this.musicElement) {
      const element = document.createElement('audio');
      element.src = assetUrl(MUSIC_FILE);
      element.loop = true;
      element.preload = 'auto';
      // Routed through Web Audio because iOS ignores HTMLMediaElement.volume.
      this.context.createMediaElementSource(element).connect(this.musicBus);
      this.musicElement = element;
    }
    // A refused start is retried by the next tap's unlock().
    void this.musicElement.play().catch(() => {});
  }
  crash() {
    const c = this.context;
    if (c?.state !== 'running' || !this.active || !this.effects) return;
    if (!this.crashBuffer) {
      this.crashBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.65), c.sampleRate);
      const data = this.crashBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = c.createBufferSource();
    source.buffer = this.crashBuffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.6);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.24, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.65);
    source.connect(filter).connect(gain).connect(c.destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start();
    this.tone(75, 0.45, 'triangle', 0.18);
  }
  destroy() {
    this.musicElement?.pause();
    this.musicElement?.removeAttribute('src');
    void this.context?.close();
  }
}
