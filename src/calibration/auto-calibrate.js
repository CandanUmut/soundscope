// Automatic "quick" calibration via a speaker -> mic loopback sweep.
//
// HONESTY (this is the whole reason it's only an *estimate*):
// playing tones through the phone's own speaker and measuring them with the
// same phone's mic reveals the speaker->mic loopback gain, NOT the true room
// loudness. To turn that into an absolute offset we must ASSUME how loud a
// typical phone speaker actually is at full scale & max volume. That assumption
// is device- and volume-dependent, so auto-calibration can easily be off by
// 5-10 dB. It is a convenience starting point — for real accuracy you still
// need an external reference (see the reference-match method).
//
// What it does buy us: it's fully automatic (the user needs no equipment and
// needs to know no numbers), it's self-consistent across several tone levels,
// and it detects when the room is too noisy or the speaker too quiet to trust.

// Assumed acoustic SPL at the mic from a FULL-SCALE (0 dBFS) 1 kHz tone played
// at max system volume on a "typical" phone resting near a hard surface.
// This single population assumption dominates the error budget.
export const ASSUMED_FULLSCALE_SPL = 78;

// 1 kHz is the reference frequency where A/C/Z weightings are all ~0 dB, so the
// measurement is independent of the selected weighting.
export const CAL_FREQ = 1000;

// Digital amplitudes (linear) to probe: -6, -12, -18 dBFS.
export const CAL_AMPLITUDES = [0.5, 0.25, 0.125];

const MIN_SNR_DB = 6; // a tone must exceed the noise floor by this to be trusted

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Pure offset estimator (unit-testable, no audio).
 * @param {{amp:number, dbfs:number}[]} samples  measured mic dBFS per amplitude
 * @param {number} floorDbfs                      measured silent noise floor
 * @param {number} assumedFullScaleSpl
 * @returns {{offset:number, used:number, perAmp:{amp,offset,snr}[]}}
 */
export function estimateOffset(samples, floorDbfs, assumedFullScaleSpl = ASSUMED_FULLSCALE_SPL) {
  const perAmp = [];
  const offsets = [];
  for (const s of samples) {
    const snr = s.dbfs - floorDbfs;
    const digitalDb = 20 * Math.log10(s.amp); // negative
    // assumed acoustic SPL produced by this amplitude:
    const assumedSpl = assumedFullScaleSpl + digitalDb;
    const offset = assumedSpl - s.dbfs;
    perAmp.push({ amp: s.amp, offset, snr });
    if (snr >= MIN_SNR_DB) offsets.push(offset);
  }
  if (offsets.length === 0) {
    return { offset: null, used: 0, perAmp };
  }
  return { offset: median(offsets), used: offsets.length, perAmp };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Drive the full loopback measurement.
 * @param {object} deps
 * @param {ToneGenerator} deps.tone   shared tone generator (output path)
 * @param {() => number} deps.getDbfs returns the live RAW dBFS from the meter
 * @param {(step:object)=>void} [deps.onStep]
 */
export async function runAutoCalibration({ tone, getDbfs, onStep }) {
  // 1) Noise floor (speaker silent).
  onStep?.({ phase: 'floor', label: 'Measuring background noise…' });
  await tone.stop();
  const floor = await measure(getDbfs, 700);

  // 2) Probe each amplitude.
  const samples = [];
  for (const amp of CAL_AMPLITUDES) {
    onStep?.({ phase: 'tone', amp, label: `Playing test tone (${Math.round(20 * Math.log10(amp))} dBFS)…` });
    await tone.playTone(CAL_FREQ, amp);
    await wait(450); // let the level settle
    const dbfs = await measure(getDbfs, 700);
    samples.push({ amp, dbfs });
  }
  await tone.stop();

  onStep?.({ phase: 'compute', label: 'Computing calibration…' });
  const result = estimateOffset(samples, floor);
  if (result.offset == null) {
    const err = new Error(
      'Could not hear the test tones over the background noise. Turn the volume up, ' +
        'lay the phone on a hard surface, and try again in a quieter spot.'
    );
    err.code = 'low_snr';
    err.detail = { floor, samples };
    throw err;
  }
  return { ...result, floor, samples };
}

/** Energy-average the live dBFS over a window (ms). */
async function measure(getDbfs, ms) {
  const start = performance.now();
  const lin = [];
  while (performance.now() - start < ms) {
    const d = getDbfs();
    if (Number.isFinite(d)) lin.push(Math.pow(10, d / 10));
    await wait(50);
  }
  if (!lin.length) return -Infinity;
  const avg = lin.reduce((a, b) => a + b, 0) / lin.length;
  return 10 * Math.log10(avg);
}
