// Over-threshold alerts: when the ambient level exceeds a user threshold, fire
// a strong visual flash and a haptic buzz (navigator.vibrate). Useful for
// protecting residual hearing and for people who cannot hear warning sounds.

export class ThresholdAlerter {
  constructor({ onFlash } = {}) {
    this.threshold = 85;
    this.enabled = false;
    this.onFlash = onFlash;
    this._active = false;
    this._lastVibrate = 0;
    this._cooldownMs = 1500;
  }

  setThreshold(db) {
    this.threshold = db;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this._setActive(false);
  }

  /** Feed the current displayed level. */
  update(level) {
    if (!this.enabled || level == null || !Number.isFinite(level)) {
      this._setActive(false);
      return;
    }
    const over = level >= this.threshold;
    this._setActive(over);
    if (over) {
      const now = performance.now();
      if (now - this._lastVibrate > this._cooldownMs) {
        this._lastVibrate = now;
        if (navigator.vibrate) {
          try {
            navigator.vibrate([120, 60, 120]);
          } catch {
            /* not supported */
          }
        }
      }
    }
  }

  _setActive(on) {
    if (on === this._active) return;
    this._active = on;
    if (this.onFlash) this.onFlash(on);
  }
}
