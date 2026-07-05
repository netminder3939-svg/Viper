/* =====================================================================
   Viper OS — plus.js
   Loaded last. The "runs the whole business" layer:
     • Price book (reusable priced services) + one-tap quote building
     • Job costing & profitability + A/R aging report
     • Field time tracking (clock in / out)
     • Requests intake (public Client-Hub form → lead)
     • Branded PDF / print for estimates & invoices
     • A time-based automation runner (fires reminders on its own)
     • Backup & restore (export / import)
   ===================================================================== */
(function (global) {
  'use strict';
  var App = global.App, Store = global.Store;
  if (!App || !Store) return;
  var f = App._fmt, ui = App._ui, ch = App._charts, icon = App.icon;
  var money = f.money, money2 = f.money2, esc = f.esc, fmtDate = f.fmtDate, fmtDateY = f.fmtDateY, fmtTime = f.fmtTime, relDay = f.relDay;
  var btn = ui.btn, avatar = ui.avatar, pill = ui.pill, statusPill = ui.statusPill;
  var A = App.actions, V = App.views;
  var Field = App._Field, Portal = App._Portal, sendComm = App._sendComm;
  function card(inner, cls) { return '<div class="card ' + (cls || '') + '">' + inner + '</div>'; }
  function field(label, inner) { return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inner + '</label>'; }
  function input(id, attrs) { return '<input id="' + id + '" class="inp" ' + (attrs || '') + '>'; }
  function sectionTitle(t, right) { return '<div class="sec-head"><h2>' + esc(t) + '</h2>' + (right || '') + '</div>'; }
  function hoursLabel(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h ' : '') + (m || !h ? m + 'm' : ''); }

  /* =================================================================
     PRICE BOOK  (catalog)
     ================================================================= */
  V.catalog = {
    render: function () {
      var toolbar = '<div class="toolbar"><p class="muted">Reusable priced services. Set your price and your cost — margins flow into job profitability.</p><div class="grow"></div>' + btn('Add service', { variant: 'brand', sm: true, action: 'new-catalog' }) + '</div>';
      var rows = Store.all('catalog').map(function (c) {
        var margin = c.rate ? Math.round((c.rate - c.cost) / c.rate * 100) : 0;
        return '<tr class="rowlink" data-action="edit-catalog" data-id="' + c.id + '"><td><div class="cell-name">' + esc(c.name) + '</div><div class="cell-sub">' + esc(c.category) + ' · per ' + esc(c.unit) + '</div></td>' +
          '<td class="mono">' + money(c.rate) + '</td><td class="mono muted">' + money(c.cost) + '</td>' +
          '<td>' + pill(margin + '% margin', margin >= 50 ? 'green' : margin >= 30 ? 'amber' : 'rose') + '</td>' +
          '<td class="row-actions">' + btn('', { icon: 'trash', sm: true, action: 'del-catalog', data: { id: c.id } }) + '</td></tr>';
      }).join('');
      return toolbar + card('<table class="tbl"><thead><tr><th>Service</th><th>Price</th><th>Your cost</th><th>Margin</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>', 'nopad rise');
    }
  };
  function catalogForm(c) {
    c = c || { name: '', category: 'Service', unit: 'each', rate: '', cost: '' };
    return '<div class="form-grid">' + field('Service name', input('cat-name', 'value="' + esc(c.name) + '"')) + field('Category', input('cat-cat', 'value="' + esc(c.category) + '"')) + '</div>' +
      '<div class="form-grid">' + field('Unit', input('cat-unit', 'value="' + esc(c.unit) + '"')) + field('Price ($)', input('cat-rate', 'type="number" value="' + c.rate + '"')) + field('Your cost ($)', input('cat-cost', 'type="number" value="' + c.cost + '"')) + '</div>';
  }
  A['new-catalog'] = function () { App.openModal('Add service', catalogForm(), btn('Cancel', { action: 'close-modal' }) + btn('Save service', { variant: 'brand', action: 'save-catalog' })); };
  A['edit-catalog'] = function (el, d) { var c = Store.get('catalog', d.id); App.openModal('Edit service', catalogForm(c), btn('Cancel', { action: 'close-modal' }) + btn('Save', { variant: 'brand', action: 'save-catalog', data: { id: d.id } })); };
  A['save-catalog'] = function (el, d) {
    var patch = { name: document.getElementById('cat-name').value.trim(), category: document.getElementById('cat-cat').value.trim() || 'Service', unit: document.getElementById('cat-unit').value.trim() || 'each', rate: +document.getElementById('cat-rate').value || 0, cost: +document.getElementById('cat-cost').value || 0 };
    if (!patch.name) { App.toast('Name it first.', 'error'); return; }
    if (d && d.id) Store.update('catalog', d.id, patch); else Store.insert('catalog', patch);
    App.closeModal(); App.toast('Price book updated.'); App.refresh();
  };
  A['del-catalog'] = function (el, d) { Store.remove('catalog', d.id); App.refresh(); App.toast('Removed.'); };

  /* ---- inject "Add from price book" into the estimate/invoice builder ---- */
  function injectCatalogBar() {
    var modal = document.querySelector('#modal-root .modal'); if (!modal) return;
    if (modal.querySelector('.catalog-bar')) return;
    var addLine = modal.querySelector('.add-line'); if (!addLine) return;
    var opts = Store.all('catalog').map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + ' · ' + money(c.rate) + '</option>'; }).join('');
    var bar = document.createElement('div'); bar.className = 'catalog-bar';
    bar.innerHTML = '<span class="field-label">Add from price book</span><div class="catalog-pick"><select class="inp" id="cat-pick"><option value="">Choose a service…</option>' + opts + '</select>' + btn('Add', { sm: true, icon: 'plus', action: 'catalog-add' }) + '</div>';
    addLine.parentNode.insertBefore(bar, addLine);
  }
  function wrapAction(name, after) {
    var orig = A[name]; A[name] = function (el, d, e) { var r = orig ? orig(el, d, e) : null; try { after(el, d, r); } catch (x) {} return r; };
  }
  wrapAction('new-estimate', injectCatalogBar);
  wrapAction('new-invoice', injectCatalogBar);
  A['catalog-add'] = function (el) {
    var modal = el.closest('.modal'); var sel = modal.querySelector('#cat-pick'); var c = Store.get('catalog', sel.value); if (!c) return;
    modal.querySelector('#bld-rows').insertAdjacentHTML('beforeend', App._liRow({ desc: c.name, qty: 1, rate: c.rate }));
    App._recalc(modal); sel.value = '';
  };

  /* =================================================================
     TIMESHEETS  (owner)
     ================================================================= */
  V.timesheets = {
    render: function () {
      var ts = Store.all('timesheets').slice().sort(function (a, b) { return a.start < b.start ? 1 : -1; });
      var byTech = {}; ts.forEach(function (t) { byTech[t.userId] = (byTech[t.userId] || 0) + (t.minutes || 0); });
      var stats = Store.all('team').map(function (m) {
        var min = byTech[m.id] || 0; var cost = (min / 60) * (m.hourlyCost || 0);
        return '<div class="stat rise"><div class="stat-ic" style="background:' + m.color + '22;color:' + m.color + '">' + icon('timer') + '</div><div class="stat-label mono">' + esc(m.name.split(' ')[0].toUpperCase()) + '</div><div class="stat-val mono">' + hoursLabel(min) + '</div><div class="stat-sub">' + money(cost) + ' labor</div></div>';
      }).join('');
      if (!ts.length) return '<div class="stat-grid">' + stats + '</div>' + card('<div class="empty"><div class="empty-ic">' + icon('timer') + '</div><p>No time logged yet. Techs clock in on a job from field mode.</p></div>', 'rise');
      var rows = ts.map(function (t) {
        var m = Store.teamMember(t.userId); var j = Store.get('jobs', t.jobId);
        var cost = (t.minutes / 60) * ((m && m.hourlyCost) || 0);
        return '<tr' + (j ? ' class="rowlink" data-action="open-record" data-type="job" data-id="' + j.id + '"' : '') + '><td><div class="cell-id">' + (m ? avatar(m.name, 26, m.color) : '') + '<div class="cell-name">' + esc(m ? m.name : '') + '</div></div></td>' +
          '<td>' + esc(j ? j.title : '—') + '</td><td class="muted">' + fmtDateY((t.start || '').slice(0, 10)) + '</td>' +
          '<td class="mono">' + (t.end ? hoursLabel(t.minutes || 0) : pill('running', 'amber')) + '</td><td class="mono muted">' + money(cost) + '</td></tr>';
      }).join('');
      return '<div class="stat-grid">' + stats + '</div>' + card('<table class="tbl"><thead><tr><th>Tech</th><th>Job</th><th>Date</th><th>Duration</th><th>Labor cost</th></tr></thead><tbody>' + rows + '</tbody></table>', 'nopad rise');
    }
  };

  /* =================================================================
     REQUESTS  (public Client-Hub intake → lead)
     ================================================================= */
  function requestFormHTML() {
    var s = Store.state().settings;
    var logo = s.branding.logo ? '<div class="login-logo" style="background-image:url(' + s.branding.logo + ')"></div>' : '<div class="login-mark">' + icon('bolt') + '</div>';
    return '<div class="login-panel req-panel">' +
      '<button class="login-close icon-btn" data-action="close-request-form" aria-label="Close">' + icon('x') + '</button>' +
      '<div class="login-head">' + logo + '<div><div class="login-title">Request a quote</div><div class="login-sub">Tell ' + esc(s.business.name) + ' what you need — we\'ll get right back to you.</div></div></div>' +
      '<div class="req-form">' +
        '<div class="form-grid">' + field('Your name', input('rq-name', 'placeholder="Full name"')) + field('Phone', input('rq-phone', 'placeholder="(208) …"')) + '</div>' +
        '<div class="form-grid">' + field('Email', input('rq-email', 'placeholder="you@email.com"')) + field('Property type', '<select class="inp" id="rq-type"><option>Residential</option><option>Commercial</option><option>Industrial</option></select>') + '</div>' +
        field('Service address', input('rq-addr', 'placeholder="Street, City"')) +
        field('What do you need?', input('rq-service', 'placeholder="e.g. EV charger install, panel upgrade"')) +
        field('Details', '<textarea class="inp" id="rq-details" rows="3" placeholder="Anything that helps us scope it…"></textarea>') +
        field('Preferred timing', '<select class="inp" id="rq-pref"><option>As soon as possible</option><option>This week</option><option>Next 2 weeks</option><option>This month</option><option>Just getting quotes</option></select>') +
        '<div class="mt12">' + btn('Send request', { variant: 'brand', block: true, icon: 'send', action: 'submit-request' }) + '</div>' +
      '</div></div>';
  }
  function openRequestForm() {
    App._closeLogin && App._closeLogin();
    var el = document.getElementById('login-screen');
    if (!el) { el = document.createElement('div'); el.id = 'login-screen'; document.body.appendChild(el); }
    el.innerHTML = requestFormHTML(); el.classList.add('open'); document.body.classList.add('login-open');
  }
  A['open-request-form'] = function () { openRequestForm(); };
  A['close-request-form'] = function () { App._closeLogin && App._closeLogin(); };
  A['submit-request'] = function () {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var name = g('rq-name'); if (!name) { App.toast('Please add your name.', 'error'); return; }
    Store.insert('requests', { name: name, email: g('rq-email'), phone: g('rq-phone'), address: g('rq-addr'), type: document.getElementById('rq-type').value, service: g('rq-service'), details: g('rq-details'), preferred: document.getElementById('rq-pref').value, status: 'new', createdAt: Store.iso(Store.now) }, true);
    Store.logActivity('lead', 'New quote request from ' + name);
    App._closeLogin && App._closeLogin();
    App.openModal('Thank you!', '<div class="req-thanks">' + icon('check') + '<p>Your request is in. ' + esc(Store.state().settings.business.name) + ' will reach out shortly.</p></div>', btn('Done', { variant: 'brand', action: 'close-modal' }));
  };

  V.requests = {
    render: function () {
      var reqs = Store.all('requests').slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      if (!reqs.length) return card('<div class="empty"><div class="empty-ic">' + icon('tray') + '</div><p>No new requests. When someone submits your quote form, it lands here as a lead.</p></div>', 'rise');
      var toolbar = '<div class="toolbar"><p class="muted">New work coming in. Convert to a lead to start a deal, or book a visit.</p><div class="grow"></div>' + btn('Preview request form', { sm: true, icon: 'eye', action: 'open-request-form' }) + '</div>';
      var cards = reqs.map(function (r) {
        var done = r.status !== 'new';
        return '<div class="req-card rise' + (done ? ' done' : '') + '"><div class="req-top"><div><div class="req-name">' + esc(r.name) + ' ' + pill(r.type, 'soft') + '</div><div class="req-svc">' + esc(r.service || '—') + '</div></div>' + statusPill(r.status === 'new' ? 'lead' : r.status === 'converted' ? 'won' : 'lost') + '</div>' +
          '<div class="req-meta"><span>' + icon('phone') + esc(r.phone) + '</span><span>' + icon('mail') + esc(r.email) + '</span><span>' + icon('pin') + esc(r.address || '—') + '</span><span>' + icon('clock') + esc(r.preferred) + '</span></div>' +
          (r.details ? '<div class="req-details">' + esc(r.details) + '</div>' : '') +
          '<div class="req-when mono muted">' + relDay(r.createdAt) + '</div>' +
          (done ? '' : '<div class="req-actions">' + btn('Convert to lead', { variant: 'brand', sm: true, icon: 'pipeline', action: 'convert-request', data: { id: r.id } }) + btn('Decline', { sm: true, action: 'decline-request', data: { id: r.id } }) + '</div>') + '</div>';
      }).join('');
      return toolbar + '<div class="req-grid">' + cards + '</div>';
    }
  };
  A['convert-request'] = function (el, d) {
    var r = Store.get('requests', d.id); if (!r) return;
    var c = Store.insert('contacts', { name: r.name, company: r.name, email: r.email || '—', phone: r.phone || '—', type: r.type, stage: 'lead', owner: 'u_ops', address: r.address, tags: ['inbound'], createdAt: Store.iso(Store.now), lastContact: Store.iso(Store.now) }, true);
    Store.insert('deals', { title: (r.service || 'New request') + ' — ' + r.name, contactId: c.id, value: 0, stage: 'lead', owner: 'u_ops', createdAt: Store.iso(Store.now), note: r.details || '', hot: true }, true);
    Store.update('requests', d.id, { status: 'converted' });
    Store.logActivity('lead', 'Request converted to lead — ' + r.name);
    if (App.sendComm) App.sendComm(c.id, 't_lead', {});
    App.toast(r.name + ' added as a lead + deal.'); App.go('pipeline');
  };
  A['decline-request'] = function (el, d) { Store.update('requests', d.id, { status: 'declined' }); App.refresh(); App.toast('Request declined.'); };

  /* =================================================================
     FIELD TIME TRACKING  (extend field job screen)
     ================================================================= */
  if (Field && Field.jobScreen) {
    var origJobScreen = Field.jobScreen;
    Field.jobScreen = function (id) {
      var html = origJobScreen(id);
      var j = Store.get('jobs', id); if (!j) return html;
      var open = Store.openTimesheet(id, App.session.userId);
      var total = Store.jobLaborMinutes(j);
      var clock = '<div class="fld-lbl rise">Time tracking</div><div class="clock-card rise">' +
        '<div class="clock-total"><span class="mono">' + hoursLabel(total) + '</span><small>logged on this job</small></div>' +
        (open
          ? '<button class="fld-big brand clock-btn" data-action="f-clock-out" data-id="' + id + '">' + icon('timer') + 'Clock out</button><div class="clock-running">' + icon('clock') + 'Running since ' + fmtTime((open.start || '').slice(11, 16)) + '</div>'
          : '<button class="fld-big clock-btn" data-action="f-clock-in" data-id="' + id + '">' + icon('play') + 'Clock in</button>') +
        '</div>';
      return html + clock;
    };
  }
  A['f-clock-in'] = function (el, d) {
    if (Store.openTimesheet(d.id, App.session.userId)) return;
    Store.insert('timesheets', { jobId: d.id, userId: App.session.userId, start: Store.nowISO(), end: null, minutes: 0 });
    App.toast('Clocked in.'); Field.go('job', d.id);
  };
  A['f-clock-out'] = function (el, d) {
    var ts = Store.openTimesheet(d.id, App.session.userId); if (!ts) return;
    var mins = Math.max(1, Math.round((Date.now() - new Date(ts.start).getTime()) / 60000));
    Store.update('timesheets', ts.id, { end: Store.nowISO(), minutes: mins });
    App.toast('Clocked out — ' + hoursLabel(mins) + ' logged.'); Field.go('job', d.id);
  };

  /* =================================================================
     OWNER JOB DRAWER — costing, expenses, reassign, timesheets
     (inject after the base drawer renders)
     ================================================================= */
  var origOpenRecord = App._openRecord;
  App._openRecord = function (type, id) {
    origOpenRecord(type, id);
    if (type === 'job') injectJobCosting(id);
    if (type === 'estimate' || type === 'invoice') injectPrintButton(type, id);
  };
  function injectJobCosting(id) {
    var j = Store.get('jobs', id); if (!j) return;
    var body = document.querySelector('#drawer .dr-body'); if (!body) return;
    var p = Store.jobProfit(j);
    var ts = Store.timesheetsForJob(id);
    var teamOpts = Store.all('team').map(function (m) { return '<option value="' + m.id + '"' + (m.id === j.assignedTo ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
    var expenses = (j.costs || []).map(function (c) { return '<div class="li-line"><span>' + esc(c.desc) + '</span><span></span><span class="mono">' + money(c.amount) + '</span></div>'; }).join('') || '<div class="muted" style="padding:8px 0;font-size:13px">No materials logged yet.</div>';
    var tsHtml = ts.length ? ts.map(function (t) { var m = Store.teamMember(t.userId); return '<div class="li-line"><span>' + esc(m ? m.name : '') + '</span><span class="muted">' + fmtDate((t.start || '').slice(0, 10)) + '</span><span class="mono">' + hoursLabel(t.minutes || 0) + '</span></div>'; }).join('') : '<div class="muted" style="padding:8px 0;font-size:13px">No time logged.</div>';
    var html = '<div class="dr-sec">Profitability</div>' +
      '<div class="profit-box"><div class="profit-row"><span>Revenue</span><span class="mono">' + money(p.revenue) + '</span></div>' +
      '<div class="profit-row"><span>Labor (' + hoursLabel(Store.jobLaborMinutes(j)) + ')</span><span class="mono">−' + money(p.labor) + '</span></div>' +
      '<div class="profit-row"><span>Materials</span><span class="mono">−' + money(p.material) + '</span></div>' +
      '<div class="profit-row grand"><span>Profit</span><span class="mono">' + money(p.profit) + '</span></div>' +
      '<div class="profit-margin"><div class="pm-bar"><div class="pm-fill" style="width:' + Math.max(0, Math.min(100, p.margin)) + '%"></div></div><span class="mono">' + p.margin + '% margin</span></div></div>' +
      '<div class="dr-sec">Materials / expenses' + '<button class="dr-add" data-action="add-expense" data-id="' + id + '">' + icon('plus') + 'Add</button></div><div class="li-block">' + expenses + '</div>' +
      '<div class="dr-sec">Time logged</div><div class="li-block">' + tsHtml + '</div>' +
      '<div class="dr-sec">Assigned tech</div><select class="inp" data-action="reassign-tech" data-id="' + id + '" onchange="">' + teamOpts + '</select>';
    body.insertAdjacentHTML('beforeend', html);
  }
  A['add-expense'] = function (el, d) {
    App.openModal('Add material / expense', '<div class="form-grid">' + field('Description', input('exp-desc', 'placeholder="e.g. Wire + breakers"')) + field('Amount ($)', input('exp-amt', 'type="number" placeholder="0"')) + '</div>',
      btn('Cancel', { action: 'close-modal' }) + btn('Add', { variant: 'brand', action: 'save-expense', data: { id: d.id } }));
  };
  A['save-expense'] = function (el, d) {
    var j = Store.get('jobs', d.id); var desc = document.getElementById('exp-desc').value.trim(); var amt = +document.getElementById('exp-amt').value || 0;
    if (!desc) { App.closeModal(); return; }
    (j.costs = j.costs || []).push({ id: Store.uid('co'), desc: desc, amount: amt }); Store.save();
    App.closeModal(); App.toast('Expense added.'); App._openRecord('job', d.id);
  };
  A['reassign-tech'] = function (el, d) { Store.update('jobs', d.id, { assignedTo: el.value }); App.toast('Reassigned to ' + Store.teamMember(el.value).name + '.'); };

  /* =================================================================
     BRANDED PDF / PRINT  (estimates + invoices)
     ================================================================= */
  function injectPrintButton(type, id) {
    var foot = document.querySelector('#drawer .dr-foot'); if (!foot) return;
    foot.insertAdjacentHTML('beforeend', btn('Download PDF', { icon: 'printer', action: 'print-doc', data: { type: type, id: id } }));
  }
  function docHTML(type, id) {
    var s = Store.state().settings;
    var rec = Store.get(type === 'estimate' ? 'estimates' : 'invoices', id); if (!rec) return '';
    var c = Store.get('contacts', rec.contactId);
    var items = rec.items || [];
    var t = Store.withTax(Store.lineTotal(items));
    var rows = items.map(function (it) { return '<tr><td>' + esc(it.desc) + '</td><td style="text-align:center">' + (it.qty || 1) + '</td><td style="text-align:right">' + money2(it.rate) + '</td><td style="text-align:right">' + money2((it.qty || 1) * it.rate) + '</td></tr>'; }).join('');
    var title = type === 'estimate' ? 'ESTIMATE' : 'INVOICE';
    var num = rec.number;
    var logo = s.branding.logo ? '<img src="' + s.branding.logo + '" style="width:54px;height:54px;border-radius:10px;object-fit:cover">' : '<div style="width:54px;height:54px;border-radius:10px;background:' + s.branding.primary + ';"></div>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + num + '</title><style>' +
      '*{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}body{margin:0;padding:40px;color:#0e1525}' +
      '.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ' + s.branding.primary + ';padding-bottom:20px}' +
      '.biz{display:flex;gap:12px;align-items:center}.biz h1{margin:0;font-size:20px}.biz .sub{color:#666;font-size:12px}' +
      '.doc h2{margin:0;font-size:30px;letter-spacing:1px;color:' + s.branding.primary + '}.doc .num{font-family:monospace;color:#333}' +
      '.meta{display:flex;justify-content:space-between;margin:24px 0}.meta .b{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.05em}' +
      'table{width:100%;border-collapse:collapse;margin-top:10px}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888;border-bottom:2px solid #eee;padding:10px 8px}' +
      'td{padding:11px 8px;border-bottom:1px solid #f0f0f0;font-size:14px}tfoot td{border:none;font-size:14px}tfoot .grand td{font-size:18px;font-weight:700;border-top:2px solid #eee}' +
      '.foot{margin-top:40px;padding-top:16px;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center}' +
      '@media print{body{padding:0}}</style></head><body>' +
      '<div class="top"><div class="biz">' + logo + '<div><h1>' + esc(s.business.name) + '</h1><div class="sub">' + esc(s.business.address) + '<br>' + esc(s.business.phone) + ' · ' + esc(s.business.email) + '</div></div></div>' +
      '<div class="doc" style="text-align:right"><h2>' + title + '</h2><div class="num">' + esc(num) + '</div></div></div>' +
      '<div class="meta"><div><div class="b">Bill to</div><div style="font-weight:600;margin-top:4px">' + esc(c ? c.name : '') + '</div><div style="color:#666;font-size:13px">' + esc(c ? c.address : '') + '</div></div>' +
      '<div style="text-align:right"><div class="b">' + (type === 'estimate' ? 'Valid until' : 'Due') + '</div><div style="margin-top:4px">' + fmtDateY(type === 'estimate' ? rec.validUntil : rec.dueAt) + '</div><div class="b" style="margin-top:8px">Terms</div><div style="margin-top:4px">' + esc(s.terms) + '</div></div></div>' +
      '<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3" style="text-align:right;color:#666">Subtotal</td><td style="text-align:right">' + money2(t.sub) + '</td></tr>' +
      '<tr><td colspan="3" style="text-align:right;color:#666">Tax (' + s.taxRate + '%)</td><td style="text-align:right">' + money2(t.tax) + '</td></tr>' +
      '<tr class="grand"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">' + money2(t.total) + '</td></tr></tfoot></table>' +
      '<div class="foot">' + esc(s.branding.emailFooter) + '</div></body></html>';
  }
  App._docHTML = docHTML;
  A['print-doc'] = function (el, d) {
    var html = docHTML(d.type, d.id); if (!html) return;
    var w = global.open('', '_blank');
    if (!w) { App.toast('Allow pop-ups to download the PDF.', 'info'); return; }
    w.document.write(html); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350);
  };

  /* =================================================================
     REPORTS+  (profitability + A/R aging appended)
     ================================================================= */
  if (V.reports && V.reports.render) {
    var origReports = V.reports.render;
    V.reports.render = function () {
      var base = origReports();
      var pj = Store.profitByJob().slice(0, 6);
      var maxP = Math.max.apply(null, pj.map(function (x) { return Math.abs(x.profit); })) || 1;
      var profitCard = card(sectionTitle('Job profitability', '<span class="mono muted">top jobs</span>') +
        (pj.length ? pj.map(function (x) {
          return '<div class="lb-row"><div class="lb-main"><div class="lb-top"><span>' + esc(x.title) + '</span><span class="mono">' + money(x.profit) + '</span></div><div class="lb-bar"><div class="lb-fill" style="width:' + Math.round(Math.abs(x.profit) / maxP * 100) + '%;background:' + (x.profit >= 0 ? 'var(--ok)' : 'var(--bad)') + '"></div></div><div class="lb-sub">' + esc(x.contact) + ' · ' + x.margin + '% margin · ' + money(x.revenue) + ' revenue</div></div></div>';
        }).join('') : '<div class="empty"><p>Complete a job to see profit.</p></div>'), 'rise');
      var ar = Store.arAging();
      var arTotal = ar.current + ar.d30 + ar.d60 + ar.d90 || 1;
      function arRow(label, val, color) { return '<div class="ar-row"><span class="ar-lbl">' + label + '</span><div class="ar-bar"><div class="ar-fill" style="width:' + Math.round(val / arTotal * 100) + '%;background:' + color + '"></div></div><span class="mono ar-amt">' + money(val) + '</span></div>'; }
      var arCard = card(sectionTitle('A/R aging', '<span class="mono muted">unpaid</span>') +
        arRow('Current', ar.current, '#10b981') + arRow('1–30 days', ar.d30, '#f59e0b') + arRow('31–60 days', ar.d60, '#ea580c') + arRow('60+ days', ar.d90, '#f43f5e'), 'rise');
      return base + '<div class="grid-2">' + profitCard + arCard + '</div>';
    };
  }

  /* =================================================================
     BACKUP / RESTORE  (injected into Settings)
     ================================================================= */
  V.settings.mount = function () {
    var cards = document.querySelectorAll('#view .card');
    var dataCard = cards[cards.length - 1];
    if (!dataCard) return;
    var row = document.createElement('div');
    row.className = 'backup-row';
    row.innerHTML = btn('Export backup', { sm: true, icon: 'download', action: 'export-data' }) + btn('Import backup', { sm: true, icon: 'upload', action: 'import-data' });
    dataCard.appendChild(row);
  };
  A['export-data'] = function () {
    try {
      var blob = new global.Blob([Store.exportData()], { type: 'application/json' });
      var url = global.URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'viper-os-backup.json'; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); global.URL.revokeObjectURL(url); }, 100);
      App.toast('Backup downloaded.');
    } catch (e) { App.toast('Export failed.', 'error'); }
  };
  A['import-data'] = function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.addEventListener('change', function () {
      var file = inp.files && inp.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        if (Store.importData(rd.result)) { App.toast('Backup restored.'); App.launch(); }
        else App.toast('That file could not be read.', 'error');
      };
      rd.readAsText(file);
    });
    inp.click();
  };

  /* =================================================================
     AUTOMATION RUNNER  (fire time-based rules once per load, owner only)
     ================================================================= */
  var origBoot = App.boot;
  App.boot = function () {
    origBoot();
    try {
      var fired = Store.runAutomations(function (cid, ev, ctx) { if (App.sendComm) App.sendComm(cid, ev, ctx); });
      if (fired && fired.length) setTimeout(function () { App.toast(fired.length + ' automation' + (fired.length > 1 ? 's' : '') + ' ran — see Outbox.', 'info'); }, 600);
    } catch (e) {}
  };

})(typeof window !== 'undefined' ? window : this);
