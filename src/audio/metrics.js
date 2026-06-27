// Session-level metrics computed from the displayed SPL stream on the main
// thread: Leq, Lmax/Lmin, and the L10/L50/L90 percentiles used in
// environmental noise surveys (via a running histogram).

const HIST_MIN = 0; // dB SPL bottom of histogram
const HIST_MAX = 140;
const HIST_BINS = HIST_MAX - HIST_MIN; // 1 dB bins

export class MetricsAccumulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = null;
    this.elapsedMs = 0;
    this.energySum = 0; // sum of 10^(L/10)
    this.count = 0;
    this.lmax = null;
    this.lmin = null;
    this.hist = new Uint32Array(HIST_BINS);
    this.histTotal = 0;
    this._samples = []; // {t, level} for timeline (downsampled by caller cadence)
  }

  /** Add one displayed SPL reading (already weighted, Fast). */
  add(level, timestamp = performance.now()) {
    if (this.startTime === null) this.startTime = timestamp;
    this.elapsedMs = timestamp - this.startTime;
    if (!Number.isFinite(level)) return;

    this.energySum += Math.pow(10, level / 10);
    this.count++;

    if (this.lmax === null || level > this.lmax) this.lmax = level;
    if (this.lmin === null || level < this.lmin) this.lmin = level;

    const bin = Math.min(HIST_BINS - 1, Math.max(0, Math.round(level - HIST_MIN)));
    this.hist[bin]++;
    this.histTotal++;
  }

  get leq() {
    if (this.count === 0) return null;
    return 10 * Math.log10(this.energySum / this.count);
  }

  /** Lp percentile: the level exceeded p% of the time (L10 = louder events). */
  percentile(p) {
    if (this.histTotal === 0) return null;
    // L10 means exceeded 10% of the time -> the level at the (100-10)th
    // cumulative position counting from the bottom.
    const target = this.histTotal * (1 - p / 100);
    let cum = 0;
    for (let i = 0; i < HIST_BINS; i++) {
      cum += this.hist[i];
      if (cum >= target) return i + HIST_MIN;
    }
    return HIST_MAX;
  }

  snapshot() {
    return {
      leq: this.leq,
      lmax: this.lmax,
      lmin: this.lmin,
      l10: this.percentile(10),
      l50: this.percentile(50),
      l90: this.percentile(90),
      elapsedMs: this.elapsedMs
    };
  }
}
