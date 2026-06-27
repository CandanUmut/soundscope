// Live-listen / assist mode: amplify + EQ ambient sound to earphones in real
// time as a CONVENIENCE aid.
//
// SAFETY: output gain is hard-capped, the UI shows a loudness/feedback warning,
// it defaults conservative, and it never auto-maxes. This is NOT a medical
// hearing aid. Using it with the phone's speaker (not earphones) will howl with
// feedback and can be loud — earphones strongly recommended.

const MAX_GAIN = 8; // hard cap on linear output gain (~+18 dB)

export class AssistEngine {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.preGain = null;
    this.low = null;
    this.mid = null;
    this.high = null;
    this.limiter = null;
    this.outGain = null;
    this.running = false;
  }

  get isRunning() {
    return this.running;
  }

  /** Start within a user gesture. Earphones recommended to avoid feedback. */
  async start({ gain = 2, bass = 0, treble = 0 } = {}) {
    if (this.running) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture is not supported in this browser.');
    }
    // For assist we DO want echo cancellation off (we want raw ambient sound),
    // but allow the browser defaults for the rest to reduce feedback risk.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.source = new MediaStreamAudioSourceNode(this.ctx, { mediaStream: this.stream });
    this.preGain = new GainNode(this.ctx, { gain: 1 });
    this.low = new BiquadFilterNode(this.ctx, { type: 'lowshelf', frequency: 250, gain: bass });
    this.high = new BiquadFilterNode(this.ctx, { type: 'highshelf', frequency: 3000, gain: treble });
    this.mid = new BiquadFilterNode(this.ctx, { type: 'peaking', frequency: 1500, Q: 1, gain: 0 });

    // A compressor acting as a safety limiter near 0 dBFS.
    this.limiter = new DynamicsCompressorNode(this.ctx, {
      threshold: -6,
      knee: 0,
      ratio: 20,
      attack: 0.002,
      release: 0.1
    });
    this.outGain = new GainNode(this.ctx, { gain: this._clampGain(gain) });

    this.source
      .connect(this.preGain)
      .connect(this.low)
      .connect(this.mid)
      .connect(this.high)
      .connect(this.limiter)
      .connect(this.outGain)
      .connect(this.ctx.destination);

    this.running = true;
  }

  _clampGain(g) {
    return Math.min(MAX_GAIN, Math.max(0, g));
  }

  setGain(g) {
    if (this.outGain) this.outGain.gain.value = this._clampGain(g);
  }
  setBass(db) {
    if (this.low) this.low.gain.value = Math.max(-12, Math.min(12, db));
  }
  setTreble(db) {
    if (this.high) this.high.gain.value = Math.max(-12, Math.min(12, db));
  }

  get maxGain() {
    return MAX_GAIN;
  }

  async stop() {
    this.running = false;
    try {
      this.source?.disconnect();
      this.preGain?.disconnect();
      this.low?.disconnect();
      this.mid?.disconnect();
      this.high?.disconnect();
      this.limiter?.disconnect();
      this.outGain?.disconnect();
    } catch {
      /* ignore */
    }
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
    this.stream = null;
    this.source = null;
  }
}
