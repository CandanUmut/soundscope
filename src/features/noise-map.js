// Geotagged noise logging. With explicit user consent, capture timestamped,
// geotagged Leq samples and export them as GeoJSON (for mapping tools) and CSV.
//
// PRIVACY MODEL: nothing leaves the device. There is no server. Geolocation is
// only requested after the user opts in, and the exported file is owned by the
// user. The app neither stores location to any cloud nor transmits it anywhere.

export class NoiseMapLogger {
  constructor() {
    this.points = [];
    this.watchId = null;
    this.lastPosition = null;
  }

  get isLogging() {
    return this.watchId != null;
  }

  /** Begin watching geolocation. Resolves once permission is granted/denied. */
  start() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not available in this browser.'));
        return;
      }
      let settled = false;
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.lastPosition = pos;
          if (!settled) {
            settled = true;
            resolve();
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            this.stop();
            reject(new Error(err.message || 'Location permission denied.'));
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    });
  }

  stop() {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /** Record one sample at the most recent known position. */
  record(leq, extra = {}) {
    if (!this.lastPosition) return false;
    const c = this.lastPosition.coords;
    this.points.push({
      t: Date.now(),
      lat: c.latitude,
      lon: c.longitude,
      accuracy: c.accuracy,
      leq,
      ...extra
    });
    return true;
  }

  clear() {
    this.points = [];
  }

  toGeoJson() {
    return {
      type: 'FeatureCollection',
      properties: {
        generator: 'SoundScope',
        note: 'On-device noise log. Not a certified instrument (+/-2..5 dB).'
      },
      features: this.points.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          timestamp: new Date(p.t).toISOString(),
          leq_dB: p.leq == null ? null : Number(p.leq.toFixed(2)),
          accuracy_m: p.accuracy
        }
      }))
    };
  }

  toCsv() {
    const lines = ['timestamp,lat,lon,accuracy_m,leq_dB'];
    for (const p of this.points) {
      lines.push(
        [
          new Date(p.t).toISOString(),
          p.lat,
          p.lon,
          p.accuracy ?? '',
          p.leq == null ? '' : p.leq.toFixed(2)
        ].join(',')
      );
    }
    return lines.join('\n');
  }
}
