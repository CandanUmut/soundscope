// Noise-exposure dose estimation: OSHA PEL and NIOSH REL.
//
// EDUCATIONAL FRAMING ONLY. This is not a compliance instrument. It estimates
// dose from the app's (uncertain) calibrated readings using the standard
// criterion levels and exchange rates.
//
//   OSHA PEL : criterion 90 dBA over 8 h, 5 dB exchange rate.
//   NIOSH REL: criterion 85 dBA over 8 h, 3 dB exchange rate.
//
// Allowed time at level L:  T(L) = T_c / 2^((L - L_c) / Q)
//   where T_c = 8 h, L_c = criterion, Q = exchange rate.
// Dose accrues as elapsed_time_at_L / T(L), summed over the session.

const STANDARDS = {
  osha: { criterion: 90, exchange: 5, refHours: 8 },
  niosh: { criterion: 85, exchange: 3, refHours: 8 }
};

function allowedSeconds(level, std) {
  const t = (std.refHours * 3600) / Math.pow(2, (level - std.criterion) / std.exchange);
  return t;
}

export class ExposureAccumulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.oshaDoseFraction = 0; // 1.0 == 100%
    this.nioshDoseFraction = 0;
    this._lastLevel = null;
    this._emaLevel = null; // smoothed level used for a stable time-to-limit
  }

  /**
   * Add an interval: a level held for dtSeconds.
   * Levels below the measurement threshold (~40 dB) contribute negligibly and
   * are clamped to avoid absurd allowed-time math.
   */
  add(level, dtSeconds) {
    if (!Number.isFinite(level) || dtSeconds <= 0) return;
    const L = Math.max(level, 40);
    this._lastLevel = level;
    // ~10 s smoothing so the projected time-to-limit is readable, not jittery.
    const tau = 10;
    const alpha = 1 - Math.exp(-Math.min(dtSeconds, tau) / tau);
    this._emaLevel = this._emaLevel == null ? level : this._emaLevel + alpha * (level - this._emaLevel);
    this.oshaDoseFraction += dtSeconds / allowedSeconds(L, STANDARDS.osha);
    this.nioshDoseFraction += dtSeconds / allowedSeconds(L, STANDARDS.niosh);
  }

  /** Project seconds remaining until 100% dose at the current level. */
  _timeToLimit(doseFraction, level, std) {
    if (level == null || !Number.isFinite(level)) return Infinity;
    if (doseFraction >= 1) return 0;
    const ratePerSec = 1 / allowedSeconds(Math.max(level, 40), std);
    if (ratePerSec <= 0) return Infinity;
    return (1 - doseFraction) / ratePerSec;
  }

  snapshot() {
    // Project from the smoothed level so the countdown is stable and readable.
    return {
      oshaDose: this.oshaDoseFraction * 100,
      oshaTimeToLimit: this._timeToLimit(this.oshaDoseFraction, this._emaLevel, STANDARDS.osha),
      nioshDose: this.nioshDoseFraction * 100,
      nioshTimeToLimit: this._timeToLimit(this.nioshDoseFraction, this._emaLevel, STANDARDS.niosh),
      avgLevel: this._emaLevel
    };
  }
}
