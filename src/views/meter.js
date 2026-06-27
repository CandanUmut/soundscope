// Live meter view: big SPL number, color-zoned gauge, Fast/Slow + weighting
// toggles, session stats, and a live timeline chart.

import { el, card, notice, segmented } from '../ui/components.js';
import { fmtDb, fmtDuration } from '../utils/format.js';
import { WEIGHTING_LABELS } from '../audio/weighting.js';
import { isCalibrated } from '../calibration/calibrate.js';
import { zoneForLevel } from '../ui/gauge.js';

export function meterView(ctx) {
  const { store, gauge, timeline } = ctx;
  const state = store.get();

  // --- readout block ---
  const numberEl = el('span', { class: 'level-number' }, '—');
  const unitEl = el('span', { class: 'level-unit' }, weightLabel(state));
  const readout = el('div', { class: 'level-readout' }, [numberEl, ' ', unitEl]);

  const badgeRow = el('div', { class: 'badge-row' });

  // --- controls ---
  const weightSeg = segmented(
    [
      { value: 'A', label: 'A' },
      { value: 'C', label: 'C' },
      { value: 'Z', label: 'Z' }
    ],
    state.weighting,
    (v) => {
      store.set({ weighting: v });
      ctx.engine.setWeighting(v);
    },
    'Frequency weighting'
  );

  const timeSeg = segmented(
    [
      { value: 'fast', label: 'Fast' },
      { value: 'slow', label: 'Slow' }
    ],
    state.timeWeighting,
    (v) => store.set({ timeWeighting: v }),
    'Time weighting'
  );

  const startBtn = el('button', { type: 'button', class: 'btn btn-primary btn-lg' }, 'Start');
  const resetBtn = el('button', { type: 'button', class: 'btn' }, 'Reset session');
  startBtn.addEventListener('click', onStartStop);
  resetBtn.addEventListener('click', () => ctx.resetSession());

  function onStartStop() {
    const s = store.get().status;
    if (s === 'running' || s === 'starting') ctx.stopEngine();
    else ctx.startEngine(); // inside the user gesture (iOS requirement)
  }

  const controls = el('div', { class: 'controls-row' }, [startBtn, resetBtn]);

  // --- stats grid ---
  const stats = {
    leq: statCell('Leq'),
    lmax: statCell('Lmax'),
    lmin: statCell('Lmin'),
    l10: statCell('L10'),
    l50: statCell('L50'),
    l90: statCell('L90'),
    elapsed: statCell('Elapsed')
  };
  const statGrid = el('div', { class: 'stat-grid' }, Object.values(stats).map((s) => s.cell));

  // --- timeline ---
  const timelineWrap = el('div', {}, timeline.element);

  const calNote = isCalibrated()
    ? null
    : notice(
        'Uncalibrated — readings and zone colors are only meaningful after you calibrate. ' +
          'See the Calibrate tab.',
        'warn'
      );

  const root = el('div', {}, [
    card(null, [
      el('div', { class: 'meter-main' }, [gauge.element, readout, badgeRow]),
      el('div', { class: 'controls-row' }, [
        labelled('Weighting', weightSeg),
        labelled('Response', timeSeg)
      ]),
      controls
    ]),
    calNote,
    card('Session statistics (dB)', statGrid),
    card('Level over time', timelineWrap)
  ]);

  function update(s) {
    unitEl.textContent = weightLabel(s);
    const v = s.spl;
    numberEl.textContent = s.status === 'running' ? fmtDb(v, 0) : '—';
    gauge.set(s.status === 'running' ? v : null);

    // badges
    badgeRow.innerHTML = '';
    badgeRow.appendChild(badge(`${WEIGHTING_LABELS[s.weighting]} ${s.timeWeighting === 'slow' ? 'Slow' : 'Fast'}`));
    if (s.status === 'running' && Number.isFinite(v)) {
      const zone = zoneForLevel(v);
      if (zone) badgeRow.appendChild(badge(zone, zone === 'harmful' ? 'danger' : zone === 'loud' ? 'warn' : ''));
    }
    if (s.nearLimit && s.status === 'running') {
      badgeRow.appendChild(badge('near sensor limit (>95 dB)', 'danger'));
    }
    if (s.peak != null && s.status === 'running') {
      badgeRow.appendChild(badge(`peak ${fmtDb(s.peak, 0)}`));
    }

    const m = s.metrics;
    stats.leq.value.textContent = fmtDb(m.leq);
    stats.lmax.value.textContent = fmtDb(m.lmax);
    stats.lmin.value.textContent = fmtDb(m.lmin);
    stats.l10.value.textContent = fmtDb(m.l10, 0);
    stats.l50.value.textContent = fmtDb(m.l50, 0);
    stats.l90.value.textContent = fmtDb(m.l90, 0);
    stats.elapsed.value.textContent = fmtDuration(m.elapsedMs);
  }

  function onStatus(s) {
    const running = s.status === 'running' || s.status === 'starting';
    startBtn.textContent = s.status === 'starting' ? 'Starting…' : running ? 'Stop' : 'Start';
    startBtn.classList.toggle('btn-danger', running);
    startBtn.classList.toggle('btn-primary', !running);
    resetBtn.disabled = !running;
  }

  return {
    el: root,
    mount() {
      timeline.mount();
      onStatus(store.get());
    },
    unmount() {
      timeline.unmount();
    },
    update,
    onStatus
  };
}

function weightLabel(s) {
  return `${WEIGHTING_LABELS[s.weighting]} · ${s.timeWeighting === 'slow' ? 'Slow' : 'Fast'}`;
}

function statCell(label) {
  const value = el('span', { class: 'stat-value' }, '—');
  const cell = el('div', { class: 'stat' }, [el('span', { class: 'stat-label' }, label), value]);
  return { cell, value };
}

function badge(text, variant = '') {
  return el('span', { class: `badge ${variant}` }, text);
}

function labelled(label, node) {
  return el('div', { class: 'row', style: 'flex-direction:column;align-items:flex-start;gap:4px' }, [
    el('span', { class: 'stat-label' }, label),
    node
  ]);
}
