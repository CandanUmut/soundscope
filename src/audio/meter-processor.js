// AudioWorkletProcessor for SoundScope.
//
// Runs on the audio render thread. Maintains exponentially-averaged
// mean-square with two acoustic time constants (Fast = 0.125 s, Slow = 1.0 s),
// tracks block peak, and posts a compact message to the main thread on a
// fixed ~50 ms cadence (NOT per 128-sample render quantum).
//
// This file must stay self-contained: AudioWorkletGlobalScope cannot resolve
// bundler imports reliably, so no `import` statements here.

const RMS_FLOOR = 1e-7;
const FAST_TAU = 0.125;
const SLOW_TAU = 1.0;
const POST_INTERVAL_MS = 50;

class MeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // sampleRate is a global available in AudioWorkletGlobalScope.
    this.fastAlpha = 1 - Math.exp(-1 / (FAST_TAU * sampleRate));
    this.slowAlpha = 1 - Math.exp(-1 / (SLOW_TAU * sampleRate));
    this.msFast = RMS_FLOOR * RMS_FLOOR;
    this.msSlow = RMS_FLOOR * RMS_FLOOR;
    this.peak = 0;
    this.samplesSincePost = 0;
    this.postEvery = Math.max(1, Math.round((POST_INTERVAL_MS / 1000) * sampleRate));
    this._running = true;

    this.port.onmessage = (e) => {
      if (e.data === 'stop') this._running = false;
      if (e.data === 'reset') {
        this.msFast = RMS_FLOOR * RMS_FLOOR;
        this.msSlow = RMS_FLOOR * RMS_FLOOR;
        this.peak = 0;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return this._running;
    const channel = input[0];
    if (!channel) return this._running;

    const fa = this.fastAlpha;
    const sa = this.slowAlpha;
    let msFast = this.msFast;
    let msSlow = this.msSlow;
    let peak = this.peak;

    for (let i = 0; i < channel.length; i++) {
      const x = channel[i];
      const sq = x * x;
      msFast += fa * (sq - msFast);
      msSlow += sa * (sq - msSlow);
      const a = x < 0 ? -x : x;
      if (a > peak) peak = a;
    }

    this.msFast = msFast;
    this.msSlow = msSlow;
    this.peak = peak;

    this.samplesSincePost += channel.length;
    if (this.samplesSincePost >= this.postEvery) {
      this.samplesSincePost = 0;
      this.port.postMessage({
        rmsFast: Math.sqrt(Math.max(msFast, RMS_FLOOR * RMS_FLOOR)),
        rmsSlow: Math.sqrt(Math.max(msSlow, RMS_FLOOR * RMS_FLOOR)),
        peak: Math.max(peak, RMS_FLOOR)
      });
      // Peak is a per-window maximum: reset after each post.
      this.peak = 0;
    }

    return this._running;
  }
}

registerProcessor('meter-processor', MeterProcessor);
