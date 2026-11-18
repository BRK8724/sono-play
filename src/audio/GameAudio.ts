/** Original procedural flight theme: no downloaded tracks or network requests. */
const MELODY = [
  72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 74, 69, 72, 76, 72, 67, 71, 74, 71,
  65, 69, 72, 77, 74, 71, 67, 71,
];
const BASS = [48, 50, 48, 55, 45, 43, 41, 43];
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
  private timer?: ReturnType<typeof setInterval>;
  private nextNote = 0;
  private beat = 0;
  private active = true;
  music = readPreference('sono-music');
  effects = readPreference('sono-sound');
  get state() {
    return this.context?.state ?? 'locked';
  }
  async unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.musicBus = this.context.createGain();
        this.musicBus.gain.value = this.music ? 0.22 : 0;
        this.musicBus.connect(this.context.destination);
        this.timer = setInterval(() => this.schedule(), 100);
      }
      if (this.active && this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* A host may disallow audio. Gameplay remains available. */
    }
  }
  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    if (!active) void this.context?.suspend().catch(() => {});
    else {
      this.nextNote = (this.context?.currentTime ?? 0) + 0.05;
      void this.context?.resume().catch(() => {});
    }
  }
  setMusic(enabled: boolean) {
    this.music = enabled;
    savePreference('sono-music', enabled);
    if (this.context && this.musicBus)
      this.musicBus.gain.setTargetAtTime(enabled ? 0.22 : 0, this.context.currentTime, 0.08);
  }
  setEffects(enabled: boolean) {
    this.effects = enabled;
    savePreference('sono-sound', enabled);
  }
  tone(
    frequency: number,
    duration = 0.1,
    wave: OscillatorType = 'sine',
    volume = 0.07,
    when?: number,
    bus?: AudioNode,
  ) {
    const c = this.context;
    if (!c || (!bus && !this.effects)) return;
    const t = when ?? c.currentTime;
    const oscillator = c.createOscillator();
    const gain = c.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain).connect(bus ?? c.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  }
  private schedule() {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.active || !this.music) return;
    if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.03;
    while (this.nextNote < c.currentTime + 0.2) {
      const note = MELODY[this.beat % MELODY.length];
      this.tone(
        440 * 2 ** ((note - 69) / 12),
        0.23,
        'triangle',
        0.12,
        this.nextNote,
        this.musicBus,
      );
      if (this.beat % 4 === 0)
        this.tone(
          440 * 2 ** ((BASS[Math.floor(this.beat / 4) % BASS.length] - 69) / 12),
          0.7,
          'sine',
          0.18,
          this.nextNote,
          this.musicBus,
        );
      this.beat++;
      this.nextNote += 0.3;
    }
  }
  crash() {
    const c = this.context;
    if (!c || !this.effects) return;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.65), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = c.createBufferSource();
    source.buffer = buffer;
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
    clearInterval(this.timer);
    void this.context?.close();
  }
}
