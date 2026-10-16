(function () {
  const C = window.ADMIN_CONFIG;
  const form = document.getElementById('form');
  const steps = Array.from(document.querySelectorAll('.step'));
  const bars = Array.from(document.querySelectorAll('#steps i'));
  const back = document.getElementById('back'), next = document.getElementById('next');
  const formError = document.getElementById('formError');
  const guardian = document.getElementById('guardian');
  const dob = document.getElementById('dob'), ageHint = document.getElementById('ageHint');
  let cur = 0, age = null;

  /* Date limits */
  const today = new Date();
  dob.max = today.toISOString().slice(0, 10);
  dob.min = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()).toISOString().slice(0, 10);

  function calcAge(v) {
    if (!v) return null;
    const b = new Date(v + 'T00:00:00'); if (isNaN(b)) return null;
    let a = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) a--;
    return a;
  }
  dob.addEventListener('input', () => {
    age = calcAge(dob.value);
    if (age == null) { ageHint.textContent = 'You must be at least ' + C.MIN_AGE + ' years old.'; guardian.hidden = true; return; }
    if (age < C.MIN_AGE) ageHint.textContent = 'You must be at least ' + C.MIN_AGE + ' years old to apply.';
    else ageHint.textContent = 'Age: ' + age;
    guardian.hidden = !(age >= C.MIN_AGE && age < 18);
  });

  /* Password strength */
  const pw = document.getElementById('password'), bar = document.getElementById('strength');
  pw.addEventListener('input', () => {
    const v = pw.value; let s = 0;
    if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
    bar.style.width = (s * 20) + '%';
    bar.style.background = s <= 2 ? 'var(--red)' : s === 3 ? 'var(--amber)' : 'var(--green)';
  });

  /* Validation */
  function setErr(el, msg) {
    const f = el.closest('.field'); if (!f) return;
    const e = f.querySelector('.err');
    if (msg) { f.classList.add('invalid'); if (e) e.textContent = msg; } else { f.classList.remove('invalid'); if (e) e.textContent = ''; }
  }
  function validStep(i) {
    let ok = true, firstBad = null;
    const root = steps[i];
    root.querySelectorAll('input:not([type=checkbox]),select,textarea').forEach(el => {
      if (el.closest('.guardian') && guardian.hidden) return;
      const v = el.value.trim(), label = el.dataset.label || 'This field';
      let msg = '';
      const needed = el.required || (el.closest('.guardian') && !guardian.hidden && ['guardianName', 'guardianRelation', 'guardianPhone'].indexOf(el.name) !== -1);
      if (needed && !v) msg = label === 'This field' ? 'This is required.' : label + ' is required.';
      else if (el.name === 'dob' && v) {
        const a = calcAge(v);
        if (a == null) msg = 'Enter a valid date.';
        else if (a < C.MIN_AGE) msg = 'You must be at least ' + C.MIN_AGE + ' years old to apply.';
        else if (a > 100) msg = 'Enter a valid date of birth.';
      }
      else if (el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Enter a valid email address.';
      else if ((el.name === 'phone' || el.name === 'guardianPhone') && v && v.replace(/\D/g, '').length < 7) msg = 'Enter a valid phone number.';
      else if (el.dataset.min && v.length < Number(el.dataset.min)) msg = 'Write at least ' + el.dataset.min + ' characters.';
      else if (el.name === 'username' && v && (v.length < 2 || v.length > 40)) msg = 'Use between 2 and 40 characters.';
      else if (el.name === 'password' && v && !(v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v))) msg = 'Use at least 8 characters with a letter and a number.';
      else if (el.name === 'confirm' && v !== form.password.value) msg = 'Passwords do not match.';
      setErr(el, msg);
      if (msg) { ok = false; if (!firstBad) firstBad = el; }
    });
    root.querySelectorAll('input[type=checkbox]').forEach(cb => {
      if (cb.closest('.guardian') && guardian.hidden) return;
      const wrap = cb.closest('.check'); const bad = !cb.checked;
      wrap.classList.toggle('invalid', bad);
      if (bad) { ok = false; if (!firstBad) firstBad = cb; }
    });
    if (firstBad) firstBad.focus({ preventScroll: false });
    return ok;
  }
  form.addEventListener('input', e => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); const c = e.target.closest('.check'); if (c) c.classList.remove('invalid'); });
  form.addEventListener('change', e => { const c = e.target.closest('.check'); if (c) c.classList.remove('invalid'); });

  function show(i, quiet) {
    cur = i;
    steps.forEach((s, n) => s.classList.toggle('active', n === i));
    bars.forEach((b, n) => b.classList.toggle('done', n <= i));
    back.style.visibility = i === 0 ? 'hidden' : 'visible';
    next.textContent = i === steps.length - 1 ? 'Send application' : 'Continue';
    formError.hidden = true;
    if (!quiet) document.getElementById('card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  back.addEventListener('click', () => cur > 0 && show(cur - 1));
  next.addEventListener('click', async () => {
    if (!validStep(cur)) return;
    if (cur < steps.length - 1) return show(cur + 1);
    // Submit
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
    data.age = calcAge(data.dob);
    delete data.agree1; delete data.agree2;
    next.disabled = true; next.textContent = 'Sending…'; formError.hidden = true;
    try {
      await API.apply(data);
      document.getElementById('formWrap').hidden = true;
      const done = document.getElementById('done'); done.hidden = false; done.classList.add('view-in');
      document.getElementById('card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (ex) {
      formError.textContent = ex.message; formError.hidden = false;
      if (ex.code === 'TAKEN') { show(3); setErr(form.username, ex.message); formError.hidden = true; }
      next.disabled = false; next.textContent = 'Send application';
    }
  });
  form.addEventListener('submit', e => { e.preventDefault(); next.click(); });
  show(0, true);
})();
