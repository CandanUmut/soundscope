// Session level-over-time chart on a canvas, with a Leq reference line.

const MIN_DB = 20;
const MAX_DB = 120;

export class Timeline {
  constructor({ maxPoints = 1800 } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'timeline';
    this.points = []; // { t, level }
    this.maxPoints = maxPoints;
    this.leq = null;
    this._ro = null;
  }

  get element() {
    return this.canvas;
  }

  mount() {
    // Size to container once attached.
    this._resize();
    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.canvas);
    }
  }

  unmount() {
    this._ro?.disconnect();
    this._ro = null;
  }

  push(t, level) {
    this.points.push({ t, level });
    if (this.points.length > this.maxPoints) this.points.shift();
    this.draw();
  }

  setLeq(leq) {
    this.leq = leq;
  }

  reset() {
    this.points = [];
    this.leq = null;
    this.draw();
  }

  load(points) {
    this.points = points.slice(-this.maxPoints);
    this.draw();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height || 160);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this._dpr = dpr;
    this.draw();
  }

  _y(level, h) {
    const c = Math.max(MIN_DB, Math.min(MAX_DB, level));
    return h - ((c - MIN_DB) / (MAX_DB - MIN_DB)) * h;
  }

  draw() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const dpr = this._dpr || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const grid = css.getPropertyValue('--line').trim() || '#243040';
    const accent = css.getPropertyValue('--accent').trim() || '#37d6a0';
    const text = css.getPropertyValue('--text-dim').trim() || '#8aa';

    // gridlines at 40/60/80/100 dB
    ctx.strokeStyle = grid;
    ctx.fillStyle = text;
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui, sans-serif';
    for (const db of [40, 60, 80, 100]) {
      const y = this._y(db, h);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(String(db), 2, y + 3);
    }

    if (this.points.length > 1) {
      const n = this.points.length;
      const x = (i) => 28 + (i / (n - 1)) * (w - 30);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = x(i);
        const py = this._y(this.points[i].level, h);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (this.leq != null && Number.isFinite(this.leq)) {
      const y = this._y(this.leq, h);
      ctx.strokeStyle = css.getPropertyValue('--zone-loud').trim() || '#f2c14e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText('Leq', w - 26, y - 4);
    }
  }
}
