// Formatting helpers for levels, durations and timestamps.

/** Format a dB level. Returns "—" for non-finite/idle values. */
export function fmtDb(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** Format a duration in milliseconds as H:MM:SS (or M:SS under an hour). */
export function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Short clock-ish label for time-to-limit, e.g. "2 h 15 m" or "8 m". */
export function fmtCountdown(seconds) {
  if (!Number.isFinite(seconds)) return '∞';
  if (seconds <= 0) return 'now';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} m`;
  if (m > 0) return `${m} m`;
  return `${Math.ceil(seconds)} s`;
}

/** ISO-ish local timestamp for filenames. */
export function fmtFileStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

/** Human-readable date/time for the UI. */
export function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

/** Format a frequency in Hz or kHz. */
export function fmtFreq(hz) {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(hz));
}
