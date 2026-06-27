// Captions view: live speech-to-text via the Web Speech API, large readable text.

import { el, card, notice, slider, segmented, toast } from '../ui/components.js';
import { CaptionEngine } from '../features/captions.js';

export function captionsView() {
  const supported = CaptionEngine.isSupported();
  const box = el('div', { class: 'caption-box', 'aria-live': 'polite' }, supported ? 'Captions will appear here…' : '');
  let finalText = '';

  const engine = new CaptionEngine({
    onResult: ({ interim, final }) => {
      if (final) finalText = (finalText + ' ' + final).trim();
      box.innerHTML = '';
      box.append(document.createTextNode(finalText + ' '));
      if (interim) box.appendChild(el('span', { class: 'caption-interim' }, interim));
      box.scrollTop = box.scrollHeight;
    },
    onState: (running) => {
      startBtn.textContent = running ? 'Stop captions' : 'Start captions';
      startBtn.classList.toggle('btn-danger', running);
      startBtn.classList.toggle('btn-primary', !running);
    },
    onError: (msg) => toast(msg, 'warn', 4000)
  });

  const startBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Start captions');
  const clearBtn = el('button', { type: 'button', class: 'btn' }, 'Clear');
  startBtn.addEventListener('click', () => {
    if (engine.running) engine.stop();
    else engine.start();
  });
  clearBtn.addEventListener('click', () => {
    finalText = '';
    box.textContent = 'Captions cleared.';
  });

  const sizeSlider = slider({
    label: 'Text size',
    min: 1.2,
    max: 4,
    step: 0.1,
    value: 2,
    unit: 'rem',
    onInput: (v) => box.style.setProperty('--caption-size', `${v}rem`)
  });
  box.style.setProperty('--caption-size', '2rem');

  const langSeg = segmented(
    [
      { value: 'en-US', label: 'EN' },
      { value: 'es-ES', label: 'ES' },
      { value: 'fr-FR', label: 'FR' },
      { value: 'de-DE', label: 'DE' }
    ],
    'en-US',
    (v) => engine.setLang(v),
    'Caption language'
  );

  const root = el('div', {}, [
    notice(
      'Privacy caveat: unlike the rest of SoundScope, live captions use your browser’s speech ' +
        'recognition, which may send audio to a cloud service (e.g. Chrome → Google) and usually ' +
        'needs a network connection. Everything else in the app stays on-device.',
      'warn'
    ),
    supported ? null : notice('Live captions are not supported in this browser. Try Chrome on desktop or Android.', 'danger'),
    card('Live captions', [
      el('div', { class: 'row row-between' }, [el('span', { class: 'muted' }, 'Language'), langSeg]),
      sizeSlider,
      box,
      el('div', { class: 'row', style: 'margin-top:10px' }, [startBtn, clearBtn])
    ])
  ].filter(Boolean));

  return {
    el: root,
    unmount() {
      engine.stop();
    }
  };
}
