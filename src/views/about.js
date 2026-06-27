// About view: the honest accuracy statement, privacy model, and limitations.

import { el, card, notice } from '../ui/components.js';

export function aboutView() {
  return {
    el: el('div', {}, [
      card('What SoundScope is', [
        el(
          'p',
          {},
          'SoundScope is a browser-based sound-level meter and hearing-awareness toolkit. ' +
            'Everything runs on your device. No accounts, no servers, no tracking, no ads. ' +
            'It works offline once loaded.'
        )
      ]),
      notice(
        'Honest accuracy: a phone browser cannot measure absolute sound level without an external ' +
          'reference. After proper calibration, expect ±2–5 dB. Readings are trustworthy roughly ' +
          'in the 30–90 dB range; phone mics clamp and compress above ~95–100 dB, so loud ' +
          'environments (concerts, machinery, gunfire) are unreliable. This is NOT a Type 1/2 ' +
          'certified sound level meter and must not be used for legal, occupational-compliance, ' +
          'or evidentiary purposes.',
        'danger'
      ),
      card('Why A/C weighting is approximate', [
        el(
          'p',
          { class: 'muted' },
          'A- and C-weighting use standard IEC 61672 filter approximations applied before metering. ' +
            'But the phone mic’s own frequency response is not flat and is not corrected per device, ' +
            'so weighted readings are approximate. Per-device correction curves are out of scope.'
        )
      ]),
      card('The hearing tools are awareness only', [
        el(
          'p',
          { class: 'muted' },
          'The hearing screening is NOT a medical test, NOT calibrated, and NOT a diagnosis. ' +
            'The assist/listen mode is a convenience aid, not a medical hearing aid. For anything ' +
            'real, see an audiologist.'
        )
      ]),
      card('Privacy', [
        el(
          'p',
          { class: 'muted' },
          'Audio is processed on-device and never uploaded. Sessions are stored locally (IndexedDB); ' +
            'settings and calibration in localStorage. Location for the noise map is opt-in and stays ' +
            'on-device. The one exception is live captions: your browser’s speech recognition may ' +
            'send audio to a cloud service (e.g. Chrome → Google).'
        )
      ]),
      card('Open source', [
        el('p', { class: 'muted' }, 'Free to host on GitHub Pages. Apache-2.0 licensed.')
      ])
    ])
  };
}
