// Exposure view: OSHA PEL and NIOSH REL running dose + projected time to 100%.
// Educational framing only — not a compliance instrument.

import { el, card, notice } from '../ui/components.js';
import { fmtCountdown } from '../utils/format.js';

export function exposureView(ctx) {
  const { store } = ctx;

  const osha = doseBlock('OSHA PEL', '90 dBA criterion · 5 dB exchange · 8 h');
  const niosh = doseBlock('NIOSH REL', '85 dBA criterion · 3 dB exchange · 8 h');

  const root = el('div', {}, [
    notice(
      'Educational estimate only. SoundScope is not a certified dosimeter and these figures ' +
        'depend on the app’s uncertain calibration (±2–5 dB). Do not use for compliance.',
      'warn'
    ),
    card('OSHA permissible exposure', osha.el),
    card('NIOSH recommended exposure', niosh.el),
    notice(
      'Dose accumulates only while the meter is running. NIOSH is the more protective ' +
        'public-health guideline; OSHA is the US occupational legal limit.',
      'info'
    )
  ]);

  function update(s) {
    const e = s.exposure;
    osha.set(e.oshaDose, e.oshaTimeToLimit);
    niosh.set(e.nioshDose, e.nioshTimeToLimit);
  }

  return { el: root, update };
}

function doseBlock(title, sub) {
  const pct = el('div', { class: 'stat-value' }, '0%');
  const fill = el('div', { class: 'dose-fill', style: 'width:0%' });
  const bar = el('div', { class: 'dose-bar' }, fill);
  const ttl = el('div', { class: 'muted' }, 'Time to 100%: —');
  const wrap = el('div', {}, [
    el('div', { class: 'row row-between' }, [el('strong', {}, title), pct]),
    el('div', { class: 'muted', style: 'font-size:.82rem;margin-bottom:6px' }, sub),
    bar,
    ttl
  ]);
  return {
    el: wrap,
    set(dose, timeToLimit) {
      const d = Math.max(0, dose);
      pct.textContent = `${d < 10 ? d.toFixed(1) : Math.round(d)}%`;
      fill.style.width = `${Math.min(100, d)}%`;
      fill.classList.toggle('over', d >= 100);
      ttl.textContent =
        d >= 100
          ? '⚠ 100% reached at current rate'
          : `Time to 100% at current level: ${fmtCountdown(timeToLimit)}`;
    }
  };
}
