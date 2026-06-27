// Assist / live-listen view: amplify + EQ ambient sound to earphones.
// Gain-capped, conservative defaults. Not a medical hearing aid.

import { el, card, notice, slider, toast } from '../ui/components.js';
import { AssistEngine } from '../features/assist.js';

export function assistView() {
  const assist = new AssistEngine();

  const startBtn = el('button', { type: 'button', class: 'btn btn-primary btn-lg' }, 'Start listening');

  const gainSlider = slider({
    label: 'Amplification',
    min: 0,
    max: assist.maxGain,
    step: 0.5,
    value: 2,
    unit: '×',
    onInput: (v) => assist.setGain(v)
  });
  const bassSlider = slider({
    label: 'Bass',
    min: -12,
    max: 12,
    step: 1,
    value: 0,
    unit: ' dB',
    onInput: (v) => assist.setBass(v)
  });
  const trebleSlider = slider({
    label: 'Treble',
    min: -12,
    max: 12,
    step: 1,
    value: 0,
    unit: ' dB',
    onInput: (v) => assist.setTreble(v)
  });

  startBtn.addEventListener('click', async () => {
    if (assist.isRunning) {
      await assist.stop();
      startBtn.textContent = 'Start listening';
      startBtn.classList.replace('btn-danger', 'btn-primary');
      return;
    }
    try {
      await assist.start({ gain: 2 }); // conservative default; never auto-max
      startBtn.textContent = 'Stop listening';
      startBtn.classList.replace('btn-primary', 'btn-danger');
      toast('Listening. Use earphones to avoid feedback, and raise volume slowly.', 'warn', 5000);
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  const root = el('div', {}, [
    notice(
      'Safety: use EARPHONES — using the speaker will cause loud feedback howl. Output gain is ' +
        'hard-capped and limited, but start quiet and raise slowly. This is a convenience aid, ' +
        'NOT a medical hearing aid.',
      'danger'
    ),
    card('Live listen', [
      el('div', {}, startBtn),
      el('div', { style: 'margin-top:12px' }, [gainSlider, bassSlider, trebleSlider])
    ]),
    notice('If you hear whistling/feedback, lower amplification or switch to earphones.', 'warn')
  ]);

  return {
    el: root,
    unmount() {
      assist.stop();
    }
  };
}
