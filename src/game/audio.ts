import type { Settings } from './config';

/**
 * Procedural synth — no external assets.
 * A tiny FM + noise engine that survives autoplay policies by unlocking on first gesture.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimer = 0;
  private unlocked = false;
  private settings: Settings;
  muted = false;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  apply(settings: Settings): void {
    this.settings = settings;
    this.sync();
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.unlocked = true;
    this.sync();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.startMusic();
  }

  private sync(): void {
    if (!this.master || !this.musicGain || !this.sfxGain) return;
    const m = this.muted ? 0 : this.settings.master;
    this.master.gain.value = m;
    this.musicGain.gain.value = this.settings.music;
    this.sfxGain.gain.value = this.settings.sfx;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.sync();
  }

  beep(freq: number, dur = 0.12, type: OscillatorType = 'square', gain = 0.08, slide = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur = 0.18, gain = 0.12, hp = 400): void {
    if (!this.ctx || !this.sfxGain) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  collect(): void {
    this.beep(880, 0.08, 'triangle', 0.07, 420);
    this.beep(1320, 0.1, 'sine', 0.05, 200);
  }
  jump(): void {
    this.beep(240, 0.14, 'sawtooth', 0.05, 380);
  }
  slide(): void {
    this.beep(180, 0.16, 'triangle', 0.04, -80);
    this.noise(0.08, 0.04, 800);
  }
  hit(): void {
    this.noise(0.22, 0.18, 180);
    this.beep(90, 0.25, 'sawtooth', 0.1, -50);
  }
  shield(): void {
    this.beep(520, 0.2, 'sine', 0.07, 700);
  }
  magnet(): void {
    this.beep(400, 0.18, 'triangle', 0.06, 500);
  }
  ui(): void {
    this.beep(660, 0.07, 'square', 0.04);
  }
  highscore(): void {
    this.beep(523, 0.12, 'triangle', 0.07, 0);
    setTimeout(() => this.beep(659, 0.12, 'triangle', 0.07), 90);
    setTimeout(() => this.beep(784, 0.22, 'triangle', 0.08), 180);
  }
  gameover(): void {
    this.beep(220, 0.35, 'sawtooth', 0.08, -140);
    this.noise(0.4, 0.1, 90);
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusic();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain);

    const pad = ctx.createOscillator();
    pad.type = 'sawtooth';
    pad.frequency.value = 55;
    lfoGain.connect(pad.frequency);
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 280;
    padFilter.Q.value = 8;
    const padG = ctx.createGain();
    padG.gain.value = 0.07;
    pad.connect(padFilter);
    padFilter.connect(padG);
    padG.connect(this.musicGain);
    pad.start(t0);
    lfo.start(t0);
    this.musicNodes.push(pad, lfo, padFilter, padG, lfoGain);

    const bass = ctx.createOscillator();
    bass.type = 'square';
    bass.frequency.value = 55;
    const bassG = ctx.createGain();
    bassG.gain.value = 0.04;
    bass.connect(bassG);
    bassG.connect(this.musicGain);
    bass.start(t0);
    this.musicNodes.push(bass, bassG);

    const pulse = ctx.createOscillator();
    pulse.type = 'triangle';
    pulse.frequency.value = 110;
    const pulseG = ctx.createGain();
    pulseG.gain.value = 0;
    pulse.connect(pulseG);
    pulseG.connect(this.musicGain);
    pulse.start(t0);
    this.musicNodes.push(pulse, pulseG);

    const tick = () => {
      if (!this.ctx || !pulseG) return;
      const now = this.ctx.currentTime;
      pulseG.gain.cancelScheduledValues(now);
      pulseG.gain.setValueAtTime(0.05, now);
      pulseG.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      const notes = [110, 130.81, 146.83, 164.81, 110, 98, 82.41, 110];
      pulse.frequency.setValueAtTime(notes[this.musicTimer % notes.length]!, now);
      this.musicTimer++;
    };
    tick();
    const id = window.setInterval(tick, 420);
    this.musicNodes.push({ disconnect() { clearInterval(id); } } as unknown as AudioNode);
  }

  stopMusic(): void {
    for (const n of this.musicNodes) {
      try {
        if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') (n as OscillatorNode).stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = [];
  }
}
