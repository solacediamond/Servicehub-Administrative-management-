(function () {
  const C = window.ADMIN_CONFIG;
  if (Auth.get()) { location.replace('dashboard.html'); return; }

  const form = document.getElementById('loginForm');
  const err = document.getElementById('error');
  const note = document.getElementById('note');
  const btn = document.getElementById('submit');
  const FAIL = 'sh_login_fail';

  if (C.MODE === 'demo') document.getElementById('demoPill').hidden = false;

  const m = new URLSearchParams(location.search).get('m');
  const notes = { idle: 'You were signed out after a period of inactivity.', expired: 'Your session ended. Sign in again.', out: 'You are signed out.' };
  if (m && notes[m]) { note.textContent = notes[m]; note.hidden = false; }

  document.getElementById('togglePw').addEventListener('click', e => {
    const i = form.password; const show = i.type === 'password';
    i.type = show ? 'text' : 'password'; e.target.textContent = show ? 'Hide' : 'Show';
  });

  function failState() { try { return JSON.parse(sessionStorage.getItem(FAIL)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
  function saveFail(s) { try { sessionStorage.setItem(FAIL, JSON.stringify(s)); } catch (e) {} }
  function show(msg) { err.textContent = msg; err.hidden = false; }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true; note.hidden = true;
    const username = form.username.value.trim(), password = form.password.value;
    if (!username || !password) return show('Enter your admin name and password.');

    const f = failState();
    if (Date.now() < f.until) return show('Too many attempts. Try again in ' + Math.ceil((f.until - Date.now()) / 1000) + ' seconds.');

    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const r = await API.login({ username, password });
      saveFail({ n: 0, until: 0 });
      Auth.set(r.token, r.user);
      document.body.style.transition = 'opacity .4s'; document.body.style.opacity = '0';
      setTimeout(() => location.replace('dashboard.html'), 380);
    } catch (ex) {
      if (ex.code === 'INVALID') {
        f.n += 1;
        if (f.n >= 5) { f.until = Date.now() + 60000; f.n = 0; }
        saveFail(f);
      }
      show(ex.message);
      btn.disabled = false; btn.textContent = 'Sign in';
      form.password.value = '';
    }
  });
})();
