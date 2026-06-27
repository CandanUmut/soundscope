// Audio engine: AudioContext lifecycle, mic stream acquisition with AGC OFF,
// graph wiring (mic -> weighting -> meter worklet; parallel tap -> analyser),
// and constraint-honoring detection.
//
// Graph:
//   mediaStreamSource ──> weighting(input..output) ──> meterWorklet ──> (silent)
//                     └─> analyser (parallel tap for spectrum view)

import { buildWeighting } from './weighting.js';
// Vite: import the worklet as a URL asset (self-contained module served as-is).
import meterWorkletUrl from './meter-processor.js?url';

const MIC_CONSTRAINTS = {
  audio: {
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
    channelCount: 1
  }
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.weighting = null;
    this.meterNode = null;
    this.analyser = null;
    this.silentSink = null;
    this._onLevel = null;
    this._weightingType = 'A';
    this.constraintWarning = null;
  }

  get isRunning() {
    return this.ctx != null && this.ctx.state === 'running';
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : null;
  }

  /**
   * Start the engine. MUST be called inside a user gesture (iOS Safari).
   * @param {object} opts { weighting, onLevel(fn) }
   */
  async start({ weighting = 'A', onLevel } = {}) {
    this._onLevel = onLevel;
    this._weightingType = weighting;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new EngineError('unsupported', 'This browser does not support microphone capture.');
    }
    if (!window.AudioContext && !window.webkitAudioContext) {
      throw new EngineError('unsupported', 'This browser does not support the Web Audio API.');
    }

    // Acquire mic with AGC/EC/NS disabled.
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        throw new EngineError('denied', 'Microphone permission was denied. Allow mic access and try again.');
      }
      if (err && err.name === 'NotFoundError') {
        throw new EngineError('nodevice', 'No microphone was found on this device.');
      }
      throw new EngineError('error', `Could not access the microphone: ${err?.message || err}`);
    }

    this.constraintWarning = this._checkConstraints();

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    // Resume inside the gesture (suspended by default on some platforms).
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    await this.ctx.audioWorklet.addModule(meterWorkletUrl);

    this.source = new MediaStreamAudioSourceNode(this.ctx, { mediaStream: this.stream });

    this.weighting = buildWeighting(this.ctx, this._weightingType);

    this.meterNode = new AudioWorkletNode(this.ctx, 'meter-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1
    });
    this.meterNode.port.onmessage = (e) => {
      if (this._onLevel) this._onLevel(e.data);
    };

    // Parallel analyser tap for the spectrum view (taps the weighted signal).
    this.analyser = new AnalyserNode(this.ctx, {
      fftSize: 4096,
      smoothingTimeConstant: 0.6
    });

    // Wire graph.
    this.source.connect(this.weighting.input);
    this.weighting.output.connect(this.meterNode);
    this.weighting.output.connect(this.analyser);

    // The worklet has an output we don't use; route through a muted gain to a
    // destination so the node is kept alive without making sound.
    this.silentSink = new GainNode(this.ctx, { gain: 0 });
    this.meterNode.connect(this.silentSink).connect(this.ctx.destination);

    return { constraintWarning: this.constraintWarning };
  }

  /** Swap the weighting chain live without restarting the stream. */
  setWeighting(type) {
    if (!this.ctx || type === this._weightingType) return;
    this._weightingType = type;
    // Disconnect old chain.
    this.source.disconnect();
    this.weighting.output.disconnect();
    for (const n of this.weighting.nodes) n.disconnect();

    this.weighting = buildWeighting(this.ctx, type);
    this.source.connect(this.weighting.input);
    this.weighting.output.connect(this.meterNode);
    this.weighting.output.connect(this.analyser);
  }

  resetMetrics() {
    this.meterNode?.port.postMessage('reset');
  }

  getAnalyser() {
    return this.analyser;
  }

  /** Inspect whether the AGC-off constraints were actually honored. */
  _checkConstraints() {
    const track = this.stream?.getAudioTracks?.()[0];
    if (!track || !track.getSettings) return null;
    const s = track.getSettings();
    const offenders = [];
    if (s.autoGainControl === true) offenders.push('auto-gain');
    if (s.echoCancellation === true) offenders.push('echo-cancel');
    if (s.noiseSuppression === true) offenders.push('noise-suppression');
    if (offenders.length === 0) return null;
    return `This device kept ${offenders.join(', ')} on; readings may be distorted.`;
  }

  async stop() {
    try {
      this.meterNode?.port.postMessage('stop');
    } catch {
      /* ignore */
    }
    try {
      this.source?.disconnect();
      this.weighting?.output?.disconnect();
      this.meterNode?.disconnect();
      this.analyser?.disconnect();
      this.silentSink?.disconnect();
    } catch {
      /* ignore */
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
    }
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
    this.weighting = null;
    this.meterNode = null;
    this.analyser = null;
    this.silentSink = null;
  }
}

export class EngineError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'EngineError';
  }
}
