// Octave / one-third-octave band analysis from an AnalyserNode.
//
// We read the AnalyserNode frequency data (dB) and aggregate FFT bins into
// standard octave or 1/3-octave bands by energy summation. This is for the
// spectrum *view* only — the core level metric comes from the worklet, not here.

// IEC preferred centre frequencies.
export const OCTAVE_CENTERS = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const THIRD_OCTAVE_CENTERS = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

/** Band edges for a centre frequency. ratio = 2^(1/2) octave, 2^(1/6) third-octave. */
function bandEdges(centers, isThird) {
  const r = isThird ? Math.pow(2, 1 / 6) : Math.pow(2, 1 / 2);
  return centers.map((fc) => ({ fc, lo: fc / r, hi: fc * r }));
}

export class SpectrumAnalyzer {
  /**
   * @param {AnalyserNode} analyser
   * @param {'octave'|'third'} mode
   */
  constructor(analyser, mode = 'octave') {
    this.analyser = analyser;
    this.bins = new Float32Array(analyser.frequencyBinCount);
    this.sampleRate = analyser.context.sampleRate;
    this.setMode(mode);
  }

  setMode(mode) {
    this.mode = mode;
    const centers = mode === 'third' ? THIRD_OCTAVE_CENTERS : OCTAVE_CENTERS;
    // keep bands under Nyquist
    const nyq = this.sampleRate / 2;
    this.bands = bandEdges(centers, mode === 'third').filter((b) => b.lo < nyq);
  }

  /** Returns an array of { fc, db } where db is the band's aggregate level (dBFS-ish). */
  read() {
    this.analyser.getFloatFrequencyData(this.bins);
    const n = this.bins.length;
    const binHz = this.sampleRate / 2 / n;
    const out = [];
    for (const band of this.bands) {
      let energy = 0;
      let count = 0;
      const loBin = Math.max(0, Math.floor(band.lo / binHz));
      const hiBin = Math.min(n - 1, Math.ceil(band.hi / binHz));
      for (let i = loBin; i <= hiBin; i++) {
        const dB = this.bins[i];
        if (Number.isFinite(dB)) {
          energy += Math.pow(10, dB / 10);
          count++;
        }
      }
      const db = count > 0 ? 10 * Math.log10(energy) : -Infinity;
      out.push({ fc: band.fc, db });
    }
    return out;
  }
}
