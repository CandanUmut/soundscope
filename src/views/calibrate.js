// Calibration view: the three honest methods + the clearly-labelled self-test.

import { el, card, notice, slider, toast } from '../ui/components.js';
import { fmtDb, fmtDateTime } from '../utils/format.js';
import {
  DEVICE_PRESETS,
  METHOD_LABELS,
  calibrateReference,
  calibrateManual,
  calibratePreset
} from '../calibration/calibrate.js';
import { ToneGenerator } from '../calibration/tone-generator.js';

export function calibrateView(ctx) {
  const { store } = ctx;
  const tone = new ToneGenerator();

  // --- status line ---
  const statusLine = el('div', { class: 'muted' });

  // --- current live reading (raw dBFS + current SPL) ---
  const liveDbfs = el('strong', {}, '—');
  const liveSpl = el('strong', {}, '—');

  // --- method 1: reference match ---
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

  // --- method 2: manual nudge ---
  const nudge = slider({
    label: 'Manual offset (dB)',
    min: 60,
    max: 140,
    step: 0.5,
    value: store.get().calibration.offset,
    onInput: (v) => calibrateManual(v)
  });

  // --- method 3: device presets ---
  const presetSelect = el('select', { class: 'select' });
  presetSelect.appendChild(el('option', { value: '' }, 'Choose a rough starting point…'));
  for (const p of DEVICE_PRESETS) presetSelect.appendChild(el('option', { value: p.id }, `${p.label} (~${p.offset})`));
  presetSelect.addEventListener('change', () => {
    if (!presetSelect.value) return;
    calibratePreset(presetSelect.value);
    toast('Applied a rough preset. Calibrate properly for real use.', 'warn');
  });

  // --- self-test ---
  const toneBtn = el('button', { type: 'button', class: 'btn' }, 'Play 1 kHz tone');
  const pinkBtn = el('button', { type: 'button', class: 'btn' }, 'Play pink noise');
  const stopBtn = el('button', { type: 'button', class: 'btn btn-danger' }, 'Stop');
  toneBtn.addEventListener('click', async () => {
    await tone.playTone();
    toast('Self-test tone playing — watch the meter respond. This does NOT set accuracy.', 'info', 5000);
  });
  pinkBtn.addEventListener('click', async () => {
    await tone.playPinkNoise();
    toast('Pink noise playing — relative input check only.', 'info', 5000);
  });
  stopBtn.addEventListener('click', () => tone.stop());

  const root = el('div', {}, [
    notice(
      'A browser cannot measure absolute sound level without an external reference. ' +
        'Even after good calibration, expect ±2–5 dB, and readings are reliable only roughly ' +
        'in the 30–90 dB range. This is not a certified instrument.',
      'danger'
    ),
    card('Current calibration', [
      statusLine,
      el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('span', { class: 'muted' }, ['Live raw: ', liveDbfs, ' dBFS']),
        el('span', { class: 'muted' }, ['Live SPL: ', liveSpl, ' dB'])
      ])
    ]),
    card('1 · Reference match (recommended, accurate)', [
      el(
        'p',
        { class: 'muted' },
        'Expose the mic to a known level — from a calibrated SPL meter beside your phone, ' +
          'or a 94 dB / 1 kHz acoustic calibrator — then enter that value while the meter runs.'
      ),
      el('label', { class: 'field-label' }, 'Known level (dB SPL)'),
      knownInput,
      el('div', { style: 'margin-top:10px' }, refBtn)
    ]),
    card('2 · Manual nudge (rough)', [
      el('p', { class: 'muted' }, 'Drag until the reading looks plausible for your environment. Saved automatically.'),
      nudge
    ]),
    card('3 · Device preset (rough starting point)', [
      el(
        'p',
        { class: 'muted' },
        'Approximate offsets for common phones — a starting point only. Calibrate properly for real use.'
      ),
      presetSelect
    ]),
    card('Self-test (relative only — NOT calibration)', [
      notice(
        'Playing a tone through this phone’s speaker and measuring it with the same phone’s mic ' +
          'only reveals the speaker→mic loopback gain. It does NOT establish room loudness and ' +
          'CANNOT set absolute accuracy. Use it to confirm the input path responds.',
        'warn'
      ),
      el('div', { class: 'row' }, [toneBtn, pinkBtn, stopBtn])
    ])
  ]);

  function update(s) {
    const cal = s.calibration;
    statusLine.innerHTML = '';
    statusLine.append(
      `Offset: ${cal.offset.toFixed(1)} dB · Method: ${METHOD_LABELS[cal.method] || METHOD_LABELS.null} · ` +
        `Last set: ${fmtDateTime(cal.lastCalibrated)}`
    );
    liveDbfs.textContent = fmtDb(s.dbfs);
    liveSpl.textContent = s.status === 'running' ? fmtDb(s.spl) : '—';
  }

  return {
    el: root,
    update,
    unmount() {
      tone.dispose();
    }
  };
}
