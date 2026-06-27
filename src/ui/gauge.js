// Live arc gauge (SVG) with color zones. Zones are only meaningful AFTER
// calibration — the caller surfaces that caveat in the UI.

const MIN_DB = 20;
const MAX_DB = 120;
const START_ANGLE = 135; // degrees
const SWEEP = 270;

// Zone thresholds (dB) and colors.
const ZONES = [
  { upTo: 50, color: 'var(--zone-quiet)', label: 'quiet' },
  { upTo: 70, color: 'var(--zone-moderate)', label: 'moderate' },
  { upTo: 85, color: 'var(--zone-loud)', label: 'loud' },
  { upTo: 120, color: 'var(--zone-harmful)', label: 'harmful' }
];

function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function dbToAngle(db) {
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  const frac = (clamped - MIN_DB) / (MAX_DB - MIN_DB);
  return START_ANGLE + frac * SWEEP;
}

export class Gauge {
  constructor() {
    this.size = 260;
    this.svg = this._build();
  }

  get element() {
    return this.svg;
  }

  _build() {
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const r = s / 2 - 24;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${s} ${s}`);
    svg.setAttribute('class', 'gauge');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Sound level gauge');

    // Track.
    const track = document.createElementNS(NS, 'path');
    track.setAttribute('d', arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP));
    track.setAttribute('class', 'gauge-track');
    svg.appendChild(track);

    // Colored zone arcs.
    let prev = MIN_DB;
    for (const z of ZONES) {
      const a1 = dbToAngle(prev);
      const a2 = dbToAngle(z.upTo);
      const seg = document.createElementNS(NS, 'path');
      seg.setAttribute('d', arcPath(cx, cy, r, a1, a2));
      seg.setAttribute('class', 'gauge-zone');
      seg.setAttribute('stroke', z.color);
      svg.appendChild(seg);
      prev = z.upTo;
    }

    // Needle.
    const needle = document.createElementNS(NS, 'line');
    needle.setAttribute('x1', cx);
    needle.setAttribute('y1', cy);
    needle.setAttribute('class', 'gauge-needle');
    svg.appendChild(needle);
    this._needle = needle;
    this._geom = { cx, cy, r };

    // Hub.
    const hub = document.createElementNS(NS, 'circle');
    hub.setAttribute('cx', cx);
    hub.setAttribute('cy', cy);
    hub.setAttribute('r', 6);
    hub.setAttribute('class', 'gauge-hub');
    svg.appendChild(hub);

    return svg;
  }

  /** Update needle position for a displayed dB value (or null = idle). */
  set(db) {
    const { cx, cy, r } = this._geom;
    const angle = Number.isFinite(db) ? dbToAngle(db) : START_ANGLE;
    const [x2, y2] = polar(cx, cy, r - 12, angle);
    this._needle.setAttribute('x2', x2.toFixed(2));
    this._needle.setAttribute('y2', y2.toFixed(2));
    this._needle.classList.toggle('is-idle', !Number.isFinite(db));
  }
}

export function zoneForLevel(db) {
  if (!Number.isFinite(db)) return null;
  for (const z of ZONES) if (db <= z.upTo) return z.label;
  return 'harmful';
}
