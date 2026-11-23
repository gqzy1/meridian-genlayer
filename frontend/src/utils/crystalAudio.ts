import type { ClaimStatus } from "../config/meridian";

const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 1046.5];

class CrystalAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private lastBrushTime = 0;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next) {
      const ctx = this.ensureContext();
      if (ctx) {
        this.playTone(ctx, 880, 0.035, 0.45, 0);
        this.playTone(ctx, 1318.5, 0.025, 0.55, 0.07);
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    peakGain: number,
    duration: number,
    delay = 0,
    type: OscillatorType = "sine"
  ): void {
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playRibbonBrush(speed: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBrushTime < 150) return;
    this.lastBrushTime = nowMs;

    const idx = Math.min(
      PENTATONIC_HZ.length - 1,
      Math.floor(Math.random() * PENTATONIC_HZ.length)
    );
    const freq = PENTATONIC_HZ[idx] * 2;
    const vol = Math.min(0.024, 0.007 + speed * 0.0005);
    this.playTone(ctx, freq, vol, 0.42, 0, "sine");
  }

  public playBeaconHover(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTone(ctx, 1174.66, 0.022, 0.28, 0, "sine");
  }

  public playBeaconSelect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTone(ctx, 783.99, 0.032, 0.45, 0);
    this.playTone(ctx, 1174.66, 0.024, 0.55, 0.06);
  }

  public playRipple(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTone(ctx, 659.25, 0.024, 0.5, 0);
    this.playTone(ctx, 987.77, 0.016, 0.6, 0.05);
  }

  public playValidatorPulse(stepIndex: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const clamped = Math.max(0, Math.min(PENTATONIC_HZ.length - 1, stepIndex));
    this.playTone(ctx, PENTATONIC_HZ[clamped], 0.035, 0.52, 0);
    this.playTone(ctx, PENTATONIC_HZ[clamped] * 2, 0.014, 0.4, 0.02, "triangle");
  }

  public playConsensusFinalized(verdict: ClaimStatus): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const chord =
      verdict === "VERIFIED"
        ? [523.25, 659.25, 783.99, 1174.66]
        : verdict === "REFUTED"
          ? [440, 523.25, 659.25, 880]
          : [493.88, 587.33, 739.99];
    chord.forEach((hz, i) => {
      this.playTone(ctx, hz, 0.034 - i * 0.005, 1.15, i * 0.055);
    });
  }
}

export const crystalAudio = new CrystalAudioEngine();
