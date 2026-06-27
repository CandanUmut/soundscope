import { meterView } from './meter.js';
import { spectrumView } from './spectrum.js';
import { exposureView } from './exposure.js';
import { calibrateView } from './calibrate.js';
import { sessionsView } from './sessions.js';
import { mapView } from './map.js';
import { alertsView } from './alerts.js';
import { captionsView } from './captions.js';
import { hearingView } from './hearing.js';
import { assistView } from './assist.js';
import { aboutView } from './about.js';

export const views = {
  meter: meterView,
  spectrum: spectrumView,
  exposure: exposureView,
  calibrate: calibrateView,
  sessions: sessionsView,
  map: mapView,
  alerts: alertsView,
  captions: captionsView,
  hearing: hearingView,
  assist: assistView,
  about: aboutView
};
