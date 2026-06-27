// Real-time band-bar spectrum view (canvas). Reads from a SpectrumAnalyzer.

import { fmtFreq } from '../utils/format.js';

const FLOOR_DB = -100;
const CEIL_DB = -10;

export class SpectrumView {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'spectrum';
    this._raf = null;
    this._ro = null;
  }

  get element() {
    return this.canvas;
  }

  setAnalyzer(analyzer) {
    this.analyzer = analyzer;
  }

  mount() {
    this._resize();
    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.canvas);
    }
    this._loop();
  }

  unmount() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._ro?.disconnect();
    this._ro = null;
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(Math.max(1, rect.width) * dpr);
    this.canvas.height = Math.round(Math.max(1, rect.height || 200) * dpr);
    this._dpr = dpr;
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    this.draw();
  }

  draw() {
    if (!this.analyzer) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const dpr = this._dpr || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bands = this.analyzer.read();
    if (!bands.length) return;

    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--text-dim').trim() || '#8aa';

    const pad = 18;
    const usableH = h - pad;
    const gap = 3;
    const bw = (w - gap * (bands.length + 1)) / bands.length;

    bands.forEach((b, i) => {
      const norm = Math.max(0, Math.min(1, (b.db - FLOOR_DB) / (CEIL_DB - FLOOR_DB)));
      const barH = norm * (usableH - 4);
      const x = gap + i * (bw + gap);
      const y = usableH - barH;
      // color by height
      let color = css.getPropertyValue('--zone-quiet').trim() || '#37d6a0';
      if (norm > 0.75) color = css.getPropertyValue('--zone-harmful').trim() || '#e8543f';
      else if (norm > 0.55) color = css.getPropertyValue('--zone-loud').trim() || '#f2c14e';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, bw, barH);

      ctx.fillStyle = text;
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      // label every other band when crowded
      if (bands.length <= 12 || i % 3 === 0) {
        ctx.fillText(fmtFreq(b.fc), x + bw / 2, h - 4);
      }
    });
  }
}
