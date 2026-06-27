// Hearing screening view (AWARENESS ONLY — heavily disclaimed).

import { el, card, notice, slider, toast } from '../ui/components.js';
import { fmtFreq } from '../utils/format.js';
import { HearingScreen, SCREEN_FREQUENCIES } from '../features/hearing-screen.js';

export function hearingView() {
  const screen = new HearingScreen();
  let idx = -1;
  let testing = false;

  const grid = el('div', { class: 'freq-grid' });
  const cells = {};
  for (const f of SCREEN_FREQUENCIES) {
    const cell = el('div', { class: 'freq-cell', dataset: { freq: String(f) } }, [
      el('div', { class: 'stat-value', style: 'font-size:1rem' }, `${fmtFreq(f)}Hz`),
      el('div', { class: 'muted', style: 'font-size:.75rem' }, '—')
    ]);
    cells[f] = cell;
    grid.appendChild(cell);
  }

  const startBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Start screening');
  const heardBtn = el('button', { type: 'button', class: 'btn' }, 'I heard it');
  const notHeardBtn = el('button', { type: 'button', class: 'btn' }, 'I did not');
  const resetBtn = el('button', { type: 'button', class: 'btn' }, 'Reset');
  heardBtn.disabled = true;
  notHeardBtn.disabled = true;

  const levelSlider = slider({
    label: 'Tone level (relative, NOT calibrated dB HL)',
    min: 0.01,
    max: 0.6,
    step: 0.01,
    value: 0.15,
    onInput: (v) => screen.setLevel(v)
  });

  const progress = el('div', { class: 'muted' }, 'Not started.');

  function setCellState(f, cls, label) {
    const cell = cells[f];
    cell.classList.remove('heard', 'missed', 'testing');
    if (cls) cell.classList.add(cls);
    if (label != null) cell.querySelector('.muted').textContent = label;
  }

  async function next() {
    idx++;
    if (idx >= SCREEN_FREQUENCIES.length) return finish();
    const f = SCREEN_FREQUENCIES[idx];
    progress.textContent = `Playing ${fmtFreq(f)}Hz (${idx + 1}/${SCREEN_FREQUENCIES.length})…`;
    setCellState(f, 'testing', 'testing');
    heardBtn.disabled = true;
    notHeardBtn.disabled = true;
    await screen.playTone(f, 1500);
    heardBtn.disabled = false;
    notHeardBtn.disabled = false;
    progress.textContent = `Did you hear ${fmtFreq(f)}Hz? (${idx + 1}/${SCREEN_FREQUENCIES.length})`;
  }

  function answer(heard) {
    const f = SCREEN_FREQUENCIES[idx];
    if (f == null) return;
    screen.mark(f, heard);
    setCellState(f, heard ? 'heard' : 'missed', heard ? 'responded' : 'no response');
    heardBtn.disabled = true;
    notHeardBtn.disabled = true;
    next();
  }

  function finish() {
    testing = false;
    progress.textContent = 'Screening complete. This is awareness only — see an audiologist for a real test.';
    startBtn.textContent = 'Start again';
    startBtn.disabled = false;
    heardBtn.disabled = true;
    notHeardBtn.disabled = true;
    const heardCount = Object.values(screen.results).filter((r) => r.heard).length;
    toast(`You responded to ${heardCount} of ${SCREEN_FREQUENCIES.length} frequencies.`, 'info', 5000);
  }

  startBtn.addEventListener('click', () => {
    screen.reset();
    for (const f of SCREEN_FREQUENCIES) setCellState(f, null, '—');
    idx = -1;
    testing = true;
    startBtn.disabled = true;
    next();
  });
  heardBtn.addEventListener('click', () => answer(true));
  notHeardBtn.addEventListener('click', () => answer(false));
  resetBtn.addEventListener('click', () => {
    screen.stopTone();
    screen.reset();
    idx = -1;
    testing = false;
    for (const f of SCREEN_FREQUENCIES) setCellState(f, null, '—');
    startBtn.disabled = false;
    startBtn.textContent = 'Start screening';
    heardBtn.disabled = true;
    notHeardBtn.disabled = true;
    progress.textContent = 'Not started.';
  });

  const root = el('div', {}, [
    notice(
      'THIS IS NOT A HEARING TEST. It is not calibrated, not a diagnosis, and produces no medical ' +
        'dB HL thresholds. Phone/earphone output is uncalibrated, so results show only RELATIVE ' +
        'awareness — “you responded to these tones at the level you set.” If you have any concern ' +
        'about your hearing, see an audiologist for proper audiometry.',
      'danger'
    ),
    notice('For a more useful relative check: use headphones in a quiet room, set a comfortable low level, and don’t peek at the screen.', 'info'),
    card('Tone level', levelSlider),
    card('Screening', [
      progress,
      el('div', { class: 'row', style: 'margin:10px 0' }, [startBtn, heardBtn, notHeardBtn, resetBtn]),
      grid
    ])
  ]);

  return {
    el: root,
    unmount() {
      screen.dispose();
    }
  };
}
