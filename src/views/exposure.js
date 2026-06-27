// Exposure view: a clear, plain-language daily-noise-dose readout.
// Display updates at most once per second so the numbers are readable, and the
// time-to-limit is projected from a smoothed average level (not the jittery
// instantaneous one). Educational only — not a compliance dosimeter.

import { el, card, notice, expander } from '../ui/components.js';
import { fmtCountdown, fmtDb } from '../utils/format.js';

export function exposureView(ctx) {
  const { store } = ctx;

  // Big plain-language status banner.
  const banner = el('div', { class: 'safety-banner' });
  const bannerTitle = el('div', { class: 'safety-title' }, '—');
  const bannerText = el('div', { class: 'safety-sub' }, 'Start the meter to track your noise exposure.');
  banner.append(bannerTitle, bannerText);

  // Primary: NIOSH daily dose (the protective public-health guideline).
  const dosePct = el('div', { class: 'dose-big' }, '0%');
  const fill = el('div', { class: 'dose-fill', style: 'width:0%' });
  const bar = el('div', { class: 'dose-bar dose-bar-lg' }, fill);
  const doseExplain = el('p', { class: 'muted', style: 'margin:8px 0 0' }, '—');

  // OSHA shown as a secondary line.
  const oshaLine = el('div', { class: 'muted' }, '—');

  const root = el('div', {}, [
    banner,
    card('Your daily noise dose', [
      el('div', { class: 'row row-between', style: 'align-items:baseline' }, [
        el('span', { class: 'muted' }, 'NIOSH recommended limit (85 dB / 8 h)'),
        dosePct
      ]),
      bar,
      doseExplain
    ]),
    card('What this means', [
      el(
        'p',
        { class: 'muted', style: 'margin-top:0' },
        'Your “dose” is how much of a safe day’s worth of noise you’ve taken in. ' +
          '100% is the most a typical day should include before noise can start to harm hearing. ' +
          'Louder sound uses up the dose much faster — every few dB roughly doubles the rate.'
      ),
      oshaLine,
      expander('How the limits work', [
        el(
          'p',
          { class: 'muted' },
          'NIOSH (public-health): 85 dB for 8 h = 100%, doubling every +3 dB. ' +
            'OSHA (US legal limit): 90 dB for 8 h = 100%, doubling every +5 dB. ' +
            'Dose only accrues while the meter runs.'
        )
      ])
    ]),
    notice(
      'Estimate for awareness only. SoundScope is not a certified dosimeter and depends on the ' +
        'app’s rough calibration, so treat these figures as a guide — not a compliance measurement.',
      'warn'
    )
  ]);

  // throttle the display
  let lastRender = 0;

  function update(s) {
    const now = performance.now();
    if (now - lastRender < 1000 && s.status === 'running') return;
    lastRender = now;

    const e = s.exposure;
    const running = s.status === 'running';
    const avg = e.avgLevel;

    // --- dose readout ---
    const d = Math.max(0, e.nioshDose);
    dosePct.textContent = d < 10 ? `${d.toFixed(1)}%` : `${Math.round(d)}%`;
    fill.style.width = `${Math.min(100, d)}%`;
    fill.classList.toggle('over', d >= 100);

    if (!running) {
      doseExplain.textContent = 'Not running. Start the meter to accumulate dose.';
    } else if (d >= 100) {
      doseExplain.textContent = '⚠ You have reached a full day’s safe dose. Give your ears a quiet break.';
    } else {
      doseExplain.textContent = `At your average (${fmtDb(avg, 0)} dB) you’d reach 100% in ${fmtCountdown(e.nioshTimeToLimit)}.`;
    }

    oshaLine.textContent = `OSHA legal limit: ${e.oshaDose < 10 ? e.oshaDose.toFixed(1) : Math.round(e.oshaDose)}% used` +
      (running && e.oshaDose < 100 ? ` · 100% in ${fmtCountdown(e.oshaTimeToLimit)}` : '');

    // --- plain-language safety banner (based on smoothed average) ---
    const status = safetyStatus(running ? avg : null);
    banner.dataset.level = status.key;
    bannerTitle.textContent = status.title;
    bannerText.textContent = status.text;
  }

  return { el: root, update, onStatus: update };
}

// Maps an average level to a plain-language hearing-safety message.
export function safetyStatus(level) {
  if (level == null || !Number.isFinite(level)) {
    return { key: 'idle', title: 'Not measuring', text: 'Start the meter to see your hearing-safety status.' };
  }
  if (level < 70) {
    return { key: 'safe', title: 'Safe for hearing', text: 'This level is comfortable — you can stay here all day.' };
  }
  if (level < 85) {
    return { key: 'moderate', title: 'Generally OK', text: 'Fine for long periods, but not silent. Keep an eye on long exposure.' };
  }
  if (level < 95) {
    return {
      key: 'loud',
      title: 'Loud — limit your time',
      text: 'At this level, hearing damage builds over hours. Take breaks or move away.'
    };
  }
  return {
    key: 'harmful',
    title: 'Harmful — protect your ears',
    text: 'Damage can occur in minutes. Use hearing protection or leave if you can.'
  };
}
