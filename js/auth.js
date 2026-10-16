/* Session handling. No "remember me": the session lives in this tab only.
 * It ends on tab close, after SESSION_HOURS, or after IDLE_MINUTES with no activity.
 * Idle time is measured with a timestamp, not just a timer, because phones freeze
 * timers while the screen is locked. The timestamp is checked again the moment the
 * page comes back, so a phone picked up after the limit lands on the sign-in page. */
(function () {
  const C = window.ADMIN_CONFIG;
  const KEY = 'sh_admin_session';
  let memory = null; // fallback if sessionStorage is blocked
  let lastTouch = 0;

  function read() {
    try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : memory; }
    catch (e) { return memory; }
  }
  function write(s) {
    memory = s;
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* memory fallback */ }
  }
  const idleMs = () => C.IDLE_MINUTES * 60000;

  const Auth = {
    /* null when the session is fine, otherwise 'none', 'expired' or 'idle' */
    check() {
      const s = read();
      if (!s) return 'none';
      const now = Date.now();
      if (now > s.exp) return 'expired';
      if (now - (s.last || now) > idleMs()) return 'idle';
      return null;
    },
    get() {
      if (Auth.check()) { Auth.clear(); return null; }
      return read();
    },
    set(token, user) {
      const now = Date.now();
      write({ token, user, exp: now + C.SESSION_HOURS * 36e5, last: now });
    },
    touch() {
      const s = read(); if (!s) return;
      s.last = Date.now(); write(s);
    },
    clear() { memory = null; try { sessionStorage.removeItem(KEY); } catch (e) {} },
    require() {
      const r = Auth.check();
      if (r) { Auth.logout(r === 'none' ? '' : r); return false; }
      return true;
    },
    logout(reason) {
      const s = read();
      Auth.clear();
      // Tell the server to end the token too (live mode, best effort)
      if (s && C.MODE === 'live' && window.API && window.API.logout) {
        try { window.API.logout({ token: s.token }).catch(() => {}); } catch (e) {}
      }
      // Wipe what is on screen so a cached copy of this page shows nothing
      try { document.body.innerHTML = ''; } catch (e) {}
      location.replace('index.html' + (reason ? '?m=' + reason : ''));
    },
    startIdle() {
      const verify = () => { const r = Auth.check(); if (r) { Auth.logout(r); return false; } return true; };
      const activity = () => {
        const now = Date.now();
        if (now - lastTouch < 1000) return;   // do not write storage on every pixel of movement
        if (!verify()) return;
        lastTouch = now; Auth.touch();
      };
      ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel']
        .forEach(ev => window.addEventListener(ev, activity, { passive: true }));
      setInterval(verify, 5000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) verify(); });
      window.addEventListener('focus', verify);
      window.addEventListener('pageshow', verify);   // also covers the Back button restoring a cached page
      Auth.touch();
    }
  };
  window.Auth = Auth;
})();
