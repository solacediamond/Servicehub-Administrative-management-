/* Shared helpers: escaping, dates, toasts, modals, copy */
(function () {
  const C = window.ADMIN_CONFIG;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function categoryOf(status) {
    const s = String(status || '').trim().toLowerCase();
    for (const key of Object.keys(C.STATUS_MAP)) {
      if (C.STATUS_MAP[key].indexOf(s) !== -1) return key;
    }
    return 'others';
  }

  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = ts => ts ? new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  function relDays(ts) {
    if (!ts) return '';
    const d = Math.round((ts - Date.now()) / 864e5);
    if (d === 0) return 'today';
    return d > 0 ? 'in ' + d + (d === 1 ? ' day' : ' days') : Math.abs(d) + (Math.abs(d) === 1 ? ' day' : ' days') + ' ago';
  }
  const cap = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };

  /* Toasts */
  function toast(msg, type, ms) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast glass ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 420); }, ms || 3200);
  }

  /* Copy */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      try {
        const t = document.createElement('textarea');
        t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        const ok = document.execCommand('copy'); t.remove(); return ok;
      } catch (e2) { return false; }
    }
  }
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-copy]');
    if (!el) return;
    const val = el.getAttribute('data-copy') || (el.previousElementSibling && el.previousElementSibling.value) || '';
    const ok = await copyText(val);
    toast(ok ? 'Copied' : 'Copy failed. Select the text and copy it manually.', ok ? 'ok' : 'bad', 1800);
  });

  /* Glass highlight that follows the pointer */
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('.glass.hover');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  /* Modal with optional password confirmation */
  function openModal(o) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="mt">' +
      '<h3 id="mt">' + esc(o.title) + '</h3>' +
      (o.desc ? '<div class="desc">' + o.desc + '</div>' : '') +
      '<form novalidate>' + (o.fields || '') +
      (o.password ? '<label class="field"><span>Your password <em>(confirms it is you)</em></span><input class="input" type="password" name="__pw" autocomplete="off" required></label>' : '') +
      '<p class="form-error" role="alert" hidden></p>' +
      '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button>' +
      '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + esc(o.confirmText || 'Confirm') + '</button></div>' +
      '</form></div>';
    document.body.appendChild(wrap);

    const form = wrap.querySelector('form');
    const errBox = wrap.querySelector('.form-error');
    const submit = form.querySelector('[type=submit]');
    const prevFocus = document.activeElement;

    function close() {
      document.removeEventListener('keydown', onKey);
      wrap.classList.add('closing');
      setTimeout(() => { wrap.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 260);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    wrap.querySelector('[data-cancel]').addEventListener('click', close);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errBox.hidden = true;
      const values = {};
      new FormData(form).forEach((v, k) => { values[k] = typeof v === 'string' ? v.trim() : v; });
      if (o.password && !values.__pw) { errBox.textContent = 'Enter your password to continue.'; errBox.hidden = false; return; }
      const label = submit.textContent;
      submit.disabled = true; submit.textContent = 'Working…';
      try {
        const pw = values.__pw; delete values.__pw;
        await o.onConfirm(values, pw);
        close();
      } catch (err) {
        errBox.textContent = err.message || 'Something went wrong.';
        errBox.hidden = false;
        submit.disabled = false; submit.textContent = label;
        const pwInput = form.querySelector('[name=__pw]');
        if (pwInput && (err.code === 'BAD_PASSWORD' || err.code === 'AUTH')) { pwInput.value = ''; pwInput.focus(); }
      }
    });

    const first = form.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 60);
    return { close };
  }

  window.UI = { esc, categoryOf, fmtDate, fmtDateTime, relDays, cap, toast, copyText, openModal };
})();
