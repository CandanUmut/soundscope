// Small DOM helpers and shared UI bits. No framework.

/** Create an element with props and children. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** A labelled card section. */
export function card(title, children, opts = {}) {
  const head = title ? el('h2', { class: 'card-title' }, title) : null;
  return el('section', { class: `card ${opts.class || ''}` }, [head, ...[].concat(children)].filter(Boolean));
}

/** A prominent disclaimer/notice box. variant: 'warn' | 'info' | 'danger'. */
export function notice(text, variant = 'info') {
  return el('div', { class: `notice notice-${variant}`, role: 'note' }, text);
}

/**
 * Toggle button group. options: [{value,label}]. Calls onChange(value).
 * The active button updates immediately on click; the returned element also
 * exposes `setValue(v)` so callers can sync it when the value changes elsewhere.
 */
export function segmented(options, value, onChange, ariaLabel = '') {
  const group = el('div', { class: 'segmented', role: 'group', 'aria-label': ariaLabel });
  const btns = [];

  function setActive(v) {
    for (const b of btns) {
      const on = b.dataset.value === String(v);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  for (const opt of options) {
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'seg-btn',
        onClick: () => {
          setActive(opt.value); // reflect the choice right away
          onChange(opt.value);
        }
      },
      opt.label
    );
    btn.dataset.value = String(opt.value);
    btns.push(btn);
    group.appendChild(btn);
  }

  setActive(value);
  group.setValue = setActive;
  return group;
}

/** Collapsible section (native <details>) for tucking away advanced options. */
export function expander(summaryText, children, open = false) {
  const d = el('details', { class: 'expander' });
  if (open) d.setAttribute('open', '');
  d.appendChild(el('summary', { class: 'expander-summary' }, summaryText));
  d.appendChild(el('div', { class: 'expander-body' }, [].concat(children).filter(Boolean)));
  return d;
}

/** Labelled range slider with a live value readout. */
export function slider({ label, min, max, step = 1, value, unit = '', onInput }) {
  const out = el('output', { class: 'slider-value' }, `${value}${unit}`);
  const input = el('input', {
    type: 'range',
    min,
    max,
    step,
    value,
    class: 'slider',
    'aria-label': label
  });
  input.addEventListener('input', () => {
    out.textContent = `${input.value}${unit}`;
    onInput?.(Number(input.value));
  });
  return el('label', { class: 'slider-row' }, [el('span', { class: 'slider-label' }, [label, out]), input]);
}

let toastTimer = null;
/** Transient toast message. */
export function toast(message, variant = 'info', ms = 3200) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  region.innerHTML = '';
  const t = el('div', { class: `toast toast-${variant}` }, message);
  region.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.add('toast-out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/** Trigger a client-side file download from a string. */
export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
