// Pure-tone hearing SCREENING (awareness only).
//
// !!! HARD REQUIREMENT !!!
// This is NOT a hearing test, NOT calibrated, NOT a diagnosis. Phone speakers
// and earphones are not calibrated audiometric transducers, and output level
// depends on volume, hardware, and fit. Results are RELATIVE AWARENESS ONLY:
// "you responded to X at the level you set." No dB HL thresholds are produced
// or implied. Anyone with a concern must see an audiologist for real audiometry.
//
// The flow plays a tone at each standard frequency at a chosen relative level;
// the user marks whether they heard it. Output is a simple presence chart.

export const SCREEN_FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];

export class HearingScreen {
  constructor() {
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    // relative level 0..1 (digital amplitude). Default conservative.
    this.level = 0.15;
    this.results = {}; // freq -> { heard: bool, level }
  }

  _ensureCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  async playTone(freq, durationMs = 1500) {
    await this.stopTone();
    const ctx = this._ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: freq });
    const gain = new GainNode(ctx, { gain: 0 });
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    // gentle ramps to avoid clicks
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.level, now + 0.05);
    osc.start(now);
    this.osc = osc;
    this.gain = gain;

    return new Promise((resolve) => {
      const stopAt = now + durationMs / 1000;
      gain.gain.setValueAtTime(this.level, stopAt - 0.05);
      gain.gain.linearRampToValueAtTime(0, stopAt);
      osc.stop(stopAt + 0.02);
      osc.onended = () => {
        this.osc = null;
        this.gain = null;
        resolve();
      };
    });
  }

  async stopTone() {
    if (this.osc) {
      try {
        this.osc.stop();
        this.osc.disconnect();
        this.gain?.disconnect();
      } catch {
        /* ignore */
      }
      this.osc = null;
      this.gain = null;
    }
  }

  setLevel(level) {
    this.level = Math.min(0.6, Math.max(0.01, level));
  }

  mark(freq, heard) {
    this.results[freq] = { heard, level: this.level };
  }

  reset() {
    this.results = {};
  }

  async dispose() {
    await this.stopTone();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }
}
