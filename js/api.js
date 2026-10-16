/* API layer. The pages only ever call API.something().
 *   demo mode : runs against fake data in this browser
 *   live mode : POSTs to your Apps Script web app (see README for the contract)
 */
(function () {
  const C = window.ADMIN_CONFIG;

  class ApiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  const MSG = {
    INVALID: 'Name or password is incorrect.',
    PENDING: 'Your application is still pending. You can sign in after the owner approves it.',
    LOCKED: 'Too many attempts. Try again in a minute.',
    NOT_FOUND: 'No listing matches that ID or link.',
    AUTH: 'Your session has ended. Sign in again.',
    BAD_PASSWORD: 'That password is not correct.',
    TAKEN: 'That name is already taken. Choose another.',
    BAD_CODE: 'That access code is not correct.',
    ERROR: 'Something went wrong. Try again.'
  };

  /* ---------- live ---------- */
  async function live(action, payload) {
    if (!C.API_URL) throw new ApiError('ERROR', 'API_URL is not set in js/config.js.');
    const s = window.Auth.get();
    let res;
    try {
      res = await fetch(C.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight on Apps Script
        keepalive: true,
        body: JSON.stringify((function(){ const b = Object.assign({ action: 'admin_' + action }, payload || {}); if (s) { b.token = s.token; b.username = s.user && s.user.username; } return b; })())
      });
    } catch (e) { throw new ApiError('NETWORK', 'Could not reach the server. Check your connection.'); }
    let data;
    try { data = await res.json(); } catch (e) { throw new ApiError('ERROR', MSG.ERROR); }
    if (!data.ok) {
      if (data.code === 'AUTH' && window.Auth.get()) window.Auth.logout('expired');
      throw new ApiError(data.code || 'ERROR', data.message || MSG[data.code] || MSG.ERROR);
    }
    return data.data;
  }

  /* ---------- demo ---------- */
  const LS_LIST = 'sh_admin_demo_listings_v1', LS_APPS = 'sh_admin_demo_apps_v1';
  const wait = ms => new Promise(r => setTimeout(r, (ms || 300) + Math.random() * 250));
  const clone = o => JSON.parse(JSON.stringify(o));
  const DAY = 864e5;

  function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v || fallback(); } catch (e) { return fallback(); } }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  let listings = load(LS_LIST, () => clone(window.DEMO_SEED));
  let apps = load(LS_APPS, () => clone(window.DEMO_APPS_SEED || []));
  const saveL = () => store(LS_LIST, listings);
  const saveA = () => store(LS_APPS, apps);

  async function sha(s) {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
    return 'plain:' + s;
  }
  const norm = s => String(s || '').trim().toLowerCase();
  const rand = (n, chars) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const hex = n => rand(n, '0123456789abcdef');

  async function checkPassword(pw) {
    const s = window.Auth.get();
    if (!s) throw new ApiError('AUTH', MSG.AUTH);
    const t = C.TEST_LOGIN;
    if (t && norm(s.user.username) === norm(t.username)) {
      if (pw !== t.password) throw new ApiError('BAD_PASSWORD', MSG.BAD_PASSWORD);
      return s.user;
    }
    const a = apps.find(x => norm(x.username) === norm(s.user.username));
    if (!a || a.pwdHash !== await sha(pw)) throw new ApiError('BAD_PASSWORD', MSG.BAD_PASSWORD);
    return s.user;
  }
  /* What the pages may see of a listing: never the manage link itself */
  function pub(l) { const o = clone(l); o.hasLink = !!o.manageLink; delete o.manageLink; return o; }
  const codeGuard = { n: 0, until: 0 };
  function find(id) {
    const l = listings.find(x => x.id === id);
    if (!l) throw new ApiError('NOT_FOUND', MSG.NOT_FOUND);
    return l;
  }
  function needSession() { if (!window.Auth.get()) throw new ApiError('AUTH', MSG.AUTH); }

  function parseQuery(q) {
    q = String(q || '').trim();
    const m = q.match(/[#?&]k=([A-Za-z0-9_-]+)/);
    if (m) return { token: m[1] };
    if (/^https?:\/\//i.test(q)) return { token: q.split(/[\/#=?&]/).filter(Boolean).pop() };
    return { id: q, token: q };
  }

  const demo = {
    async login(p) {
      await wait(450);
      const t = C.TEST_LOGIN, u = norm(p.username);
      if (t && u === norm(t.username)) {
        if (p.password !== t.password) throw new ApiError('INVALID', MSG.INVALID);
        return { token: 'demo-' + hex(24), user: { username: t.username, displayName: t.displayName, role: t.role } };
      }
      const a = apps.find(x => norm(x.username) === u);
      if (!a || a.pwdHash !== await sha(p.password)) throw new ApiError('INVALID', MSG.INVALID);
      if (a.status !== 'approved') throw new ApiError('PENDING', MSG.PENDING);
      return { token: 'demo-' + hex(24), user: { username: a.username, displayName: a.firstName, role: 'admin' } };
    },

    async apply(form) {
      await wait(600);
      const u = norm(form.username);
      if ((C.TEST_LOGIN && norm(C.TEST_LOGIN.username) === u) || apps.some(x => norm(x.username) === u)) throw new ApiError('TAKEN', MSG.TAKEN);
      const rec = Object.assign({}, form, { pwdHash: await sha(form.password), status: 'pending', appliedAt: Date.now() });
      delete rec.password; delete rec.confirm;
      apps.push(rec); saveA();
      return { ok: true };
    },

    async listings() {
      needSession(); await wait(250);
      return listings.map(l => ({
        id: l.id, title: l.title, type: l.type, category: l.category, status: l.status,
        ownerName: l.ownerName, createdAt: l.createdAt, expiresAt: l.expiresAt, hasPayment: !!l.payment
      }));
    },

    async get(p) { needSession(); await wait(250); return pub(find(p.id)); },

    async search(p) {
      needSession(); await wait(300);
      const { id, token } = parseQuery(p.q);
      const hit = listings.find(l =>
        (id && (norm(l.id) === norm(id) || norm(l.paymentCode) === norm(id))) ||
        (token && token.length >= 16 && l.manageLink && l.manageLink.indexOf(token) !== -1));
      if (!hit) throw new ApiError('NOT_FOUND', MSG.NOT_FOUND);
      return { id: hit.id };
    },

    async update(p) {
      await checkPassword(p.password); await wait(400);
      const l = find(p.id);
      ['title', 'type', 'category', 'description', 'location', 'ownerName', 'phone', 'whatsapp', 'email', 'pricing', 'customPricing']
        .forEach(k => { if (p.changes && k in p.changes) l[k] = String(p.changes[k]); });
      saveL(); return pub(l);
    },

    async setStatus(p) {
      const user = await checkPassword(p.password); await wait(400);
      const l = find(p.id);
      if (['approved', 'disapproved', 'pending', 'hidden'].indexOf(p.status) === -1) throw new ApiError('ERROR', MSG.ERROR);
      l.status = p.status; l.statusNote = p.note || '';
      saveL(); return pub(l);
    },

    async writePayment(p) {
      const user = await checkPassword(p.password); await wait(500);
      const l = find(p.id);
      const amount = Number(p.amount);
      if (!(amount >= 0)) throw new ApiError('ERROR', 'Enter an amount of 0 or more.');
      const now = Date.now();
      if (l.payment) {
        // Repeat payment on an existing code: no new row, only Updated At changes
        l.payment.updatedAt = now;
        l.payment.updatedBy = user.displayName + ' (admin)';
      } else {
        l.payment = {
          amount, currency: p.currency === 'USDT' ? 'USDT' : 'NGN',
          method: 'Manual approval by admin',
          txId: 'ADMIN-MANUAL-' + rand(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
          source: 'ADMIN', paidAt: now, updatedAt: null, approvedBy: user.displayName, note: p.note || ''
        };
      }
      l.status = 'approved';
      l.statusNote = '';
      l.expiresAt = Math.max(now, l.expiresAt || 0) + 180 * DAY; // demo only: your real expiry code decides this
      if (!l.manageLink) l.manageLink = 'https://servicehub-amber.vercel.app/manage.html#k=' + hex(32);
      saveL(); return pub(l);
    },

    async regenerateLink(p) {
      await checkPassword(p.password); await wait(450);
      const l = find(p.id);
      l.manageLink = 'https://servicehub-amber.vercel.app/manage.html#k=' + hex(32);
      l.linkRegeneratedAt = Date.now();
      saveL(); return pub(l);
    },

    async getLink(p) {
      await checkPassword(p.password); await wait(300);
      const l = find(p.id);
      if (!l.manageLink) throw new ApiError('NOT_FOUND', 'This listing has no manage link yet.');
      return { manageLink: l.manageLink };
    },

    async pendingAdmins(p) {
      needSession(); await wait(350);
      if (Date.now() < codeGuard.until) throw new ApiError('LOCKED', MSG.LOCKED);
      const t = C.TEST_LOGIN;
      if (!t || !t.pendingCode || String(p.code || '') !== t.pendingCode) {
        if (++codeGuard.n >= 5) { codeGuard.until = Date.now() + 60000; codeGuard.n = 0; }
        throw new ApiError('BAD_CODE', MSG.BAD_CODE);
      }
      codeGuard.n = 0;
      return apps.filter(a => a.status !== 'approved').map(a => { const o = clone(a); delete o.pwdHash; return o; });
    },

    async logout() { return { ok: true }; },

    async extend(p) {
      await checkPassword(p.password); await wait(450);
      const l = find(p.id);
      const months = Math.max(1, Math.min(24, Number(p.months) || 6));
      l.expiresAt = Math.max(Date.now(), l.expiresAt || 0) + months * 30 * DAY;
      if (window.UI.categoryOf(l.status) === 'expired') l.status = 'approved';
      saveL(); return pub(l);
    }
  };

  /* Console helpers for testing the "pending until approved" flow */
  window.ADMIN_DEMO = {
    applicants() { return apps.map(a => ({ username: a.username, status: a.status, name: [a.firstName, a.middleName, a.lastName].join(' ') })); },
    approve(username) { const a = apps.find(x => norm(x.username) === norm(username)); if (a) { a.status = 'approved'; saveA(); return 'approved'; } return 'not found'; },
    reset() { try { localStorage.removeItem(LS_LIST); localStorage.removeItem(LS_APPS); } catch (e) {} location.reload(); }
  };

  const names = ['login', 'apply', 'listings', 'get', 'search', 'update', 'setStatus', 'writePayment', 'regenerateLink', 'extend', 'getLink', 'pendingAdmins', 'logout'];
  const API = {};
  names.forEach(n => { API[n] = C.MODE === 'live' ? p => live(n, p) : demo[n]; });
  window.API = API;
  window.ApiError = ApiError;
})();
