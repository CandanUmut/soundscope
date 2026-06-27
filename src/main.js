// SoundScope bootstrap: wire UI to the audio engine, route views, run the
// live update loop. Everything is on-device.

import './styles/app.css';
import { store } from './store/state.js';
import { AudioEngine, EngineError } from './audio/engine.js';
import { MetricsAccumulator } from './audio/metrics.js';
import { ExposureAccumulator } from './features/exposure.js';
import { ThresholdAlerter } from './features/alerts.js';
import { dbfs } from './utils/dsp.js';
import { getOffset } from './calibration/calibrate.js';
import { el, toast } from './ui/components.js';
import { Gauge } from './ui/gauge.js';
import { Timeline } from './ui/timeline.js';
import { views } from './views/index.js';

// ---------- shared singletons ----------
const engine = new AudioEngine();
const metrics = new MetricsAccumulator();
const exposure = new ExposureAccumulator();
const gauge = new Gauge();
const timeline = new Timeline();

let alertFlashEl = null;
const alerter = new ThresholdAlerter({
  onFlash: (on) => {
    if (!alertFlashEl) {
      alertFlashEl = el('div', { class: 'alert-flash', 'aria-hidden': 'true' });
      document.body.appendChild(alertFlashEl);
    }
    alertFlashEl.classList.toggle('is-on', on);
  }
});

// session sample buffer (downsampled) used when saving a session
let sessionSamples = [];
let sessionStartedAt = null;
let lastExposureTs = null;
let lastTimelineTs = 0;

// shared context passed to views
const ctx = {
  engine,
  metrics,
  exposure,
  gauge,
  timeline,
  alerter,
  store,
  startEngine, // must be called from a user gesture
  stopEngine,
  resetSession,
  getSessionData
};

// ---------- engine lifecycle ----------
async function startEngine() {
  if (store.get().status === 'running' || store.get().status === 'starting') return;
  store.set({ status: 'starting', error: null });
  try {
    resetSession();
    const { constraintWarning } = await engine.start({
      weighting: store.get().weighting,
      onLevel: handleLevel
    });
    sessionStartedAt = Date.now();
    store.set({
      status: 'running',
      permission: 'granted',
      constraintWarning: constraintWarning || null
    });
    if (constraintWarning) toast(constraintWarning, 'warn', 6000);
  } catch (err) {
    const message = err instanceof EngineError ? err.message : `Could not start: ${err?.message || err}`;
    store.set({
      status: 'error',
      error: message,
      permission: err?.code === 'denied' ? 'denied' : store.get().permission
    });
    toast(message, 'danger', 6000);
  }
}

async function stopEngine() {
  alerter.setEnabled(alerter.enabled); // keep setting but clear flash
  alertFlashEl?.classList.remove('is-on');
  await engine.stop();
  store.set({ status: 'idle' });
}

function resetSession() {
  metrics.reset();
  exposure.reset();
  timeline.reset();
  sessionSamples = [];
  sessionStartedAt = Date.now();
  lastExposureTs = null;
  lastTimelineTs = 0;
  engine.resetMetrics();
  store.set({ metrics: metrics.snapshot(), exposure: exposure.snapshot() });
}

function getSessionData() {
  return {
    startedAt: sessionStartedAt,
    endedAt: Date.now(),
    weighting: store.get().weighting,
    timeWeighting: store.get().timeWeighting,
    calibration: { ...store.get().calibration },
    metrics: metrics.snapshot(),
    samples: sessionSamples.slice()
  };
}

// ---------- the level stream handler (~20 Hz from the worklet) ----------
function handleLevel({ rmsFast, rmsSlow, peak }) {
  const offset = getOffset();
  const dbfsFast = dbfs(rmsFast);
  const dbfsSlow = dbfs(rmsSlow);
  const slow = store.get().timeWeighting === 'slow';
  const rawDbfs = slow ? dbfsSlow : dbfsFast;
  const splFast = dbfsFast + offset;
  const splSlow = dbfsSlow + offset;
  const peakSpl = dbfs(peak) + offset;
  const displaySpl = slow ? splSlow : splFast;

  const now = performance.now();
  // Metrics + dose always use Fast for consistency with survey conventions.
  metrics.add(splFast, now);
  if (lastExposureTs !== null) exposure.add(splFast, (now - lastExposureTs) / 1000);
  lastExposureTs = now;

  alerter.update(displaySpl);

  if (now - lastTimelineTs > 500) {
    lastTimelineTs = now;
    const t = metrics.elapsedMs;
    timeline.push(t, splFast);
    timeline.setLeq(metrics.leq);
    sessionSamples.push({ t, level: Number(splFast.toFixed(2)) });
  }

  store.set({
    dbfs: rawDbfs,
    spl: displaySpl,
    splFast,
    splSlow,
    peak: peakSpl,
    nearLimit: displaySpl > 95,
    metrics: metrics.snapshot(),
    exposure: exposure.snapshot()
  });
}

// ---------- routing ----------
const TABS = [
  { id: 'meter', label: 'Meter' },
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'calibrate', label: 'Calibrate' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'map', label: 'Noise Map' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'captions', label: 'Captions' },
  { id: 'hearing', label: 'Hearing' },
  { id: 'assist', label: 'Listen' },
  { id: 'about', label: 'About' }
];

const viewRoot = document.getElementById('view-root');
const tabbar = document.getElementById('tabbar');
let activeView = null;
let activeId = null;

function renderTabs() {
  tabbar.innerHTML = '';
  for (const tab of TABS) {
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'tab' + (tab.id === activeId ? ' is-active' : ''),
        onClick: () => navigate(tab.id)
      },
      tab.label
    );
    tabbar.appendChild(btn);
  }
}

function navigate(id) {
  if (id === activeId) return;
  if (activeView?.unmount) activeView.unmount();
  activeId = id;
  store.set({ view: id });
  const factory = views[id] || views.meter;
  activeView = factory(ctx);
  viewRoot.innerHTML = '';
  viewRoot.appendChild(activeView.el);
  activeView.mount?.();
  activeView.update?.(store.get());
  renderTabs();
  viewRoot.focus();
}

// ---------- store subscription: theme, bigtext, live updates ----------
function applyChrome(state) {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.bigtext = String(state.bigText);
  const bt = document.getElementById('bigtext-toggle');
  if (bt) bt.setAttribute('aria-pressed', String(state.bigText));
}

let lastStatus = null;
store.subscribe((state, prev) => {
  if (state.theme !== prev.theme || state.bigText !== prev.bigText) applyChrome(state);
  // Re-render the active view on structural status changes.
  if (state.status !== lastStatus) {
    lastStatus = state.status;
    activeView?.onStatus?.(state);
  }
  // Live, cheap updates every tick.
  activeView?.update?.(state);
});

// ---------- header controls ----------
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  store.set({ theme: store.get().theme === 'dark' ? 'light' : 'dark' });
});
document.getElementById('bigtext-toggle')?.addEventListener('click', () => {
  store.set({ bigText: !store.get().bigText });
});

// Stop the engine when the page is hidden for a long time? Keep running so
// background measurement continues; just release on unload.
window.addEventListener('pagehide', () => {
  engine.stop();
});

// ---------- service worker ----------
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is best-effort */
    });
  });
}

// ---------- boot ----------
applyChrome(store.get());
renderTabs();
navigate('meter');
