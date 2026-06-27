// Spectrum view: real-time octave / 1/3-octave band bars from the AnalyserNode.

import { el, card, notice, segmented } from '../ui/components.js';
import { SpectrumAnalyzer } from '../audio/spectrum.js';
import { SpectrumView } from '../ui/spectrum-view.js';

export function spectrumView(ctx) {
  const { engine, store } = ctx;
  let analyzer = null;
  let view = null;
  let mode = 'octave';

  const canvasWrap = el('div', { style: 'height:240px' });
  const placeholder = notice('Start the meter to see live spectrum bands.', 'info');

  const modeSeg = segmented(
    [
      { value: 'octave', label: 'Octave' },
      { value: 'third', label: '1/3 Octave' }
    ],
    mode,
    (v) => {
      mode = v;
      analyzer?.setMode(v);
    },
    'Band resolution'
  );

  const root = el('div', {}, [
    card('Frequency spectrum', [
      el('div', { class: 'row row-between' }, [el('span', { class: 'muted' }, 'Resolution'), modeSeg]),
      canvasWrap,
      placeholder
    ]),
    notice(
      'Spectrum shows relative band energy at the input (dBFS-scale), reflecting the active weighting. ' +
        'It is for visualization — the phone mic response is not flat or per-device corrected.',
      'info'
    )
  ]);

  function setup() {
    const an = engine.getAnalyser();
    if (an && store.get().status === 'running') {
      analyzer = new SpectrumAnalyzer(an, mode);
      view = new SpectrumView(analyzer);
      canvasWrap.innerHTML = '';
      canvasWrap.appendChild(view.element);
      view.mount();
      placeholder.style.display = 'none';
    } else {
      teardown();
      placeholder.style.display = '';
    }
  }

  function teardown() {
    view?.unmount();
    view = null;
    analyzer = null;
    canvasWrap.innerHTML = '';
  }

  return {
    el: root,
    mount() {
      setup();
    },
    unmount() {
      teardown();
    },
    onStatus() {
      setup();
    }
  };
}
