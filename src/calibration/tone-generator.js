// Self-test signal generator: a 1 kHz sine and pink noise at a FIXED digital
// amplitude. This lets the user confirm the audio output path works and do
// relative channel checks.
//
// IMPORTANT (do not misrepresent in the UI): playing a tone through the
// phone's own speaker and measuring it with the same phone's mic only reveals
// the speaker->mic loopback gain. It does NOT establish the true loudness in
// the room and CANNOT set absolute calibration. This is a self-test only.

export class ToneGenerator {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.gain = null;
    this.type = null;
  }

  get isPlaying() {
    return this.node != null;
  }

  _ensureCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  /** Play a 1 kHz sine at a fixed, conservative amplitude. */
  async playTone(freq = 1000, amplitude = 0.2) {
    await this.stop();
    const ctx = this._ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: freq });
    const gain = new GainNode(ctx, { gain: amplitude });
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    this.node = osc;
    this.gain = gain;
    this.type = 'tone';
  }

  /** Play pink noise (approx via a simple filter on white noise). */
  async playPinkNoise(amplitude = 0.15) {
    await this.stop();
    const ctx = this._ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Paul Kellet's economy pink-noise approximation.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    const src = new AudioBufferSourceNode(ctx, { buffer, loop: true });
    const gain = new GainNode(ctx, { gain: amplitude });
    src.connect(gain).connect(ctx.destination);
    src.start();
    this.node = src;
    this.gain = gain;
    this.type = 'pink';
  }

  async stop() {
    if (this.node) {
      try {
        this.node.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.node.disconnect();
        this.gain?.disconnect();
      } catch {
        /* ignore */
      }
      this.node = null;
      this.gain = null;
      this.type = null;
    }
  }

  async dispose() {
    await this.stop();
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
