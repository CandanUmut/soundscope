// Alerts view: configure the over-threshold visual flash + haptic alert.

import { el, card, notice, slider } from '../ui/components.js';
import { fmtDb } from '../utils/format.js';

export function alertsView(ctx) {
  const { store, alerter } = ctx;

  // sync alerter with persisted threshold
  alerter.setThreshold(store.get().alertThreshold);

  const enableToggle = el('input', { type: 'checkbox' });
  enableToggle.checked = alerter.enabled;
  enableToggle.addEventListener('change', () => alerter.setEnabled(enableToggle.checked));

  const thresh = slider({
    label: 'Alert when level exceeds',
    min: 40,
    max: 110,
    step: 1,
    value: store.get().alertThreshold,
    unit: ' dB',
    onInput: (v) => {
      store.set({ alertThreshold: v });
      alerter.setThreshold(v);
    }
  });

  const liveEl = el('strong', {}, '—');
  const stateEl = el('span', { class: 'muted' }, 'Idle');

  const root = el('div', {}, [
    notice(
      'When the ambient level crosses your threshold, the screen flashes and the device vibrates ' +
        '(where supported). Useful for protecting residual hearing and for people who cannot hear ' +
        'warning sounds. The meter must be running.',
      'info'
    ),
    card('Threshold alert', [
      el('label', { class: 'row', style: 'gap:8px' }, [enableToggle, el('span', {}, 'Enable alerts')]),
      thresh
    ]),
    card('Live', [
      el('div', { class: 'row row-between' }, [
        el('span', {}, ['Current: ', liveEl, ' dB']),
        stateEl
      ])
    ])
  ]);

  function update(s) {
    liveEl.textContent = s.status === 'running' ? fmtDb(s.spl, 0) : '—';
    const over = alerter.enabled && s.status === 'running' && Number.isFinite(s.spl) && s.spl >= alerter.threshold;
    stateEl.textContent = !alerter.enabled
      ? 'Alerts off'
      : s.status !== 'running'
        ? 'Meter not running'
        : over
          ? '⚠ Over threshold'
          : 'Below threshold';
    stateEl.style.color = over ? 'var(--danger)' : '';
  }

  return { el: root, update };
}
