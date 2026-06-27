// Sessions view: save the current session, list saved ones, export CSV, delete.

import { el, card, notice, toast, downloadFile } from '../ui/components.js';
import { fmtDb, fmtDuration, fmtDateTime, fmtFileStamp } from '../utils/format.js';
import { saveSession, listSessions, deleteSession, sessionToCsv } from '../store/sessions.js';

export function sessionsView(ctx) {
  const { store, getSessionData } = ctx;

  const nameInput = el('input', { type: 'text', class: 'text-input', placeholder: 'Session name (optional)' });
  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Save current session');
  const listEl = el('ul', { class: 'list' });

  saveBtn.addEventListener('click', async () => {
    const data = getSessionData();
    if (!data.samples.length) {
      return toast('Nothing to save yet — run the meter first.', 'warn');
    }
    const name = nameInput.value.trim() || `Session ${fmtFileStamp()}`;
    try {
      await saveSession({ name, ...data });
      nameInput.value = '';
      toast('Session saved.', 'success');
      refresh();
    } catch (err) {
      toast(`Could not save: ${err.message}`, 'danger');
    }
  });

  async function refresh() {
    let sessions = [];
    try {
      sessions = await listSessions();
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(notice('Session storage is unavailable in this browser.', 'warn'));
      return;
    }
    listEl.innerHTML = '';
    if (!sessions.length) {
      listEl.appendChild(el('li', { class: 'muted' }, 'No saved sessions yet.'));
      return;
    }
    for (const sess of sessions) listEl.appendChild(renderItem(sess, refresh));
  }

  const root = el('div', {}, [
    card('Save current session', [
      el('p', { class: 'muted' }, 'Stored on-device in your browser (IndexedDB). Nothing is uploaded.'),
      nameInput,
      el('div', { style: 'margin-top:10px' }, saveBtn)
    ]),
    card('Saved sessions', listEl)
  ]);

  return {
    el: root,
    mount() {
      refresh();
    }
  };
}

function renderItem(sess, refresh) {
  const m = sess.metrics || {};
  const meta = el('div', {}, [
    el('strong', {}, sess.name),
    el(
      'div',
      { class: 'muted', style: 'font-size:.82rem' },
      `${fmtDateTime(sess.startedAt)} · ${fmtDuration(m.elapsedMs || 0)} · ` +
        `Leq ${fmtDb(m.leq)} · Lmax ${fmtDb(m.lmax)} dB(${sess.weighting || '?'})`
    )
  ]);

  const csvBtn = el('button', { type: 'button', class: 'btn' }, 'CSV');
  csvBtn.addEventListener('click', () => {
    downloadFile(`soundscope-${fmtFileStamp(new Date(sess.startedAt))}.csv`, sessionToCsv(sess), 'text/csv');
  });

  const delBtn = el('button', { type: 'button', class: 'btn btn-danger' }, 'Delete');
  delBtn.addEventListener('click', async () => {
    await deleteSession(sess.id);
    toast('Session deleted.', 'info');
    refresh();
  });

  return el('li', { class: 'list-item' }, [meta, el('div', { class: 'row' }, [csvBtn, delBtn])]);
}
