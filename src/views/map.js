// Noise map view: consent-gated geotagged Leq logging, GeoJSON + CSV export.

import { el, card, notice, toast, downloadFile } from '../ui/components.js';
import { fmtDb, fmtFileStamp } from '../utils/format.js';
import { NoiseMapLogger } from '../features/noise-map.js';

export function mapView(ctx) {
  const { store } = ctx;
  const logger = new NoiseMapLogger();
  let autoTimer = null;

  const countEl = el('strong', {}, '0');
  const lastEl = el('span', { class: 'muted' }, 'No points yet.');

  const consent = el('input', { type: 'checkbox', id: 'geo-consent' });
  const startBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Start location logging');
  const stopBtn = el('button', { type: 'button', class: 'btn btn-danger' }, 'Stop');
  const markBtn = el('button', { type: 'button', class: 'btn' }, 'Log a point here');
  const geojsonBtn = el('button', { type: 'button', class: 'btn' }, 'Export GeoJSON');
  const csvBtn = el('button', { type: 'button', class: 'btn' }, 'Export CSV');
  const clearBtn = el('button', { type: 'button', class: 'btn' }, 'Clear');
  stopBtn.disabled = true;
  markBtn.disabled = true;

  function refreshCount() {
    countEl.textContent = String(logger.points.length);
    const last = logger.points[logger.points.length - 1];
    lastEl.textContent = last
      ? `Last: ${last.lat.toFixed(5)}, ${last.lon.toFixed(5)} · ${fmtDb(last.leq)} dB`
      : 'No points yet.';
  }

  function curLeq() {
    return store.get().metrics.leq;
  }

  startBtn.addEventListener('click', async () => {
    if (!consent.checked) return toast('Please tick the consent box first.', 'warn');
    try {
      await logger.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      markBtn.disabled = false;
      toast('Location logging on. Coordinates stay on your device.', 'success');
      // auto-log every 10s while running
      autoTimer = setInterval(() => {
        if (store.get().status === 'running') {
          if (logger.record(curLeq())) refreshCount();
        }
      }, 10000);
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  stopBtn.addEventListener('click', () => {
    logger.stop();
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    markBtn.disabled = true;
  });

  markBtn.addEventListener('click', () => {
    if (logger.record(curLeq())) {
      refreshCount();
      toast('Point logged.', 'info', 1500);
    } else {
      toast('No location fix yet.', 'warn');
    }
  });

  geojsonBtn.addEventListener('click', () => {
    if (!logger.points.length) return toast('No points to export.', 'warn');
    downloadFile(`soundscope-noise-${fmtFileStamp()}.geojson`, JSON.stringify(logger.toGeoJson(), null, 2), 'application/geo+json');
  });
  csvBtn.addEventListener('click', () => {
    if (!logger.points.length) return toast('No points to export.', 'warn');
    downloadFile(`soundscope-noise-${fmtFileStamp()}.csv`, logger.toCsv(), 'text/csv');
  });
  clearBtn.addEventListener('click', () => {
    logger.clear();
    refreshCount();
  });

  const root = el('div', {}, [
    notice(
      'Privacy: location logging is OFF until you opt in. Coordinates and levels are stored ' +
        'only in memory on this device and exported to a file you own. There is no server and ' +
        'nothing is uploaded.',
      'info'
    ),
    card('Consent & logging', [
      el('label', { class: 'row', style: 'gap:8px;align-items:flex-start' }, [
        consent,
        el('span', {}, 'I consent to using my device location to geotag noise samples on-device.')
      ]),
      el('div', { class: 'row', style: 'margin-top:10px' }, [startBtn, stopBtn, markBtn])
    ]),
    card('Logged points', [
      el('div', { class: 'row row-between' }, [el('span', {}, ['Points: ', countEl]), lastEl]),
      el('div', { class: 'row', style: 'margin-top:10px' }, [geojsonBtn, csvBtn, clearBtn])
    ]),
    notice('Tip: run the meter while logging so each point captures the current Leq.', 'info')
  ]);

  return {
    el: root,
    mount() {
      refreshCount();
    },
    unmount() {
      logger.stop();
      if (autoTimer) clearInterval(autoTimer);
    }
  };
}
