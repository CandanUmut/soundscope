// Tiny observable store. No framework — just get/set/subscribe with
// shallow-merge updates and topic-scoped subscriptions.

const SETTINGS_KEY = 'soundscope.settings.v1';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const savedSettings = loadSettings();

const initial = {
  // engine status: 'idle' | 'starting' | 'running' | 'error'
  status: 'idle',
  error: null,
  permission: 'unknown', // 'unknown' | 'granted' | 'denied'

  // constraint honoring (AGC etc.)
  constraintWarning: null,

  // live level stream (updated ~20Hz from the worklet)
  spl: null, // displayed SPL (dBFS + offset), weighting/time-weighting applied
  splFast: null,
  splSlow: null,
  peak: null,
  dbfs: null, // raw, pre-offset (for calibration)
  nearLimit: false,

  // session metrics
  metrics: {
    leq: null,
    lmax: null,
    lmin: null,
    l10: null,
    l50: null,
    l90: null,
    elapsedMs: 0
  },

  // exposure
  exposure: { oshaDose: 0, oshaTimeToLimit: Infinity, nioshDose: 0, nioshTimeToLimit: Infinity },

  // user settings (persisted)
  weighting: savedSettings.weighting || 'A', // 'A' | 'C' | 'Z'
  timeWeighting: savedSettings.timeWeighting || 'fast', // 'fast' | 'slow'
  calibration: savedSettings.calibration || { offset: 130, lastCalibrated: null, method: null },
  alertThreshold: savedSettings.alertThreshold ?? 85,
  theme: savedSettings.theme || 'dark',
  bigText: savedSettings.bigText || false,

  // ui
  view: 'meter'
};

// Which keys are persisted to localStorage.
const PERSIST_KEYS = ['weighting', 'timeWeighting', 'calibration', 'alertThreshold', 'theme', 'bigText'];

let state = { ...initial };
const subs = new Set();

function persist() {
  const out = {};
  for (const k of PERSIST_KEYS) out[k] = state[k];
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(out));
  } catch {
    /* storage may be unavailable in private mode; ignore */
  }
}

export const store = {
  get() {
    return state;
  },
  /** Shallow-merge a patch and notify subscribers. */
  set(patch) {
    const prev = state;
    state = { ...state, ...patch };
    let persistNeeded = false;
    for (const k of PERSIST_KEYS) {
      if (k in patch && patch[k] !== prev[k]) persistNeeded = true;
    }
    if (persistNeeded) persist();
    for (const fn of subs) fn(state, prev);
  },
  /** Subscribe to all changes. Returns an unsubscribe function. */
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }
};
