(function () {
  const C = window.ADMIN_CONFIG;
  const { esc, categoryOf, fmtDate, fmtDateTime, relDays, cap, toast, openModal } = UI;
  if (!Auth.require()) return;
  Auth.startIdle();

  const app = document.getElementById('app');
  const CATS = [
    { key: 'approved', label: 'Approved' }, { key: 'pending', label: 'Pending' },
    { key: 'disapproved', label: 'Disapproved' }, { key: 'expired', label: 'Expired' }, { key: 'others', label: 'Others' }
  ];
  let rows = [];
  let typeFilter = 'all';
  let adminCode = null, pendingAdmins = [];   // kept in memory only, cleared when leaving the Pending admins pages

  const typeOf = r => String(r.type || '').toLowerCase() === 'job' ? 'job' : 'service';
  const rowCat = r => categoryOf(r.status);

  function view(html) {
    app.innerHTML = '<div class="view-in">' + html + '</div>';
    window.scrollTo({ top: 0 });
  }
  function fail(msg) {
    view('<div class="glass empty"><b>Could not load this</b>' + esc(msg) + '<div style="margin-top:16px"><button class="btn btn-ghost btn-sm" onclick="location.reload()">Try again</button></div></div>');
  }

  /* ---------- header, search, sign out ---------- */
  const s = Auth.get();
  document.getElementById('whoName').textContent = s.user.displayName || s.user.username;
  document.getElementById('logout').addEventListener('click', () => Auth.logout('out'));
  if (C.MODE === 'demo') {
    document.getElementById('foot').innerHTML = 'Demo mode with fake listings. <button class="linkbtn" id="resetDemo">Reset demo data</button>';
    document.getElementById('resetDemo').addEventListener('click', () => ADMIN_DEMO.reset());
  }

  const q = document.getElementById('q'), msg = document.getElementById('searchMsg'), sbtn = document.getElementById('searchBtn');
  document.getElementById('searchForm').addEventListener('submit', async e => {
    e.preventDefault(); msg.hidden = true;
    const text = q.value.trim(); if (!text) return;
    sbtn.disabled = true; sbtn.textContent = 'Finding…';
    try {
      const r = await API.search({ q: text });
      q.value = '';
      location.hash = '#/listing/' + encodeURIComponent(r.id);
    } catch (ex) { msg.textContent = ex.message; msg.hidden = false; }
    sbtn.disabled = false; sbtn.textContent = 'Find';
  });
  q.addEventListener('input', () => { msg.hidden = true; });

  /* ---------- data ---------- */
  async function loadRows() { rows = await API.listings(); }

  /* ---------- home ---------- */
  function renderHome() {
    const total = rows.length;
    const cards = CATS.map(c => {
      const items = rows.filter(r => rowCat(r) === c.key);
      const jobs = items.filter(r => typeOf(r) === 'job').length;
      const svcs = items.length - jobs;
      return '<a class="stat glass hover" data-cat="' + c.key + '" href="#/list/' + c.key + '">' +
        '<div class="label"><i class="dot"></i>' + c.label + '</div>' +
        '<div class="num">' + items.length + '</div>' +
        '<div class="split"><span>Jobs<b>' + jobs + '</b></span><span>Services<b>' + svcs + '</b></span></div></a>';
    }).join('');
    const hr = new Date().getHours();
    const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const name = s.user.displayName || s.user.username;
    view('<div class="page-head"><div><h1>' + hello + ', ' + esc(name) + '</h1><p class="muted" style="margin-top:6px">' + total + ' listings in total. Tap a count to see the listings.</p></div>' +
      '<div class="dashboard-shortcuts" role="group" aria-label="Admin shortcuts">' +
      '<button class="btn btn-ghost btn-sm" id="openAdmins" type="button">Pending admins</button>' +
      '<button class="btn btn-ghost btn-sm" id="manageByLink" type="button">Manage by link</button>' +
      '</div></div>' +
      '<div class="stats">' + cards + '</div>');
    document.getElementById('openAdmins').addEventListener('click', () => { location.href = 'admin-info.html'; });
    // Open the existing management page without changing dashboard search behavior.
    document.getElementById('manageByLink').addEventListener('click', () => { window.location.href = 'manage.html'; });
  }

  /* ---------- pending admins (needs the access code from the sheet) ---------- */
  function adminCodeModal() {
    openModal({
      title: 'Pending admins', confirmText: 'Open',
      desc: 'Enter the access code to see the people waiting to be approved as admins.',
      fields: '<label class="field"><span>Access code</span><input class="input" type="password" name="code" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>',
      onConfirm: async v => {
        if (!v.code) throw new Error('Enter the access code to continue.');
        pendingAdmins = await API.pendingAdmins({ code: v.code });
        adminCode = true;
        location.hash = '#/admins';
      }
    });
  }

  function renderAdmins() {
    view('<a class="back" href="#/">‹ All listings</a>' +
      '<div class="page-head"><div><h1>Pending admins</h1><p class="muted" style="margin-top:6px">' + pendingAdmins.length + (pendingAdmins.length === 1 ? ' person is' : ' people are') + ' waiting. Approve them in the Admins sheet.</p></div></div>' +
      '<div class="rows">' + (pendingAdmins.length ? pendingAdmins.map(a =>
        '<a class="row glass hover" href="#/admin/' + encodeURIComponent(a.username) + '">' +
        '<div class="row-main"><strong>' + esc([a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ')) + '</strong><div class="row-meta"><span>' + esc(a.username) + '</span><span>' + esc(a.gender || '') + (a.age != null ? ', ' + esc(a.age) : '') + '</span><span>' + esc(a.location || '') + '</span></div></div>' +
        '<div class="row-side"><span class="chip" data-cat="pending"><i class="dot" style="width:7px;height:7px"></i>Pending</span>' +
        '<span class="faint" style="font-size:13px">Applied ' + esc(fmtDate(a.appliedAt)) + '</span><span class="chev">›</span></div></a>').join('')
        : '<div class="glass empty"><b>Nothing here</b>No admin applications are waiting right now.</div>') + '</div>');
  }

  function renderAdminDetail(username) {
    const a = pendingAdmins.find(x => String(x.username).toLowerCase() === String(username).toLowerCase());
    if (!a) return renderAdmins();
    const row = (label, v) => '<dt>' + label + '</dt><dd>' + dv(v) + '</dd>';
    const full = [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ');
    const guardian = a.guardianName ?
      '<section class="glass pad sec"><h3>Parent or guardian</h3><dl class="kv">' + row('Name', a.guardianName) + row('Relationship', a.guardianRelation) + row('Phone', a.guardianPhone) + row('Agrees', a.guardianOk ? 'Yes' : '') + '</dl></section>' : '';
    view('<a class="back" href="#/admins">‹ Pending admins</a>' +
      '<div class="detail-head"><div><h1>' + esc(full) + '</h1><div class="chips"><span class="chip" data-cat="pending"><i class="dot" style="width:7px;height:7px"></i>Pending</span>' +
      '<span class="chip plain">' + esc(a.username) + '</span></div></div></div>' +
      '<div class="grid2"><div class="col">' +
      '<section class="glass pad sec"><h3>About</h3><dl class="kv">' + row('Gender', a.gender) + row('Date of birth', a.dob) + row('Age', a.age) + row('Email', a.email) + row('Phone', a.phone) + row('Country', a.country) + row('State and city', a.location) + row('Applied on', fmtDateTime(a.appliedAt)) + '</dl></section>' +
      guardian +
      '<section class="glass pad sec"><h3>Education and experience</h3><dl class="kv">' + row('Education', a.education) + row('In school', a.inSchool) + row('School or field', a.school) + row('Occupation', a.occupation) + row('Languages', a.languages) + row('Skills', a.skills) + row('Experience', a.experience) + row('Details', a.experienceDetails) + '</dl></section>' +
      '</div><div class="col">' +
      '<section class="glass pad sec"><h3>Availability and motivation</h3><dl class="kv">' + row('Hours per week', a.hours) + row('Best time', a.timeOfDay) + row('Device', a.device) + row('Heard from', a.heardFrom) + row('Why', a.why) + row('Recommended by', a.referral) + '</dl></section>' +
      '<section class="glass pad sec"><h3>Approval</h3><p class="muted">To approve this person, set their status to approved in the Admins sheet. They can sign in once you do.</p></section>' +
      '</div></div>');
  }

  /* ---------- list ---------- */
  function renderList(cat) {
    const meta = CATS.find(c => c.key === cat);
    view('<a class="back" href="#/">‹ All listings</a>' +
      '<div class="page-head"><div><h1>' + meta.label + '</h1><p class="muted" style="margin-top:6px" id="listCount"></p></div>' +
      '<div class="seg glass" id="seg">' +
      ['all', 'job', 'service'].map(t => '<button data-t="' + t + '" class="' + (typeFilter === t ? 'on' : '') + '">' + (t === 'all' ? 'All' : t === 'job' ? 'Jobs' : 'Services') + '</button>').join('') +
      '</div></div><div class="rows" id="rows"></div>');
    function draw() {
      const items = rows.filter(r => rowCat(r) === cat && (typeFilter === 'all' || typeOf(r) === typeFilter))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      document.getElementById('listCount').textContent = items.length + (items.length === 1 ? ' listing' : ' listings');
      document.getElementById('rows').innerHTML = items.length ? items.map(r =>
        '<a class="row glass hover" href="#/listing/' + encodeURIComponent(r.id) + '">' +
        '<div class="row-main"><strong>' + esc(r.title) + '</strong><div class="row-meta"><span>' + esc(r.id) + '</span><span>' + esc(r.ownerName) + '</span><span>' + esc(r.category) + '</span></div></div>' +
        '<div class="row-side">' +
        '<span class="chip plain">' + (typeOf(r) === 'job' ? 'Job' : 'Service') + '</span>' +
        '<span class="chip" data-cat="' + cat + '"><i class="dot" style="width:7px;height:7px"></i>' + esc(cap(r.status)) + '</span>' +
        (r.expiresAt ? '<span class="faint" style="font-size:13px">' + (r.expiresAt < Date.now() ? 'Expired ' : 'Expires ') + esc(fmtDate(r.expiresAt)) + '</span>' : '') +
        '<span class="chev">›</span></div></a>').join('')
        : '<div class="glass empty"><b>Nothing here</b>No ' + (typeFilter === 'all' ? '' : typeFilter + ' ') + meta.label.toLowerCase() + ' listings right now.</div>';
    }
    draw();
    document.getElementById('seg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      typeFilter = b.dataset.t;
      document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('on', x === b));
      draw();
    });
  }

  /* ---------- detail ---------- */
  const EDIT_FIELDS = ['title', 'type', 'category', 'description', 'location', 'ownerName', 'phone', 'whatsapp', 'email', 'pricing', 'customPricing'];

  async function renderDetail(id) {
    view('<a class="back" href="#/">‹ All listings</a><div class="glass skeleton"></div>');
    let l;
    try { l = await API.get({ id }); } catch (ex) { return fail(ex.message); }
    drawDetail(l, false);
  }

  function gradient(seed) {
    let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return 'linear-gradient(135deg,hsl(' + h + ' 80% 62%),hsl(' + ((h + 70) % 360) + ' 80% 55%))';
  }
  const dv = v => (v === '' || v == null) ? '<span class="faint">Not set</span>' : esc(v);

  function drawDetail(l, editing) {
    const cat = categoryOf(l.status);
    const val = k => esc(l[k] == null ? '' : l[k]);
    const f = (k, label, type) => editing
      ? '<label class="field" style="margin:0"><span class="sr">' + label + '</span>' +
        (type === 'area' ? '<textarea class="input" name="' + k + '">' + val(k) + '</textarea>'
          : type === 'type' ? '<select class="input" name="type"><option value="service"' + (l.type === 'service' ? ' selected' : '') + '>Service</option><option value="job"' + (l.type === 'job' ? ' selected' : '') + '>Job</option></select>'
          : '<input class="input" name="' + k + '" value="' + val(k) + '">') + '</label>'
      : dv(l[k]);

    const media = (l.media || []).map((m, i) => '<i style="background-image:' + (m && m.url ? 'url(' + esc(m.url) + ')' : gradient(l.id + i)) + '" title="Media ' + (i + 1) + '"></i>').join('');
    const manual = l.payment && (String(l.payment.txId).indexOf('ADMIN') === 0 || l.payment.source === 'ADMIN');

    const left =
      '<section class="glass pad sec"><h3>Listing</h3><dl class="kv">' +
      '<dt>Title</dt><dd>' + f('title', 'Title') + '</dd>' +
      '<dt>Type</dt><dd>' + (editing ? f('type', 'Type', 'type') : esc(cap(l.type))) + '</dd>' +
      '<dt>Category</dt><dd>' + f('category', 'Category') + '</dd>' +
      '<dt>Description</dt><dd>' + f('description', 'Description', 'area') + '</dd>' +
      '<dt>Location</dt><dd>' + f('location', 'Location') + '</dd>' +
      '<dt>Listed on</dt><dd>' + esc(fmtDateTime(l.createdAt)) + '</dd>' +
      '<dt>Subscription</dt><dd>' + (l.expiresAt ? (l.expiresAt < Date.now() ? 'Expired ' : 'Expires ') + esc(fmtDate(l.expiresAt)) + ' <span class="faint">(' + esc(relDays(l.expiresAt)) + ')</span>' : '<span class="faint">Not started</span>') + '</dd>' +
      '<dt>Likes</dt><dd>' + esc(l.likes || 0) + '</dd>' +
      '<dt>Media</dt><dd>' + (media ? '<div class="media">' + media + '</div>' : '<span class="faint">None</span>') + '</dd>' +
      '</dl></section>' +
      '<section class="glass pad sec"><h3>Owner and contact</h3><dl class="kv">' +
      '<dt>Name</dt><dd>' + f('ownerName', 'Owner name') + '</dd>' +
      '<dt>Phone</dt><dd>' + f('phone', 'Phone') + '</dd>' +
      '<dt>WhatsApp</dt><dd>' + f('whatsapp', 'WhatsApp') + '</dd>' +
      '<dt>Email</dt><dd>' + f('email', 'Email') + '</dd></dl></section>' +
      '<section class="glass pad sec"><h3>Pricing</h3><dl class="kv">' +
      '<dt>Pricing</dt><dd>' + f('pricing', 'Pricing') + '</dd>' +
      '<dt>Custom pricing</dt><dd>' + f('customPricing', 'Custom pricing') + '</dd></dl></section>';

    const p = l.payment;
    const payment = '<section class="glass pad sec"><h3>Payment</h3>' + (p ?
      '<dl class="kv"><dt>Payment code</dt><dd><span class="copyable" data-copy="' + esc(l.paymentCode) + '" title="Copy">' + esc(l.paymentCode) + '</span></dd>' +
      '<dt>Amount</dt><dd>' + esc(p.amount) + ' ' + esc(p.currency) + '</dd>' +
      '<dt>Method</dt><dd>' + esc(p.method) + '</dd>' +
      '<dt>Transaction ID</dt><dd><span class="copyable" data-copy="' + esc(p.txId) + '" title="Copy">' + esc(p.txId) + '</span>' +
      (manual ? ' <span class="chip manual">Approved manually' + (p.approvedBy ? ' by ' + esc(p.approvedBy) : '') + '</span>' : '') + '</dd>' +
      '<dt>Source</dt><dd>' + esc(p.source) + '</dd>' +
      '<dt>Paid at</dt><dd>' + esc(fmtDateTime(p.paidAt)) + '</dd>' +
      '<dt>Updated at</dt><dd>' + (p.updatedAt ? esc(fmtDateTime(p.updatedAt)) + (p.updatedBy ? ' <span class="faint">by ' + esc(p.updatedBy) + '</span>' : '') : '<span class="faint">No repeat payments</span>') + '</dd></dl>'
      : '<dl class="kv"><dt>Payment code</dt><dd><span class="copyable" data-copy="' + esc(l.paymentCode) + '" title="Copy">' + esc(l.paymentCode) + '</span></dd></dl>' +
        '<p class="muted" style="margin-top:14px">No payment recorded for this listing. If the owner paid and it did not come through, use Write payment.</p>') + '</section>';

    const link = '<section class="glass pad sec"><h3>Manage link</h3>' + (l.hasLink ?
      '<div class="copyfield"><input class="input" id="linkField" readonly value="' + '\u2022'.repeat(36) + '" aria-label="Manage link (hidden)"><button class="btn btn-ghost" type="button" data-act="copylink">Copy</button></div>' +
      '<p class="hint" style="margin:-6px 0 12px">The link is hidden. Copying it asks for your password.</p>' +
      '<p class="warn">Anyone with this link can read this listing\'s chats and edit it. Give it only to the verified owner.</p>' +
      (l.linkRegeneratedAt ? '<p class="hint" style="margin:-6px 0 12px">Regenerated ' + esc(fmtDateTime(l.linkRegeneratedAt)) + '</p>' : '') +
      '<button class="btn btn-danger btn-sm" type="button" data-act="regen">Regenerate link</button>'
      : '<p class="muted">No link yet. It is created when the payment is confirmed.</p>') + '</section>';

    const acts = [];
    if (editing) {
      acts.push('<button class="btn btn-primary btn-sm" data-act="save">Save changes</button><button class="btn btn-ghost btn-sm" data-act="cancel">Cancel</button>');
    } else {
      if (cat === 'pending') acts.push('<button class="btn btn-primary btn-sm" data-act="approve">Approve</button><button class="btn btn-danger btn-sm" data-act="disapprove">Disapprove</button>');
      else if (cat === 'approved') acts.push('<button class="btn btn-danger btn-sm" data-act="disapprove">Disapprove</button><button class="btn btn-ghost btn-sm" data-act="hide">Hide</button>');
      else if (cat === 'disapproved') acts.push('<button class="btn btn-primary btn-sm" data-act="approve">Re-approve</button>');
      else if (cat === 'others') acts.push('<button class="btn btn-primary btn-sm" data-act="approve">Re-approve</button>');
      acts.push('<button class="btn btn-ghost btn-sm" data-act="pay">Write payment</button>');
      acts.push('<button class="btn btn-ghost btn-sm" data-act="extend">' + (cat === 'expired' ? 'Renew subscription' : 'Extend subscription') + '</button>');
      acts.push('<button class="btn btn-ghost btn-sm" data-act="edit">Edit details</button>');
    }
    const actions = '<section class="glass pad sec"><h3>Actions</h3><div class="actions">' + acts.join('') + '</div>' +
      (l.statusNote ? '<p class="muted" style="margin-top:14px;font-size:14px">Note: ' + esc(l.statusNote) + '</p>' : '') + '</section>';

    view('<a class="back" href="#/list/' + cat + '">‹ ' + (CATS.find(c => c.key === cat) || {}).label + '</a>' +
      '<div class="detail-head"><div><h1>' + esc(l.title) + '</h1><div class="chips">' +
      '<span class="chip" data-cat="' + cat + '"><i class="dot" style="width:7px;height:7px"></i>' + esc(cap(l.status)) + '</span>' +
      '<span class="chip plain">' + (typeOf(l) === 'job' ? 'Job' : 'Service') + '</span>' +
      '<span class="chip plain copyable" data-copy="' + esc(l.id) + '" title="Copy ID">' + esc(l.id) + '</span></div></div></div>' +
      '<div class="grid2"><form class="col" id="editForm" novalidate>' + left + '</form><div class="col">' + actions + payment + link + '</div></div>');

    bindActions(l, editing);
  }

  async function refresh(id, message) {
    const [l] = await Promise.all([API.get({ id }), loadRows()]);
    if (message) toast(message, 'ok');
    drawDetail(l, false);
  }

  function bindActions(l, editing) {
    const id = l.id;
    app.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => {
      const a = btn.dataset.act;
      if (a === 'edit') return drawDetail(l, true);
      if (a === 'cancel') return drawDetail(l, false);
      if (a === 'save') return save();
      if (a === 'approve' || a === 'disapprove' || a === 'hide') return statusModal(a);
      if (a === 'pay') return payModal();
      if (a === 'extend') return extendModal();
      if (a === 'regen') return regenModal();
      if (a === 'copylink') return copyLinkModal();
    }));

    const LABELS = { title: 'Title', type: 'Type', category: 'Category', description: 'Description', location: 'Location', ownerName: 'Owner name', phone: 'Phone', whatsapp: 'WhatsApp', email: 'Email', pricing: 'Pricing', customPricing: 'Custom pricing' };

    function save() {
      const form = document.getElementById('editForm');
      const all = {}; new FormData(form).forEach((v, k) => { all[k] = String(v).trim(); });
      if (!all.title) { toast('The title cannot be empty.', 'bad'); return; }
      const changes = {};
      EDIT_FIELDS.forEach(k => { if (k in all && all[k] !== String(l[k] == null ? '' : l[k]).trim()) changes[k] = all[k]; });
      const keys = Object.keys(changes);
      if (!keys.length) { toast('Nothing was changed.'); return drawDetail(l, false); }
      openModal({
        title: 'Save changes?', password: true, confirmText: 'Save changes',
        desc: 'Are you sure you want to save these changes? You changed: ' + keys.map(k => esc(LABELS[k] || k)).join(', ') + '.',
        onConfirm: async (v, pw) => { await API.update({ id, changes, password: pw }); await refresh(id, 'Changes saved'); }
      });
    }

    function copyLinkModal() {
      openModal({
        title: 'Copy manage link', password: true, confirmText: 'Copy link',
        desc: 'Enter your password to copy this link. Anyone with it can read this listing\'s chats and edit it.',
        onConfirm: async (v, pw) => {
          const r = await API.getLink({ id, password: pw });
          if (await UI.copyText(r.manageLink)) { toast('Link copied', 'ok', 1800); return; }
          // Browser blocked the copy: show the link briefly so it can be copied by hand
          const f = document.getElementById('linkField');
          if (f) { f.value = r.manageLink; f.select(); setTimeout(() => { f.value = '\u2022'.repeat(36); }, 30000); }
          toast('Copy failed. The link is shown for 30 seconds. Copy it by hand.', 'bad', 4000);
        }
      });
    }

    function statusModal(a) {
      const map = {
        approve: { status: 'approved', title: (categoryOf(l.status) === 'pending' ? 'Approve' : 'Re-approve') + ' this listing?', btn: 'Approve', done: 'Listing approved', danger: false },
        disapprove: { status: 'disapproved', title: 'Disapprove this listing?', btn: 'Disapprove', done: 'Listing disapproved', danger: true },
        hide: { status: 'hidden', title: 'Hide this listing?', btn: 'Hide', done: 'Listing hidden', danger: true }
      }[a];
      let desc = a === 'approve' ? 'The listing goes live on ServiceHub.' : a === 'hide' ? 'The listing disappears from ServiceHub. You can re-approve it later.' : 'The listing is taken down. Add a short reason so the team knows why.';
      if (a === 'approve' && !l.payment) desc += '<br><br><b style="color:#ffd9a0">This listing has no payment.</b> Use Write payment instead if the owner did pay.';
      openModal({
        title: map.title, desc, password: true, confirmText: map.btn, danger: map.danger,
        fields: a === 'approve' ? '' : '<label class="field"><span>Reason <em>(optional)</em></span><textarea class="input" name="note" style="min-height:76px"></textarea></label>',
        onConfirm: async (v, pw) => { await API.setStatus({ id, status: map.status, note: v.note || '', password: pw }); await refresh(id, map.done); }
      });
    }

    function payModal() {
      const has = !!l.payment;
      openModal({
        title: 'Write payment', password: true, confirmText: 'Write payment',
        desc: has ? 'This listing already has a payment. Nothing new is added; only its Updated at date changes, and the listing is approved and renewed.'
          : 'Records a payment that was not captured and approves the listing. It gets a transaction ID starting with ADMIN-MANUAL so it is clear the owner did not pay through the normal flow.',
        fields: has ? '' :
          '<div class="grid-fields"><label class="field"><span>Amount</span><input class="input" name="amount" type="number" min="0" step="any" value="1000" required></label>' +
          '<label class="field"><span>Currency</span><select class="input" name="currency"><option value="NGN">NGN</option><option value="USDT">USDT</option></select></label></div>' +
          '<label class="field"><span>Note <em>(optional)</em></span><input class="input" name="note" placeholder="Why this is being written manually"></label>',
        onConfirm: async (v, pw) => { await API.writePayment({ id, amount: has ? l.payment.amount : v.amount, currency: has ? l.payment.currency : v.currency, note: v.note || '', password: pw }); await refresh(id, 'Payment written'); }
      });
    }

    function extendModal() {
      openModal({
        title: categoryOf(l.status) === 'expired' ? 'Renew subscription' : 'Extend subscription', password: true, confirmText: 'Extend',
        desc: 'Adds time to the subscription.' + (categoryOf(l.status) === 'expired' ? ' The listing becomes approved again.' : ''),
        fields: '<label class="field"><span>Add</span><select class="input" name="months"><option value="1">1 month</option><option value="3">3 months</option><option value="6" selected>6 months</option><option value="12">12 months</option></select></label>',
        onConfirm: async (v, pw) => { await API.extend({ id, months: v.months, password: pw }); await refresh(id, 'Subscription extended'); }
      });
    }

    function regenModal() {
      openModal({
        title: 'Regenerate manage link', password: true, confirmText: 'Regenerate', danger: true,
        desc: 'The current link stops working immediately and a new one is created. Do this only after you have verified the owner.',
        onConfirm: async (v, pw) => { await API.regenerateLink({ id, password: pw }); await refresh(id, 'New link created'); }
      });
    }
  }

  /* ---------- router ---------- */
  function route() {
    const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
    if (a !== 'admins' && a !== 'admin') { adminCode = null; pendingAdmins = []; }   // leaving locks Pending admins again
    if (a === 'admins' && adminCode) return renderAdmins();
    if (a === 'admin' && b && adminCode) return renderAdminDetail(decodeURIComponent(b));
    if (a === 'list' && CATS.some(c => c.key === b)) return renderList(b);
    if (a === 'listing' && b) return renderDetail(decodeURIComponent(b));
    renderHome();
  }
  window.addEventListener('hashchange', async () => {
    const a = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (a !== 'listing' && a !== 'admins' && a !== 'admin') { try { await loadRows(); } catch (e) {} }
    route();
  });

  (async function boot() {
    view('<div class="glass skeleton"></div>');
    try { await loadRows(); } catch (ex) { return fail(ex.message); }
    route();
  })();
})();
