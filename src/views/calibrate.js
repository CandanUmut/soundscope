// Calibration view. Simplified: one big "Quick calibrate" flow (automatic,
// equipment-free) up top, everything else tucked into an Advanced expander.

import { el, card, notice, slider, expander, toast } from '../ui/components.js';
import { fmtDb, fmtDateTime } from '../utils/format.js';
import {
  DEVICE_PRESETS,
  METHOD_LABELS,
  calibrateReference,
  calibrateManual,
  calibrateAuto,
  calibratePreset
} from '../calibration/calibrate.js';
import { ToneGenerator } from '../calibration/tone-generator.js';
import { runAutoCalibration } from '../calibration/auto-calibrate.js';

export function calibrateView(ctx) {
  const { store } = ctx;
  const tone = new ToneGenerator();
  let running = false;

  // ---- status line (compact) ----
  const statusLine = el('div', { class: 'muted', style: 'font-size:.85rem' });

  // ---- quick auto-calibrate ----
  const autoBtn = el('button', { type: 'button', class: 'btn btn-primary btn-lg' }, '✨ Auto-calibrate');
  const progress = el('div', { class: 'cal-progress', hidden: 'true' });
  const fineWrap = el('div', { hidden: 'true' });
  const fineNudge = slider({
    label: 'Fine-tune (±dB)',
    min: -15,
    max: 15,
    step: 0.5,
    value: 0,
    unit: ' dB',
    onInput: (delta) => {
      if (autoBaseOffset != null) calibrateManualKeepAuto(autoBaseOffset + delta);
    }
  });
  fineWrap.appendChild(el('p', { class: 'muted', style: 'font-size:.85rem;margin:6px 0' }, 'Nudge if it reads a bit high or low compared to what you’d expect.'));
  fineWrap.appendChild(fineNudge);

  let autoBaseOffset = null;
  function calibrateManualKeepAuto(offset) {
    // keep showing as auto-derived but persist the nudged value
    calibrateAuto(Number(offset.toFixed(2)));
  }

  autoBtn.addEventListener('click', runAuto);

  async function runAuto() {
    if (running) return;
    running = true;
    autoBtn.disabled = true;
    fineWrap.hidden = true;
    progress.hidden = false;
    progress.textContent = 'Starting…';

    try {
      // Need the mic open. Starting here keeps us inside the user gesture (iOS).
      if (store.get().status !== 'running') {
        progress.textContent = 'Turning on the microphone…';
        await ctx.startEngine();
        await wait(400);
      }
      if (store.get().status !== 'running') {
        throw new Error('Microphone is needed for calibration. Please allow mic access.');
      }

      const result = await runAutoCalibration({
        tone,
        getDbfs: () => store.get().dbfs,
        onStep: (s) => {
          progress.textContent = s.label || '';
        }
      });

      autoBaseOffset = result.offset;
      calibrateAuto(Number(result.offset.toFixed(2)));
      progress.hidden = true;
      fineWrap.hidden = false;
      // reset the fine slider to 0 around the new base
      const slot = fineNudge.querySelector('input');
      if (slot) {
        slot.value = '0';
        fineNudge.querySelector('output').textContent = '0 dB';
      }
      toast(`Auto-calibrated (estimate). Offset ${result.offset.toFixed(1)} dB from ${result.used} tones.`, 'success', 5000);
    } catch (err) {
      progress.hidden = true;
      toast(err.message, err.code === 'low_snr' ? 'warn' : 'danger', 6000);
    } finally {
      running = false;
      autoBtn.disabled = false;
    }
  }

  // ---- advanced: reference, preset, self-test ----
  const knownInput = el('input', {
    type: 'number',
    class: 'text-input',
    placeholder: 'e.g. 74.0',
    step: '0.1',
    inputmode: 'decimal'
  });
  const refBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Set offset from reference');
  refBtn.addEventListener('click', () => {
    const known = parseFloat(knownInput.value);
    const cur = store.get().dbfs;
    if (!Number.isFinite(known)) return toast('Enter the known SPL from your reference.', 'warn');
    if (store.get().status !== 'running' || !Number.isFinite(cur)) {
      return toast('Start the meter first so there is a live reading to match.', 'warn');
    }
    try {
      calibrateReference(known, cur);
      toast('Calibrated against your reference. Expect ±2–5 dB.', 'success');
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  const presetSelect = el('select', { class: 'select' });
  presetSelect.appendChild(el('option', { value: '' }, 'Choose a rough starting point…'));
  for (const p of DEVICE_PRESETS) presetSelect.appendChild(el('option', { value: p.id }, `${p.label} (~${p.offset})`));
  presetSelect.addEventListener('change', () => {
    if (!presetSelect.value) return;
    calibratePreset(presetSelect.value);
    toast('Applied a rough preset.', 'warn');
  });

  const manualNudge = slider({
    label: 'Manual offset',
    min: 60,
    max: 140,
    step: 0.5,
    value: store.get().calibration.offset,
    unit: ' dB',
    onInput: (v) => calibrateManual(v)
  });

  const toneBtn = el('button', { type: 'button', class: 'btn' }, 'Play 1 kHz tone');
  const pinkBtn = el('button', { type: 'button', class: 'btn' }, 'Play pink noise');
  const stopBtn = el('button', { type: 'button', class: 'btn btn-danger' }, 'Stop');
  toneBtn.addEventListener('click', () => tone.playTone());
  pinkBtn.addEventListener('click', () => tone.playPinkNoise());
  stopBtn.addEventListener('click', () => tone.stop());

  const advanced = expander('Advanced calibration & self-test', [
    el('h3', { class: 'sub' }, 'Reference match (most accurate)'),
    el('p', { class: 'muted' }, 'If you have a calibrated SPL meter or a 94 dB / 1 kHz calibrator: run the meter, then enter the known level.'),
    el('label', { class: 'field-label' }, 'Known level (dB SPL)'),
    knownInput,
    el('div', { style: 'margin:8px 0 16px' }, refBtn),

    el('h3', { class: 'sub' }, 'Device preset'),
    presetSelect,

    el('h3', { class: 'sub', style: 'margin-top:16px' }, 'Manual offset'),
    manualNudge,

    el('h3', { class: 'sub', style: 'margin-top:16px' }, 'Self-test (relative only)'),
    notice(
      'A speaker→mic test only checks that the input responds. It cannot set absolute accuracy.',
      'warn'
    ),
    el('div', { class: 'row' }, [toneBtn, pinkBtn, stopBtn])
  ]);

  const root = el('div', {}, [
    notice(
      'Phones can’t measure true sound level without a reference, so calibration is an estimate ' +
        '(±2–5 dB at best; auto-calibrate is rougher). Reliable roughly 30–90 dB. Not a certified meter.',
      'info'
    ),
    card('Quick calibrate', [
      el('p', { class: 'muted', style: 'margin-top:0' }, 'Turn your volume up, put the phone on a desk in a quiet room, and tap. It plays a few test tones and sets your calibration automatically — no equipment or numbers needed.'),
      el('div', { class: 'row' }, [autoBtn]),
      progress,
      fineWrap,
      el('hr', { class: 'rule' }),
      statusLine
    ]),
    advanced
  ]);

  function update(s) {
    const cal = s.calibration;
    statusLine.textContent =
      `Current offset ${cal.offset.toFixed(1)} dB · ${METHOD_LABELS[cal.method] || METHOD_LABELS.null} · ` +
      `set ${fmtDateTime(cal.lastCalibrated)}`;
    // keep advanced manual slider roughly synced
  }

  return {
    el: root,
    update,
    unmount() {
      tone.dispose();
    }
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
