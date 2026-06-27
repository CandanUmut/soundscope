// Small DSP helpers shared between the main thread and feature modules.
// (The audio-thread integration lives in meter-processor.js, which is
// self-contained and does not import this file.)

export const RMS_FLOOR = 1e-7;

/** Root-mean-square of a Float32 sample block. */
export function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Convert a linear RMS amplitude (0..1) to dBFS. Clamped to a floor. */
export function dbfs(rmsValue) {
  return 20 * Math.log10(Math.max(rmsValue, RMS_FLOOR));
}

/**
 * Time constant -> per-sample smoothing coefficient for exponential averaging
 * of the mean-square. alpha = 1 - exp(-1 / (tau * fs)).
 */
export function smoothingAlpha(tauSeconds, sampleRate) {
  return 1 - Math.exp(-1 / (tauSeconds * sampleRate));
}

/** One-pole exponential smoother for display values (separate from acoustic weighting). */
export function makeSmoother(coeff = 0.3) {
  let prev = null;
  return (value) => {
    if (prev === null || !Number.isFinite(prev)) prev = value;
    prev = prev + coeff * (value - prev);
    return prev;
  };
}

/** Clamp helper. */
export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
