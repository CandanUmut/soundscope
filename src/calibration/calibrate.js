// Calibration state and the three honest calibration methods + a clearly
// labelled self-test. The offset is applied globally: displayedSPL = dBFS + offset.
//
// HONESTY: a browser cannot measure absolute SPL without an external reference.
// Only the reference-match method (method 1) establishes real absolute accuracy.
// Even then, expect +/-2..5 dB. The self-test tone (tone-generator.js) checks
// the input path only — it does NOT set absolute accuracy.

import { store } from '../store/state.js';

// Rough starting-point offsets for common phones. These are NOT calibrated
// values — they only get the gauge into a plausible range until the user
// performs a proper reference-match calibration.
export const DEVICE_PRESETS = [
  { id: 'generic', label: 'Generic phone (start here)', offset: 130 },
  { id: 'pixel', label: 'Google Pixel (rough)', offset: 132 },
  { id: 'iphone', label: 'iPhone (rough)', offset: 128 },
  { id: 'samsung', label: 'Samsung Galaxy (rough)', offset: 131 },
  { id: 'laptop', label: 'Laptop built-in mic (rough)', offset: 120 }
];

export function getCalibration() {
  return store.get().calibration;
}

export function getOffset() {
  return store.get().calibration.offset;
}

/** Apply the global offset to a raw dBFS value. */
export function dbfsToSpl(dbfs) {
  if (dbfs == null || !Number.isFinite(dbfs)) return null;
  return dbfs + getOffset();
}

function commit(offset, method) {
  const cal = {
    offset: Number(offset.toFixed(2)),
    method,
    lastCalibrated: method === 'preset' || method === 'nudge' ? store.get().calibration.lastCalibrated : Date.now()
  };
  // For preset/nudge we still record when it was last *touched*.
  if (method === 'preset' || method === 'nudge') cal.lastCalibrated = Date.now();
  store.set({ calibration: cal });
  return cal;
}

/**
 * Method 1 — reference-match (the accurate path).
 * @param {number} knownSpl   the true level from a calibrated meter/calibrator
 * @param {number} currentDbfs the app's current raw dBFS reading
 */
export function calibrateReference(knownSpl, currentDbfs) {
  if (!Number.isFinite(knownSpl) || !Number.isFinite(currentDbfs)) {
    throw new Error('Need both a known SPL and a live reading.');
  }
  return commit(knownSpl - currentDbfs, 'reference');
}

/** Method 2 — manual nudge. The slider value IS the offset. */
export function calibrateManual(offset) {
  return commit(offset, 'nudge');
}

/** Auto loopback estimate (rough, equipment-free). */
export function calibrateAuto(offset) {
  return commit(offset, 'auto');
}

/** Method 3 — device preset (rough starting point only). */
export function calibratePreset(presetId) {
  const p = DEVICE_PRESETS.find((d) => d.id === presetId);
  if (!p) throw new Error('Unknown preset.');
  return commit(p.offset, 'preset');
}

export function isCalibrated() {
  return store.get().calibration.method === 'reference';
}

export const METHOD_LABELS = {
  reference: 'Reference-match (accurate)',
  auto: 'Auto estimate (rough)',
  nudge: 'Manual nudge (rough)',
  preset: 'Device preset (rough)',
  null: 'Not calibrated'
};
