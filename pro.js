/* =====================================================================
   Viper OS — pro.js
   The "Fortune 500" layer, loaded last so it can extend everything:
     • Role logins  (Owner · Field Tech · Customer)
     • Field / Dispatch mode  (mobile, on-my-way texts, photos, status sync)
     • Customer portal  (progress photos, approvals, payments, messaging)
     • Branded, editable message templates + Outbox
     • Editable automations + a real stage-automation engine
     • A much deeper, customizable dashboard
   ===================================================================== */
(function (global) {
  'use strict';
  var App = global.App, Store = global.Store;
  if (!App || !Store) return;
  var f = App._fmt, ui = App._ui, ch = App._charts, icon = App.icon;
  var money = f.money, money2 = f.money2, esc = f.esc, fmtDate = f.fmtDate, fmtDateY = f.fmtDateY, fmtTime = f.fmtTime, relDay = f.relDay, initials = f.initials;
  var btn = ui.btn, avatar = ui.avatar, pill = ui.pill, statusPill = ui.statusPill;
  var A = App.actions, V = App.views;
  function card(inner, cls) { return '<div class="card ' + (cls || '') + '">' + inner + '</div>'; }
  function field(label, inner) { return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inner + '</label>'; }
  function input(id, attrs) { return '<input id="' + id + '" class="inp" ' + (attrs || '') + '>'; }
  function mapsUrl(addr) { return 'https://maps.google.com/?q=' + encodeURIComponent(addr || ''); }

  /* =================================================================
     SESSION + BRANDING + LAUNCH DISPATCH
     ================================================================= */
  var SESS = 'viper-os.session';
  function loadSession() { try { var r = localStorage.getItem(SESS); if (r) return JSON.parse(r); } catch (e) {} return { role: 'owner', userId: 'u_owner' }; }
  function saveSession(s) { App.session = s; try { localStorage.setItem(SESS, JSON.stringify(s)); } catch (e) {} }
  App.session = App.session || loadSession();
  function applyBranding() { try { document.documentElement.style.setProperty('--brand', Store.state().settings.branding.primary); } catch (e) {} }

  App.launch = function () {
    applyBranding();
    App._bindGlobal && App._bindGlobal();
    var role = (App.session && App.session.role) || 'owner';
    document.body.classList.remove('mode-field', 'mode-portal');
    if (role === 'tech') { document.body.classList.add('mode-field'); Field.boot(); }
    else if (role === 'portal') { document.body.classList.add('mode-portal'); Portal.boot(); }
    else { App.boot(); }
  };

  /* =================================================================
     SHARED: image picker, real-or-simulated send
     ================================================================= */
  function ensureImgInput() {
    var el = document.getElementById('img-file');
    if (!el) {
      el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*'; el.id = 'img-file'; el.style.display = 'none';
      el.addEventListener('change', function () {
        var file = el.files && el.files[0]; if (!file || !App._imgCb) { el.value = ''; return; }
        var rd = new FileReader();
        rd.onload = function () { var cb = App._imgCb; App._imgCb = null; el.value = ''; cb(rd.result); };
        rd.readAsDataURL(file);
      });
      document.body.appendChild(el);
    }
    return el;
  }
  App._pickImage = function (cb) { var el = ensureImgInput(); App._imgCb = cb; el.click(); };

  function sendComm(contactId, tplOrEvent, ctx) {
    var tpl = (typeof tplOrEvent === 'string' && Store.template(tplOrEvent)) || Store.templateForEvent(tplOrEvent);
    if (!tpl || !tpl.enabled) return null;
    var c = Store.get('contacts', contactId); ctx = ctx || {};
    if (c && !ctx.client_name) ctx.client_name = (c.name || '').split(' ')[0];
    if (c && !ctx.address) ctx.address = c.address;
    var r = Store.renderTemplate(tpl, ctx);
    var rec = Store.recordOutbox({ contactId: contactId, channel: tpl.channel, templateId: tpl.id, subject: r.subject, body: r.body, status: 'sent' });
    try {
      fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: tpl.channel, to: tpl.channel === 'sms' ? (c && c.phone) : (c && c.email), subject: r.subject, body: r.body }) }).catch(function () {});
    } catch (e) {}
    return rec;
  }
  App.sendComm = sendComm;

  /* =================================================================
     LOGIN / ROLE CHOOSER  (overlay)
     ================================================================= */
  function loginHTML() {
    var s = Store.state().settings;
    var techs = Store.all('team');
    var custs = Store.all('contacts');
    var mark = s.branding.logo ? '<div class="login-logo" style="background-image:url(' + s.branding.logo + ')"></div>' : '<div class="login-mark">' + icon('bolt') + '</div>';
    var techList = techs.map(function (m) {
      return '<button class="login-row" data-action="do-login" data-role="tech" data-user="' + m.id + '">' + avatar(m.name, 34, m.color) +
        '<div><div class="lr-title">' + esc(m.name) + '</div><div class="lr-sub">' + esc(m.role) + '</div></div>' + icon('chevR') + '</button>';
    }).join('');
    var custList = custs.map(function (c) {
      return '<button class="login-row" data-action="do-login" data-role="portal" data-user="' + c.id + '" data-name="' + esc((c.name + ' ' + c.company).toLowerCase()) + '">' + avatar(c.name, 34) +
        '<div><div class="lr-title">' + esc(c.name) + '</div><div class="lr-sub">' + esc(c.company || c.type) + '</div></div>' + icon('chevR') + '</button>';
    }).join('');
    return '<div class="login-panel">' +
      '<button class="login-close icon-btn" data-action="close-login" aria-label="Close">' + icon('x') + '</button>' +
      '<div class="login-head">' + mark + '<div><div class="login-title">' + esc(s.business.name) + ' OS</div><div class="login-sub">Choose how you\'re signing in</div></div></div>' +
      '<div class="login-grid">' +
        '<div class="login-col"><div class="login-col-head">' + icon('gauge') + '<span>Owner / Admin</span></div><p class="login-desc">Full command center — pipeline, money, dispatch, reports.</p>' +
          '<button class="login-row big" data-action="do-login" data-role="owner" data-user="u_owner">' + avatar('Marcus Vance', 34, '#4f46e5') + '<div><div class="lr-title">Marcus Vance</div><div class="lr-sub">Owner · full access</div></div>' + icon('chevR') + '</button></div>' +
        '<div class="login-col"><div class="login-col-head">' + icon('truck') + '<span>Field Tech</span></div><p class="login-desc">Mobile dispatch — today\'s jobs, on-my-way texts, photos.</p><div class="login-list">' + techList + '</div></div>' +
        '<div class="login-col"><div class="login-col-head">' + icon('portal') + '<span>Customer</span></div><p class="login-desc">Client portal — track progress, see photos, approve & pay.</p>' +
          '<div class="search-inp" style="margin-bottom:8px"><span>' + icon('search') + '</span><input id="login-cust-search" placeholder="Find your account…"></div>' +
          '<div class="login-list" id="login-cust-list">' + custList + '</div></div>' +
      '</div>' +
      '<div class="login-foot">New customer? <button class="login-link" data-action="open-request-form">Request a quote →</button><br>Demo sign-in — no password needed. Real authentication arrives with the Supabase backend (see README).</div>' +
    '</div>';
  }
  function openLogin() {
    var el = document.getElementById('login-screen');
    if (!el) { el = document.createElement('div'); el.id = 'login-screen'; document.body.appendChild(el); }
    el.innerHTML = loginHTML(); el.classList.add('open'); document.body.classList.add('login-open');
    var s = document.getElementById('login-cust-search');
    if (s) s.addEventListener('input', function () {
      var q = s.value.toLowerCase();
      Array.prototype.forEach.call(document.querySelectorAll('#login-cust-list .login-row'), function (r) {
        r.style.display = (!q || r.getAttribute('data-name').indexOf(q) >= 0) ? '' : 'none';
      });
    });
  }
  function closeLogin() { var el = document.getElementById('login-screen'); if (el) { el.classList.remove('open'); el.innerHTML = ''; } document.body.classList.remove('login-open'); }
  App._closeLogin = closeLogin;
  A['open-login'] = function () { openLogin(); };
  A['close-login'] = function () { closeLogin(); };
  A['do-login'] = function (el, d) {
    saveSession({ role: d.role, userId: d.user });
    try { if (d.role === 'owner' && global.location) global.location.hash = 'home'; } catch (e) {}
    closeLogin();
    App.launch();
    if (d.role === 'owner' && App.go) App.go('home');
    var who = d.role === 'owner' ? 'owner dashboard' : d.role === 'tech' ? 'field mode' : 'customer portal';
    App.toast('Signed in — ' + who + '.');
  };
  A['logout'] = function () { openLogin(); };

  /* =================================================================
     FIELD / DISPATCH MODE  (technician, mobile-first)
     ================================================================= */
  var Field = { state: { screen: 'today', jobId: null } };
  function meUser() { return Store.get('team', App.session.userId) || Store.all('team')[0]; }

  Field.boot = function () {
    var s = Store.state().settings, m = meUser();
    var logo = s.branding.logo ? '<div class="fld-logo" style="background-image:url(' + s.branding.logo + ')"></div>' : '<div class="fld-mark">' + icon('bolt') + '</div>';
    document.getElementById('topbar').innerHTML =
      '<div class="fld-head">' + logo + '<div class="fld-biz">' + esc(s.business.name) + '<span>Field</span></div>' +
      '<div class="fld-me">' + avatar(m.name, 30, m.color) + '<span>' + esc(m.name.split(' ')[0]) + '</span></div>' +
      '<button class="icon-btn" data-action="logout" aria-label="Log out">' + icon('logout') + '</button></div>';
    ensureFieldNav();
    Field.go(Field.state.screen);
  };
  function ensureFieldNav() {
    var main = document.getElementById('main');
    var nav = document.getElementById('field-nav');
    if (!nav) { nav = document.createElement('div'); nav.id = 'field-nav'; main.appendChild(nav); }
    var items = [['today', 'Today', 'jobs'], ['schedule', 'Schedule', 'calendar'], ['messages', 'Messages', 'inbox']];
    nav.innerHTML = items.map(function (it) {
      return '<button class="fnav-item' + (Field.state.screen === it[0] ? ' on' : '') + '" data-action="f-nav" data-screen="' + it[0] + '">' + icon(it[2]) + '<span>' + it[1] + '</span></button>';
    }).join('');
  }
  Field.go = function (screen, jobId) {
    Field.state.screen = screen; if (jobId !== undefined) Field.state.jobId = jobId;
    ensureFieldNav();
    var view = document.getElementById('view');
    view.innerHTML = Field.render(); view.scrollTop = 0;
    Array.prototype.forEach.call(view.querySelectorAll('.rise'), function (el, i) { el.style.animationDelay = (i * 0.04) + 's'; });
  };
  Field.render = function () {
    if (Field.state.screen === 'job') return Field.jobScreen(Field.state.jobId);
    if (Field.state.screen === 'schedule') return Field.scheduleScreen();
    if (Field.state.screen === 'messages') return Field.messagesScreen();
    return Field.todayScreen();
  };
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function statusLabel(s) { return ({ scheduled: 'Scheduled', in_progress: 'Work started', complete: 'Completed', invoiced: 'Invoiced' })[s] || s; }
  function fieldJobCard(j) {
    var c = Store.get('contacts', j.contactId);
    var cls = j.status === 'complete' || j.status === 'invoiced' ? 'done' : j.status === 'in_progress' ? 'active' : '';
    return '<button class="fld-job rise ' + cls + '" data-action="f-open-job" data-id="' + j.id + '">' +
      '<div class="fld-job-time mono">' + esc(fmtTime(j.time)) + '</div>' +
      '<div class="fld-job-main"><div class="fld-job-title">' + esc(j.title) + '</div>' +
      '<div class="fld-job-sub">' + esc(c ? c.name : '') + '</div>' +
      '<div class="fld-job-addr">' + icon('pin') + esc(j.address || '') + '</div></div>' +
      '<div class="fld-job-right">' + statusPill(j.status) + icon('chevR') + '</div></button>';
  }
  Field.todayScreen = function () {
    var m = meUser(); var today = Store.iso(Store.now);
    var jobs = Store.jobsForTech(m.id, today);
    var done = jobs.filter(function (j) { return j.status === 'complete' || j.status === 'invoiced'; }).length;
    var hero = '<div class="fld-hero rise"><div class="fld-hero-glow"></div><div class="fld-greet">' + greeting() + ', ' + esc(m.name.split(' ')[0]) + '</div>' +
      '<div class="fld-date mono">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</div>' +
      '<div class="fld-hero-stats"><div><span class="mono">' + jobs.length + '</span>jobs</div><div><span class="mono">' + done + '</span>done</div><div><span class="mono">' + (jobs.length - done) + '</span>left</div></div></div>';
    var list = jobs.length ? jobs.map(fieldJobCard).join('') : '<div class="empty rise"><div class="empty-ic">' + icon('check') + '</div><p>No jobs scheduled today. Enjoy the day.</p></div>';
    return hero + '<div class="fld-sec">Your route</div>' + list;
  };
  Field.scheduleScreen = function () {
    var m = meUser();
    var jobs = Store.all('jobs').filter(function (j) { return j.assignedTo === m.id; }).sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var byDay = {}; jobs.forEach(function (j) { (byDay[j.date] = byDay[j.date] || []).push(j); });
    var days = Object.keys(byDay).sort();
    if (!days.length) return '<div class="fld-sec">Schedule</div><div class="empty"><p>Nothing on the calendar.</p></div>';
    return '<div class="fld-sec">Upcoming</div>' + days.map(function (d) {
      return '<div class="fld-day-h mono rise">' + fmtDateY(d) + '</div>' + byDay[d].map(fieldJobCard).join('');
    }).join('');
  };
  Field.messagesScreen = function () {
    var cvs = Store.all('conversations').slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return '<div class="fld-sec">Messages</div>' + cvs.map(function (cv) {
      var c = Store.get('contacts', cv.contactId); var last = cv.messages[cv.messages.length - 1];
      return '<button class="fld-msg rise" data-action="f-open-msg" data-id="' + cv.id + '">' + avatar(c ? c.name : '?', 40) +
        '<div class="fld-msg-main"><div class="fld-msg-top"><span>' + esc(c ? c.name : '') + '</span><span class="mono">' + relDay(cv.at) + '</span></div>' +
        '<div class="fld-msg-prev">' + esc(last.text) + '</div></div></button>';
    }).join('');
  };
  Field.jobScreen = function (id) {
    var j = Store.get('jobs', id); if (!j) return Field.todayScreen();
    var c = Store.get('contacts', j.contactId);
    var timeline = (j.statusLog || []).map(function (s, i, arr) {
      return '<div class="tl-row"><div class="tl-dot' + (i === arr.length - 1 ? ' on' : '') + '"></div><div class="tl-main"><div class="tl-title">' + statusLabel(s.status) + '</div><div class="tl-when mono">' + fmtDateY((s.at || '').slice(0, 10)) + '</div></div></div>';
    }).join('');
    var photos = (j.photos || []).map(function (p) {
      return '<figure class="ph"><img src="' + p.url + '" alt=""><figcaption>' + esc(p.caption || '') + '</figcaption></figure>';
    }).join('');
    var actions = '';
    if (j.status === 'scheduled') {
      actions = '<button class="fld-big brand" data-action="f-omw" data-id="' + j.id + '">' + icon('truck') + 'I\'m on my way' + (j.onMyWayAt ? ' ✓' : '') + '</button>' +
        '<button class="fld-big" data-action="f-start" data-id="' + j.id + '">' + icon('play') + 'Start job</button>';
    } else if (j.status === 'in_progress') {
      actions = '<button class="fld-big" data-action="f-add-photo" data-id="' + j.id + '">' + icon('camera') + 'Add photo</button>' +
        '<button class="fld-big" data-action="f-add-note" data-id="' + j.id + '">' + icon('edit') + 'Add note</button>' +
        '<button class="fld-big brand" data-action="f-complete" data-id="' + j.id + '">' + icon('check') + 'Complete job</button>';
    } else {
      actions = '<div class="fld-done-banner">' + icon('check') + 'Job complete — great work.</div>' +
        '<button class="fld-big" data-action="f-add-photo" data-id="' + j.id + '">' + icon('camera') + 'Add photo</button>';
    }
    return '<button class="fld-back rise" data-action="f-nav" data-screen="today">' + icon('chevL') + 'Today</button>' +
      '<div class="fld-job-head rise"><div class="fld-job-title big">' + esc(j.title) + '</div>' + statusPill(j.status) + '</div>' +
      '<div class="fld-contact rise">' + avatar(c ? c.name : '?', 44) + '<div class="fld-contact-main"><div class="lr-title">' + esc(c ? c.name : '') + '</div><div class="lr-sub">' + esc(j.address || '') + '</div></div>' +
        '<a class="icon-btn" href="tel:' + esc(c ? c.phone : '') + '">' + icon('phone') + '</a>' +
        '<a class="icon-btn" href="' + mapsUrl(j.address) + '" target="_blank" rel="noopener">' + icon('map') + '</a></div>' +
      (j.notes ? '<div class="fld-notes rise"><div class="fld-lbl">Scope & notes</div>' + esc(j.notes) + '</div>' : '') +
      (j.items && j.items.length ? '<div class="fld-notes rise"><div class="fld-lbl">Line items</div>' + j.items.map(function (it) { return '<div class="fld-li">' + esc(it.desc) + '<span class="mono">' + money((it.qty || 1) * it.rate) + '</span></div>'; }).join('') + '</div>' : '') +
      '<div class="fld-actions rise">' + actions + '</div>' +
      '<div class="fld-lbl rise">Progress photos' + (j.photos && j.photos.length ? ' · ' + j.photos.length : '') + '</div>' +
      '<div class="ph-grid rise">' + (photos || '<div class="ph-empty">No photos yet — tap “Add photo” to document the work. Your customer sees these live.</div>') + '</div>' +
      '<div class="fld-lbl rise">Status timeline</div><div class="tl rise">' + timeline + '</div>';
  };
  function setJobStatus(id, status) {
    var j = Store.get('jobs', id); if (!j) return;
    j.status = status; (j.statusLog = j.statusLog || []).push({ status: status, at: Store.nowISO(), by: App.session.userId });
    Store.save();
  }
  App._addJobPhoto = function (id, url, caption) {
    var j = Store.get('jobs', id); if (!j) return;
    (j.photos = j.photos || []).push({ id: Store.uid('ph'), url: url, caption: caption || '', at: Store.nowISO(), by: App.session.userId });
    Store.save();
  };
  function promptText(title, initial, cb) {
    App.openModal(title, input('prompt-in', 'value="' + esc(initial) + '"'), btn('Skip', { action: 'close-modal' }) + btn('Save', { variant: 'brand', action: 'prompt-ok' }));
    A['prompt-ok'] = function () { var v = document.getElementById('prompt-in').value; App.closeModal(); cb(v); };
  }

  A['f-nav'] = function (el, d) { Field.go(d.screen); };
  A['f-open-job'] = function (el, d) { Field.go('job', d.id); };
  A['f-omw'] = function (el, d) {
    var j = Store.get('jobs', d.id); if (!j) return; var m = meUser();
    Store.update('jobs', d.id, { onMyWayAt: Store.nowISO() });
    sendComm(j.contactId, 't_omw', { tech_name: m.name, address: j.address, job_title: j.title });
    Store.logActivity('job', m.name + ' is en route to ' + Store.contactName(j.contactId));
    App.toast('Client texted — you\'re on the way.'); Field.go('job', d.id);
  };
  A['f-start'] = function (el, d) { setJobStatus(d.id, 'in_progress'); App.toast('Job started.'); Field.go('job', d.id); };
  A['f-complete'] = function (el, d) {
    App.openModal('Complete this job?', '<p class="muted">This marks the job done, notifies the customer, and generates an invoice.</p>',
      btn('Cancel', { action: 'close-modal' }) + btn('Complete & invoice', { variant: 'brand', action: 'f-complete-confirm', data: { id: d.id } }));
  };
  A['f-complete-confirm'] = function (el, d) {
    var j = Store.get('jobs', d.id); if (!j) return;
    setJobStatus(d.id, 'complete');
    sendComm(j.contactId, 't_complete', { job_title: j.title });
    var n = 'INV-' + (Store.state().counters.inv++);
    var v = Store.insert('invoices', { number: n, contactId: j.contactId, jobId: j.id, items: j.items && j.items.length ? j.items : [{ desc: j.title, qty: 1, rate: j.value }], status: 'sent', issuedAt: Store.iso(Store.now), dueAt: Store.iso(Store.dayShift(30)), paidAt: null }, true);
    setJobStatus(d.id, 'invoiced');
    sendComm(j.contactId, 't_inv', { invoice_number: n, amount: money(Store.invoiceTotal(v)) });
    Store.logActivity('invoice', 'Invoice ' + n + ' auto-generated on job completion');
    App.closeModal(); App.toast('Job complete · customer notified · ' + n + ' created.'); Field.go('job', d.id);
  };
  A['f-add-photo'] = function (el, d) {
    App._pickImage(function (url) {
      promptText('Add a caption (optional)', '', function (cap) {
        App._addJobPhoto(d.id, url, cap || 'Progress photo');
        App.toast('Photo added — visible to your customer.'); Field.go('job', d.id);
      });
    });
  };
  A['f-add-note'] = function (el, d) {
    App.openModal('Add note', '<textarea class="inp" id="fld-note" rows="4" placeholder="What happened on site…"></textarea>',
      btn('Cancel', { action: 'close-modal' }) + btn('Save note', { variant: 'brand', action: 'f-note-save', data: { id: d.id } }));
  };
  A['f-note-save'] = function (el, d) {
    var j = Store.get('jobs', d.id); var t = document.getElementById('fld-note').value.trim(); if (!t) { App.closeModal(); return; }
    Store.update('jobs', d.id, { notes: (j.notes ? j.notes + '\n' : '') + t }); App.closeModal(); App.toast('Note saved.'); Field.go('job', d.id);
  };
  A['f-open-msg'] = function (el, d) {
    var cv = Store.get('conversations', d.id); Store.update('conversations', d.id, { unread: false });
    var c = Store.get('contacts', cv.contactId);
    var msgs = cv.messages.map(function (m) { return '<div class="pmsg ' + (m.from === 'me' ? 'me' : 'them') + '"><div class="bubble">' + esc(m.text) + '</div></div>'; }).join('');
    App.openModal(c ? c.name : 'Message', '<div class="pane-msgs" style="max-height:46vh">' + msgs + '</div><div class="pane-compose"><input id="fld-reply" class="inp" placeholder="Reply…">' + btn('', { variant: 'brand', icon: 'send', action: 'f-send-msg', data: { id: d.id } }) + '</div>');
  };
  A['f-send-msg'] = function (el, d) {
    var t = document.getElementById('fld-reply').value.trim(); if (!t) return;
    var cv = Store.get('conversations', d.id); cv.messages.push({ from: 'me', text: t, at: Store.iso(Store.now) }); cv.at = Store.iso(Store.now); Store.save();
    App.closeModal(); App.toast('Sent.');
  };

  /* =================================================================
     CUSTOMER PORTAL
     ================================================================= */
  var Portal = { state: { screen: 'home' } };
  function meContact() { return Store.get('contacts', App.session.userId) || Store.all('contacts')[0]; }
  Portal.boot = function () {
    var s = Store.state().settings, c = meContact();
    var logo = s.branding.logo ? '<div class="fld-logo" style="background-image:url(' + s.branding.logo + ')"></div>' : '<div class="fld-mark">' + icon('bolt') + '</div>';
    document.getElementById('topbar').innerHTML =
      '<div class="fld-head">' + logo + '<div class="fld-biz">' + esc(s.business.name) + '<span>Client portal</span></div>' +
      '<div class="fld-me">' + avatar(c.name, 30) + '<span>' + esc(c.name.split(' ')[0]) + '</span></div>' +
      '<button class="icon-btn" data-action="logout" aria-label="Sign out">' + icon('logout') + '</button></div>';
    ensurePortalNav();
    Portal.go(Portal.state.screen);
  };
  function ensurePortalNav() {
    var main = document.getElementById('main');
    var nav = document.getElementById('portal-nav');
    if (!nav) { nav = document.createElement('div'); nav.id = 'portal-nav'; main.appendChild(nav); }
    var items = [['home', 'Home', 'home'], ['work', 'My work', 'jobs'], ['billing', 'Billing', 'invoice'], ['msg', 'Messages', 'inbox']];
    nav.innerHTML = items.map(function (it) {
      return '<button class="fnav-item' + (Portal.state.screen === it[0] ? ' on' : '') + '" data-action="p-nav" data-screen="' + it[0] + '">' + icon(it[2]) + '<span>' + it[1] + '</span></button>';
    }).join('');
  }
  Portal.go = function (screen) {
    Portal.state.screen = screen; ensurePortalNav();
    var view = document.getElementById('view'); view.innerHTML = Portal.render(); view.scrollTop = 0;
    Array.prototype.forEach.call(view.querySelectorAll('.rise'), function (el, i) { el.style.animationDelay = (i * 0.04) + 's'; });
  };
  Portal.render = function () {
    if (Portal.state.screen === 'work') return Portal.workScreen();
    if (Portal.state.screen === 'billing') return Portal.billingScreen();
    if (Portal.state.screen === 'msg') return Portal.msgScreen();
    return Portal.homeScreen();
  };
  function projectCard(j) {
    var steps = ['scheduled', 'in_progress', 'complete'];
    var cur = Math.max(0, steps.indexOf(j.status === 'invoiced' ? 'complete' : j.status));
    var bar = steps.map(function (s, i) {
      return '<div class="pstep' + (i <= cur ? ' on' : '') + '"><div class="pstep-dot">' + (i <= cur ? icon('check') : (i + 1)) + '</div><span>' + statusLabel(s) + '</span></div>';
    }).join('<div class="pstep-line"></div>');
    var photos = (j.photos || []).map(function (p) { return '<figure class="ph"><img src="' + p.url + '" alt=""><figcaption>' + esc(p.caption || '') + '</figcaption></figure>'; }).join('');
    var tech = Store.teamMember(j.assignedTo);
    return card('<div class="proj-top"><div><div class="proj-title">' + esc(j.title) + '</div><div class="proj-when muted">' + fmtDateY(j.date) + ' · ' + fmtTime(j.time) + '</div></div>' + statusPill(j.status) + '</div>' +
      '<div class="pstepper">' + bar + '</div>' +
      (j.onMyWayAt && j.status === 'scheduled' ? '<div class="proj-omw">' + icon('truck') + (tech ? tech.name.split(' ')[0] : 'Your tech') + ' is on the way</div>' : '') +
      '<div class="proj-lbl">Progress photos</div><div class="ph-grid">' + (photos || '<div class="ph-empty">Photos will appear here as work progresses.</div>') + '</div>' +
      (tech ? '<div class="proj-tech">' + avatar(tech.name, 30, tech.color) + '<span>Your technician: <b>' + esc(tech.name) + '</b></span></div>' : ''), 'rise');
  }
  Portal.homeScreen = function () {
    var c = meContact();
    var jobs = Store.jobsForContact(c.id);
    var active = jobs.filter(function (j) { return j.status !== 'invoiced' && j.status !== 'complete'; });
    var show = active.length ? active : jobs.slice(0, 1);
    var open = Store.all('estimates').filter(function (e) { return e.contactId === c.id && e.status === 'sent'; }).length +
      Store.all('invoices').filter(function (v) { return v.contactId === c.id && v.status !== 'paid'; }).length;
    var hero = '<div class="fld-hero rise"><div class="fld-hero-glow"></div><div class="fld-greet">Hi ' + esc(c.name.split(' ')[0]) + '</div>' +
      '<div class="fld-date mono">Welcome to your ' + esc(Store.state().settings.business.name) + ' portal</div>' +
      (open ? '<div class="portal-alert">' + open + ' item' + (open > 1 ? 's' : '') + ' need your attention</div>' : '') + '</div>';
    return hero + '<div class="fld-sec">Your project' + (show.length > 1 ? 's' : '') + '</div>' + (show.length ? show.map(projectCard).join('') : '<div class="empty"><p>No active projects right now.</p></div>');
  };
  Portal.workScreen = function () {
    var c = meContact(); var jobs = Store.jobsForContact(c.id);
    return '<div class="fld-sec">All work</div>' + (jobs.length ? jobs.map(projectCard).join('') : '<div class="empty"><p>Nothing here yet.</p></div>');
  };
  Portal.billingScreen = function () {
    var c = meContact();
    var ests = Store.all('estimates').filter(function (e) { return e.contactId === c.id; });
    var invs = Store.all('invoices').filter(function (v) { return v.contactId === c.id; });
    var estHtml = ests.length ? ests.map(function (e) {
      return card('<div class="bill-row"><div><div class="lr-title mono">' + esc(e.number) + '</div><div class="lr-sub">' + esc(e.items[0] ? e.items[0].desc : '') + '</div></div><div class="bill-right"><div class="mono bill-amt">' + money(Store.estimateTotal(e)) + '</div>' + statusPill(e.status) + '</div></div>' +
        (e.status === 'sent' ? '<div class="bill-actions">' + btn('Approve estimate', { variant: 'brand', icon: 'check', block: true, action: 'p-approve', data: { id: e.id } }) + '</div>' : ''), 'rise');
    }).join('') : '';
    var invHtml = invs.length ? invs.map(function (v) {
      return card('<div class="bill-row"><div><div class="lr-title mono">' + esc(v.number) + '</div><div class="lr-sub">Due ' + fmtDateY(v.dueAt) + '</div></div><div class="bill-right"><div class="mono bill-amt">' + money(Store.invoiceTotal(v)) + '</div>' + statusPill(v.status) + '</div></div>' +
        (v.status !== 'paid' ? '<div class="bill-actions">' + btn('Pay ' + money(Store.invoiceTotal(v)), { variant: 'brand', icon: 'wallet', block: true, action: 'p-pay', data: { id: v.id } }) + '</div>' : '<div class="paid-stamp">' + icon('check') + ' Paid</div>'), 'rise');
    }).join('') : '';
    return '<div class="fld-sec">Estimates</div>' + (estHtml || '<div class="empty"><p>No estimates.</p></div>') +
      '<div class="fld-sec">Invoices</div>' + (invHtml || '<div class="empty"><p>No invoices.</p></div>');
  };
  Portal.msgScreen = function () {
    var c = meContact();
    var cv = Store.all('conversations').filter(function (x) { return x.contactId === c.id; })[0];
    var msgs = cv ? cv.messages.map(function (m) { return '<div class="pmsg ' + (m.from === 'me' ? 'them' : 'me') + '"><div class="bubble">' + esc(m.text) + '</div></div>'; }).join('') : '<div class="ph-empty">No messages yet. Say hello 👋</div>';
    return '<div class="fld-sec">Messages with ' + esc(Store.state().settings.business.name) + '</div>' +
      card('<div class="pane-msgs" style="max-height:52vh">' + msgs + '</div><div class="pane-compose"><input id="p-reply" class="inp" placeholder="Write a message…">' + btn('', { variant: 'brand', icon: 'send', action: 'p-message' }) + '</div>', 'nopad rise');
  };
  A['p-nav'] = function (el, d) { Portal.go(d.screen); };
  A['p-approve'] = function (el, d) {
    var e = Store.get('estimates', d.id); if (!e) return;
    Store.update('estimates', d.id, { status: 'approved' });
    if (e.dealId) Store.update('deals', e.dealId, { stage: 'won' });
    Store.advanceContactStage(e.contactId, 'customer');
    Store.logActivity('estimate', Store.contactName(e.contactId) + ' approved ' + e.number + ' via portal');
    var cv = Store.all('conversations').filter(function (x) { return x.contactId === e.contactId; })[0];
    if (cv) { cv.messages.push({ from: 'them', text: 'Approved estimate ' + e.number + ' — let\'s do it!', at: Store.iso(Store.now) }); cv.unread = true; cv.at = Store.iso(Store.now); Store.save(); }
    App.toast('Estimate approved — thank you! We\'ll be in touch.'); Portal.go('billing');
  };
  A['p-pay'] = function (el, d) {
    var v = Store.get('invoices', d.id); if (!v) return;
    App.openModal('Pay invoice ' + v.number, '<div class="pay-amt mono">' + money(Store.invoiceTotal(v)) + '</div>' +
      '<p class="muted">In production this opens secure Stripe checkout. Add your Stripe keys (see README) to take real card payments. For now this simulates a successful payment.</p>',
      btn('Cancel', { action: 'close-modal' }) + btn('Pay now', { variant: 'brand', icon: 'lock', action: 'p-pay-confirm', data: { id: d.id } }));
  };
  A['p-pay-confirm'] = function (el, d) {
    var v = Store.get('invoices', d.id); if (!v) return;
    Store.update('invoices', d.id, { status: 'paid', paidAt: Store.iso(Store.now) });
    Store.advanceContactStage(v.contactId, 'customer');
    Store.logActivity('invoice', 'Payment received (portal) — ' + Store.contactName(v.contactId) + ' ' + money(Store.invoiceTotal(v)));
    sendComm(v.contactId, 't_receipt', { amount: money(Store.invoiceTotal(v)), invoice_number: v.number });
    App.closeModal(); App.toast('Payment successful — receipt sent. Thank you!'); Portal.go('billing');
  };
  A['p-message'] = function () {
    var c = meContact(); var t = document.getElementById('p-reply').value.trim(); if (!t) return;
    var cv = Store.all('conversations').filter(function (x) { return x.contactId === c.id; })[0];
    if (cv) { cv.messages.push({ from: 'them', text: t, at: Store.iso(Store.now) }); cv.unread = true; cv.at = Store.iso(Store.now); }
    else Store.insert('conversations', { contactId: c.id, channel: 'email', unread: true, at: Store.iso(Store.now), messages: [{ from: 'them', text: t, at: Store.iso(Store.now) }] }, true);
    Store.save(); App.toast('Message sent to ' + Store.state().settings.business.name + '.'); Portal.go('msg');
  };

  /* =================================================================
     MESSAGES (templates) + BRANDING  — owner view
     ================================================================= */
  function emailPreview(subject, body) {
    var s = Store.state().settings;
    var logo = s.branding.logo ? '<div class="ep-logo" style="background-image:url(' + s.branding.logo + ')"></div>' : '<div class="ep-mark">' + icon('bolt') + '</div>';
    return '<div class="email-preview"><div class="ep-head">' + logo + '<span>' + esc(s.business.name) + '</span></div>' +
      (subject ? '<div class="ep-subj">' + esc(subject) + '</div>' : '') +
      '<div class="ep-body">' + esc(body).replace(/\n/g, '<br>') + '</div>' +
      '<div class="ep-foot">' + esc(s.branding.emailFooter) + '</div></div>';
  }
  function smsPreview(body) { return '<div class="sms-preview"><div class="sms-bubble">' + esc(body).replace(/\n/g, '<br>') + '</div></div>'; }
  var SAMPLE = { client_name: 'Sarah', amount: '$4,800', job_title: '200A panel upgrade', date: 'Fri, Aug 15', time: '9:00 AM', tech_name: 'Dale Briggs', estimate_number: 'EST-1042', invoice_number: 'INV-2044', address: '14 Lakeshore Dr' };
  V.templates = {
    render: function () {
      var s = Store.state().settings;
      var logoBox = s.branding.logo ? '<div class="logo-box" style="background-image:url(' + s.branding.logo + ')"></div>' : '<div class="logo-box empty">' + icon('image') + '</div>';
      var swatches = ['#4f46e5', '#0891b2', '#7c3aed', '#0d9488', '#db2777', '#ea580c'].map(function (c) { return '<button class="swatch' + (c === s.branding.primary ? ' on' : '') + '" style="background:' + c + '" data-action="brand-color" data-color="' + c + '"></button>'; }).join('');
      var brand = card('<div class="sec-head"><h2>Brand kit</h2><span class="muted">applied to every email, portal &amp; the app</span></div>' +
        '<div class="brand-kit"><div class="brand-kit-logo">' + logoBox + '<div>' + btn('Upload logo', { sm: true, icon: 'image', action: 'upload-logo' }) + (s.branding.logo ? btn('Remove', { sm: true, action: 'remove-logo' }) : '') + '<div class="muted" style="font-size:12px;margin-top:6px">PNG or SVG, square works best.</div></div></div>' +
        '<div><span class="field-label">Brand color</span><div class="swatches">' + swatches + '</div></div></div>' +
        field('Email footer / signature', '<textarea class="inp" id="brand-footer" rows="2">' + esc(s.branding.emailFooter) + '</textarea>') +
        '<div class="mt12">' + btn('Save brand kit', { variant: 'brand', action: 'save-branding' }) + '</div>', 'rise');
      function trow(t) {
        var r = Store.renderTemplate(t, SAMPLE);
        return card('<div class="tpl-top"><div class="tpl-name">' + esc(t.name) + '</div><div class="tpl-meta">' + pill(t.channel.toUpperCase(), t.channel === 'sms' ? 'blue' : 'violet') +
          '<label class="switch sm"><input type="checkbox" ' + (t.enabled ? 'checked' : '') + ' data-action="toggle-template" data-id="' + t.id + '"><span class="slider"></span></label></div></div>' +
          '<div class="tpl-prev">' + esc((r.subject ? r.subject + ' — ' : '') + r.body).slice(0, 130) + '…</div>' +
          '<div class="tpl-actions">' + btn('Edit', { sm: true, icon: 'edit', action: 'edit-template', data: { id: t.id } }) + btn('Preview', { sm: true, icon: 'eye', action: 'preview-template', data: { id: t.id } }) + '</div>', 'rise tpl-card');
      }
      var emails = Store.all('templates').filter(function (t) { return t.channel === 'email'; }).map(trow).join('');
      var texts = Store.all('templates').filter(function (t) { return t.channel === 'sms'; }).map(trow).join('');
      return brand + '<div class="sec-head mt12"><h2>Email templates</h2></div><div class="tpl-grid">' + emails + '</div>' +
        '<div class="sec-head mt12"><h2>Text templates</h2></div><div class="tpl-grid">' + texts + '</div>';
    }
  };
  A['upload-logo'] = function () { App._pickImage(function (url) { Store.state().settings.branding.logo = url; Store.save(); App._renderSidebar(); App.refresh(); App.toast('Logo updated everywhere.'); }); };
  A['remove-logo'] = function () { Store.state().settings.branding.logo = null; Store.save(); App._renderSidebar(); App.refresh(); App.toast('Logo removed.'); };
  A['brand-color'] = function (el, d) { Store.state().settings.branding.primary = d.color; Store.save(); document.documentElement.style.setProperty('--brand', d.color); App._renderSidebar(); App.refresh(); };
  A['save-branding'] = function () { Store.state().settings.branding.emailFooter = document.getElementById('brand-footer').value; Store.save(); App.toast('Brand kit saved.'); };
  A['toggle-template'] = function (el, d) { var t = Store.get('templates', d.id); Store.update('templates', d.id, { enabled: !t.enabled }); App.toast(t.enabled ? 'Template paused.' : 'Template active.'); };
  A['preview-template'] = function (el, d) {
    var t = Store.get('templates', d.id); var r = Store.renderTemplate(t, SAMPLE);
    App.openModal('Preview · ' + t.name, t.channel === 'email' ? emailPreview(r.subject, r.body) : smsPreview(r.body), btn('Close', { action: 'close-modal' }), { wide: t.channel === 'email' });
  };
  A['edit-template'] = function (el, d) {
    var t = Store.get('templates', d.id);
    var chips = Store.MERGE_VARS.map(function (v) { return '<button class="mvar" data-action="insert-var" data-var="' + v + '">{{' + v + '}}</button>'; }).join('');
    var body = '<div class="tpl-edit"><div class="tpl-edit-form">' +
      field('Name', input('tpl-name', 'value="' + esc(t.name) + '"')) +
      (t.channel === 'email' ? field('Subject', input('tpl-subj', 'value="' + esc(t.subject) + '"')) : '') +
      field('Message', '<textarea class="inp" id="tpl-body" rows="8">' + esc(t.body) + '</textarea>') +
      '<div class="field-label">Insert a field</div><div class="mvars">' + chips + '</div></div>' +
      '<div class="tpl-edit-prev"><div class="field-label">Live preview</div><div id="tpl-live"></div></div></div>';
    App.openModal('Edit · ' + t.name, body, btn('Cancel', { action: 'close-modal' }) + btn('Save template', { variant: 'brand', action: 'save-template', data: { id: t.id } }), { wide: true, mount: function (root) {
      function live() {
        var sub = root.querySelector('#tpl-subj') ? root.querySelector('#tpl-subj').value : '';
        var bod = root.querySelector('#tpl-body').value;
        var r = Store.renderTemplate({ subject: sub, body: bod, channel: t.channel }, SAMPLE);
        root.querySelector('#tpl-live').innerHTML = t.channel === 'email' ? emailPreview(r.subject, r.body) : smsPreview(r.body);
      }
      root.addEventListener('input', live); live(); App._tplLive = live;
    } });
  };
  A['insert-var'] = function (el, d) {
    var ta = document.getElementById('tpl-body'); if (!ta) return;
    var v = '{{' + d.var + '}}'; var s = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
    ta.value = ta.value.slice(0, s) + v + ta.value.slice(ta.selectionEnd == null ? s : ta.selectionEnd); ta.focus();
    App._tplLive && App._tplLive();
  };
  A['save-template'] = function (el, d) {
    var patch = { name: document.getElementById('tpl-name').value, body: document.getElementById('tpl-body').value };
    var sub = document.getElementById('tpl-subj'); if (sub) patch.subject = sub.value;
    Store.update('templates', d.id, patch); App.closeModal(); App.toast('Template saved.'); App.refresh();
  };

  /* =================================================================
     OUTBOX
     ================================================================= */
  V.outbox = {
    render: function () {
      var items = Store.all('outbox');
      if (!items.length) return card('<div class="empty"><div class="empty-ic">' + icon('send') + '</div><p>Nothing sent yet. As automations and messages fire, they land here.</p></div>', 'rise');
      var rows = items.map(function (o) {
        var t = Store.template(o.templateId);
        return '<div class="ob-row rowlink rise" data-action="view-outbox" data-id="' + o.id + '"><span class="ob-ch ' + o.channel + '">' + icon(o.channel === 'sms' ? 'phone' : 'mail') + '</span>' +
          '<div class="ob-main"><div class="ob-top"><span class="ob-to">' + esc(Store.contactName(o.contactId)) + '</span><span class="mono muted">' + relDay((o.at || '').slice(0, 10)) + '</span></div>' +
          '<div class="ob-sub">' + esc(o.subject || o.body).slice(0, 90) + '</div></div>' +
          '<span class="ob-tag">' + esc(t ? t.name : 'Manual') + '</span></div>';
      }).join('');
      return '<div class="toolbar"><p class="muted">Every email &amp; text the system has sent — proof your automations are working.</p></div>' + card(rows, 'nopad rise');
    }
  };
  A['view-outbox'] = function (el, d) {
    var o = Store.get('outbox', d.id); if (!o) return;
    App.openModal('Sent · ' + Store.contactName(o.contactId), o.channel === 'email' ? emailPreview(o.subject, o.body) : smsPreview(o.body), btn('Close', { action: 'close-modal' }), { wide: o.channel === 'email' });
  };

  /* =================================================================
     AUTOMATIONS  (editable + testable) — override
     ================================================================= */
  V.automations = {
    render: function () {
      var toolbar = '<div class="toolbar"><p class="muted">Workflows run in the background. Edit what each one sends, or test it live.</p><div class="grow"></div>' + btn('New automation', { variant: 'brand', sm: true, action: 'new-automation' }) + '</div>';
      var cards = Store.all('automations').map(function (a) {
        var t = a.templateId ? Store.template(a.templateId) : null;
        return '<div class="auto-card' + (a.enabled ? '' : ' off') + ' rise"><div class="auto-top"><div class="auto-bolt">' + icon('automation') + '</div>' +
          '<label class="switch"><input type="checkbox" ' + (a.enabled ? 'checked' : '') + ' data-action="toggle-automation" data-id="' + a.id + '"><span class="slider"></span></label></div>' +
          '<div class="auto-name">' + esc(a.name) + '</div>' +
          '<div class="auto-flow"><span class="auto-when">WHEN</span> ' + esc(a.trigger) + '</div>' +
          '<div class="auto-flow"><span class="auto-then">THEN</span> ' + esc(a.action) + '</div>' +
          (t ? '<div class="auto-tpl">' + icon(t.channel === 'sms' ? 'phone' : 'mail') + ' uses “' + esc(t.name) + '”</div>' : '') +
          '<div class="auto-foot"><span class="auto-runs mono">' + a.runs + ' runs</span><span class="auto-btns">' + btn('Edit', { sm: true, icon: 'edit', action: 'edit-automation', data: { id: a.id } }) + btn('Test', { sm: true, icon: 'play', action: 'test-automation', data: { id: a.id } }) + '</span></div></div>';
      }).join('');
      return toolbar + '<div class="auto-grid">' + cards + '</div>';
    }
  };
  function tplOptions(sel) {
    return '<option value="">— no message —</option>' + Store.all('templates').map(function (t) { return '<option value="' + t.id + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.channel + ')</option>'; }).join('');
  }
  A['edit-automation'] = function (el, d) {
    var a = Store.get('automations', d.id);
    var body = field('Name', input('au-name', 'value="' + esc(a.name) + '"')) +
      field('When (trigger)', input('au-trig', 'value="' + esc(a.trigger) + '"')) +
      field('Then (action)', input('au-act', 'value="' + esc(a.action) + '"')) +
      field('Message it sends', '<select class="inp" id="au-tpl">' + tplOptions(a.templateId) + '</select>');
    App.openModal('Edit automation', body, btn('Cancel', { action: 'close-modal' }) + btn('Save', { variant: 'brand', action: 'save-automation', data: { id: d.id } }));
  };
  A['save-automation'] = function (el, d) {
    Store.update('automations', d.id, { name: document.getElementById('au-name').value, trigger: document.getElementById('au-trig').value, action: document.getElementById('au-act').value, templateId: document.getElementById('au-tpl').value || null });
    App.closeModal(); App.toast('Automation saved.'); App.refresh();
  };
  A['test-automation'] = function (el, d) {
    var a = Store.get('automations', d.id);
    var tpl = a.templateId ? Store.template(a.templateId) : Store.all('templates')[0];
    var c = Store.all('contacts')[0];
    if (tpl) { sendComm(c.id, tpl.id, SAMPLE); Store.update('automations', d.id, { runs: a.runs + 1 }); App.toast('Test sent to Outbox → ' + c.name + '.'); }
    else App.toast('Attach a message to test this one.', 'info');
    App.refresh();
  };

  /* =================================================================
     STAGE-AUTOMATION ENGINE + lifecycle hooks
     ================================================================= */
  function handleDealStage(deal) {
    if (!deal) return;
    var rule = Store.state().settings.stageAutomation[deal.stage]; if (!rule) return;
    if (rule.advanceContact) Store.advanceContactStage(deal.contactId, rule.advanceContact);
    if (rule.templateId) sendComm(deal.contactId, rule.templateId, { job_title: deal.title, amount: money(deal.value) });
    if (rule.task) Store.insert('tasks', { title: rule.task + ' — ' + Store.contactName(deal.contactId), status: 'todo', priority: 'high', dueDate: Store.iso(Store.dayShift(3)), assignedTo: deal.owner || 'u_ops', contactId: deal.contactId }, true);
    App.toast(rule.label + (rule.templateId ? ' · client notified' : ''), 'info');
  }
  App._handleDealStage = handleDealStage;
  App._Field = Field; App._Portal = Portal; App._sendComm = sendComm;
  App._emailPreview = emailPreview; App._smsPreview = smsPreview;
  function wrap(name, after) {
    var orig = A[name];
    A[name] = function (el, d, e) { var r = orig ? orig(el, d, e) : null; try { after(el, d, r); } catch (x) { if (global.console) console.warn('hook', name, x); } return r; };
  }
  App._wrap = wrap;

  // Pipeline transitions → acknowledgment + advance contact + fire template + next-step task
  wrap('move-deal', function (el, d) { handleDealStage(Store.get('deals', d.id)); });
  wrap('set-deal-stage', function (el, d) { handleDealStage(Store.get('deals', d.id)); });
  // Estimates → contact becomes a Prospect + branded estimate email logged
  wrap('approve-estimate', function (el, d) { var e = Store.get('estimates', d.id); if (e) Store.advanceContactStage(e.contactId, 'prospect'); });
  wrap('send-estimate', function (el, d) {
    var e = Store.get('estimates', d.id); if (!e) return;
    Store.advanceContactStage(e.contactId, 'prospect');
    sendComm(e.contactId, 't_est', { estimate_number: e.number, job_title: e.items[0] ? e.items[0].desc : 'your project', amount: money(Store.estimateTotal(e)) });
  });
  wrap('create-estimate', function () {
    var e = Store.all('estimates')[0]; if (!e) return;
    Store.advanceContactStage(e.contactId, 'prospect');
    sendComm(e.contactId, 't_est', { estimate_number: e.number, job_title: e.items[0] ? e.items[0].desc : 'your project', amount: money(Store.estimateTotal(e)) });
  });
  // Money → contact becomes a Customer + receipt/invoice comms
  wrap('mark-paid', function (el, d) {
    var v = Store.get('invoices', d.id); if (!v) return;
    Store.advanceContactStage(v.contactId, 'customer');
    sendComm(v.contactId, 't_receipt', { amount: money(Store.invoiceTotal(v)), invoice_number: v.number });
  });
  wrap('create-invoice', function () { var v = Store.all('invoices')[0]; if (v) sendComm(v.contactId, 't_inv', { invoice_number: v.number, amount: money(Store.invoiceTotal(v)) }); });
  wrap('job-to-invoice', function () { var v = Store.all('invoices')[0]; if (v) sendComm(v.contactId, 't_inv', { invoice_number: v.number, amount: money(Store.invoiceTotal(v)) }); });
  wrap('complete-job', function (el, d) { var j = Store.get('jobs', d.id); if (j) sendComm(j.contactId, 't_complete', { job_title: j.title }); });
  // Jobs → booking confirmation text; on-my-way when a tech starts from the board
  wrap('create-job', function () { var j = Store.all('jobs')[0]; if (j) sendComm(j.contactId, 't_booked', { job_title: j.title, date: fmtDateY(j.date), time: fmtTime(j.time) }); });
  // New contact at Lead stage → welcome email
  wrap('create-contact', function () { var c = Store.all('contacts')[0]; if (c && c.stage === 'lead') sendComm(c.id, 't_lead', {}); });

  /* =================================================================
     ENHANCED, CUSTOMIZABLE DASHBOARD  — override V.home
     ================================================================= */
  var WIDGETS = {
    kpis: 'Key metrics', revenue: 'Revenue trend', schedule: "Today's schedule",
    pipeline: 'Pipeline funnel', activity: 'Recent activity', tasks: 'Needs attention', leaderboard: 'Team leaderboard'
  };
  function sectionTitle(t, right) { return '<div class="sec-head"><h2>' + esc(t) + '</h2>' + (right || '') + '</div>'; }
  V.home = {
    render: function () {
      var k = Store.kpis(), ek = Store.extraKpis();
      var enabled = (Store.state().settings.dashboard || Object.keys(WIDGETS));
      var out = '';
      // hero + customize control
      var trend = Store.revenueSeries(8).map(function (x) { return x.value || 1; });
      var hero = '<div class="dash-hero"><div class="hero rise"><div class="hero-glow"></div>' +
        '<div class="hero-top"><span class="hero-label mono">REVENUE · THIS MONTH</span><span class="live"><span class="live-dot"></span>LIVE</span></div>' +
        '<div class="hero-num mono">' + money(k.revenueMTD) + '</div>' +
        '<div class="hero-foot"><span class="delta up">' + icon('trend') + ' collected ' + money(ek.collectedMTD) + '</span>' + ch.sparkline(trend, { w: 150, h: 40, color: '#fff' }) + '</div></div>' +
        '<div class="hero-side rise">' +
          '<div class="hs-item"><div class="hs-ic stat-amber">' + icon('invoice') + '</div><div><div class="hs-val mono">' + money(k.outstanding) + '</div><div class="hs-lbl">Outstanding · ' + ek.overdueCount + ' overdue</div></div></div>' +
          '<div class="hs-item"><div class="hs-ic stat-indigo">' + icon('pipeline') + '</div><div><div class="hs-val mono">' + money(k.pipelineValue) + '</div><div class="hs-lbl">' + k.openDeals + ' open deals</div></div></div>' +
          '<div class="hs-item"><div class="hs-ic stat-green">' + icon('jobs') + '</div><div><div class="hs-val mono">' + ek.jobsThisWeek + '</div><div class="hs-lbl">Jobs this week · ' + ek.activeJobs + ' active now</div></div></div>' +
        '</div></div>';
      out += '<div class="dash-bar"><div class="mono muted">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</div><div class="grow"></div>' +
        btn('Field mode', { sm: true, icon: 'truck', action: 'open-login' }) +
        btn('Customize', { sm: true, icon: 'sliders', action: 'dash-customize' }) + '</div>' + hero;

      function w(id) { return enabled.indexOf(id) >= 0; }
      // KPI strip
      if (w('kpis')) {
        function kp(label, val, sub, ic, kind) {
          return '<div class="stat rise"><div class="stat-ic stat-' + kind + '">' + icon(ic) + '</div><div class="stat-label mono">' + label + '</div><div class="stat-val mono">' + val + '</div><div class="stat-sub">' + sub + '</div></div>';
        }
        out += '<div class="kpi-strip">' +
          kp('WIN RATE', k.winRate + '%', 'deals won', 'target', 'green') +
          kp('AVG JOB', money(ek.avgJobValue), 'per completed job', 'wallet', 'indigo') +
          kp('NEW LEADS', ek.newLeads7, 'in the last 7 days', 'users', 'violet') +
          kp('COMPLETED', ek.completedJobs, 'jobs all-time', 'check', 'green') +
          kp('UNPAID', ek.unpaidCount, money(ek.overdueAmount) + ' overdue', 'invoice', 'amber') +
          kp('OPEN DEALS', k.openDeals, money(k.pipelineValue) + ' value', 'pipeline', 'indigo') +
          '</div>';
      }
      // revenue + pipeline row
      var left = '', right = '';
      if (w('revenue')) {
        var series = Store.revenueSeries(6);
        var max = Math.max.apply(null, series.map(function (x) { return x.value; })) || 1;
        var data = series.map(function (x, i) { return { label: x.label, value: x.value, color: i === series.length - 1 ? 'var(--brand)' : '#c7d2fe' }; });
        left = card(sectionTitle('Revenue', '<span class="mono muted">6 months · peak ' + money(max) + '</span>') + ch.barChart(data, { h: 200 }), 'rise');
      }
      if (w('pipeline')) {
        var stages = [['lead', 'New leads', '#6366f1'], ['contacted', 'Contacted', '#3b82f6'], ['estimate', 'Estimate', '#7c3aed'], ['won', 'Won', '#10b981']];
        var fn = stages.map(function (st) { return { label: st[1], value: Store.all('deals').filter(function (d) { return d.stage === st[0]; }).reduce(function (s, d) { return s + d.value; }, 0), color: st[2] }; });
        right = card(sectionTitle('Pipeline', btn('Open board', { sm: true, action: 'nav', data: { route: 'pipeline' } })) + ch.funnel(fn), 'rise');
      }
      if (left || right) out += '<div class="grid-2">' + left + right + '</div>';
      // schedule + tasks
      var s1 = '', s2 = '';
      if (w('schedule')) {
        var today = k.jobsToday.slice().sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; });
        s1 = card(sectionTitle("Today's schedule", '<span class="mono muted">' + today.length + ' jobs</span>') + '<div class="line-list">' +
          (today.length ? today.map(function (j) { var m = Store.teamMember(j.assignedTo); return '<div class="line-row" data-action="open-record" data-type="job" data-id="' + j.id + '"><div class="lr-time mono">' + fmtTime(j.time) + '</div><div class="lr-main"><div class="lr-title">' + esc(j.title) + '</div><div class="lr-sub">' + esc(Store.contactName(j.contactId)) + '</div></div>' + (m ? avatar(m.name, 26, m.color) : '') + '</div>'; }).join('') : '<div class="empty"><p>No jobs today.</p></div>') + '</div>', 'rise');
      }
      if (w('tasks')) {
        var due = Store.all('tasks').filter(function (t) { return t.status !== 'done' && t.dueDate <= Store.iso(Store.now); });
        s2 = card(sectionTitle('Needs attention', '<span class="mono muted">' + due.length + '</span>') +
          (due.length ? due.map(function (t) { return '<div class="line-row"><span class="prio prio-' + t.priority + '"></span><div class="lr-main"><div class="lr-title">' + esc(t.title) + '</div><div class="lr-sub">Due ' + relDay(t.dueDate) + '</div></div>' + btn('', { icon: 'check', sm: true, action: 'task-done', data: { id: t.id } }) + '</div>'; }).join('') : '<div class="empty"><p>All caught up.</p></div>'), 'rise');
      }
      if (s1 || s2) out += '<div class="grid-2">' + s1 + s2 + '</div>';
      // leaderboard + activity
      var l1 = '', l2 = '';
      if (w('leaderboard')) {
        var lb = Store.techLeaderboard();
        var maxRev = Math.max.apply(null, lb.map(function (x) { return x.revenue; })) || 1;
        l1 = card(sectionTitle('Team leaderboard', '<span class="mono muted">revenue booked</span>') + lb.map(function (m) {
          return '<div class="lb-row">' + avatar(m.name, 30, m.color) + '<div class="lb-main"><div class="lb-top"><span>' + esc(m.name) + '</span><span class="mono">' + money(m.revenue) + '</span></div><div class="lb-bar"><div class="lb-fill" style="width:' + Math.round(m.revenue / maxRev * 100) + '%;background:' + m.color + '"></div></div><div class="lb-sub">' + m.done + ' of ' + m.jobs + ' jobs complete</div></div></div>';
        }).join(''), 'rise');
      }
      if (w('activity')) {
        var im = { invoice: 'invoice', deal: 'pipeline', lead: 'users', estimate: 'estimate', job: 'jobs' };
        l2 = card(sectionTitle('Recent activity') + '<div class="act-list">' + Store.all('activities').slice(0, 7).map(function (a) {
          return '<div class="act-row"><span class="act-ic">' + icon(im[a.type] || 'spark') + '</span><div><div class="act-text">' + esc(a.text) + '</div><div class="act-when mono">' + relDay(a.at) + '</div></div></div>';
        }).join('') + '</div>', 'rise');
      }
      if (l1 || l2) out += '<div class="grid-2">' + l1 + l2 + '</div>';
      return out;
    }
  };
  A['dash-customize'] = function () {
    var enabled = Store.state().settings.dashboard || [];
    var rows = Object.keys(WIDGETS).map(function (id) {
      return '<label class="dash-opt"><span>' + esc(WIDGETS[id]) + '</span><label class="switch sm"><input type="checkbox" data-w="' + id + '" ' + (enabled.indexOf(id) >= 0 ? 'checked' : '') + '><span class="slider"></span></label></label>';
    }).join('');
    App.openModal('Customize dashboard', '<p class="muted">Show or hide widgets. Your layout is saved on this device.</p><div class="dash-opts">' + rows + '</div>',
      App._ui.btn('Cancel', { action: 'close-modal' }) + App._ui.btn('Save layout', { variant: 'brand', action: 'dash-save' }));
  };
  A['dash-save'] = function () {
    var order = Object.keys(WIDGETS);
    var picked = [];
    Array.prototype.forEach.call(document.querySelectorAll('.dash-opts input[data-w]'), function (i) { if (i.checked) picked.push(i.getAttribute('data-w')); });
    Store.state().settings.dashboard = order.filter(function (id) { return picked.indexOf(id) >= 0; });
    Store.save(); App.closeModal(); App.toast('Dashboard updated.'); App.refresh();
  };

})(typeof window !== 'undefined' ? window : this);
