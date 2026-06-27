// IndexedDB-backed session history: save / load / list / delete, plus CSV export.

const DB_NAME = 'soundscope';
const DB_VERSION = 1;
const STORE = 'sessions';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * Save a session record.
 * @param {object} session { name, startedAt, endedAt, metrics, weighting,
 *                           calibration, samples: [{t, level}] }
 */
export async function saveSession(session) {
  const db = await openDb();
  const id = session.id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = { ...session, id };
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function listSessions() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      all.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSession(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Build a CSV string for one session (header + time/level rows). */
export function sessionToCsv(session) {
  const lines = [];
  lines.push(`# SoundScope session export`);
  lines.push(`# name,${csvCell(session.name || '')}`);
  lines.push(`# started,${new Date(session.startedAt).toISOString()}`);
  lines.push(`# ended,${session.endedAt ? new Date(session.endedAt).toISOString() : ''}`);
  lines.push(`# weighting,${session.weighting || ''}`);
  if (session.metrics) {
    const m = session.metrics;
    lines.push(`# Leq_dB,${fmt(m.leq)}`);
    lines.push(`# Lmax_dB,${fmt(m.lmax)}`);
    lines.push(`# Lmin_dB,${fmt(m.lmin)}`);
    lines.push(`# L10_dB,${fmt(m.l10)}`);
    lines.push(`# L50_dB,${fmt(m.l50)}`);
    lines.push(`# L90_dB,${fmt(m.l90)}`);
  }
  lines.push(`# NOTE: not a certified instrument; +/-2..5 dB after calibration.`);
  lines.push('elapsed_seconds,level_dB');
  for (const s of session.samples || []) {
    lines.push(`${(s.t / 1000).toFixed(2)},${fmt(s.level)}`);
  }
  return lines.join('\n');
}

function fmt(v) {
  return v == null || !Number.isFinite(v) ? '' : v.toFixed(2);
}
function csvCell(s) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
